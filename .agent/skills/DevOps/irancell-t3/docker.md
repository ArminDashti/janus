# Irancell-T3 — Docker inventory

All containers on this host (snapshot-oriented). Deep ops: [haproxy.md](haproxy.md) [softether.md](softether.md) [xray.md](xray.md) [windscribe.md](windscribe.md). Host/paths: [server.md](server.md).

Live refresh **2026-09-12**: host `t3-new` up 4d, disk 23G/48G used, ~40 containers Up; `mullvad-1`/`mullvad-2` Exited (137). No `3x-ui` / `sign-box-platform` / socks5 `3proxy` containers. Compose tree `/home/cloud-admin/irancell-t3/docker/composes/` is edge-only (not app stacks).

Refresh with: `docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'`

## Networks

| Network | Use |
|---------|-----|
| `t3-net` | Main app + proxy fabric |
| `openvpn-net` | HAProxy primary; legacy SoftEther-era |
| `wg-easy-net` | Windscribe containers |
| `remnawave-network` | Panel DB/redis/backend |
| `exar-net` / `asip-net` / `asip-webui-net` | App-private |
| `amnezia-dns-net` | Amnezia leftover |

## Edge / VPN / proxy

| Name | Image | Status pattern | Networks / netns | Role |
|------|-------|----------------|------------------|------|
| `haproxy` | `haproxy:3.0-alpine` | Up | `openvpn-net`,`t3-net`; host **TCP 443** | Public mux: SSH / SoftEther TCP / HTTPS / Reality |
| `windscribe` | `local/windscribe:latest` | Up | `t3-net`,`wg-easy-net` | SoftEther + openrouter egress (Manchester City / stealth) |
| `windscribe-2` | `local/windscribe:latest` | Up | `t3-net`,`wg-easy-net`; pub **2053** | Xray node netns + Reality target |
| `windscribe-3` | `local/windscribe:latest` | Up | `t3-net`,`wg-easy-net` | IKEv2 mobile VIP egress |
| `softether` | `local/softether:latest` | Up | **`container:windscribe`** | VPN server (TCP/UDP via windscribe ns) |
| `openrouter-proxy` | `local/3proxy:latest` | Up | **`container:windscribe`** | HTTP proxy for OpenRouter via SoftEther egress |
| `xray-platform` | `remnawave/node:latest` | Up | **`container:windscribe-2`** | Remnawave node / Xray |
| `remnawave` | `remnawave/backend:3` | Up (healthy) | `remnawave-network`,`t3-net`; `127.0.0.1:3000-3001` | Panel (`dash`/`sub`) |
| `remnawave-db` | `postgres:18.4` | Up (healthy) | `remnawave-network`; `127.0.0.1:6767` | Panel DB |
| `remnawave-redis` | `valkey/valkey:9-alpine` | Up (healthy) | `remnawave-network` | Panel cache (socket to backend) |
| `mullvad-1` | `local/mullvad:latest` | **Exited** | `openvpn-net` | Retired SoftEther egress; volumes kept |
| `mullvad-2` | `local/mullvad:latest` | **Exited (137)** since 2026-09-10 | `t3-net` | Former Xray egress; replaced by windscribe-2 |
| `nginx` | `nginx:alpine` | Up | `t3-net` | Internal HTTP helper (not public :443) |

## App stacks (all on `t3-net` unless noted)

| Stack | Containers |
|-------|------------|
| Lexmora | `lexmora-webui`, `lexmora-api`, `lexmora-pgsql` |
| Exar | `exar-webui`, `exar-api`, `exar`, `exar-pgsql` (+ `exar-net`) |
| Dogan | `dogan-webui`, `dogan-api`, `dogan-livekit`, `dogan-pgsql` |
| ASIP | `asip-webui` (`asip-webui-net`,`t3-net`), `asip-api` (`openvpn-net`,`t3-net`,`asip-net`), `asip-pgsql` |
| Aipedia | `aipedia-webui`, `aipedia-api`, `aipedia-pgsql` |
| Geoquiz | `geoquiz-webui`, `geoquiz-api`, `geoquiz-pgsql` |
| Arvaz | `arvaz-webui`, `arvaz-api`, `arvaz-pgsql` |
| Mark | `mark-ui`, `mark-api`, `mark-pgsql` |
| Radar | `radar-webui`, `radar-api`, `radar-agent`, `radar-pgsql` |
| AI agent logs | `ai-agent-log-webui`, `ai-agent-log-api`, `ai-agent-log-pgsql` |

## Volume roots (selected)

| Path | Content |
|------|---------|
| `/cloud-admin/docker-volumes/reverse-proxy/haproxy/` | `config/haproxy.cfg`, `certs/` |
| `/cloud-admin/docker-volumes/openvpn/softether/` | `data/` (`vpn_server.config`), `certs/` |
| `/cloud-admin/docker-volumes/openvpn/openrouter-proxy/` | `config/3proxy.cfg`, logs |
| `/cloud-admin/docker-volumes/wg-easy/windscribe{,-2,-3}/` | Per-instance config + scripts |
| `/cloud-admin/docker-volumes/mullvad-{1,2}/` | Rollback |
| `/cloud-admin/docker-volumes/sign-box/` | Disabled platform volumes |
| `/cloud-admin/docker-volumes/xray/` | Xray-related host files |
| `/cloud-admin/docker-volumes/strongswan/` | Host IPsec material |

Compose sources: `/home/cloud-admin/irancell-t3/docker/composes/{reverse-proxy,wg-easy,openvpn,sign-box,...}`.

## Coupling rules

1. Recreate `windscribe` → recreate SoftEther + openrouter (shared netns); re-run local-bridge + verify UDP443 DNAT IP
2. Recreate `windscribe-2` → recreate `xray-platform`; fix HAProxy `be_xray_reality` resolver target
3. Recreate `windscribe-3` → verify `strongswan-nat-mobile` POSTROUTING to new IP
4. Prefer `restart: "no"` on VPN helpers when editing compose (host may still show mixed policies historically)
5. Do not `docker network disconnect` SoftEther path mid-session without approval

## Stopped / rollback

| Name | Note |
|------|------|
| `mullvad-1` | SoftEther egress rollback: start, SoftEther `network_mode: container:mullvad-1`, HAProxy `be_softether` → `mullvad-1:443`, remove windscribe UDP443 DNAT |
| `mullvad-2` | Old Xray netns; if revived must stay on `t3-net` (not `lo` only) |
| `sign-box-platform` | Disabled 2026-08-30; container absent; volumes retained |
| `3x-ui` | Compose exists (`local/3x-ui:v3.7.0`, `network_mode: container:mullvad-2`); no container. Do not start while mullvad-2 is Exited |
