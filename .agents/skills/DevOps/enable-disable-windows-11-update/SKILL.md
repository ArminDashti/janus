---
name: enable-disable-windows-11-update
description: >-
  Enables (bypasses KSC localhost WSUS) or disables (restores company path)
  Windows 11 Update when Kaspersky Security Center Network Agent blocks
  Microsoft Update; also diagnose, verify, and install updates.
disable-model-invocation: false
metadata:
  version: "2.0.0"
  author: Armin Dashti
  category: security
  tags: [windows-update, kaspersky, klnagent, wsus, bypass, restore, pc-armin]
  last_updated: "2026-09-11 01:10:00"
  uuid: 7c3e9a21-4b8f-4d12-9e6a-1f0c8d2a5b47
---

# Enable / Disable Windows 11 Update

## When

- User invokes `enable-disable-windows-11-update`, `security-warriors-windows-update`, or `security-warriors-windows-update-restore`
- Windows Update check fails with `0x8024402D` or `0x8024500C` on a KES + `klnagent` machine (enable / apply bypass)
- User asks to unblock Windows Update blocked by Kaspersky / KSC
- User asks to restore `klnagent`, undo the bypass, or put company-managed update policy back (disable / restore)
- User asks to apply, verify, or install after the bypass
- Not: cracking Kaspersky passwords, permanently removing company AV, pausing real-time protection by default, or changing SoftEther / VPN stacks

## How

### Modes (pick from the ask; default = diagnose then act only if user wants a change)

| Mode | Goal |
|------|------|
| `diagnose` | Prove root cause or whether bypass is still active; change nothing |
| `apply` / `enable` | Unblock check/install (policy override + stop Network Agent) |
| `restore` / `disable` | Put KSC Windows Update policy and `klnagent` back to normal |
| `verify` | Confirm search works (after apply) or agent/policy normal (after restore) |
| `install` | Install updates found after a successful search (only if user asked) |

### Step 1 — Diagnose (read-only)

1. Confirm elevation: local Administrator required for apply/restore.
2. Read Windows Update policy and agent state:

```powershell
Get-Service klnagent, AVP.KES* -ErrorAction SilentlyContinue | Format-Table Name, Status, StartType
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -ErrorAction SilentlyContinue |
  Select-Object WUServer, WUStatusServer, DoNotConnectToWindowsUpdateInternetLocations
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue |
  Select-Object UseWUServer, NoAutoUpdate, AUOptions
Test-Path (Join-Path $env:TEMP 'WU-policy-backup.reg')
Get-NetTCPConnection -LocalPort 1550 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
Get-Process klnagent -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, Path
```

3. Read recent client failures (when investigating blocked updates):

```powershell
Get-WinEvent -LogName 'Microsoft-Windows-WindowsUpdateClient/Operational' -MaxEvents 15 -ErrorAction SilentlyContinue |
  Where-Object { $_.Level -le 3 -or $_.Id -eq 25 } |
  Select-Object TimeCreated, Id, Message
```

4. Optional COM probe:

```powershell
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$searcher.Search('IsInstalled=0')
```

**Signature that apply/enable is needed (all or most):**

| Signal | Meaning |
|--------|---------|
| `WUServer` = `http://localhost:1550` | KSC redirects WU to Network Agent |
| `UseWUServer` = `1` | WSUS mode on |
| `DoNotConnectToWindowsUpdateInternetLocations` = `1` | Direct Microsoft blocked |
| `NoAutoUpdate` = `1` | Auto update off |
| Port `1550` owned by `klnagent` | Local proxy |
| Probe to `http://127.0.0.1:1550` times out / 502 | Broken proxy → `0x8024402D` |

**Signature that restore/disable is still needed (any):**

| Signal | Meaning |
|--------|---------|
| `klnagent` Stopped and/or StartType Manual | Bypass left Network Agent down |
| `UseWUServer` = `0` | WSUS redirect disabled by apply |
| `DoNotConnectToWindowsUpdateInternetLocations` = `0` with prior KSC machine | Direct Microsoft allowed by apply |
| `WUServer` / `WUStatusServer` missing | Apply removed localhost WSUS URLs |
| Backup exists at `%TEMP%\WU-policy-backup.reg` | Preferred restore source from last apply |

Report the signature. Stop after diagnose unless the user asked to apply/enable, restore/disable, verify, or install.

### Step 2 — Apply / enable (unblock)

Do **not** stop `AVP.KES*` / real-time protection. Only Network Agent + WU policy.

1. Backup policy (required before edits):

