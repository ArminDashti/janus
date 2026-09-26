#Requires -Version 5.1
<#
.SYNOPSIS
  Lifecycle test for the win-x64 scripts: build -> install -> update -> remove
  (-> restore), with colored PASS/FAIL assertions after every step.

.DESCRIPTION
  Verifies exe/settings/Data.db presence, user PATH membership (exactly once),
  hosts mappings, settings.json preservation across update, and full cleanup
  after remove. Exits 0 only when every assertion passes.

  May show UAC prompts when --local-address is used (installer/remove elevate
  themselves for the hosts edit). If Janus is already installed, it is removed
  by the test and re-installed afterwards; user files (settings.json, logs) are
  snapshotted first and put back afterwards.

.EXAMPLE
  .\test-win-x64.ps1
  .\test-win-x64.ps1 --local-address=janus-test.local
#>
param(
    [string]$LocalAddress,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\_common.ps1"

# PowerShell never binds --local-address forms to a param - they land in the remaining args.
for ($i = 0; $i -lt $Rest.Count; $i++) {
    $tok = [string]$Rest[$i]
    if ($tok -match '^--local-address=(.+)$') { $LocalAddress = $Matches[1] }
    elseif ($tok -eq '--local-address' -and ($i + 1) -lt $Rest.Count) { $LocalAddress = [string]$Rest[$i + 1]; $i++ }
}

$script:Passed = 0
$script:Failed = 0

function Section([string]$Title) {
    Write-Host ''
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Assert {
    param([bool]$Condition, [string]$Message)
    if ($Condition) {
        $script:Passed++
        Write-Host "  [PASS] $Message" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "  [FAIL] $Message" -ForegroundColor Red
    }
}

# Runs one lifecycle step in its own scriptblock scope: named parameters are
# invoked directly (array splatting passes elements positionally in PS 5.1),
# and stdout is swallowed so the pipeline output cannot corrupt the exit code.
# Write-Host output still shows (host stream, not pipeline).
function Invoke-LifecycleStep {
    param([string]$Name, [scriptblock]$Body)
    try {
        & $Body | Out-Null
        return [int]$LASTEXITCODE
    }
    catch {
        Write-Host "  [FAIL] ${Name}: $($_.Exception.Message)" -ForegroundColor Red
        return -1
    }
}

function Get-UserPathHits {
    param([string]$Dir)
    $norm = $Dir.TrimEnd('\')
    $u = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $u) { return 0 }
    return @($u -split ';' | Where-Object { $_ -and $_.Trim().TrimEnd('\') -ieq $norm }).Count
}

function Get-HostsNameLineCount {
    param([string]$Path, [string]$Name)
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    $n = 0
    foreach ($line in ([IO.File]::ReadAllText($Path) -split "`r?`n")) {
        $tok = (((($line -split '#')[0]) -replace '\s+', ' ').Trim()) -split ' '
        if ($tok.Count -ge 2 -and $tok[0] -eq '127.0.0.1' -and $tok[1] -ieq $Name) { $n++ }
    }
    return $n
}

function Get-HostsMarkerCount {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    return @(([IO.File]::ReadAllText($Path) -split "`r?`n") | Where-Object { $_ -match '#\s*janus-local\s*$' }).Count
}

$root = Get-JanusLocalRoot
$exe = Join-Path $root 'Janus.exe'
$settings = Join-Path $root 'settings.json'
$dataDb = Join-Path $root 'Data.db'
$staged = Get-JanusStagedExePath
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'

$buildStep = { & "$PSScriptRoot\build-janus-exe.ps1" -OutExe $staged | Out-Null }
$installStep = {
    if ($LocalAddress) { & "$PSScriptRoot\installer-win-x64.ps1" -LocalAddress $LocalAddress | Out-Null }
    else { & "$PSScriptRoot\installer-win-x64.ps1" | Out-Null }
}
$removeStep = {
    if ($LocalAddress) { & "$PSScriptRoot\Remove-win-x64.ps1" -LocalAddress $LocalAddress | Out-Null }
    else { & "$PSScriptRoot\Remove-win-x64.ps1" | Out-Null }
}

$preexisting = Test-Path -LiteralPath $exe
$wasRunning = $preexisting -and (@(Get-JanusLocalInstances).Count -gt 0)
if ($preexisting) {
    Write-Host "Existing Janus install detected at $root - the test removes it and re-installs afterwards." -ForegroundColor Yellow
}
if ($LocalAddress) { $hostBaseline = Get-HostsNameLineCount -Path $hostsPath -Name $LocalAddress }

# --- 1. BUILD -----------------------------------------------------------------
Section 'BUILD'
$code = Invoke-LifecycleStep -Name 'build-janus-exe.ps1' -Body $buildStep
Assert ($code -eq 0) "build-janus-exe.ps1 exited 0 (got $code)"
Assert (Test-Path -LiteralPath $staged) "staged exe exists: $staged"

if ($script:Failed -gt 0) {
    Section 'SUMMARY'
    Write-Host "Build failed - skipping install/update/remove. Passed: $script:Passed  Failed: $script:Failed" -ForegroundColor Red
    exit 1
}

# --- 2. INSTALL ---------------------------------------------------------------
Section 'INSTALL'
$failedBeforeInstall = $script:Failed
$code = Invoke-LifecycleStep -Name 'installer-win-x64.ps1' -Body $installStep
Assert ($code -eq 0) "installer-win-x64.ps1 exited 0 (got $code)"
Assert (Test-Path -LiteralPath $exe) 'Janus.exe present'
Assert (Test-Path -LiteralPath $settings) 'settings.json present'
Assert (Test-Path -LiteralPath $dataDb) 'Data.db present'
$settingsHash = if (Test-Path -LiteralPath $settings) { (Get-FileHash -LiteralPath $settings).Hash } else { '' }
Assert ($settingsHash -ne '') 'settings.json present and hashable'
Assert ((Get-UserPathHits -Dir $root) -eq 1) 'user PATH contains install dir exactly once'
if ($LocalAddress) {
    Assert ((Get-HostsNameLineCount -Path $hostsPath -Name $LocalAddress) -ge 1) "hosts maps $LocalAddress -> 127.0.0.1"
}

# Never remove when the install step failed: with a pre-existing install the
# remove would succeed but the restore (same failing installer) could not run.
if ($script:Failed -gt $failedBeforeInstall) {
    Section 'SUMMARY'
    Write-Host "Install failed - skipping update/remove/restore (existing state left untouched). Passed: $script:Passed  Failed: $script:Failed" -ForegroundColor Red
    exit 1
}

# --- 3. UPDATE (re-run installer) --------------------------------------------
Section 'UPDATE'
$mtime = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
$code = Invoke-LifecycleStep -Name 'installer-win-x64.ps1 (update)' -Body $installStep
Assert ($code -eq 0) "re-run installer exited 0 (got $code)"
Assert (Test-Path -LiteralPath $exe) 'Janus.exe present after update'
Assert ((Get-Item -LiteralPath $exe).LastWriteTimeUtc -ge $mtime) 'exe replaced by the new build'
Assert ((Get-UserPathHits -Dir $root) -eq 1) 'user PATH still has exactly one entry (no duplicates)'
$settingsHash2 = if (Test-Path -LiteralPath $settings) { (Get-FileHash -LiteralPath $settings).Hash } else { '' }
Assert ($settingsHash2 -ne '' -and $settingsHash2 -eq $settingsHash) 'settings.json preserved across update'
if ($LocalAddress) {
    Assert ((Get-HostsNameLineCount -Path $hostsPath -Name $LocalAddress) -ge 1) "hosts mapping for $LocalAddress still present"
}

# --- 4. REMOVE ----------------------------------------------------------------
Section 'REMOVE'
# Preserve user files (settings.json, logs, ...) so RESTORE can put them back -
# remove deletes the whole base path, and a template-seeded reinstall would
# otherwise reset the user's port/theme configuration to defaults.
$preserve = $null
if ($preexisting) {
    $preserve = Join-Path $env:TEMP ("janus-test-preserve-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $preserve -Force | Out-Null
    Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -ne 'Janus.exe' } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $preserve $_.Name) -Recurse -Force
    }
}
$code = Invoke-LifecycleStep -Name 'Remove-win-x64.ps1' -Body $removeStep
Assert ($code -eq 0) "Remove-win-x64.ps1 exited 0 (got $code)"
Assert (-not (Test-Path -LiteralPath $root)) 'install directory removed'
Assert ((Get-UserPathHits -Dir $root) -eq 0) 'user PATH entry removed'
Assert (@(Get-JanusLocalInstances).Count -eq 0) 'no running Janus.exe instance left'
if ($LocalAddress) {
    Assert ((Get-HostsMarkerCount -Path $hostsPath) -eq 0) 'hosts # janus-local entries removed'
    Assert ((Get-HostsNameLineCount -Path $hostsPath -Name $LocalAddress) -eq $hostBaseline) "pre-existing hosts mappings for $LocalAddress preserved"
}

# --- 5. RESTORE (only when a pre-existing install was replaced) ---------------
if ($preexisting) {
    Section 'RESTORE'
    Write-Host 'Re-installing to restore the pre-existing install...' -ForegroundColor Yellow
    $code = Invoke-LifecycleStep -Name 'installer-win-x64.ps1 (restore)' -Body $installStep
    Assert ($code -eq 0) "restore install exited 0 (got $code)"
    if ($code -eq 0) {
        # Stop -> put the preserved user files back -> restore the original run state.
        if (Test-Path -LiteralPath $exe) { & $exe service stop }
        if ($preserve -and (Test-Path -LiteralPath $preserve)) {
            Get-ChildItem -LiteralPath $preserve -Force | ForEach-Object {
                $dest = Join-Path $root $_.Name
                if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue }
                Copy-Item -LiteralPath $_.FullName -Destination $root -Recurse -Force
            }
            Remove-Item -LiteralPath $preserve -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host 'Preserved user files (settings/logs) restored.' -ForegroundColor Green
        }
        if ($wasRunning) {
            & $exe service start
            Write-Host 'Service restarted (it was running before the test).' -ForegroundColor Yellow
        }
    }
}

# --- SUMMARY ------------------------------------------------------------------
Section 'SUMMARY'
Write-Host "Passed: $script:Passed  Failed: $script:Failed"
if ($script:Failed -gt 0) {
    Write-Host 'LIFECYCLE TEST FAILED' -ForegroundColor Red
    exit 1
}
Write-Host 'LIFECYCLE TEST PASSED' -ForegroundColor Green
exit 0
