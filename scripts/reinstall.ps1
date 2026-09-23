#Requires -Version 5.1
<#
.SYNOPSIS
  Remove Janus completely (local + legacy), then install it fresh and start it.

.DESCRIPTION
  1) remove-local.ps1 (local install, PATH entry, and the legacy install when present)
  2) install-local.ps1 (fresh build + install; the service is started by install-local.ps1)

.EXAMPLE
  .\reinstall.ps1
#>
param()

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

# Elevate ONCE here so remove-local.ps1 runs inline: it would otherwise spawn its own elevated
# child and return before the removal finished, racing the install below.
$needsElevation = (Test-JanusServiceExists -Name $script:JanusApiService) -or
    (Test-JanusServiceExists -Name $script:JanusWebuiService) -or
    (Test-Path -LiteralPath $script:JanusInstallRoot)
if ($needsElevation -and -not (Test-JanusAdmin)) {
    Write-Host 'Legacy install detected. Relaunching elevated (UAC prompt)...'
    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath) | Out-Null
        exit 0
    }
    catch {
        Write-Warning "Elevation cancelled - nothing was changed: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host '=== reinstall: remove ==='
& "$PSScriptRoot\remove-local.ps1"
$removeExit = $LASTEXITCODE
if ($null -eq $removeExit) { $removeExit = 0 }
if ($removeExit -ne 0) {
    throw "remove-local.ps1 failed with exit code $removeExit"
}

Write-Host '=== reinstall: install ==='
& "$PSScriptRoot\install-local.ps1"
$installExit = $LASTEXITCODE
if ($null -eq $installExit) { $installExit = 0 }
if ($installExit -ne 0) {
    throw "install-local.ps1 failed with exit code $installExit"
}

Write-Host '=== reinstall: done (fresh local install, service started) ==='
exit 0
