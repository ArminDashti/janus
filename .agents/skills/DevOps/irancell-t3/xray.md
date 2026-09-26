# Irancell-T3 — Xray / Remnawave

Panel + node for user VPN configs. Public hosts: `dash` / `sub` / `gb` on `atmost.dpdns.org`.

## Containers

| Name | Image | Net | Role |
|------|-------|-----|------|
| `remnawave` | `remnawave/backend:3` | `remnawave-network` + `t3-net` | Panel API/UI `:3000` (metrics `:3001`) |
| `remnawave-db` | `postgres:18.4` | `remnawave-network` | DB (`127.0.0.1:6767`→5432) |
| `remnawave-redis` | `valkey:9-alpine` | `remnawave-network` | Cache; socket mounted into backend |
| `xray-platform` | `remnawave/node:latest` | **`container:windscribe-2`** | Node agent + Xray |

Panel env (non-secret): `PANEL_DOMAIN=dash.atmost.dpdns.org`, `SUB_PUBLIC_DOMAIN=sub.atmost.dpdns.org/api/sub`, `APP_PORT=3000`, `TRUST_PROXY=1`.

Secrets (DB URL, `APP_SECRET`, node `SECRET_KEY`, metrics): live in container env — do not copy into docs.

## Public entry

| Surface | Path |
|---------|------|
| Panel / sub HTTPS | HAProxy SNI → TLS offload → `be_xy_admin` → `remnawave:3000` |
| Domains | `dash.atmost.dpdns.org`, `sub.atmost.dpdns.org` (+ legacy `xry-dash` / `xry-sub.xaigrok.ir`) |
| Sub URL shape | `https://sub.atmost.dpdns.org/api/sub/<shortUuid>` (+ `/json` client profile) |
| Reality VPN | HAProxy TCP SNI → `be_xray_reality` → **`windscribe-2:10443`** |
| Reality SNI decoys | `www.microsoft.com` / `microsoft.com` / Cloudflare / `gb.atmost.dpdns.org` |

Inside `windscribe-2` ns (observed): listen **`:10443`** (Reality), node **`:2222`**, published host **`:2053`**.

## Inbounds (design intent)

| Tag / name | Proto | Public | Notes |
|------------|-------|--------|-------|
| `London-443-Reality` | VLESS + XHTTP + Reality | TCP **443** via HAProxy | Internal **10443**; path like `/cdn/static/js/main.bundle`; SNI microsoft/gb |
| `London-80` | VLESS + XHTTP | TCP **80** (when published) | path `/xy`, security none — **verify host bind**; often unpublished if only 2053 mapped |

Client tips (Happ / JSON):

- Classic Mux **off** with XHTTP (Mux+XHTTP → connected/no data)
- Prefer XHTTP `mode: stream-one` + XMUX
- Iran direct: `regexp:.*\.ir$` + Iran CIDRs from `geoip.dat` IR + `geoip:private` → direct; `domainStrategy: IPIfNonMatch`
- Avoid relying on `geosite:ir` / bare `geoip:ir` tags on Happ
- Outbound tags are **case-sensitive**

## Egress

Current: node shares **`windscribe-2`** (Manchester City / stealth). Former: `mullvad-2` (gb lon + LWO) — container **Exited**; volumes kept.

Iran bypass on old mullvad path: `wg-iran-bypass.sh` / `sbox-iran-bypass.sh`. On windscribe-2, follow that instance’s split scripts under its volume `config/scripts`.

If `mullvad-2` revived for Xray: must have `t3-net` eth0 (`docker network connect t3-net mullvad-2` then restart node) — `lo`-only breaks egress.

## Coupling

1. Recreate `windscribe-2` → recreate/restart `xray-platform`; confirm HAProxy Reality target IP/name
2. Panel DB changes may need node restart/reload so Xray picks hosts/inbounds
3. Do **not** touch SoftEther / `windscribe` / UDP443 DNAT when only changing Xray
4. `sign-box-platform` disabled; do not confuse sbox HAProxy backends with live Remnawave path

## Checks

```bash
docker ps --filter name='remnawave|xray-platform|windscribe-2' --format 'table {{.Names}}\t{{.Status}}\t{{.Networks}}'
docker inspect xray-platform --format '{{.HostConfig.NetworkMode}}'
docker exec windscribe-2 sh -c 'ss -tlnp | grep -E "10443|2222|2053|80"'
curl -sI --resolve dash.atmost.dpdns.org:443:2.144.27.124 https://dash.atmost.dpdns.org/ | head
```

LE for dash/sub: prefer DNS-01 (see [haproxy.md](haproxy.md)).
