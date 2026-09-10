#Requires -Version 5.1
<#
.SYNOPSIS
  Remove Janus completely, then install fresh, then start it.

.DESCRIPTION
  1) remove.ps1 (app + data)
  2) install.ps1 (passes through port / data args)
  3) services are started by install.ps1

.EXAMPLE
  .\reinstall.ps1
  .\reinstall.ps1 api port set 7070 webui port set 7071
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

Write-Host '=== reinstall: remove ==='
& "$PSScriptRoot\remove.ps1"
$removeExit = $LASTEXITCODE
if ($null -eq $removeExit) { $removeExit = 0 }
if ($removeExit -ne 0) {
    throw "remove.ps1 failed with exit code $removeExit"
}

Write-Host '=== reinstall: install ==='
# Fresh install after wipe; force data remove no (already wiped).
$installArgs = @('data', 'remove', 'no')
if ($CommandArgs) { $installArgs += @($CommandArgs) }
& "$PSScriptRoot\install.ps1" @installArgs
$installExit = $LASTEXITCODE
if ($null -eq $installExit) { $installExit = 0 }
if ($installExit -ne 0) {
    throw "install.ps1 failed with exit code $installExit"
}

Write-Host '=== reinstall: done (app installed and running) ==='
exit 0
