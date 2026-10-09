# Janus

Desktop-style local app for managing AI agent resources — Skills, Sub-agents,
MCPs, and Projects — across multiple IDE/CLI platforms (Claude, Cursor, Codex,
etc.). Janus keeps one canonical copy of each resource and syncs it into every
enabled platform location, globally and per project.

Tech stack: Fastify API (`janus-api`, TypeScript/Node, tsx runtime, no DB —
file-system + settings.json as store) and React 19 + Vite + Tailwind + Zustand
WebUI (`janus-webui`, installed as a PWA).

Run: `janus` service (see `scripts/janus-cli.ts`), or dev mode:
`npm run dev` in `janus-api` (API on port 47911) and `npm run dev` in
`janus-webui` (Vite). Entry points: `janus-api/src/server.ts`, `janus-webui/src/main.tsx`.
