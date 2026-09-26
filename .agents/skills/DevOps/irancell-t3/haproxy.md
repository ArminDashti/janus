# Irancell-T3 — HAProxy

Container `haproxy` (`haproxy:3.0-alpine`). Public **TCP 443** mux for SSH, SoftEther TCP, HTTPS apps, Xray Reality.

## Paths / nets

| Item | Value |
|------|-------|
| Config (host bind) | `/cloud-admin/docker-volumes/reverse-proxy/haproxy/config/haproxy.cfg` → `/usr/local/etc/haproxy/haproxy.cfg` |
| Certs | `/cloud-admin/docker-volumes/reverse-proxy/haproxy/certs/` → `/usr/local/etc/haproxy/certs/` |
| Networks | `openvpn-net` (primary), `t3-net` |
| Publish | `0.0.0.0:443->443/tcp` |
| Restart policy | historically `unless-stopped` |
| Compose | `/home/cloud-admin/irancell-t3/docker/composes/reverse-proxy/` |

`sed -i` on the bind-mounted cfg replaces inode — **restart container** so process reloads file. New TLS PEMs often need full container restart (not only HUP).

## Architecture

```
Internet :443
  └─ fe_tls_sni (mode tcp, inspect-delay 5s)
       ├─ payload "SSH-"     → be_ssh → 172.23.0.1:22
       ├─ SNI ovp*.xaigrok.ir / no SNI → be_softether → windscribe:443
       ├─ app / dash / sub SNI → be_ssl_offload → 127.0.0.1:8443 (PROXY v2)
       ├─ Reality SNI (microsoft/cloudflare/gb…) → be_xray_reality → windscribe-2:10443
       └─ default → be_ssl_offload (never SoftEther — avoids DoS auto-ban)

fe_https_apps @ 127.0.0.1:8443 (ssl crt …/certs/)
  └─ Host header → per-app backends on t3-net
```

Docker DNS resolver: `127.0.0.11:53` (`resolvers docker`).

## Critical backends

| Backend | Mode | Target | Notes |
|---------|------|--------|-------|
| `be_ssh` | tcp | `172.23.0.1:22` | Host gateway from Docker bridge |
| `be_softether` | tcp | `windscribe:443` | **No TCP-check** (SoftEther DoS disabled in vpn config) |
| `be_xray_reality` | tcp | `windscribe-2:10443` | splice + tcpka; long timeouts |
| `be_ssl_offload` | tcp | `127.0.0.1:8443 send-proxy-v2` | Loop to TLS-terminating FE |
| `be_xy_admin` | http | `remnawave:3000` | `dash` + `sub` (+ legacy `xry-*`) |

## SNI / Host map (abbrev)

**TCP SoftEther:** `ovp.xaigrok.ir`, `ovpbackup.xaigrok.ir`, or **no SNI**.

**Reality passthrough:** `www.microsoft.com`, `microsoft.com`, `www.cloudflare.com`, `cloudflare.com`, `gb.atmost.dpdns.org`, `xry-gb.xaigrok.ir`.

**HTTPS offload (examples):** `lexmora|exar|dogan|asip|aipedia|geo-quiz|arvaz|mark|radar|ai-agent-log` (+ `-api` variants) on `*.xaigrok.ir`; Remnawave `dash.atmost.dpdns.org`, `sub.atmost.dpdns.org`.

App backend ports (http): webui usually `:80`; APIs vary (`8080`, `8090`, `8130`, `3000`, `7880` LiveKit, …) — see live `haproxy.cfg`.

## TLS / LE

- App certs in HAProxy `certs/` dir (multi-PEM)
- External HTTP-01 to public TCP 80 often times out on this Irancell IP → prefer **DNS-01** for `dash`/`sub`
- Skill helper: `C:/Users/armin/.cursor/skills/haproxy-letsencrypt/`

## Ops safety

1. **Ask** before reload/restart — drops SoftEther TCP OpenVPN sessions on :443 passthrough
2. Control session: SSH **:22** (not :443) during HAProxy restart
3. After SoftEther egress move, ensure `be_softether` still resolves to current netns owner (`windscribe`, not `mullvad-1`)
4. After Xray netns move, ensure `be_xray_reality` → current Reality listener host (`windscribe-2:10443`)
5. Unknown SNI must stay on `be_ssl_offload`, never SoftEther

## Checks

```bash
docker exec haproxy haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg
docker logs haproxy --tail 100
# approved restart over SSH :22:
docker restart haproxy
```

Validate: SSH via :443; SoftEther TCP; `openssl s_client -connect 2.144.27.124:443 -servername dash.atmost.dpdns.org`; Reality SNI returns decoy cert path.
