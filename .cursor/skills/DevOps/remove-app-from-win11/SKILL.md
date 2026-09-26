---
name: remove-app
description: >-
  Finds and cleanly removes Windows 11 apps (Win32 / Store / provisioned)
  with inventory, uninstall, leftover check, and optional cleanup.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: windows-11
  tags: [uninstall, appx, winget, cleanup, windows-11]
  last_updated: "2026-09-11 18:15:00"
  uuid: 5a4c33e6-e848-4d96-826c-171b3383ea93
---

# Remove App

## When

- User asks to uninstall, remove, or purge a Windows 11 app
- Need to list installed apps before choosing what to remove
- Not: wipe OS, remove security agents without explicit ask, or delete other users' data casually

## How

### Modes

| Mode | Goal |
|------|------|
| `list` | Find matching installs |
| `remove` | Uninstall named app(s) |
| `verify` | Confirm gone + leftover paths |

### Step 1 — List

```powershell
winget list --name '<name>'
Get-Package -Name '*<name>*' -ErrorAction SilentlyContinue |
  Select-Object Name, Version, ProviderName
Get-AppxPackage -Name '*<name>*' | Select-Object Name, PackageFullName, Version
Get-AppxProvisionedPackage -Online |
  Where-Object DisplayName -like '*<name>*' |
  Select-Object DisplayName, PackageName
```

Confirm exact package with user if multiple matches.

### Step 2 — Remove

Order: `winget uninstall` → MSI/`Get-Package` Uninstall-Package → `Remove-AppxPackage` → provisioned `Remove-AppxProvisionedPackage -Online` only if user wants all-users / new-profile purge.

```powershell
winget uninstall --id '<Id>' --exact
# or
Get-AppxPackage -Name '<Name>' | Remove-AppxPackage
```

### Step 3 — Verify / leftovers

```powershell
winget list --name '<name>'
Get-AppxPackage -Name '*<name>*'
Test-Path "$env:LOCALAPPDATA\<Vendor>"; Test-Path "$env:ProgramData\<Vendor>"
```

Delete leftover folders only if user asked and paths are clearly that app.

## Safety

- Never remove Defender, company AV, or KSC agents unless user names them
- Prefer per-user Appx remove before provisioned/all-users
- Stop if uninstall needs interactive UI the user forbade
