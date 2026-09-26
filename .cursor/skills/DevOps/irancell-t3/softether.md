# Irancell-T3 — SoftEther

Container `softether` (`local/softether:latest`). User VPN (OpenVPN/SoftEther protocols). Shares network namespace with **`windscribe`** so client traffic egresses Manchester City / stealth.

## Layout

| Item | Value |
|------|-------|
| Netns | `network_mode: container:windscribe` |
| Sibling in same ns | `openrouter-proxy` (`local/3proxy`) |
| Data | `/cloud-admin/docker-volumes/openvpn/softether/data/` (`vpn_server.config` + backups) |
| Certs | `/cloud-admin/docker-volumes/openvpn/softether/certs/` |
| Logs vol | Docker volume → `/var/log/softether` |
| Admin password | `dopadopa123` |
| IPsec inside SoftEther | **Disabled** — host strongSwan owns UDP 500/4500 |

Cmd: `/usr/local/bin/vpnserver execsvc`.

## How clients reach it

| Path | Flow |
|------|------|
| TCP :443 | Client → HAProxy `be_softether` → `windscribe:443` (SoftEther in that ns) |
| UDP :443 | Host DNAT → `172.23.0.36:443` (`windscribe` on `t3-net`) |
| SNI | `ovp.xaigrok.ir` / `ovpbackup.xaigrok.ir`; many clients use **IP / no SNI** (HAProxy routes those to SoftEther) |

DoS protection disabled in `vpn_server.config` (2026-08-16) — HAProxy must **not** TCP-check SoftEther (false positives / bans).

## Local bridge (LAN for VPN clients)

| Piece | Detail |
|-------|--------|
| Unit | `softether-local-bridge.service` |
| Script | `setup-local-bridge.sh` (under SoftEther/windscribe ops) |
| Interface | `tap_se` **`10.10.0.1/24`** + dnsmasq (`dnsmasq-tap_se.*` in data dir) |
| When | After **any** SoftEther or `windscribe` recreate: BridgeCreate + restart local-bridge unit |

Listeners observed in windscribe ns include SoftEther TCP/UDP **443**, **992**, **1194**, management **5555**, plus `tap_se` DHCP.

## Egress history

| When | Egress |
|------|--------|
| Current (2026-09-09+) | `windscribe` (Manchester City, stealth:443) |
| Rollback | Start `mullvad-1`; SoftEther `network_mode: container:mullvad-1`; HAProxy backend `mullvad-1:443`; remove UDP443 DNAT to windscribe |

Iran split for SoftEther path: `ir.txt` + `setup-split-tunnel.sh` (~1734 CIDRs via `t3-net` GW); watcher + host timer `ensure-windscribe-iran-split` — see [windscribe.md](windscribe.md). **Never** restart `softether` / `windscribe` / HAProxy SoftEther path to fix Iran bypass — routes + watcher only.

## OpenRouter proxy

`openrouter-proxy` mounts `/cloud-admin/docker-volumes/openvpn/openrouter-proxy/config/3proxy.cfg`. Same netns as SoftEther → outbound via windscribe tunnel. Do not move to host network casually.

## Ops safety

1. Keep users connected — no casual restart of `softether` / `windscribe` / HAProxy SoftEther path
2. Order on recreate: start `windscribe` → SoftEther + openrouter → local-bridge → verify DNAT IP matches `windscribe` `t3-net` addr
3. Never assign host UDP 443 to Amnezia or other stacks
4. Do not enable SoftEther IPsec while strongSwan owns 500/4500
5. HAProxy SoftEther changes: approve + SSH :22

## Checks

```bash
docker inspect softether --format '{{.HostConfig.NetworkMode}} {{.State.Status}}'
docker exec windscribe windscribe-cli status 2>/dev/null | head -20
ss -tlnp | grep ':443'   # host = haproxy
sudo iptables -t nat -S | grep 'dport 443'
systemctl is-active softether-local-bridge
```
