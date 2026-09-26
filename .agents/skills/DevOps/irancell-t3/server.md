# Irancell-T3 — server

Dense host facts. Containers → [docker.md](docker.md). Stack details → sibling `*.md`.

## Location

| Field | Value |
|-------|-------|
| Country | **Iran** |
| Datacenter / ISP | **Irancell** |

## Identity

| Field | Value |
|-------|-------|
| Hostname | `t3-new` |
| Public IP | `2.144.27.124` (replaced older `2.144.27.74`) |
| SSH user | `cloud-admin` |
| OS | Ubuntu **26.04** LTS (`resolute`), kernel `7.0.0-31-generic` |
| Arch | x86_64 |
| CPU | 4 × Intel Xeon (Cascadelake) |
| RAM | ~3.8 GiB + 2 GiB swap |
| Disk | `/dev/vda1` ~48G (keep headroom; prune carefully) |
| Volume root | `/cloud-admin/docker-volumes/` |
| Compose tree | `/home/cloud-admin/irancell-t3/docker/composes/` |
| Inventory | [../../servers/t3.md](../../servers/t3.md) |

Small-VM bias: prefer read-only inspect + surgical edits; avoid heavy builds/upgrades unless asked.

## SSH

| Path | Detail |
|------|--------|
| Identity | `~/.ssh/id_ed25519_cloud-admin_2-144-27-74` (`IdentitiesOnly yes`; name still uses old IP) |
| Prefer | SSH MCP → shell **:443** → shell **:22** |
| :443 | HAProxy `fe_tls_sni` ACL `req.payload(0,4) == SSH-` → `be_ssh` → `172.23.0.1:22` |
| :22 | Host `sshd` directly |
| :80 | **Not SSH** |
| Aliases | `Host t3` Port 443; `Host t3-22` Port 22 |

MCP note: if MCP points at :80, connection fails (`ECONNREFUSED`) — fix MCP to :22 or use shell :443.

Windows: Mullvad leak protection + host `/32` route to this IP can yield `WinError 10013` / “Permission denied” **before** handshake (local filter, not bad auth).

## Public listeners (host)

| Proto/port | Owner | Role |
|------------|-------|------|
| TCP 22 | `sshd` | SSH |
| TCP 443 | `haproxy` | SSH detect + SoftEther TCP + HTTPS SNI + Xray Reality SNI |
| UDP 443 | iptables DNAT → `windscribe` `172.23.0.36:443` | SoftEther UDP / OpenVPN-ish |
| UDP 500 / 4500 | **host strongSwan** | IKEv2 mobile (`ikev2-mobile`); SoftEther IPsec **off** |
| TCP 2053 | `windscribe-2` publish | Extra published port on Xray netns |
| TCP 80 | UFW allows; often **no host bind** when Xray :80 path unpublished | Do not assume SSH |

## Host services (non-Docker)

| Unit / piece | Role |
|--------------|------|
| `strongswan` / swanctl | IKEv2; conn `ikev2-mobile`; id/cert `ik2-ips.xaigrok.ir`; VIP pool **`10.10.30.0/24`** |
| `strongswan-nat-mobile.service` | NAT mobile VIP → `windscribe-3` (`172.23.0.37`) |
| `softether-local-bridge.service` | After SoftEther/windscribe recreate: BridgeCreate + `tap_se` **`10.10.0.1/24`** + dnsmasq |
| UDP443 DNAT | `PREROUTING -p udp --dport 443 -j DNAT --to-destination 172.23.0.36:443` (script under windscribe volume) |

PKI / conf live under `/cloud-admin/docker-volumes/strongswan/` and `/etc/swanctl/conf.d/` (`mobile-ikev2.conf`).

## Keep-alive / blast radius

- SoftEther users + OpenVPN TCP via HAProxy `be_softether` → `windscribe:443`
- SoftEther + `openrouter-proxy` share **`network_mode: container:windscribe`**
- HAProxy reload/restart drops SoftEther TCP sessions on :443 — **ask first**; control plane over SSH **:22**
- Do not give host UDP 443 to Amnezia / other stacks
- `mullvad-1` / `mullvad-2`: stopped profiles; volumes kept for rollback — SoftEther egress is **windscribe** (since 2026-09-09)
- `sign-box-platform`: temporarily disabled; volumes under `/cloud-admin/docker-volumes/sign-box/`

## Credentials policy

- SoftEther server admin password: `dopadopa123` (ops default)
- Do not paste Windscribe / Remnawave / DB secrets into chat or new docs; read live container env / volume configs when needed

## Quick health

```bash
hostname; uptime; free -h; df -h /
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Networks}}'
ss -tulnp | grep -E ':22|:443|:500|:4500'
sudo iptables -t nat -S | grep 443
systemctl is-active softether-local-bridge strongswan-nat-mobile
```
