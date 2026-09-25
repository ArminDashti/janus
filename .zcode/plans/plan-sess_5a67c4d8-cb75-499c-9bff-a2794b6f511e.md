# Janus UI/UX overhaul — 15 items

**Repo layout:** `janus-webui` (React 19 + Vite + Tailwind, no router — page = Zustand state) and `janus-api` (Fastify, port 8005). Shared types are duplicated in `janus-webui/src/shared/types.ts` **and** `janus-api/src/shared/types.ts` — every type change must be made in both.

## Phase 0 — GitNexus baseline (repo mandate)

- No `.gitnexus/` index exists → bootstrap with `bunx gitnexus@latest analyze` (npm 11 npx is broken per AGENTS.md).
- Run `impact` (upstream) before editing each major symbol (`PlatformsTab`, `ResourcePage`, `SkillsPage`, `McpsPage`, `mcp-probe.service`, `startup.service`, scanner/assignment services for the Tools removal). Report HIGH/CRITICAL risks before proceeding.

## Phase 1 — Remove the Tools feature first (item 13)

Do this early so later work doesn't touch dead code. Keep **MCP tools** (`McpTool`, McpsPage tool lists, probe `tools/list`) — only the standalone `tool` resource type goes.

**WebUI:** delete `pages/ToolsPage.tsx`; remove from `App.tsx` (import + `case 'tools'`), `stores/appStore.ts` (`PageId`, `emptyScan.tools`), `layout/Sidebar.tsx` (Hammer entry + import), `lib/filter-utils.ts` (`'tool'` from `ListableResourceType` + `FILTER_KEYS`), `RepositoriesPage.tsx` (Tools tab + copy), `ResourcePage.tsx` (`resourceType === 'tool'` rename guard), `ResourceEditView.tsx` (`ToolResource` branches), `shared/types.ts` + `shared/defaults.ts` (`'tool'` in `ResourceType`, `assignments.tools`, `mandatoryForAllProjects.tools`, `ToolResource`, `ScanResult.tools`), `api/types.ts` (`ToolResource`), package.json/README mentions.

**API:** `routes/index.ts` (`RESOURCE_TYPES`/`NON_MCP_RESOURCE_TYPES`), `shared/types.ts` + `shared/defaults.ts` (same as webui), `services/resource.service.ts` (type→dir maps, trash kind, token estimate), `assignment.service.ts` (`assignTool` + dispatch), `scanner.service.ts` (`PLATFORM_SCAN_TYPES`, tools scan block), `platform-sync.service.ts`, `file.service.ts` (`'tools'` trash kind), `watcher.service.ts` (toolsDir watch), `project-bootstrap.service.ts` (`.keep`), `app-paths.ts` (`.trash/tools`), `platforms/types.ts` + `platforms/index.ts` (`toolsDir`, `'tool'` in `supportedResources`).

**Legacy tolerance:** existing `settings.json` files may still contain `assignments.tools` — code must ignore extra keys (no strict validation; verify settings-store just spreads). Do **not** delete users' `.trash/tools` data.

## Phase 2 — Shared iOS-style Toggle (items 1, 3 UI)

Rewrite `janus-webui/src/components/Toggle.tsx` as the single iOS-style switch:
- Track `h-6 w-11 rounded-full`, knob `h-5 w-5 rounded-full bg-white shadow`, `transition-transform duration-200`, checked → `translate-x-5`, on = `bg-emerald-500` (iOS green), off = `bg-zinc-600`, focus ring, `role="switch"`/`aria-checked`, disabled support.
- Replace the local `Switch` in `PlatformsTab.tsx:35-64` (delete it, import shared `Toggle`).
- Replace the plain checkbox in `GeneralTab.tsx:110-114` ("Run Janus when Windows starts") with this Toggle; keep the existing Save flow.
- `SkillsPage` ProjectPanel already uses `Toggle` → picks up new style automatically.

## Phase 3 — Real Windows autostart (item 3 backend)

