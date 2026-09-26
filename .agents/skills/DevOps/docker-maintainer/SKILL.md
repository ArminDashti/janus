---
name: docker-status-local
description: >-
  Reports local Docker daemon, containers, images, networks, and published
  ports status for troubleshooting deploys.
disable-model-invocation: false
metadata:
  version: "1.0.1"
  author: Armin Dashti
  category: devops
  tags: [docker, status, local, containers, ports]
  last_updated: "2026-08-15 13:52:00"
  uuid: e9594d41-4b92-485f-bf5d-8fc17128a29f
---

# Docker Status Local

## When to use

- User asks for local Docker status, what’s running, or which ports are published
- Before or after a local Docker deploy
- Related: sibling `docker-status-server` (remote host from `servers/<id>.md`)
- Exclusions: does not change containers; does not invent remote/SSH host status

## Objective

1. Confirm the local Docker daemon is reachable
2. List containers, images, networks, and published ports that matter for the ask
3. Summarize anything blocked (daemon down, name conflict, port in use)

## Workflow

### Step 1: Daemon

```powershell
docker info
```

If this fails, report Docker is not running / not reachable and stop.

### Step 2: Inventory

Run as needed for the ask:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"
docker network ls
docker ps --format "{{.Names}}\t{{.Ports}}"
```

Optional host port check on Windows:

```powershell
Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
```

### Step 3: Report

Give a short status: daemon OK/fail, relevant containers, published ports, and any conflict that blocks deploy.

## Safety rules

1. **Always** use read-only Docker inspect/list commands unless the user asked to change state.
2. **Never** stop, remove, or recreate containers from this skill alone.
3. **Never** invent container or port data — only report command output.
