---
name: irancell-t3
description: >-

disable-model-invocation: false
metadata:
  version: "3.0.0"
  author: Armin Dashti
  category: ubuntu
  tags: [ssh, irancell, t3, server, devops, softether, vpn]
  last_updated: "2026-09-11 22:20:00"
  uuid: 9a656ca7-ed53-4993-b012-6bbf1728c572
---



| Need | File |
|------|------|
| All containers + networks | [docker.md](docker.md) |
| Public :443 / SNI / apps | [haproxy.md](haproxy.md) |
| SoftEther + local bridge | [softether.md](softether.md) |
| Remnawave / Xray node | [xray.md](xray.md) |
| Windscribe egress (1/2/3) | [windscribe.md](windscribe.md) |
| TLS helpers | `haproxy-letsencrypt/` |

Read **only** files required for the current task.



### 1 — Connect (strict)

| # | Method | Port | Notes |
|---|--------|------|-------|
| 1 | SSH MCP `user-ssh-mcp` | MCP config | Prefer; reuse session |
| 2 | Shell SSH | **443** | HAProxy `SSH-` → host `:22` |
| 3 | Shell SSH | **22** | Fallback |

Do not skip ahead. **:80 ≠ SSH** (Xray path when published).

Key (443 then 22):

```bash
ssh -p 443 -i ~/.ssh/id_ed25519_cloud-admin_2-144-27-74 -o IdentitiesOnly=yes cloud-admin@2.144.27.124
ssh -p 22  -i ~/.ssh/id_ed25519_cloud-admin_2-144-27-74 -o IdentitiesOnly=yes cloud-admin@2.144.27.124
```

Optional `~/.ssh/config`: `Host t3` Port 443; `Host t3-22` Port 22 — same IdentityFile.


### 2 — Operate

Base skill Steps 2–5 + T3 constraints in [server.md](server.md) (Keep-alive).

## Safety (T3)

2. Connect order: MCP → **443** → **22**
3. Ask before HAProxy reload/restart (drops SoftEther TCP on :443); run that restart over **SSH :22** so control session survives
4. Keep SoftEther users up; do not casually retarget SoftEther netns or UDP443 DNAT

- HAProxy edit → approve → restart over :22