- Implement `janus-api/src/services/startup.service.ts` (currently a no-op stub): `applyStartupSetting(runOnLogin)` → on win32, `reg.exe add/delete HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v Janus /d "<launcher>"`; no-op on other platforms and when launcher path unknown. Launcher = whatever `scripts/install-local.ps1` / `build-janus-exe.ps1` installs (inspect these scripts to get the exact path; fall back to documented exe path).
- Also apply the setting at server boot (not only on `POST /api/settings` — `routes/index.ts:98`) so toggling persists across restarts.

## Phase 4 — Settings/Platforms (items 2, 12, 11)

**Research first (web search):** for `zcode` (zcode.z.ai/en), `hermes`, `grok` (grok.com/build), `kiro` (kiro.dev) — find their real global config dir and in-project folder name (hints already in repo: `~/.zcode` is used by this very machine; `kilo` exists with `~/.config/kilo` / `.kilo`). Also search official **transparent-background logos** (SVG preferred, PNG acceptable) for these + refresh placeholder glyphs for existing platforms.

**Code changes (both `shared/types.ts` copies):**
- Add `'zcode' | 'hermes' | 'grok' | 'kiro'` to `PlatformId`; extend `PLATFORM_IDS`, `PLATFORM_LABELS`, `DEFAULT_PLATFORM_ROOTS`, `DEFAULT_PLATFORM_PROJECT_DIRS` (researched values).
- Add 4 adapters in `janus-api/src/platforms/index.ts` via `makeAdapter(id, label, false)` (skills/rules/mcp; no hooks/agents).
- Logos: add `zcode.svg` (missing) + real logos into **both** `janus-webui/public/logos/` and `janus-api/resources/logos/`; if only PNG found, extend `PlatformLogo.tsx`/`client.ts getLogoPath` to fall back `.svg → .png → initials`.
- Consumers (`ensurePlatforms`, settings-store `knownIds`, bootstrap/cleanup services) pick up new IDs automatically — verify.

## Phase 5 — Skills & Rules pages (items 4, 5, 6, 10)

