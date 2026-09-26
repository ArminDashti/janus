---
name: local-remote-sync-github
description: >-
  Aligns the local GitHub root with the authenticated GitHub account by
  renaming local folders and origin URLs to match live GitHub repo names,
  removing local git clones whose remote repo no longer exists, and cloning
  remote repos that are missing locally.
disable-model-invocation: false
metadata:
  version: "2.0.0"
  author: Armin Dashti
  category: git
  tags: [github, sync, clone, prune, rename, mcp, token, windows]
  last_updated: "2026-09-11 01:10:00"
  uuid: 75dd7ea8-11f1-493f-899e-a672097a794d
---

# Local Remote Sync GitHub

## When

- User asks to sync local GitHub folders with the remote GitHub account at the repo-folder level
- User names `local-remote-sync-github`, `sync-local-with-remote-in-github`, `github-repos-sync`, or former `github-sync`, or wants local folder names aligned with GitHub, local repos removed when the GitHub remote is gone, and missing GitHub repos cloned locally
- Triggers: "local-remote-sync-github", "sync-local-with-remote-in-github", "github-repos-sync", "github-sync", "sync local with GitHub", "rename local folders to match GitHub", "remove local repos not on GitHub", "clone missing GitHub repos"
- Exclusions: no pull, commit, push, merge, or bidirectional content sync (use `github-pull-all` or `commit-push-to-github`)
- Exclusions: do not scan or mutate `C:/Users/armin/.cursor` unless the user explicitly includes that root
- Related: `../github-pull-all/` (pull existing clones); `../commit-push-to-github/` (commit and push); `../group-repos-under-umbrella/` (fold flat repos under umbrella)

## How

### Step 1: Resolve owner and local root

1. Call `GetDynamicTools` for `user-github`, then `get_me` — record `login` (default owner: `ArminDashti`)
2. If the user names another owner/org, use that instead
3. Local GitHub root by device:

| Device | Root |
|--------|------|
| `ARMIN-DESKTOP` | `C:/Users/armin/GitHub` |
| `PC-DASHTII` | `C:/Users/a.dashti/GitHub` |

4. Ensure the root folder exists; create it if missing
5. If owner or root is unclear, ask **one** clarifying question and stop

### Step 2: Auth — GitHub MCP first, then token

1. **Primary:** `user-github` → `get_me` for identity; on 401/403 call `mcp_auth` on `user-github`, then retry
2. **Listing all repos (including private)** requires authenticated REST/`gh` — GitHub search API does not return private repos:
   - Resolve token: `$env:GITHUB_TOKEN` → `$env:GH_TOKEN` → User/Machine `GITHUB_TOKEN` / `GH_TOKEN` / legacy `GITHUB_TOKEN_PAT`
   - Set `$env:GITHUB_TOKEN` and `$env:GH_TOKEN` for `gh`/git; never echo the value
3. Prefer `user-windows-mcp` → `PowerShell` for local `git` and filesystem work (timeout 300–600s per repo); Cursor `Shell` is allowed on token fallback
4. Abort with a clear message only if both MCP identity and token/API listing fail

### Step 3: List remote repos

Paginate until empty (100 per page):

```powershell
gh api user/repos --paginate -q '.[].name' 2>$null
# or when --owner differs from authenticated user:
gh api "users/$owner/repos?per_page=100&type=all" --paginate
```

REST fallback (authenticated user — includes private):

```text
GET https://api.github.com/user/repos?per_page=100&page={n}&type=all&sort=updated
Authorization: Bearer <token>
```

Record for each repo: `name`, `clone_url`, `archived`, `fork`, `private`.

Build `remote_names` as the set of live GitHub repo names for the target owner.

### Step 4: Discover local git repos

Direct children of the GitHub root only (not recursive):

```powershell
Get-ChildItem -Path "C:/Users/armin/GitHub" -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName ".git") } |
  ForEach-Object { $_.Name }
```

For each local repo, also read `git remote get-url origin` when present.

### Step 5: Align local names with GitHub

For every local git repo, resolve the live GitHub identity the same way as `../github-pull-all/` Step 2b:

1. Parse `origin` → `owner` + `repo` (strip `.git`; support `https://github.com/...` and `git@github.com:...`)
2. Resolve the live GitHub repo (MCP first, else `gh`/REST). GitHub follows rename redirects
3. Read live `full_name` / `name` and `clone_url` / `html_url`
4. Compare local folder name and origin path with the live GitHub name

**When the live repo exists under the target owner**

| Mismatch | Action |
|----------|--------|
| `origin` URL uses old repo name | Update `origin` to the live clone URL, keeping HTTPS vs SSH scheme: `git remote set-url origin <live-clone-url>` |
| Local folder name ≠ live GitHub `name` | Rename folder to `<root>/<live-name>` when destination is free |
| Both already match | No change — `already_synced` |

**Rename rules**

1. Destination must be `<root>/<live-name>` and must not already exist
2. If destination already exists → do **not** overwrite; keep the current folder; mark `blocked_folder_rename`; still update `origin` when the URL is stale
3. On dry run, record `would_rename` (old → new) and `would_update_origin`; do not rename or change remotes
4. After a successful rename, use the new path for all later steps in this run

**When no live GitHub repo resolves**

- Do not rename the folder
- The folder enters the remove set in Step 6

### Step 6: Compute folder diff

| Set | Rule |
|-----|------|
| `to_remove` | Local git folders with no live GitHub match after Step 5 |
| `to_clone` | Remote repo names with no local folder at `<root>/<name>` after renames |
| `already_synced` | Local folder name and `origin` already match the live GitHub repo |

Re-scan local folder names after Step 5 before building `to_clone`.

