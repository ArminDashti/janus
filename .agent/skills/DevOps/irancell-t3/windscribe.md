# Irancell-T3 — Windscribe

Three `local/windscribe:latest` instances. Image build/entrypoint: `/home/cloud-admin/irancell-t3/docker/composes/wg-easy/windscribe-build/entrypoint.sh`.

Common env pattern: `WINDSCRIBE_LOCATION=City`, `WINDSCRIBE_PROTOCOL=stealth`, `WINDSCRIBE_AMNEZIA_PRESET=H`, `WINDSCRIBE_MANUAL_LOGIN=1`, `TZ=UTC`. Credentials live in container env — do not duplicate here.

All three typically: **Logged in**, **Connected: Manchester - City**, **Stealth:443**, firewall off.

## Instances

| Name | t3-net IP | wg-easy IP | VPN IP (sample) | Consumers | Publish |
|------|-----------|------------|-----------------|-----------|---------|
| `windscribe` | `172.23.0.36` | `172.22.0.2` | e.g. `84.233.178.40` | SoftEther + openrouter netns; **UDP443 DNAT target** | host UDP **123** |
| `windscribe-2` | `172.23.0.21` | `172.22.0.3` | e.g. `84.233.178.45` | `xray-platform` netns; HAProxy Reality `:10443` | host TCP **2053** |
| `windscribe-3` | `172.23.0.37` | `172.22.0.4` | e.g. `84.233.178.42` | strongSwan mobile VIP NAT | none |

Volumes: `/cloud-admin/docker-volumes/wg-easy/windscribe{,-2,-3}/` (+ `config` → `/config-scripts`).

Restart policy on these helpers: prefer **`no`** (manual recover).

## `windscribe` (SoftEther egress)

- SoftEther + openrouter use `network_mode: container:windscribe`
- Host: `iptables -t nat -A PREROUTING -p udp --dport 443 -j DNAT --to-destination 172.23.0.36:443` (ensure script under volume keeps IP in sync after recreate)
- HAProxy TCP SoftEther → `windscribe:443`
- Iran split: `ir.txt` + `setup-split-tunnel.sh` (~1734 CIDRs main table via `t3-net` GW `172.23.0.1`); in-container watcher `windscribe-iran-split-watch.sh` (`SETUP_SCRIPT=/config/scripts/setup-split-tunnel.sh`)
- Host keep-alive (**never** restart SoftEther/`windscribe`): `ensure-windscribe-iran-split.{service,timer}` every 5m + `scripts/ensure-windscribe-iran-split.sh` — re-applies routes / restarts watcher only
- SoftEther local bridge (`tap_se` 10.10.0.1/24) runs in this ns — see [softether.md](softether.md)

## `windscribe-2` (Xray egress)

- `xray-platform` → `network_mode: container:windscribe-2`
- Listens (shared ns): **10443** Reality, **2222** node, host-map **2053**
- HAProxy `be_xray_reality` server: `windscribe-2:10443`
- Split/bypass scripts under its `config/scripts` (do not apply SoftEther scripts here blindly)

## `windscribe-3` (IKEv2 mobile egress)

- Host strongSwan conn `ikev2-mobile` (id/cert `ik2-ips.xaigrok.ir`, EAP-MSCHAPv2)
- Client VIP pool **`10.10.30.0/24`**
- `strongswan-nat-mobile.service` NAT toward `172.23.0.37`
- Same class of Iran CIDR split (~1734) as SoftEther windscribe; VIP egress via this tunnel
- SoftEther IPsec stays off so 500/4500 remain host-owned

## Shared ops patterns

```bash
# status
for c in windscribe windscribe-2 windscribe-3; do echo ==== $c; docker exec $c windscribe-cli status; done

# reconnect if zombie
docker exec windscribe windscribe-cli disconnect; docker exec windscribe windscribe-cli connect
```

After recreate:

1. Confirm login + Connected City/stealth
2. Update DNAT / HAProxy / strongSwan NAT if IP changed
3. Recreate dependents that used `network_mode: container:…`
4. Re-run Iran split + SoftEther local-bridge when touching `windscribe`

## Safety

1. Treat all three as production egress — ask before restart/recreate
2. Never point SoftEther and Xray at the same windscribe instance without explicit design
3. Do not steal UDP 443 from `windscribe` for other VPN products
4. Account data usage is shared across clients on the Windscribe side — expect large GB counters

## Rollback notes

- SoftEther → old `mullvad-1` path: see [softether.md](softether.md) / [docker.md](docker.md)
- Xray → old `mullvad-2`: start mullvad-2 on `t3-net`, move `xray-platform` netns, retarget HAProxy Reality server name/port
