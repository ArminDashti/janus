#Requires -Version 5.1
<#
.SYNOPSIS
  Remove Janus completely, including all data.

.DESCRIPTION
  Stops and deletes Windows services, deletes C:\Program Files\Janus,
  and deletes %ProgramData%\Janus.
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
Remove-JanusAppCompletely
# Ensure a successful remove does not inherit a native sc.exe miss code (1060).
exit 0