**Item 10 — Rules gets the full Skills 3-panel layout:** build a real `RulesPage.tsx` modeled on `SkillsPage.tsx` using `ThreePanelLayout`:
- **Left:** rule list with search + row **delete icon** (item 4 — confirm dialog via `showMessage`, `deleteResource('rule', key)`, same as ResourceListView's handler), plus an "Apply all to projects" button to preserve the existing bulk action.
- **Middle:** generalize SkillsPage's `ProjectPanel` into `components/resources/ProjectPanel.tsx` with a `resourceType` prop (instant per-toggle save via `applyProjectAssignment` + `setMandatory`, live `n/m` counts, project search, min-1 guard) — used by both Skills and Rules.
- **Right:** rule content — `MarkdownEditor` on the rule's `.mdc` file (load via `getCanonicalResource('rule', …)` / `readFile`, save via `writeFile`), file-tab row if multiple files.
- **Skills left list:** add the same row delete icon (item 4).
- Remove the now-unused Install/assign flow: `ResourceAssignView.tsx` (delete), `onAssign`/`showInstall`/`ResourcePage` assign view wiring. Rules stop using `ResourcePage` (Hooks/SubAgents keep it).

**Item 6 — remove the header:** delete the `<header>` block in `SkillContent` (`SkillsPage.tsx:326-351`) — this is exactly what the XPath resolves to (right panel of the 3-panel group). Skill name/badges/root-path disappear; the "Invalid structure" state remains visible in the list via `StructureWarningIcon`. Apply the same no-header treatment to the new Rules right panel.

**Item 5 — Copy button:** in `MarkdownEditor.tsx` toolbar, add a `Copy` button beside `Save` (copies current draft via `navigator.clipboard.writeText`, brief "Copied!" feedback). Same pattern added to `JsonEditor.tsx` so non-md skill files get it too. Covers both Skills and Rules editors.

## Phase 6 — MCP page (items 9, 15)

**Item 9 — tools in a modal:** new `McpToolsModal.tsx` (reuse the existing `fixed inset-0 bg-black/60 z-50` overlay pattern from the Add-MCP modal): shows status, count, and the tools grid (name + description).
- List view: "N tools" button opens the modal (delete the inline expanded `<tr>`, `expanded` state).
- Edit view: replace the bottom `max-h-48` tools section with an "Open tools" button → same modal.

**Item 15 — stop the terminal spam:**
1. `mcp-probe.service.ts:53` — add `windowsHide: true` to `spawn()` (this is the direct cause of flashing console windows on Windows).
2. Add a short-TTL in-memory probe-result cache keyed by server name + params hash (e.g. 5 min) so re-opening the page doesn't re-spawn unchanged servers; in-flight dedupe already exists in scanner.
3. `McpsPage.tsx` mount effect keeps one initial probe (StrictMode double-fire is absorbed by the cache/in-flight dedupe).

## Phase 7 — Search-field dropdown (item 14)

- `UiFilterState` (both types.ts): add `searchField: 'name' | 'tags' | 'category'`, default `'name'`; add to `DEFAULT_UI_FILTER`/`mergeUiFilter` (auto-migrates persisted filters).
- Backend: in `resource.service.ts` `getGroupSummaries`, extend the existing frontmatter parse (`extractDescription`) to also surface `tags?: string[]` and `category?: string` on `ResourceGroupSummary` (both types.ts) — **category only if present in the file; never invent it** (per your answer: "if exists, consider it, if not, leave it").
- UI: add a compact dropdown beside the search input in `ResourceListToolbar.tsx` (styled native select or the `ProjectFilterDropdown` portal pattern) offering Name / Tags / Category; default Name. Same dropdown beside the Skills-list filter. Filter logic in `ResourceListView.filtered` and `SkillsPage.filtered` picks the haystack by `searchField`.

## Phase 8 — Theme text + fonts (items 7, 8)

**Item 7 — whiter text in dark themes** (`index.css`): in each dark block (`vscode-dark`, `github-dark`, `dracula`, `monokai`, `one-dark`, `nord`, `catppuccin-mocha`) brighten `--dp-fg` and the `--c-zinc-100/200/300` text roles toward white (e.g. vscode-dark `#cccccc → #f2f2f2`, zinc-100 `231→243`, etc.). `github-light` untouched. Keep contrast hierarchy (500/400 muted steps stay dimmer).

**Item 8 — top-10 fonts in Settings:** add `font: string` to `AppSettings` (both types.ts + defaults + settings template). `GeneralTab` Appearance section gets a font picker grid (each option rendered in its own font): **Segoe UI (default), Arial, Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Source Sans 3**. Selecting saves immediately (same pattern as theme) + injects a Google Fonts `<link>` for the chosen family and sets `--app-font` on `documentElement`; `index.css` body + `tailwind.config.js` `fontFamily.sans` read `var(--app-font, 'Segoe UI', …)`. Cache-first SW route for google-fonts already exists.

## Phase 9 — Verification

- `janus-api`: `tsc --noEmit`. `janus-webui`: `tsc -b && vite build`.
- Boot both dev servers; smoke-test with the browser skill: Settings→Platforms (new cards, iOS toggles, logos), Settings→General (font picker, startup toggle), Skills (delete, copy, no header), Rules (3-panel, toggles), MCP (tools modal, **no console windows**), each dark theme's text brightness.
- GitNexus `detect_changes --scope all` at the end; report results. No commit unless you ask.

**Risks:** (a) Rules 3-panel is the largest change — `ResourceAssignView` removal ripples through `ResourcePage` props; (b) Tools removal touches ~40 sites — compiler will catch strays; (c) registry autostart depends on what path the local installer actually creates (will verify from `scripts/` before writing); (d) real logos depend on what's findable with transparent backgrounds — placeholders remain as fallback.