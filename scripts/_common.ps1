# Shared helpers for Janus install / remove / reinstall scripts.
# Dot-sourced only — do not run directly.

$ErrorActionPreference = 'Stop'

$script:JanusInstallRoot = 'C:\Program Files\Janus'
$script:JanusApiDir = Join-Path $script:JanusInstallRoot 'api'
$script:JanusWebuiDir = Join-Path $script:JanusInstallRoot 'webui'
$script:JanusBinDir = Join-Path $script:JanusInstallRoot 'bin'
$script:JanusConfigPath = Join-Path $script:JanusInstallRoot 'install-config.json'
$script:JanusDataRoot = Join-Path $env:ProgramData 'Janus'
$script:JanusApiService = 'janus'
$script:JanusWebuiService = 'janus-webui'
$script:DefaultApiPort = 7070
$script:DefaultWebuiPort = 7071
$script:JanusWinSwUrl = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
$script:JanusWinSwPath = Join-Path $script:JanusBinDir 'WinSW.exe'

function Get-JanusRepoRoot {
    Split-Path -Parent $PSScriptRoot
}

function Write-JanusUtf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Test-JanusAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Parse-JanusInstallArgs {
    param([string[]]$RawArgs)

    # Unbound ValueFromRemainingArguments is $null; @($null) is one empty token — ignore blanks.
    $RawArgs = @(
        if ($null -ne $RawArgs) {
            $RawArgs | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        }
    )

    $result = [ordered]@{
        ApiPort    = $null
        WebuiPort  = $null
        RemoveData = $false
    }

    $i = 0
    while ($i -lt $RawArgs.Count) {
        $tok = $RawArgs[$i].ToLowerInvariant()

        if ($tok -eq 'data' -and ($i + 2) -lt $RawArgs.Count -and $RawArgs[$i + 1].ToLowerInvariant() -eq 'remove') {
            $val = $RawArgs[$i + 2].ToLowerInvariant()
            $result.RemoveData = ($val -in @('yes', 'true', '1', 'y'))
            $i += 3
            continue
        }

        if ($tok -eq 'api' -and ($i + 3) -lt $RawArgs.Count -and
            $RawArgs[$i + 1].ToLowerInvariant() -eq 'port' -and
            $RawArgs[$i + 2].ToLowerInvariant() -eq 'set') {
            $result.ApiPort = [int]$RawArgs[$i + 3]
            $i += 4
            continue
        }

        if ($tok -eq 'webui' -and ($i + 3) -lt $RawArgs.Count -and
            $RawArgs[$i + 1].ToLowerInvariant() -eq 'port' -and
            $RawArgs[$i + 2].ToLowerInvariant() -eq 'set') {
            $result.WebuiPort = [int]$RawArgs[$i + 3]
            $i += 4
            continue
        }

        throw "Unknown argument '$($RawArgs[$i])'. Supported: data remove yes|no, api port set <n>, webui port set <n>"
    }

    return $result
}

function Read-JanusConfig {
    if (-not (Test-Path -LiteralPath $script:JanusConfigPath)) {
        return $null
    }
    return Get-Content -LiteralPath $script:JanusConfigPath -Raw | ConvertFrom-Json
}

function Write-JanusConfig {
    param(
        [int]$ApiPort,
        [int]$WebuiPort,
        [string]$UserHome = $env:USERPROFILE
    )

    $obj = [ordered]@{
        apiPort     = $ApiPort
        webuiPort   = $WebuiPort
        installRoot = $script:JanusInstallRoot
        # Captured at install time so the LocalSystem service can resolve ~/.cursor
        # to the installing user's profile instead of systemprofile.
        userHome    = $UserHome
        updatedAt   = (Get-Date).ToString('o')
    }
    $dir = Split-Path -Parent $script:JanusConfigPath
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Write-JanusUtf8NoBom -Path $script:JanusConfigPath -Content (($obj | ConvertTo-Json) + "`n")
}

