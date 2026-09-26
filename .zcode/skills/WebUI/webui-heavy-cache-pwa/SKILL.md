---
name: webui-heavy-cache-pwa
description: >-
  Requires every WebUI app to ship heavy client caching and full PWA support
  (manifest, service worker, installable offline shell).
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: webui
  tags: [webui, pwa, cache, service-worker, offline, workbox]
  last_updated: "2026-08-07 10:13:06"
  uuid: c827422a-1998-4633-ba08-7b4c297ec016
---

# WebUI Heavy Cache and PWA

## When to use

- Creating, scaffolding, or rewriting any WebUI / SPA / frontend app
- Adding or changing build, deploy, or static-asset delivery for a WebUI
- Reviewing whether an existing WebUI meets cache + PWA baseline
- Related: `../webui-test-functionality/`
- Exclusions: API-only / backend-only work; native mobile (unless the UI is a web/PWA shell); do not weaken caching for “dev convenience” in production builds

## Objective

1. Every WebUI is **heavy-cached** — static shell and assets load from cache aggressively; network is secondary for repeat visits
2. Every WebUI is a **PWA** — installable, with manifest + service worker + offline-capable app shell
3. Agents apply this baseline by default when building or changing WebUI apps (all projects)

## Guidelines

### Mandatory PWA

Every WebUI **must** include:

| Piece | Requirement |
|-------|-------------|
| Web app manifest | `manifest.webmanifest` (or framework equivalent) with `name`, `short_name`, `start_url`, `display` (`standalone` or `minimal-ui`), `background_color`, `theme_color`, icons |
| Icons | At least 192×192 and 512×512 PNG (maskable preferred); linked from HTML and manifest |
| Service worker | Registered from the app entry; controls caching and offline shell |
| Installability | Meets browser install criteria (HTTPS or localhost, SW, valid manifest) |
| Offline shell | App chrome / last shell loads offline; show a clear offline state for failed data fetches |
| Meta | `theme-color`, apple touch icon when targeting iOS Safari |

Prefer Workbox (or the framework’s official PWA plugin that uses Workbox) over hand-rolled SW logic unless the project already has a maintained custom SW.

### Mandatory heavy caching

| Asset class | Strategy | Notes |
|-------------|----------|-------|
| Hashed JS/CSS/fonts/images | **Cache-First** (precached) | Long-lived; content-hash in filename |
| App shell / `index.html` | **Stale-While-Revalidate** or Network-First with cache fallback | Must still work offline |
| Same-origin static media | **Cache-First** with size/age limits | Precache critical; runtime-cache the rest |
| API / JSON (GET) | **Network-First** with cache fallback **or** Stale-While-Revalidate | Never treat mutations as cacheable by default |
| Auth / user-private responses | **Network-Only** | Do not put tokens or private payloads in Cache Storage |

Also:

- Production builds: far-future `Cache-Control` for hashed assets (`immutable` when filenames are hashed)
- HTML / SW / manifest: short or revalidating cache so updates can roll out
- Precache the minimum set that makes the shell usable offline; runtime-cache the rest
- On new deploy: version the SW so clients get updates; avoid silent stuck-old-SW forever
- Dev server may skip SW; production and preview builds **must** enable it

### Default stack choices

| Stack | Prefer |
|-------|--------|
| Vite (Vue/React/Svelte/…) | `vite-plugin-pwa` + Workbox |
| Next.js | Official / maintained PWA path for that major version (or Workbox custom) — still meet the same baseline |
| Other bundlers | Workbox + manifest generation; same strategies as above |

Match the repo’s existing PWA tooling when present; do not add a second SW stack.

### Agent checklist (new or existing WebUI)

- [ ] Manifest present and linked from HTML
- [ ] Icons 192 + 512 (maskable if possible)
- [ ] Service worker registered; production build emits SW
- [ ] Precache / heavy Cache-First for hashed static assets
- [ ] Offline shell works (load app with network off after first visit)
- [ ] API GETs: Network-First or SWR with fallback; mutations Network-Only
- [ ] Private/auth responses not cached in SW
- [ ] Update path defined (SW version / skipWaiting policy documented in code comments only if non-obvious)

If any item fails during create/edit work, fix it in the same change set unless the user explicitly scopes PWA/cache out.

## Safety rules

1. **Always** treat heavy cache + PWA as required for every WebUI unless the user explicitly opts out for that project/task.
2. **Always** keep auth tokens and private API responses out of Cache Storage.
3. **Always** use hashed filenames (or equivalent) before applying long-lived Cache-First on assets.
4. **Never** ship a production WebUI without a service worker and a valid installable manifest.
5. **Never** Cache-First mutable HTML or unversioned bundles in a way that traps users on a broken deploy with no update path.
6. **Never** cache `POST`/`PUT`/`PATCH`/`DELETE` responses as the default strategy.
7. **Never** invent a second caching layer that fights the project’s existing Workbox/PWA plugin — extend it instead.
8. **Always** use forward slashes in paths.

## Examples

**Example 1 — New Vite + Vue WebUI**

- Input: “Create `foo-webui` from scratch”
- Output: App includes `vite-plugin-pwa`, `manifest.webmanifest`, 192/512 icons, Workbox precache for hashed assets, Network-First for API GETs, offline shell verified once after first load

**Example 2 — Existing SPA with no SW**

- Input: “Add a settings page to `bar-webui`”
- Output: Implement the page **and** bring the app up to this skill’s PWA + heavy-cache baseline in the same effort (or call out the gap and fix it if the user already opted out)

**Example 3 — Opt-out**

- Input: “Skip PWA for this prototype”
- Output: Follow the explicit opt-out for that task only; do not treat it as a global exception for later WebUI work