```powershell
$backup = Join-Path $env:TEMP 'WU-policy-backup.reg'
reg export "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" $backup /y
if (-not (Test-Path $backup)) { throw "Backup failed: $backup" }
```

2. Stop Network Agent and keep it from auto-restarting during the session:

```powershell
Stop-Service klnagent -Force -ErrorAction SilentlyContinue
sc.exe config klnagent start= demand
Start-Sleep -Seconds 2
if ((Get-Service klnagent).Status -ne 'Stopped') { throw 'klnagent did not stop' }
```

3. Override policy while agent is down (klnagent rewrites these if left running):

```powershell
New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Force | Out-Null
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Name UseWUServer -Type DWord -Value 0
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Name NoAutoUpdate -Type DWord -Value 0
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name DoNotConnectToWindowsUpdateInternetLocations -Type DWord -Value 0
Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name WUServer -ErrorAction SilentlyContinue
Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name WUStatusServer -ErrorAction SilentlyContinue
```

4. Restart update stack:

```powershell
Restart-Service bits, wuauserv, UsoSvc -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4
```

5. Verify search against Microsoft Update:

```powershell
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$searcher.ServerSelection = 2
$result = $searcher.Search('IsInstalled=0')
"Available=$($result.Updates.Count)"
for ($i = 0; $i -lt $result.Updates.Count; $i++) {
  $result.Updates.Item($i).Title
}
```

6. Report: backup path, `klnagent` Status/StartType, policy values, available update titles, and that Settings → Windows Update should work.

If search still returns `0x8024500C`, policy was rewritten — repeat stop `klnagent` then Step 2.3–2.5 immediately.
If search returns `0x8024402D` with agent stopped and `DoNotConnect=0`, note residual TLS/network filtering; fall back to Microsoft Update Catalog `.msu` for the machine’s build (do not invent KB numbers).

### Step 3 — Restore / disable (back to company path)

Do **not** stop or change `AVP.KES*` / real-time protection.

**Path A — backup present (preferred)**

```powershell
$backup = Join-Path $env:TEMP 'WU-policy-backup.reg'
if (-not (Test-Path $backup)) { throw "Missing backup: $backup" }
reg import $backup
```

**Path B — backup missing (manual company defaults)**

Only when Path A cannot run. Re-apply the KSC-shaped policy this machine used before bypass:

```powershell
New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Force | Out-Null
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name WUServer -Type String -Value 'http://localhost:1550'
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name WUStatusServer -Type String -Value 'http://localhost:1550'
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -Name DoNotConnectToWindowsUpdateInternetLocations -Type DWord -Value 1
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Name UseWUServer -Type DWord -Value 1
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -Name NoAutoUpdate -Type DWord -Value 1
```

Tell the user Path B was used because `%TEMP%\WU-policy-backup.reg` was missing; KSC may overwrite again after agent sync.

**Then always (both paths):**

```powershell
sc.exe config klnagent start= delayed-auto
Start-Service klnagent
if ((Get-Service klnagent).Status -ne 'Running') { throw 'klnagent did not start' }
Restart-Service bits, wuauserv, UsoSvc -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4
```

### Step 4 — Verify

**After apply/enable** — COM search with `ServerSelection = 2`; report Available count and titles; confirm `klnagent` still Stopped/Manual.

**After restore/disable:**

```powershell
Get-Service klnagent | Format-Table Name, Status, StartType
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' |
  Select-Object WUServer, WUStatusServer, DoNotConnectToWindowsUpdateInternetLocations
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' |
  Select-Object UseWUServer, NoAutoUpdate
Get-NetTCPConnection -LocalPort 1550 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
Get-Process klnagent -ErrorAction SilentlyContinue | Select-Object Id, ProcessName
```

Expect after restore: `klnagent` Running DelayedAuto (or Automatic); `WUServer` `http://localhost:1550` (may lag); `UseWUServer` `1`; port `1550` owned by `klnagent`. If policy still shows Microsoft-direct values briefly after agent start, wait and re-read once; do not re-apply the bypass.

### Step 5 — Install (only when user asks)

After a successful search in apply/verify:

```powershell
$session = New-Object -ComObject Microsoft.Update.Session
$searcher = $session.CreateUpdateSearcher()
$searcher.ServerSelection = 2
$search = $searcher.Search('IsInstalled=0')
$toInstall = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($u in $search.Updates) {
  if (-not $u.EulaAccepted) { $u.AcceptEula() }
  [void]$toInstall.Add($u)
}
if ($toInstall.Count -eq 0) { 'Nothing to install'; return }
$downloader = $session.CreateUpdateDownloader()
$downloader.Updates = $toInstall
$downloader.Download()
$installer = $session.CreateUpdateInstaller()
$installer.Updates = $toInstall
$installer.Install() | Format-List
```