function Resolve-JanusPorts {
    param(
        $Parsed,
        $Existing
    )

    $api = $script:DefaultApiPort
    $webui = $script:DefaultWebuiPort

    if ($Existing) {
        if ($Existing.apiPort) { $api = [int]$Existing.apiPort }
        if ($Existing.webuiPort) { $webui = [int]$Existing.webuiPort }
    }

    if ($null -ne $Parsed.ApiPort) { $api = [int]$Parsed.ApiPort }
    if ($null -ne $Parsed.WebuiPort) { $webui = [int]$Parsed.WebuiPort }

    return @{ ApiPort = $api; WebuiPort = $webui }
}

function Test-JanusInstalled {
    return (Test-Path -LiteralPath $script:JanusInstallRoot) -and
        (Test-Path -LiteralPath (Join-Path $script:JanusApiDir 'package.json'))
}

function Get-JanusNodePath {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) { return $c }
    }
    throw 'Node.js was not found. Install Node.js 20+ and ensure node is on PATH.'
}

function Invoke-JanusSc {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ScArgs)
    & sc.exe @ScArgs | Out-Null
    return $LASTEXITCODE
}

function Clear-JanusNativeExitCode {
    # sc.exe query/delete of a missing service leaves LASTEXITCODE=1060 and would
    # poison remove.ps1 / reinstall.ps1 process exit even when the script succeeded.
    $global:LASTEXITCODE = 0
}

function Get-JanusWinSwExePath {
    param([string]$Name)
    return Join-Path $script:JanusBinDir "$Name.exe"
}

function Get-JanusWinSwXmlPath {
    param([string]$Name)
    return Join-Path $script:JanusBinDir "$Name.xml"
}

function Ensure-JanusWinSw {
    if (-not (Test-Path -LiteralPath $script:JanusBinDir)) {
        New-Item -ItemType Directory -Path $script:JanusBinDir -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $script:JanusWinSwPath)) {
        Write-Host "Downloading WinSW to $script:JanusWinSwPath ..."
        Invoke-WebRequest -Uri $script:JanusWinSwUrl -OutFile $script:JanusWinSwPath -UseBasicParsing
    }
    if (-not (Test-Path -LiteralPath $script:JanusWinSwPath)) {
        throw "WinSW download failed: $script:JanusWinSwPath missing"
    }
    return $script:JanusWinSwPath
}

function Test-JanusServiceExists {
    param([string]$Name)
    $out = & sc.exe query $Name 2>&1 | Out-String
    $exists = ($LASTEXITCODE -eq 0) -and ($out -match 'SERVICE_NAME')
    if (-not $exists) {
        Clear-JanusNativeExitCode
    }
    return $exists
}

function Stop-JanusServiceSafe {
    param([string]$Name)
    $winsw = Get-JanusWinSwExePath -Name $Name
    if (Test-Path -LiteralPath $winsw) {
        Write-Host "Stopping service '$Name' (WinSW)..."
        & $winsw stop 2>&1 | Out-Null
        Clear-JanusNativeExitCode
        Start-Sleep -Seconds 2
        return
    }
    if (-not (Test-JanusServiceExists -Name $Name)) { return }
    Write-Host "Stopping service '$Name'..."
    & sc.exe stop $Name | Out-Null
    Clear-JanusNativeExitCode
    Start-Sleep -Seconds 2
}

function Remove-JanusServiceSafe {
    param([string]$Name)
    $winsw = Get-JanusWinSwExePath -Name $Name
    if (Test-Path -LiteralPath $winsw) {
        Write-Host "Removing service '$Name' (WinSW)..."
        & $winsw stop 2>&1 | Out-Null
        & $winsw uninstall 2>&1 | Out-Null
        Clear-JanusNativeExitCode
        Start-Sleep -Seconds 1
    }
    elseif (Test-JanusServiceExists -Name $Name) {
        Stop-JanusServiceSafe -Name $Name
        Write-Host "Removing service '$Name'..."
        & sc.exe delete $Name | Out-Null
        Clear-JanusNativeExitCode
        Start-Sleep -Seconds 1
    }

    foreach ($path in @(
            (Get-JanusWinSwExePath -Name $Name),
            (Get-JanusWinSwXmlPath -Name $Name)
        )) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-JanusServiceSafe {
    param([string]$Name)
    Write-Host "Starting service '$Name'..."
    $winsw = Get-JanusWinSwExePath -Name $Name
    if (Test-Path -LiteralPath $winsw) {
        $out = & $winsw start 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw "WinSW start '$Name' failed (exit $LASTEXITCODE):`n$out"
        }
        return
    }
    $code = Invoke-JanusSc start $Name
    if ($code -ne 0) {
        throw "Failed to start service '$Name' (sc exit $code). Run elevated and check Event Viewer."
    }
}

