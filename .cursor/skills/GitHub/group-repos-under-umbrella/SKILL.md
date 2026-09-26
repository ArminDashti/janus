---
name: group-repos-under-umbrella
description: >-
  Moves an existing *-api and *-webui pair under a parent folder, detaches
  nested .git directories so only the parent is a git repo, commits the
  project folders into that repo, creates or reuses the parent on GitHub,
  pushes until GitHub lists both folders (Credential Manager hang recovery),
  and updates projects.md without deleting source or GitHub remotes.
disable-model-invocation: false
metadata:
  version: "2.1.0"
  author: Armin Dashti
  category: git
  tags: [github, umbrella, monorepo, folder, api, webui, detach, windows, push]
  last_updated: "2026-08-30 15:57:00"
  uuid: 1e636cfa-f1b3-4b49-bee9-4906b182b105
---

# Group Repos Under Umbrella

## When

- User asks to place `*-api` and `*-webui` inside one parent folder that is the only git repo
- User names `group-repos-under-umbrella`, or wants `example/example-api` and `example/example-webui` with only `example` as git
- User asks to detach nested clones from git and keep the code as folders in a new parent repo
- Exclusions: does not delete source files, project folders, or GitHub remotes (`example-api` / `example-webui` stay on GitHub as leftover remotes)
- Exclusions: does not merge GitHub remotes, does not `gh repo delete`, does not rewrite GitHub child history
- Related: `../create-repos/` (scaffold new api/webui pairs); `../github-sync/` (flat GitHub-root discovery only); `../rename-github-repo/` (rename remotes)

## How

### Step 1: Resolve stem, paths, and owner

1. **Stem** — project group name (e.g. `example` from `example-api` + `example-webui`). If the user names only the parent folder, derive child names as `<stem>-api` and `<stem>-webui` unless they name different folder names.
2. **Owner** — `user-github` → `get_me` (default `ArminDashti`). On 401/403: `mcp_auth` on `user-github`, retry.
3. **Local GitHub root** by device:

| Device | Root |
|--------|------|
| `ARMIN-DESKTOP` | `C:/Users/armin/GitHub` |
| `PC-DASHTII` | `C:/Users/a.dashti/GitHub` |

4. **Paths** (forward slashes in docs; Windows paths on disk):

| Role | Path |
|------|------|
| Parent folder + the only git repo | `<root>/<stem>/` |
| API folder (not a git repo after this skill) | `<root>/<stem>/<stem>-api/` |
| WebUI folder (not a git repo after this skill) | `<root>/<stem>/<stem>-webui/` |

5. If stem, child names, or root is unclear, ask **one** clarifying question and stop.

### Step 2: Verify source folders exist

1. Confirm both child folders exist locally **or** can be cloned from GitHub into the nested path. Success is “source trees present”, not “they must stay git repos”.
2. If a child is missing locally but exists on GitHub, clone it into the final nested path after Step 3 (clone is copy-in, not delete).
3. If a child is missing locally and missing on GitHub, stop. Do not invent an empty project.
4. Record each child `origin` URL only for the report. Do not change those GitHub remotes. Do not push to them after detach.

### Step 3: Create parent folder and move children

1. Create `<root>/<stem>/` when missing.
2. Move children from flat layout when they still live at `<root>/<stem>-api` and `<root>/<stem>-webui`:

```powershell
New-Item -ItemType Directory -Path "<root>/<stem>" -Force
Move-Item -Path "<root>/<stem>-api"   -Destination "<root>/<stem>/<stem>-api"
Move-Item -Path "<root>/<stem>-webui" -Destination "<root>/<stem>/<stem>-webui"
```

3. Skip move when children are already nested under `<root>/<stem>/`.
4. After move, confirm source files are still on disk (`package.json`, `go.mod`, `src`, or equivalent). Stop if a tree is empty or missing.

### Step 4: Detach nested git (folders stay)

1. Remove **only** the nested git metadata directories. Do not remove the project folders.

