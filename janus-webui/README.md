# Janus Web UI

Installable PWA for [Janus](https://github.com/ArminDashti/janus) — manage Skills, Rules, MCPs, Hooks, Sub-agents, and Tools across AI platforms.

Talks to [janus-api](https://github.com/ArminDashti/janus-api) at `http://127.0.0.1:8005` by default. The desktop Electron app is separate.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs on [http://127.0.0.1:8006](http://127.0.0.1:8006). Service worker is **off** in dev (`devOptions.enabled: false`).

```
VITE_API_BASE_URL=http://127.0.0.1:8005
```

## Build / installable PWA

```bash
npm run build
npm run preview
```

Open the preview URL in Chrome/Edge → install icon in the address bar (standalone app).

### Caching policy (heavy app-shell)

| Traffic | Strategy |
|---------|----------|
| Precached JS/CSS/HTML/icons/logos/fonts | Precache + CacheFirst |
| Google Fonts | CacheFirst |
| Same-origin static (script/style/font) | CacheFirst |
| SPA navigations | `index.html` (offline shell) |
| Janus API / SSE on other localhost ports | **NetworkOnly** (never cached) |

Icons: `public/icons/icon-192.png`, `public/icons/icon-512.png` (manifest + browser install).

## Architecture

- `src/api/client.ts` — `window.agentManager` REST client
- `src/sw.ts` — Workbox `injectManifest` service worker
- `src/` — UI aligned with the desktop Janus renderer
- `public/logos/`, `public/branding/`, `public/icons/` — static assets
