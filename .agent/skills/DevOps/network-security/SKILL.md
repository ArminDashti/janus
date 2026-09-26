---
name: network-security
description: >-
  Audits and hardens Windows 11 network exposure: listeners, shares, Wi-Fi,
  SMB/RDP posture, and risky inbound reachability via PowerShell.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: windows-11
  tags: [network, security, listeners, smb, rdp, wifi]
  last_updated: "2026-09-11 18:15:00"
  uuid: c2092f50-a643-43dc-8009-12730dbe5b77
---

# Network Security

## When

- User asks to audit, harden, or check Windows 11 network security
- Suspect open ports, shares, RDP/SMB exposure, or weak Wi-Fi
- Not: remote server VPN stacks, Irancell-T3, or non-Windows hosts

## How

### Modes

| Mode | Goal |
|------|------|
| `diagnose` | Inventory exposure; change nothing |
| `harden` | Apply only user-approved mitigations |
| `verify` | Re-check after harden |

### Step 1 — Diagnose (read-only)

```powershell
Get-NetTCPConnection -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess |
  Sort-Object LocalPort
Get-NetFirewallProfile | Format-Table Name, Enabled, DefaultInboundAction
Get-SmbShare | Select-Object Name, Path, Description
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections
Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, MacAddress
netsh wlan show interfaces
```

Flag: listeners on `0.0.0.0` / `::`, unexpected shares, RDP enabled (`fDenyTSConnections=0`), Public profile firewall Off.

### Step 2 — Harden (only if asked)

Pick targeted fixes; confirm each:

| Risk | Typical fix |
|------|-------------|
| Public firewall Off | `Set-NetFirewallProfile -Profile Public -Enabled True` |
| Unused RDP | disable via System / `fDenyTSConnections=1` (Admin) |
| Broad SMB share | tighten ACL or remove share |
| Risky listener | stop owning service/app or add block rule |

Prefer least privilege. Do not disable whole firewall.

### Step 3 — Verify

Re-run diagnose snippet; report before/after for changed items only.

## Safety

- Prefer diagnose; mutate only when user asked
- Never wipe all firewall rules
- Elevate only when required; say when Admin needed