```powershell
if (Test-Path "<root>/<stem>/<stem>-api/.git") {
  Remove-Item -Recurse -Force "<root>/<stem>/<stem>-api/.git"
}
if (Test-Path "<root>/<stem>/<stem>-webui/.git") {
  Remove-Item -Recurse -Force "<root>/<stem>/<stem>-webui/.git"
}
```

2. Confirm `Test-Path ".../<stem>-api/.git"` and `".../<stem>-webui/.git"` are `$false`.
3. Confirm the same folders still contain their source files.
4. If a parent `.gitignore` lists `<stem>-api/` or `<stem>-webui/`, delete those ignore lines (or the file if it would be empty). Nested clones must be tracked, not ignored.
5. Leave each child’s own `.gitignore` file in place (it is source, not a nested repo).

### Step 5: Initialize the parent git repo and add folders

1. If `<root>/<stem>/.git` already exists, skip `git init`.
2. Otherwise:

```powershell
Set-Location "<root>/<stem>"
git init -b main
```

3. Stage and commit the parent tree **including** the two project folders:

```powershell
Set-Location "<root>/<stem>"
git add <stem>-api <stem>-webui
git status
git commit -m "Add <stem>-api and <stem>-webui as folders in the <stem> repo."
```

4. Verify:

```powershell
git check-ignore -v <stem>-api <stem>-webui
git rev-parse --is-inside-work-tree
Test-Path "<stem>-api/.git"
Test-Path "<stem>-webui/.git"
```

Expected: `check-ignore` prints nothing for those folders; parent is a work tree; nested `.git` paths are absent; `git ls-files` lists files under both folders.

### Step 6: Create parent GitHub repo

1. Search `user-github` → `search_repositories` for `repo:<owner>/<stem>`.
2. When missing, `create_repository`:

| Argument | Value |
|----------|--------|
| `name` | `<stem>` |
| `private` | `false` (MCP defaults private — always set) |
| `autoInit` | `false` |
| `description` | `"<Stem> repo (contains <stem>-api and <stem>-webui folders)"` |

3. Set parent `origin` when absent:

```powershell
git remote add origin https://github.com/<owner>/<stem>.git
```

4. Do not delete, archive, or force-push `<owner>/<stem>-api` or `<owner>/<stem>-webui`.

### Step 7: Push the parent repo

Success is GitHub showing `<stem>-api/` and `<stem>-webui/` under `<owner>/<stem>`, not only a local commit.

1. From `<root>/<stem>`, push the project folders (not a two-line gitignore stub):

```powershell
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
Set-Location "<root>/<stem>"
git push -u origin main
```

2. If the push hangs (Git Credential Manager / no output for ~30s) or fails with `terminal prompts disabled` / `could not read Username`:
   - Stop the hung process only (`Stop-Process` on that pid / stray `git`). Do not `git reset --hard`. Keep the local commit and source trees.
   - Fill the stored GitHub credential. Never print `username`, `password`, or the Authorization header.

```powershell
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
$in = "protocol=https`nhost=github.com`nusername=x-access-token`n`n"
$raw = $in | git credential fill
if ($LASTEXITCODE -ne 0) { throw "credential fill failed" }
$user = ($raw | Select-String -Pattern '^username=(.*)$').Matches.Groups[1].Value
$pass = ($raw | Select-String -Pattern '^password=(.*)$').Matches.Groups[1].Value
if ([string]::IsNullOrWhiteSpace($pass)) { throw "no password" }
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${pass}"))
Set-Location "<root>/<stem>"
git -c "http.https://github.com/.extraheader=Authorization: Basic $auth" push -u origin main
```

3. After a successful push, `user-github` → `get_file_contents` on `owner/<stem>` path `/`. Expected: directories `<stem>-api` and `<stem>-webui` (not only `.gitignore` + `README.md`). Confirm local `git status -sb` is not `ahead`.
4. If credential fill has no password, then ask the user to authenticate and retry this step. Do not upload the whole tree with GitHub MCP `push_files` as the default (it creates a different commit than local `main`).
5. Never push the detached folders back to the old child remotes.

### Step 8: Update inventory

In `C:/Users/armin/GitHub/armin-command-center/projects.md`, ensure three rows for the stem:

