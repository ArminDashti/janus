#Requires -Version 5.1
<#
.SYNOPSIS
  Build Janus.exe: bundles scripts\janus-cli.ts into a Node single-executable (SEA)
  with the built WebUI embedded as assets.

.OUTPUTS
  Janus.exe at -OutExe (default: %TEMP%\janus-build\Janus.exe via Get-JanusStagedExePath).

.EXAMPLE
  .\build-janus-exe.ps1
  .\build-janus-exe.ps1 -OutExe C:\build\Janus.exe
#>
param(
    [string]$OutExe
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

if (-not $OutExe) { $OutExe = Get-JanusStagedExePath }

$repoRoot = Get-JanusRepoRoot
$apiDir = Join-Path $repoRoot 'janus-api'
$webuiDir = Join-Path $repoRoot 'janus-webui'
if (-not (Test-Path -LiteralPath (Join-Path $apiDir 'package.json'))) { throw "janus-api not found at $apiDir" }
if (-not (Test-Path -LiteralPath (Join-Path $webuiDir 'package.json'))) { throw "janus-webui not found at $webuiDir" }

$nodeExe = Get-JanusNodePath
$buildDir = Split-Path -Parent $OutExe
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

# --- 1. Dependencies (installed once) ---------------------------------------
foreach ($d in @($apiDir, $webuiDir)) {
    if (-not (Test-Path -LiteralPath (Join-Path $d 'node_modules'))) {
        Write-Host "Installing dependencies in $d ..."
        Invoke-JanusNpm -WorkingDirectory $d -NpmArgs @('install')
    }
}

# --- 2. Typecheck scripts\ (janus-api has pre-existing type errors -> report, don't fail) ---
Write-Host 'Typechecking scripts ...'
$tsc = Join-Path $apiDir 'node_modules\.bin\tsc.cmd'
if (-not (Test-Path -LiteralPath $tsc)) { throw "tsc not found at $tsc (run npm install in janus-api)" }
# Capture stdout only: redirecting native stderr (2>&1) with $ErrorActionPreference='Stop'
# turns any stderr line (e.g. node warnings) into a terminating NativeCommandError in PS 5.1.
$scriptsDir = Join-Path $repoRoot 'scripts'
$tscOut = (& $tsc -p $scriptsDir | Out-String)
$lines = @($tscOut -split "`r?`n" | Where-Object { $_ -match 'error TS' })
$ourErrors = @($lines | Where-Object { $_ -match 'janus-cli\.ts' })
$preexisting = @($lines | Where-Object { $_ -notmatch 'janus-cli\.ts' })
if ($ourErrors.Count -gt 0) {
    throw "Typecheck failed in scripts:`n$($ourErrors -join "`n")"
}
if ($preexisting.Count -gt 0) {
    Write-Warning ("pre-existing janus-api type errors (not introduced by scripts, tolerated):`n" + ($preexisting -join "`n"))
}

# --- 3. WebUI build with an EMPTY API base -> same-origin bundle -------------
# PowerShell cannot export a PRESENT-but-empty env var (`$env:X = ''` deletes it, and so does
# cmd's `set X=`), which would leave the hardcoded API fallback in the bundle. build-webui.mjs
# injects VITE_API_BASE_URL='' from node instead; the guard below verifies the result.
Write-Host 'Building WebUI (VITE_API_BASE_URL= -> same-origin)...'
& $nodeExe (Join-Path $scriptsDir 'build-webui.mjs')
if ($LASTEXITCODE -ne 0) { throw "webui build failed (exit $LASTEXITCODE)" }

$distDir = Join-Path $webuiDir 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $distDir 'index.html'))) {
    throw "WebUI build produced no index.html under $distDir"
}
# getApiBase() is `import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8005'`.
# With an empty base the minifier must fold the fallback away (the surviving
# `janus-api.local:8005` hostname branch is unrelated and harmless).
$leaked = @(Get-ChildItem -LiteralPath $distDir -Recurse -Filter *.js |
    Where-Object { [IO.File]::ReadAllText($_.FullName) -match 'http://127\.0\.0\.1:8005' })
if ($leaked.Count -gt 0) {
    throw "Same-origin guard: built WebUI still contains the absolute API fallback (VITE_API_BASE_URL not applied): $($leaked.Name -join ', ')"
}
Write-Host 'WebUI same-origin guard passed (no hardcoded API base).'

# --- 4. Bundle the CLI (esbuild) --------------------------------------------
Write-Host 'Bundling scripts\janus-cli.ts (esbuild)...'
$esbuild = Join-Path $apiDir 'node_modules\.bin\esbuild.cmd'
if (-not (Test-Path -LiteralPath $esbuild)) { throw "esbuild not found at $esbuild (run npm install in janus-api)" }
$bundle = Join-Path $buildDir 'janus-cli.cjs'
& $esbuild (Join-Path $scriptsDir 'janus-cli.ts') --bundle --platform=node --format=cjs --target=node20 "--outfile=$bundle" --log-level=warning
if ($LASTEXITCODE -ne 0) { throw "esbuild failed (exit $LASTEXITCODE)" }
# esbuild warns that import.meta is empty in cjs output (app-paths packageRoot): that fallback
# is unreachable because janus-cli.ts always sets JANUS_APP_ROOT before any path resolution.
Write-Host "Bundle: $bundle ($([math]::Round((Get-Item -LiteralPath $bundle).Length / 1KB)) KB)"

# --- 5. SEA preparation: blob with the CLI + every WebUI file as an asset ----
Write-Host 'Preparing SEA blob (embedding WebUI assets)...'
$assets = [ordered]@{}
Get-ChildItem -LiteralPath $distDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($distDir.Length) -replace '^[\\/]+', '' -replace '\\', '/'
    $assets["webui/$rel"] = $_.FullName
}
if ($assets.Count -eq 0) { throw "No WebUI assets found under $distDir" }
Write-Host "Embedding $($assets.Count) WebUI files."

$blob = Join-Path $buildDir 'sea-prep.blob'
$seaCfgPath = Join-Path $buildDir 'sea-config.json'
$seaCfg = [ordered]@{
    main                          = $bundle
    output                        = $blob
    disableExperimentalSEAWarning = $true
    useCodeCache                  = $false
    useSnapshot                   = $false
    assets                        = $assets
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($seaCfgPath, ($seaCfg | ConvertTo-Json -Depth 6), $utf8NoBom)
& $nodeExe --experimental-sea-config "$seaCfgPath"
if ($LASTEXITCODE -ne 0) { throw "sea-config generation failed (exit $LASTEXITCODE)" }

# --- 6. Copy node.exe -> Janus.exe and inject the blob -----------------------
Write-Host "Creating $OutExe ..."
Copy-Item -LiteralPath $nodeExe -Destination $OutExe -Force

if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'npx.cmd not found - install Node.js 20+ (npm 8+) and retry.'
}
Write-Host 'Injecting SEA blob (postject)...'
# stdout captured, stderr passes through live (see the 2>&1 note above).
$postjectOut = (& npx.cmd --yes postject@1.0.0-alpha.6 "$OutExe" NODE_SEA_BLOB "$blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 | Out-String)
if ($LASTEXITCODE -ne 0) { throw "postject injection failed (exit $LASTEXITCODE):`n$postjectOut" }
# postject prints a benign 'signature seems corrupted' warning for a locally copied node.exe.

$sizeMb = [math]::Round((Get-Item -LiteralPath $OutExe).Length / 1MB, 1)
Write-Host "Built $OutExe ($sizeMb MB)"
Write-Output $OutExe