function Register-JanusService {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$Executable,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$Description
    )

    # Plain node.exe is not SCM-aware (error 1053). WinSW wraps it as a real service.
    $template = Ensure-JanusWinSw
    $winswExe = Get-JanusWinSwExePath -Name $Name
    $winswXml = Get-JanusWinSwXmlPath -Name $Name

    Copy-Item -LiteralPath $template -Destination $winswExe -Force

    $xml = @"
<service>
  <id>$Name</id>
  <name>$DisplayName</name>
  <description>$Description</description>
  <executable>$Executable</executable>
  <arguments>$Arguments</arguments>
  <workingdirectory>$WorkingDirectory</workingdirectory>
  <logmode>rotate</logmode>
  <logpath>$($script:JanusBinDir)</logpath>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <resetfailure>1 hour</resetfailure>
</service>
"@
    Write-JanusUtf8NoBom -Path $winswXml -Content $xml

    if (Test-JanusServiceExists -Name $Name) {
        Stop-JanusServiceSafe -Name $Name
        $out = & $winswExe uninstall 2>&1 | Out-String
        Clear-JanusNativeExitCode
        Start-Sleep -Seconds 1
    }

    $installOut = & $winswExe install 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "WinSW install '$Name' failed (exit $LASTEXITCODE):`n$installOut"
    }
    Clear-JanusNativeExitCode
}

function Backup-JanusUserFiles {
    param([string]$ApiDir)

    $backup = Join-Path $env:TEMP ("janus-preserve-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null

    $names = @('settings.json', 'imported-projects.json', '.trash')
    foreach ($name in $names) {
        $src = Join-Path $ApiDir $name
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $backup $name) -Recurse -Force
        }
    }
    return $backup
}

function Restore-JanusUserFiles {
    param(
        [string]$ApiDir,
        [string]$BackupDir
    )

    if (-not $BackupDir -or -not (Test-Path -LiteralPath $BackupDir)) { return }

    foreach ($item in Get-ChildItem -LiteralPath $BackupDir -Force) {
        $dest = Join-Path $ApiDir $item.Name
        if (Test-Path -LiteralPath $dest) {
            Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
        }
        Copy-Item -LiteralPath $item.FullName -Destination $dest -Recurse -Force
    }
    Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Copy-JanusTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Source not found: $Source"
    }
    if (-not (Test-Path -LiteralPath $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }

    # /E copy subdirs; no /MIR so existing user files not in source are kept until we restore explicitly.
    # Exclude node_modules / .git / dist — reinstall deps and rebuild at destination.
    & robocopy.exe $Source $Destination /E /NFL /NDL /NJH /NJS /nc /ns /np `
        /XD node_modules .git dist .armin .cursor `
        /XF settings.json imported-projects.json | Out-Null
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        throw "robocopy failed from '$Source' to '$Destination' (exit $code)"
    }
}

function Set-JanusCorsOrigins {
    param(
        [string]$ServerTsPath,
        [int]$WebuiPort
    )

    if (-not (Test-Path -LiteralPath $ServerTsPath)) {
        throw "server.ts not found at $ServerTsPath"
    }

    $content = Get-Content -LiteralPath $ServerTsPath -Raw
    $replacement = "origin: ['http://127.0.0.1:$WebuiPort', 'http://localhost:$WebuiPort', 'http://127.0.0.1:8006', 'http://localhost:8006']"
    $updated = [regex]::Replace($content, 'origin:\s*\[[^\]]*\]', $replacement)
    if ($updated -eq $content) {
        Write-Warning 'CORS origin block was not patched (pattern not found). WebUI may be blocked by CORS.'
    }
    Set-Content -LiteralPath $ServerTsPath -Value $updated -Encoding UTF8
}