| project | project-name | dir | description |
|---------|--------------|-----|-------------|
| `<stem>` | `<stem>` | `C:/Users/armin/GitHub/<stem>` | `<Stem> git repo (tracks <stem>-api and <stem>-webui folders)` |
| `<stem>` | `<stem>-api` | `C:/Users/armin/GitHub/<stem>/<stem>-api` | `<Stem> backend API (folder in <stem>, not a git repo)` |
| `<stem>` | `<stem>-webui` | `C:/Users/armin/GitHub/<stem>/<stem>-webui` | `<Stem> frontend WebUI (folder in <stem>, not a git repo)` |

Adjust descriptions when the user supplied better text.

### Step 9: Report result

Tell the user:

1. Final folder tree: `<stem>/<stem>-api`, `<stem>/<stem>-webui`.
2. Only `<stem>` is a git repo locally and on GitHub as the active origin.
3. Nested `.git` directories were removed; source files were not.
4. GitHub remotes `<stem>-api` and `<stem>-webui` were **not** deleted.
5. Sibling-relative paths (e.g. `../<stem>-webui` from `<stem>-api`) still work after nesting.
6. `github-sync` and `clone-all-repos` scan direct children of `<root>`: they will see `<stem>`. They may also try to clone leftover GitHub remotes `<stem>-api` / `<stem>-webui` as siblings — do not treat that as a reason to delete those remotes unless the user asks.
7. Give the parent GitHub URL. If leftover remotes still exist, name them and say they were not deleted.

## Always

1. After this skill, exactly one local git repo exists for the group: `<root>/<stem>`.

## Never

1. Delete project folders, source files, or GitHub remotes.
2. Use `git clean`, `git reset --hard`, or `rm` on the api/webui trees to “fix” git state.
3. Leave a nested `.git` under `<stem>-api` or `<stem>-webui` after detach.
4. Gitignore the nested project folders in the parent repo.
5. Leave GitHub `<owner>/<stem>` as a gitignore-only stub after grouping.
6. Print GitHub tokens, passwords, or Authorization headers.
7. Default to GitHub MCP `push_files` when `git credential fill` can push the local commit.

## Example

**Example 1 — Flat pair → one parent repo (example)**

- Input: "I have `example-api` and `example-webui` on GitHub; make a new repo `example` that contains both; they must not be git repos anymore."
- Output: move to `C:/Users/armin/GitHub/example/example-api` and `.../example-webui`; remove only nested `.git`; commit both folders into `example`; create/push `ArminDashti/example`; leave `example-api` and `example-webui` on GitHub; update `projects.md`.

**Example 2 — Children already nested**

- Input: "`arvaz-api` and `arvaz-webui` are already in `C:/Users/armin/GitHub/arvaz/`."
- Output: skip Step 3 moves; detach nested `.git`; add folders to parent `arvaz` repo; do not delete files.

**Example 3 — Parent repo already on GitHub**

- Input: "`foo` parent repo exists on GitHub; nest `foo-api` and `foo-webui` locally as folders."
- Output: skip `create_repository`; detach nested `.git`; commit folders into `foo`; never delete `foo-api` / `foo-webui` remotes.

**Example 4 — Local git push hangs (Credential Manager)**

- Input: Agent `git push` for parent blocks or fails with terminal prompts disabled.
- Output: stop the hung process; do not `git reset --hard`; fill stored `x-access-token` credential; push with `http.extraheader` Authorization (never print the secret); confirm GitHub root lists both folders. Ask the user to authenticate only if fill has no password.

**Example 5 — Custom child names**

- Input: "Group `acme-service` and `acme-portal` under folder `acme` as one git repo."
- Output: detach `.git` in those folders; parent `acme` tracks `acme-service/` and `acme-portal/`; GitHub remotes with those names stay; paths under `C:/Users/armin/GitHub/acme/`.

**Example 6 — Missing local clone**

- Input: "`bar-webui` exists on GitHub but not locally; group under `bar`."
- Output: create `C:/Users/armin/GitHub/bar/`, clone into nested path, then detach `.git` and commit into `bar`; reject only if a named project has no local tree and no GitHub remote to clone.