Warn if a reboot is required. Prefer listing titles first when the user did not explicitly say install.

### Error map

| Code | Meaning | Next action |
|------|---------|-------------|
| `0x8024402D` | HTTP 502 / bad gateway via local proxy | Apply: stop `klnagent` + disable WSUS redirect |
| `0x8024500C` | Internet WU blocked by policy | Set `DoNotConnectToWindowsUpdateInternetLocations=0` while agent stopped |
| `0x80073D02` | Store package in use (e.g. App Installer) | Close `WindowsPackageManagerServer` / winget; separate from OS WU proxy issue |

### Report shape (end of run)

| Field | Value |
|-------|-------|
| Mode | diagnose / apply / restore / verify / install |
| Root cause / bypass before? | one line |
| Path | A (backup) / B (manual) / n/a |
| `klnagent` | Status + StartType |
| Policy | UseWUServer, DoNotConnect, WUServer |
| Backup | full path or `n/a` / `missing` |
| Search | OK / fail + HRESULT (apply path) |
| Updates | titles or count |
| Next | restore reminder if apply left agent stopped; or wait for KSC sync if restore lag |

## Always

1. Require an explicit user ask before `apply`/`enable`, `restore`/`disable`, or `install` (diagnose alone is OK when they only ask why updates fail or if bypass is on).
2. Keep KES real-time protection (`AVP.KES*`) running unless the user separately and explicitly asks to change it.
3. Tell the user that apply leaves `klnagent` Manual/Stopped until restore/disable — company management may notice.
4. Prefer Path A when the backup file exists for restore; say clearly when Path B was used.
5. Prefer silent PowerShell; do not drive Kaspersky or Settings UI unless the user approves desktop control this turn.

## Never

1. Invent or brute-force the Kaspersky policy/`EXITPOLICY` password.
2. Uninstall KES or delete the Kaspersky personal root CA as the default fix or as part of restore.
3. Apply policy edits without a `.reg` backup in `%TEMP%`.
4. Leave the machine after `apply` without naming this skill’s restore/disable mode as the undo path.
5. Claim apply success without a COM search (or clear Settings-equivalent failure) after apply.
6. Claim restore success without confirming `klnagent` is Running.
7. Treat a still-broken Windows Update (localhost proxy) after restore as a restore failure — that is the normal company path; use apply/enable again if they need the bypass.

## Example

**Example 1 — Diagnose only**

- Input: "Why can't I update Windows?"
- Output: Report `WUServer=http://localhost:1550`, port 1550 = `klnagent`, recent `0x8024402D`; no registry or service changes

**Example 2 — Apply / enable after user confirms**

- Input: "Do it" / "apply security-warriors-windows-update" / "enable windows update bypass"
- Output: Backup `%TEMP%\WU-policy-backup.reg`, stop `klnagent` + `start=demand`, set UseWUServer/DoNotConnect/NoAutoUpdate to allow Microsoft Update, restart WU services, COM search succeeds, list available titles

**Example 3 — Restore / disable with backup**

- Input: "Put Kaspersky update policy back" / "restore after security-warriors-windows-update" / "disable the bypass"
- Output: `reg import` backup, `klnagent` delayed-auto + Started, WU services restarted; confirm Running + policy/port

**Example 4 — Restore without backup**

- Input: "Back to normal" but `WU-policy-backup.reg` is gone
- Output: Path B sets localhost:1550 / UseWUServer=1 / DoNotConnect=1 / NoAutoUpdate=1, start `klnagent`, verify; tell user backup was missing

**Example 5 — Verify mid-session**

- Input: "Check if Windows Update works now"
- Output: Read policy + `klnagent` status; run COM search with `ServerSelection=2`; report Available count and titles

**Example 6 — Install**

- Input: "Install the updates you found"
- Output: Download/install via Microsoft Update COM; report result and reboot need; leave restore reminder if agent still stopped

**Example 7 — Apply fails because agent rewrote policy**

- Input: apply ran but search returns `0x8024500C`
- Output: Stop `klnagent` again, re-apply DoNotConnect=0 and UseWUServer=0 immediately, re-search; do not claim success until search OK

**Example 8 — Wrong problem (App Installer only)**

- Input: User only sees Store App Installer fail `0x80073D02`
- Output: Explain package-in-use; do not stop `klnagent` unless OS WU detection also shows the localhost:1550 signature