function Write-JanusLaunchers {
    param(
        [string]$NodePath
    )

    if (-not (Test-Path -LiteralPath $script:JanusBinDir)) {
        New-Item -ItemType Directory -Path $script:JanusBinDir -Force | Out-Null
    }

    $startApi = @'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(readFileSync(join(root, 'install-config.json'), 'utf8').replace(/^\uFEFF/, ''))
const apiRoot = join(root, 'api')
process.env.JANUS_APP_ROOT = apiRoot
process.env.JANUS_API_BIND = `127.0.0.1:${cfg.apiPort}`
if (cfg.userHome) process.env.JANUS_USER_HOME = String(cfg.userHome)
const tsxCli = join(apiRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const cliTs = join(apiRoot, 'src', 'cli.ts')
const child = spawn(process.execPath, [tsxCli, cliTs, 'run'], {
  stdio: 'inherit',
  windowsHide: true,
  cwd: apiRoot,
  env: process.env
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
'@

    $startWebui = @'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(readFileSync(join(root, 'install-config.json'), 'utf8').replace(/^\uFEFF/, ''))
const webuiRoot = join(root, 'webui')
const viteBin = join(webuiRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const child = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(cfg.webuiPort)],
  {
    stdio: 'inherit',
    windowsHide: true,
    cwd: webuiRoot,
    env: process.env
  }
)
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
'@

    Write-JanusUtf8NoBom -Path (Join-Path $script:JanusBinDir 'start-api.mjs') -Content $startApi
    Write-JanusUtf8NoBom -Path (Join-Path $script:JanusBinDir 'start-webui.mjs') -Content $startWebui
}

function Invoke-JanusNpm {
    param(
        [string]$WorkingDirectory,
        [string[]]$NpmArgs
    )

    Push-Location $WorkingDirectory
    try {
        & npm.cmd @NpmArgs
        if ($LASTEXITCODE -ne 0) {
            throw "npm $($NpmArgs -join ' ') failed in $WorkingDirectory (exit $LASTEXITCODE)"
        }
    }
    finally {
        Pop-Location
    }
}

function Remove-JanusAppCompletely {
    Write-Host 'Removing Janus services...'
    Remove-JanusServiceSafe -Name $script:JanusWebuiService
    Remove-JanusServiceSafe -Name $script:JanusApiService

    # Also clear the in-repo janus service if it points at a non-Program-Files path.
    if (Test-JanusServiceExists -Name $script:JanusApiService) {
        Remove-JanusServiceSafe -Name $script:JanusApiService
    }

    if (Test-Path -LiteralPath $script:JanusInstallRoot) {
        Write-Host "Removing install directory: $script:JanusInstallRoot"
        Remove-Item -LiteralPath $script:JanusInstallRoot -Recurse -Force
    }

    if (Test-Path -LiteralPath $script:JanusDataRoot) {
        Write-Host "Removing data directory: $script:JanusDataRoot"
        Remove-Item -LiteralPath $script:JanusDataRoot -Recurse -Force
    }

    Clear-JanusNativeExitCode
    Write-Host 'Janus removed completely (app + data).'
}

function Start-JanusApp {
    param(
        [int]$ApiPort,
        [int]$WebuiPort
    )

    Start-JanusServiceSafe -Name $script:JanusApiService
    Start-Sleep -Seconds 2
    Start-JanusServiceSafe -Name $script:JanusWebuiService
    Start-Sleep -Seconds 1

    $url = "http://127.0.0.1:$WebuiPort"
    Write-Host "Janus API:   http://127.0.0.1:$ApiPort"
    Write-Host "Janus WebUI: $url"
    try {
        Start-Process $url | Out-Null
    }
    catch {
        Write-Warning "Could not open browser: $($_.Exception.Message)"
    }
}
