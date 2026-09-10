#Requires -Version 5.1
<#
.SYNOPSIS
  Install or update Janus under C:\Program Files\Janus.

.DESCRIPTION
  - First install: copies API + WebUI, installs deps, builds WebUI, registers Windows services, starts them.
  - Already installed: updates app files in place and does NOT remove user data (default).
  - Data lives under %ProgramData%\Janus and is preserved unless you pass: data remove yes

.EXAMPLE
  .\install.ps1
  .\install.ps1 data remove no
  .\install.ps1 api port set 7070
  .\install.ps1 webui port set 7071
  .\install.ps1 api port set 7070 webui port set 7071 data remove no
#>

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

function Ensure-Admin {
    if (Test-JanusAdmin) { return }
    Write-Host 'Elevation required. Relaunching as Administrator...'
    $argList = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath
    )
    if ($CommandArgs) { $argList += @($CommandArgs) }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList | Out-Null
    exit 0
}

Ensure-Admin

$parsed = Parse-JanusInstallArgs -RawArgs $CommandArgs
$existing = Read-JanusConfig
$ports = Resolve-JanusPorts -Parsed $parsed -Existing $existing
$apiPort = [int]$ports.ApiPort
$webuiPort = [int]$ports.WebuiPort
$alreadyInstalled = Test-JanusInstalled

Write-Host "Janus install root: $script:JanusInstallRoot"
Write-Host "API port: $apiPort | WebUI port: $webuiPort"
Write-Host "Remove data: $(if ($parsed.RemoveData) { 'yes' } else { 'no' })"
Write-Host "Mode: $(if ($alreadyInstalled) { 'update (preserve data unless remove yes)' } else { 'fresh install' })"

if ($parsed.RemoveData) {
    Write-Host 'data remove yes — wiping ProgramData Janus data before install...'
    if (Test-Path -LiteralPath $script:JanusDataRoot) {
        Remove-Item -LiteralPath $script:JanusDataRoot -Recurse -Force
    }
}

$nodePath = Get-JanusNodePath
$repoRoot = Get-JanusRepoRoot
$apiSrc = Join-Path $repoRoot 'janus-api'
$webuiSrc = Join-Path $repoRoot 'janus-webui'

if (-not (Test-Path -LiteralPath (Join-Path $apiSrc 'package.json'))) {
    throw "janus-api not found at $apiSrc"
}
if (-not (Test-Path -LiteralPath (Join-Path $webuiSrc 'package.json'))) {
    throw "janus-webui not found at $webuiSrc"
}

# Stop running services before replacing files
Stop-JanusServiceSafe -Name $script:JanusWebuiService
Stop-JanusServiceSafe -Name $script:JanusApiService

$backup = $null
if ($alreadyInstalled -and -not $parsed.RemoveData) {
    $backup = Backup-JanusUserFiles -ApiDir $script:JanusApiDir
}

New-Item -ItemType Directory -Path $script:JanusInstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $script:JanusApiDir -Force | Out-Null
New-Item -ItemType Directory -Path $script:JanusWebuiDir -Force | Out-Null

Write-Host 'Copying API...'
Copy-JanusTree -Source $apiSrc -Destination $script:JanusApiDir
Write-Host 'Copying WebUI...'
Copy-JanusTree -Source $webuiSrc -Destination $script:JanusWebuiDir

if ($backup) {
    Restore-JanusUserFiles -ApiDir $script:JanusApiDir -BackupDir $backup
}

Write-Host 'Installing API dependencies (includes tsx for the Windows service)...'
Invoke-JanusNpm -WorkingDirectory $script:JanusApiDir -NpmArgs @('install')

Write-Host 'Installing WebUI dependencies...'
Invoke-JanusNpm -WorkingDirectory $script:JanusWebuiDir -NpmArgs @('install')

Write-Host "Building WebUI (VITE_API_BASE_URL=http://127.0.0.1:$apiPort)..."
$env:VITE_API_BASE_URL = "http://127.0.0.1:$apiPort"
try {
    Invoke-JanusNpm -WorkingDirectory $script:JanusWebuiDir -NpmArgs @('run', 'build')
}
finally {
    Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
}

Set-JanusCorsOrigins -ServerTsPath (Join-Path $script:JanusApiDir 'src\server.ts') -WebuiPort $webuiPort
Write-JanusConfig -ApiPort $apiPort -WebuiPort $webuiPort
Write-JanusLaunchers -NodePath $nodePath

$apiMjs = Join-Path $script:JanusBinDir 'start-api.mjs'
$webuiMjs = Join-Path $script:JanusBinDir 'start-webui.mjs'

Register-JanusService -Name $script:JanusApiService -DisplayName 'Janus API' `
    -Executable $nodePath -Arguments "`"$apiMjs`"" -WorkingDirectory $script:JanusApiDir `
    -Description 'Janus local HTTP API for janus-webui'
Register-JanusService -Name $script:JanusWebuiService -DisplayName 'Janus WebUI' `
    -Executable $nodePath -Arguments "`"$webuiMjs`"" -WorkingDirectory $script:JanusWebuiDir `
    -Description 'Janus WebUI preview server'

Start-JanusApp -ApiPort $apiPort -WebuiPort $webuiPort

if ($alreadyInstalled) {
    Write-Host 'Janus updated successfully (user data preserved unless data remove yes).'
}
else {
    Write-Host 'Janus installed successfully.'
}
exit 0
