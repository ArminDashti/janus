---
name: create-repos
description: >-
  Creates one public GitHub umbrella repository per app name and scaffolds
  Gin plus PostgreSQL API and Vue, Tailwind, Shadcn, Inter WebUI as sibling
  folders *-api and *-webui inside that single repo unless the user overrides.
disable-model-invocation: false
metadata:
  version: "2.0.0"
  author: Armin Dashti
  category: github
  tags: [github, repos, umbrella, gin, postgresql, vue, shadcn, scaffold, public]
  last_updated: "2026-08-30 18:12:24"
  uuid: 3bfd1d23-f052-42d2-a3b4-cfd89676f3a2
---

## Overview
- It must create repository in user GitHub account.

## Workflow
1. Get name of repo from user.
2. Create the repo in GitHub user by MCP.
3. This 

### Step 2: Identity, root, collisions

1. `GetMcpTools` on `user-github`, then `get_me` — owner = `login` (expect `ArminDashti`). On 401/403: `mcp_auth` for `user-github`, retry
2. Local root: `C:/Users/armin/GitHub` on `ARMIN-DESKTOP` (folder `<root>/<repo-name>`)
3. For each **GitHub repo name** (bare token → `foo`; exact suffix → that name), skip and report if **either** is true:
   - GitHub: `search_repositories` query `repo:ArminDashti/<name>` (or `get_file_contents` on that repo) shows it exists
   - Local: `C:/Users/armin/GitHub/<name>` already exists
4. Continue remaining names when some collide
5. Do **not** create separate remotes `foo-api` / `foo-webui` when the input was bare `foo`

### Step 3: Create public GitHub remotes

For each new **umbrella or exact** name, GitHub MCP `create_repository`:

| Argument | Value |
|----------|--------|
| `name` | Exact repo name (`foo`, or `foo-api` when the user gave that exact token) |
| `private` | **`false`** (MCP defaults to private — always set this) |
| `autoInit` | `false` (empty remote; local scaffold is the first commit) |
| `organization` | Omit (personal account) |
| `description` | User text, else `"<app> API and WebUI"` for bare names; `"<app> API"` / `"<app> WebUI"` for single-side exact names |

Fallback only if MCP cannot complete: `gh repo create <name> --public` (no `--private`). Never echo tokens (`GITHUB_TOKEN` / `GH_TOKEN`).

### Step 4: Scaffold locally

Create `C:/Users/armin/GitHub/<repo-name>/`. Do not overwrite an existing folder.

**Bare app name `foo`** — layout (one git root at `foo/`):

```text
C:/Users/armin/GitHub/foo/
  README.md                 # umbrella: how to run both sides
  .gitignore                # root ignores (.env, binaries, node_modules, etc.)
  foo-api/                  # Gin + PostgreSQL scaffold
  foo-webui/                # Vue + Tailwind + Shadcn + Inter scaffold
```

Do **not** run `git init` inside `foo-api` or `foo-webui`. Only the parent folder is a git repo.

**Exact single-side name** (`foo-api`, `foo-webui`, `foo-android`, …) — scaffold that project at the repo root (same stack tables below), not nested under a second stem folder.

**API default** (`*-api` folder or `*-api` repo) — Golang **Gin** + **Pgsql** (PostgreSQL) unless the user specifies another stack:

| Piece | Requirement |
|-------|-------------|
| Module | Umbrella: `github.com/ArminDashti/<stem>/<stem>-api`. Single-side repo: `github.com/ArminDashti/<repo-name>` |
| Layout | `cmd/server/main.go`, `internal/config`, `internal/http`, `internal/auth`, `internal/store`, `migrations/` |
| HTTP | Gin, CORS for the sibling WebUI origin, `GET /health` |
| DB | `docker-compose.yml` Postgres 16 inside the API folder; published host port that is **free** (do not blindly use `5432`); `.env.example` with `DATABASE_URL` |
| Auth (when the app has login) | Seed user `armin` / `dopadopa123` |
| Docs | Folder README (how to run); root umbrella README links both sides |

**WebUI default** (`*-webui` folder or `*-webui` repo) — **VueJS**, **Tailwind**, **Shadcn**, **Inter** sans, unless the user specifies another stack:

