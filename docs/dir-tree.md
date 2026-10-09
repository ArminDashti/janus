# Directory Tree (key files; regenerated 2026-10-09)

```
janus/
├── janus-api/
│   └── src/
│       ├── server.ts              # Fastify server, /api/health, /api/events SSE
│       ├── cli.ts                 # janus CLI entry
│       ├── routes/
│       │   └── index.ts           # All /api routes incl. POST /api/sync
│       ├── services/
│       │   ├── platform-sync.service.ts   # Copy resources into platform folders
│       │   ├── assignment.service.ts      # Assign resources to projects/platforms
│       │   ├── project-bootstrap.service.ts # Create enabled platform folders
│       │   ├── scanner.service.ts         # Scan skills/sub-agents/MCPs
│       │   ├── settings-store.ts          # settings.json read/save
│       │   ├── update.service.ts          # git fetch/pull self-update check + apply
│       │   └── watcher.service.ts         # FS watcher, emits scan-changed
│       └── shared/
│           └── types.ts                   # AppSettings, ScanResult, resources
├── janus-webui/
│   └── src/
│       ├── main.tsx               # Sets window.agentManager, SSE connect
│       ├── api/
│       │   ├── types.ts           # AgentManagerApi interface (incl. syncNow)
│       │   └── client.ts          # HTTP client (POST /api/sync in syncNow)
│       ├── stores/
│       │   └── appStore.ts        # Zustand store: refreshScan, syncNow
│       ├── components/
│       │   ├── layout/
│       │   │   └── Sidebar.tsx    # Nav + unified Sync button
│       │   └── settings/
│       │       └── UpdatesTab.tsx # Settings → Updates: check, install, startup toggle
│       └── pages/                 # Skills, SubAgents, MCPs, Projects, Settings pages
├── scripts/
│   └── janus-cli.ts               # Service/IDE CLI used by installer
└── docs/                          # This documentation
```