Optional flags when the user asks:

| Ask | Behavior |
|-----|----------|
| Dry run | List `would_rename`, `would_update_origin`, `to_remove`, and `to_clone`; no rename, remote, delete, or clone |
| Skip forks | Do not clone when `fork` is true |
| Skip archived | Do not clone when `archived` is true |
| Force remove | Delete even when local branch is ahead of origin |

### Step 7: Remove local repos not on GitHub

For each folder in `to_remove` (sorted by name):

1. If not `force remove` and the repo has unpushed commits (`git log @{u}..HEAD` succeeds and is non-empty, or `git status -sb` shows ahead), mark `blocked_unpushed` and skip deletion
2. If dry run, record `would_remove` only
3. Else delete the folder: `Remove-Item -LiteralPath "<root>/<name>" -Recurse -Force`
4. On success, record `removed`; on error, record `failed_remove` and continue

Do not delete:

- Folders without `.git` (not git repos)
- Local git repos whose `origin` still resolves to a live GitHub repo under the target owner
- Any path outside the resolved GitHub root

### Step 8: Clone missing GitHub repos

For each repo in `to_clone` (sorted by name):

| Local state | Action |
|-------------|--------|
| No folder `<root>/<name>` | `git clone <clone_url> "<root>/<name>"` |
| Folder exists with `.git` | Skip — `already_cloned` |
| Folder exists without `.git` | Skip — `blocked_exists`; do not overwrite |
| User asked skip forks/archived | Skip with `skipped_fork` / `skipped_archived` |
| Clone fails | Record `failed_clone`; continue |

After each successful clone, confirm `.git` exists.

### Step 9: Refresh inventory (optional)

When `C:/Users/armin/GitHub/armin-command-center/projects.md` exists:

- Update `dir` and `project-name` rows when a folder was renamed in Step 5
- Remove rows whose `dir` points at a deleted local folder
- Add rows for newly cloned repos using the same column layout (`project`, `project-name`, `dir`, `description`)

Skip this step on dry run.

### Step 10: Final report

| State | Meaning |
|-------|---------|
| `folder_renamed` | Local folder renamed to the live GitHub repo name |
| `would_rename` | Dry-run rename candidate (old → new) |
| `remote_renamed` | `origin` URL updated to the live GitHub repo |
| `would_update_origin` | Dry-run origin URL update |
| `blocked_folder_rename` | Live GitHub name already exists as another folder; origin may still be updated |
| `removed` | Local git folder deleted because no live GitHub repo matched |
| `would_remove` | Dry-run delete candidate |
| `blocked_unpushed` | Local repo ahead of origin; not deleted unless force remove |
| `failed_remove` | Delete error |
| `failed_rename` | Folder rename error |
| `cloned` | New clone created under root |
| `already_cloned` / `already_synced` | Folder and origin already matched remote |
| `blocked_exists` | Same-named non-git folder blocked clone |
| `skipped_fork` / `skipped_archived` | Filtered by user request |
| `failed_clone` | Clone error |

Report: owner, root, remote count, local git count, renamed, origin updates, removed, cloned, blocked, failed — keep the list scannable.

## Always

1. Run Step 5 for every local git repo before delete or clone work.
2. Keep local folder names aligned with live GitHub repo names whenever the destination folder is free.
3. Continue the full run when one rename, delete, or clone fails; report all failures at the end.
4. Use forward slashes in paths written in reports and skill text.

## Never

1. Print, log, or commit token values.
2. Delete or overwrite a folder outside the resolved GitHub root.
3. Pull, commit, push, merge, or stash as part of this skill.
4. Delete a local git repo that still resolves to a live GitHub remote after rename checks.
5. Overwrite an existing destination folder when renaming for a GitHub rename.
6. Default to `C:/Users/armin/Documents/GitHub` as a root on any device.

## Example

**Example 1 — Balanced sync**

- Input: `/local-remote-sync-github`
- Flow: 42 remotes, 40 local git folders → 1 folder renamed to match GitHub; 2 missing remotes cloned; 1 local folder with no GitHub match removed; report renamed + cloned + removed names

**Example 2 — Dry run**

- Input: "local-remote-sync-github dry run"
- Flow: Lists 2 folders that would be renamed, 3 that would be removed, and 2 repos that would be cloned; no filesystem or remote changes

**Example 3 — Unpushed local work blocks delete**

- Input: `/local-remote-sync-github`
- Local: `old-experiment` has commits not on any remote
- Flow: skips delete as `blocked_unpushed`; clones missing remotes; tells user to push, backup, or rerun with force remove

**Example 4 — GitHub rename aligns local folder**

- Input: `/local-remote-sync-github`
- Local folder `legacy-api` with `origin` → live GitHub repo `helix-api`
- Flow: updates `origin` to `…/helix-api.git`; renames folder to `helix-api`; does not clone again; reports `remote_renamed` + `folder_renamed`

**Example 7 — Destination folder already exists**

- Input: `/local-remote-sync-github`
- Local: `old-name` → live GitHub `new-name`, but `C:/Users/armin/GitHub/new-name` already exists
- Flow: updates stale `origin` only; leaves folder as `old-name`; reports `blocked_folder_rename`

**Example 5 — Non-git folder left alone**

- Input: "remove local repos not on GitHub"
- Local child `design-mockups/` has no `.git`
- Flow: folder ignored; only git repos evaluated for removal

**Example 6 — Name collision blocks clone**

- Input: `/local-remote-sync-github`
- Remote `new-app` missing locally, but folder `new-app/` exists without `.git`
- Flow: skip clone as `blocked_exists`; report so the user can rename or remove the blocking folder manually