| Piece | Requirement |
|-------|-------------|
| App | Vue 3 + Vite + TypeScript |
| CSS | Tailwind; Inter via `@fontsource/inter` on `--font-sans` |
| UI | shadcn-vue (`new-york`, slate, CSS variables) |
| Routes | `vue-router`; category-based routes (each category its own page/subpages — not one combined list page) |
| PWA | Follow `C:/Users/armin/.cursor/plugins/local/webui-by-armin/skills/webui-heavy-cache-pwa/` (`vite-plugin-pwa` + Workbox) |
| Auth (when the app has login) | Sign-in works with `armin` / `dopadopa123` against the sibling API |
| Docs | Folder README (dev URL, API base URL); root umbrella README links both sides |

Copy `.env.example` → `.env` locally when needed to run; never commit `.env` or secrets.

### Step 5: Initial commit and push

In **each new umbrella (or exact single-side) repo** (not in `armin-command-center` unless the user asked to change that repo):

1. `git init` at `C:/Users/armin/GitHub/<repo-name>/` only — default branch `main`
2. Confirm there is **no** nested `.git` under `*-api` or `*-webui`
3. Stage scaffold files (exclude `.env`)
4. Commit with a short message, e.g. `Initial scaffold for <repo-name>`
5. `git remote add origin https://github.com/ArminDashti/<repo-name>.git`
6. `git push -u origin main`

Never force-push. Never change git config.

### Step 6: Inventory and report

1. Add **one** row per new GitHub repo to `C:/Users/armin/GitHub/armin-command-center/projects.md` (`project`, `project-name`, `dir`, `description`). For a bare app, describe both folders in one row (e.g. umbrella with `foo-api` + `foo-webui`).
2. Tell the user:

```text
Created:
- <repo-name>  public  https://github.com/ArminDashti/<repo-name>
  local: C:/Users/armin/GitHub/<repo-name>
  folders: <repo-name>-api, <repo-name>-webui   # omit folders line for single-side exact names
Skipped:
- <name>  <already on GitHub | local folder exists>
```

## Safety rules

1. **Always** create repos **public** (`private: false`) unless the user explicitly asks for private.
2. **Always** use GitHub MCP first; token/`gh` only when MCP cannot complete the task.
3. **Always** set `private: false` on `create_repository` — omitted means private.
4. **Always** for a bare app name create **one** remote and **two** folders (`*-api`, `*-webui`) — never two remotes.
5. **Always** default API to Gin + PostgreSQL and WebUI to Vue + Tailwind + Shadcn + Inter unless the user specifies another stack.
6. **Always** seed login apps with username `armin` and password `dopadopa123`.
7. **Always** skip a name that already exists on GitHub or locally — never overwrite.
8. **Never** create or convert `armin-command-center` (or the personal `.cursor` repo) to public.
9. **Never** put tokens, `.env` values, or extra secrets in the skill, README, or git.
10. **Never** force-push, amend a pushed commit, or update git config.
11. **Never** use `C:/Users/a.dashti` paths on `ARMIN-DESKTOP`.
12. **Never** drive the user's personal Chrome/Edge/Firefox to verify the WebUI.
13. **Never** `git init` inside the nested `*-api` or `*-webui` folders of an umbrella repo.

## Examples

**Example 1:** Bare app name (umbrella)

- Input: `create-repos example`
- Output: one public repo `example` at `https://github.com/ArminDashti/example` with local folders `example/example-api` (Gin + PostgreSQL) and `example/example-webui` (Vue + Tailwind + Shadcn + Inter); one push to `main`

**Example 2:** Bare app name (another stem)

- Input: `create-repos lexora`
- Output: public `lexora` only — folders `lexora-api` and `lexora-webui` inside it; **not** remotes `lexora-api` / `lexora-webui`

**Example 3:** Exact single-side names

- Input: `create repos mark-api mark-ui`
- Output: public `mark-api` and `mark-ui` as two separate remotes (user gave exact names); no extra `-webui` invented for `mark-ui`

**Example 4:** Stack override

- Input: `create repo notes-api in Rust`
- Output: public `notes-api` only, Rust API at repo root (not Gin); no WebUI folder unless asked

**Example 5:** Collision

- Input: `create-repos arvaz`
- Output: skip `arvaz` if that GitHub repo or `C:/Users/armin/GitHub/arvaz` already exists; report skipped; create nothing that would overwrite
