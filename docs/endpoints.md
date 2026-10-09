# API Endpoints (janus-api, Fastify)

Base URL: `http://127.0.0.1:47911` (port configurable in `janus-api/settings.json`). No auth (local-only).

| Method | Path | What it does |
| --- | --- | --- |
| GET | /api/app/root | Absolute app root directory |
| GET | /api/settings | Current app settings (prunes missing projects) |
| PUT | /api/settings | Save settings; on platform change: MCP enable cascade, purge unselected IDE folders, sync enabled platforms to projects |
| POST | /api/settings/reset | Restore default settings |
| GET | /api/updates/check | Fetch origin; ahead/behind, incoming commits, dirty state of install checkout |
| POST | /api/updates/apply | Fast-forward git pull of the install; refuses dirty/diverged checkout |
| GET | /api/scan?probeMcps= | Latest cached scan (background-refreshed); with probeMcps=true runs a full live scan |
| POST | /api/sync | Sync latest resource changes into all enabled platform copies, then return fresh scan |
| GET | /api/scan/projects?path= | Discover git projects under a path |
| GET | /api/files?path= | Read a text file |
| PUT | /api/files | Write a text file `{path, content}` |
| GET | /api/files/list?path= | Recursive file list |
| GET | /api/files/entries?path= | Recursive entries with dir flag |
| PUT | /api/files/skill-md | Save SKILL.md with name sync `{filePath, content, currentResourceName}` |
| GET | /api/resources/:type/targets | Assignment targets for resource type |
| GET | /api/resources/:type/stats | Per-resource group summaries from the cached scan (no scan on click) |
| POST | /api/resources/:type/assign-all | Assign all resources of type to all projects |
| POST | /api/resources/:type/rename | Rename a skill/sub-agent `{oldName, newName}` |
| POST | /api/resources/:type | Create resource `{name, projectIds}` |
| GET | /api/resources/:type/:name/matrix | Project assignment matrix rows |
| POST | /api/resources/:type/:name/assign | Set assigned project ids `{assignedProjectIds}` |
| POST | /api/resources/:type/:name/global-assign | Toggle global platform assignment `{platformId, assigned}` |
| POST | /api/resources/:type/:name/mandatory | Toggle mandatory flag `{mandatory}` |
| GET | /api/resources/:type/:name/canonical | Canonical resource instance |
| DELETE | /api/resources/:type/:name | Delete resource |
| DELETE | /api/mcps/:name?configPath= | Remove MCP server entry |
| POST | /api/mcps | Add MCP server `{name, params}` |
| POST | /api/mcps/test | Probe MCP server `{name, params}` |
| POST | /api/platforms | Add platform `{id, rootPath, projectDirName}` |
| POST | /api/platforms/purge | Remove platform folders from projects `{platformIds}` |
| POST | /api/projects/roots | Add project scan root `{scanPath}` |
| POST | /api/projects/import | Import project paths `{paths}` |
| DELETE | /api/projects/:projectId | Remove a project |
| POST | /api/debug/log | Agent debug hypothesis log |
| POST | /api/refactor | LLM-assisted API refactor `{resourceType, content, userPrompt}` |
| GET | /api/events | SSE scan-changed stream (server.ts). Server also refreshes its scan cache on every event (watcher + 2-min timer + after mutations), so page reads never trigger a scan |
| GET | /api/health | Liveness probe (server.ts) |

CLI: `scripts/janus-cli.ts` — `janus service start|status|restart`, `run`,
`port`, `remove`, `status`, `ide enable --ide=<id>` (imports
`syncEnabledPlatformsToProjects` for IDE enable).
