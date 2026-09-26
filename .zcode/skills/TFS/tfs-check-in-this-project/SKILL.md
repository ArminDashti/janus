---
name: tfs-check-in-this-project
description: >-
  Performs approval-gated TFVC check-in for a user-named repo or the current
  prompt project: inventories local-vs-server diffs even when not checked out,
  pends safely without overwriting local bytes, then checks in after approval.
disable-model-invocation: false
metadata:
  version: "3.1.0"
  author: Armin Dashti
  category: devops
  tags: [tfs, tfvc, check-in, changeset, folderdiff, data-safe, project, dpdc]
  last_updated: "2026-09-10 12:43:57"
  uuid: 38029559-185d-40e6-91a9-42f4dd1a1274
---

# TFS Check-in This Project

## When

- User asks to check in TFS / TFVC, run `tf checkin`, submit a changeset, or review pending TFVC changes
- User names a repo, or leaves it unnamed → use the **current prompt project**
- User asks to include local files that differ from the server even when they are not checked out
- See also: [reference.md](reference.md), [examples.md](examples.md)
- Related: `darou-pakhsh-projects`
- Exclusions: Git commits; checking in more than one repo in one run
- Merges former: `tfs-check-in`, `tfs-check-in-project`

## How

### Progress checklist

```
Check-in progress:
- [ ] 1. Load TFS connection (env / Windows auth)
- [ ] 2. Resolve RepoName (user-named, else current prompt project)
- [ ] 3. Map RepoName → local root; cd; confirm workfold
- [ ] 4. Inventory: tf status + folderdiff (checkout does not matter)
- [ ] 5. Filter exclusions; classify content-diff / local-only / server-only
- [ ] 6. Data-safe pend: hash → checkout/add (no overwrite) → re-hash
- [ ] 7. Propose comment + Added/Edited/Deleted grid
- [ ] 8. Wait for explicit approval
- [ ] 9. Check in approved in-scope paths (data still hashed)
- [ ] 10. Verify changeset + status + hashes unchanged
```

### 1. Load TFS connection

Read credentials from the environment — never hardcode passwords; never echo `TF_PASSWORD`.

| Variable | Purpose |
|----------|---------|
| `TF` | Path to `tf.exe` (or resolve VS Team Explorer `TF.exe`) |
| `TF_ADDRESS` | Team project / portal URL |
| `TF_USERNAME` | TFS login user |
| `TF_PASSWORD` | Secret — use only via `$env:TF_PASSWORD` |

**Derived collection URL** (for `/collection:` — not the same as `TF_ADDRESS`):

```text
http://10.10.12.52:8080/tfs/sotwaredpdc
```

| Item | Value |
|------|-------|
| TFS host | `10.10.12.52:8080` |
| Collection | `sotwaredpdc` |
| Team project (server) | `$/DPDC/...` |
| Workspace root (local) | Prefer this machine’s mapped root from `tf workfold` (often under `C:/Users/<user>/TFS/`) |
| Domain | `DPDC` / `DPDC.LOCAL` (Windows) |

Auth: prefer Windows integrated / cached credentials; if needed, `/login:$env:TF_USERNAME,$env:TF_PASSWORD` (do not log the password).

### 2. Resolve RepoName and local root

| Rule | Action |
|------|--------|
| User names a repo | Use that exact spelling as `RepoName` |
| User gives a path | Folder name = `RepoName`; path = local root |
| Unnamed / vague (`this repo`, `here`) | Current prompt project = `RepoName` |
| Named repo conflicts with cwd | **User-named** repo wins; `cd` there |

**Known local roots** (extend from `tf workfold` if needed):

| RepoName | Typical local root |
|----------|--------------------|
| `Source` | `C:/Users/a.dashti/TFS/Source` |
| `Source-NewUI` | `C:/Users/a.dashti/TFS/Source-NewUI` (or this machine’s `.../TFS/Source-NewUI`) |
| `PakhshReports` | `C:/Users/a.dashti/TFS/PakhshReports` |
| `RDL` | `C:/Users/a.dashti/TFS/RDL` |
| `SQL` | `C:/Users/a.dashti/TFS/SQL` |
| `academy` | `C:/Users/a.dashti/TFS/academy` |
| `MiniApp` | `C:/Users/a.dashti/TFS/MiniApp` |

### 3. Confirm mapping

```bash
cd <REPO_LOCAL_ROOT>
tf workfold .
tf workspaces
```

Report: RepoName, Collection, Server `$/...`, Local root, Scope this repo only.

### 4. Inventory — pending **and** local-vs-server diffs

Do **both**. Checkout status must not hide product changes.

**A. Pending (already pended):**

```bash
tf status . /recursive
```

**B. Full local ↔ server compare (checkout does not matter):**

```bash
tf vc folderdiff . <SERVER_ROOT> /recursive /noprompt /view:different,sourceOnly,targetOnly
```

`<SERVER_ROOT>` = mapped server path from `tf workfold` (example: `$/DPDC/Source-NewUI`).

| folderdiff bucket | Meaning | Check-in implication |
|-------------------|---------|----------------------|
| Different contents | Same path; local bytes ≠ server | Treat as **edit** candidate even if not checked out |
| Local only (`sourceOnly`) | On disk, not on server | Product files → `tf add` candidate |
| Server only (`targetOnly`) | On server, missing locally | Only if intentional delete → pend delete |

Merge A + B into one candidate set. Git status alone is **not** enough (Git can differ while TFS matches, and the reverse).

### 5. Filter exclusions

Ignore for inventory, proposal, pend, and check-in (and everything under them):

| Path | Reason |
|------|--------|
| `.cursor` | Agent / Cursor |
| `.git` | Git metadata |
| `.armin` | Agent session / rework logs |
| `.argent` | Agent design / debug artifacts |
| `.webui-eval` | Eval scratch |
| `.webui-reviewer` | Reviewer scratch |
| `.specify` | Spec tooling |
| `agent-logs` | Session logs |
| `debug-*.log` | Debug scratch |

Also skip secrets, credentials, and obvious temp files unless the user insists.

**Project policy (Source-NewUI / when documented):** exclude login pages (`Default.aspx`, `login.aspx`, and their `.vb` / `Pages/login.*`) and everything under `nginx/` unless the user **explicitly** asks to include them.

**Must include** when they differ and are in scope (do not drop):

| Path | Notes |
|------|--------|
| `node_modules` | Anywhere in tree |
| `packages` | NuGet restored packages |
| `Bin` | Build output |
| `Publish\Output` | IIS publish export |
| `package-lock.json` | Node lock file |

Summarize non-code bulk (e.g. screenshot `.jpg` trees) separately; include them in the proposal only when the user wants those assets.

### 6. Data-safe pend (keep local bytes)

Local content is the source of truth for this check-in. Never replace it with server content while preparing the changeset.

1. **Hash** every in-scope candidate file (SHA-256) and keep the table.
2. **Server workspace / not checked out:** `tf checkout <paths>` only — **no** `tf get /force`, **no** overwrite/replace prompts that pull server bytes over local.
3. **Local-only product files:** `tf add <paths>` (not excluded paths).
4. **Re-hash** the same paths. If any hash changed → **stop**, restore from the hash evidence, do not check in.
5. Confirm `tf status` lists every approved candidate as add/edit/delete.

Details and PowerShell patterns: [reference.md](reference.md).

### 7. Propose (required before check-in)

**Comment format:**

```text
<RepoName>: [1. <CHANGE-1>] [2. <CHANGE-2>] [3. <CHANGE-3>]
```

| Part | Rule |
|------|------|
| `<RepoName>:` | Exact resolved repo name, then colon + space |
| Each item | Bracketed `[N. <phrase>]` with a space between items |
| Phrase | Short purpose; not filenames |

**Proposal template:**

```markdown
### Proposed comment
<RepoName>: [1. <CHANGE-1>] [2. <CHANGE-2>]

### Target
- Collection: <url>
- Server: $/<path>
- Workspace: <name>
- Scope: <RepoName> in-scope paths only

### Data safety
- Pre-pend hashes recorded; post-pend hashes match (or N/A if already pending)

### What will happen
| Added | Edited | Deleted |
|-------|--------|---------|
| path or — | path or — | path or — |

Counts: Added N · Edited N · Deleted N · total N

### Also noted (not in this check-in unless you ask)
- Excluded paths / bulk images / tooling: …

Reply **yes** to check in, or change comment / scope.
```

- Columns must be exactly `Added`, `Edited`, `Deleted`
- One path per cell (or stacked rows); `—` when a type is empty
- Do **not** run `tf checkin` until the user confirms

### 8. Missing local file with pending edit

If check-in fails with `Could not find file` / `No files checked in`:

1. Confirm file is absent locally but still pending **edit**
2. If it should leave the server: `tf undo` → `tf get /force` → `tf delete` (this path is intentional server sync — only for the missing item)
3. Re-propose if change types changed, then check in after approval

### 9. Check in

- Prefer **explicit approved paths** when any excluded item is still pending (so exclusions are not submitted).
- If every pending change under `.` is in-scope: `tf checkin . /recursive /comment:"…" /noprompt` is OK.
- Otherwise: `tf checkin <approved paths> /comment:"…" /noprompt`
- On auth failure, retry with `/login:$env:TF_USERNAME,$env:TF_PASSWORD` (do not log the password)
- Report the **changeset number** on success
- Re-hash approved paths after check-in; local hashes must still match the pre-pend table

### 10. Verify

```bash
tf status . /recursive
```

Expect no pending **in-scope** changes. Remaining pending under excluded folders (or intentionally left-out files) is OK — say so in the report.

## Always

1. State the chosen `RepoName` in the proposal so the user can correct it.
2. Treat folderdiff **content-different** files as check-in candidates even when `tf status` is empty for them.
3. Keep local bytes safe: hash before pend, re-hash after pend and after check-in; abort on hash drift.
4. Keep long command samples and troubleshooting in [reference.md](reference.md) / [examples.md](examples.md).

## Never

1. Trust Git-only dirty lists as the TFVC check-in inventory.
2. Run `tf get /force` (or any overwrite) on files you are about to check in from local edits.
3. Check in without the Added | Edited | Deleted grid and explicit user approval.
4. Echo `$env:TF_PASSWORD` or paste passwords into chat, logs, or comments.
5. Check in sibling TFS repos in the same run.
6. Use `git commit` for this TFVC workflow unless the user explicitly asks for Git.
7. Change `metadata.uuid` on edit.

## Example

**Example 1** — Named repo

- Input: Check in TFS for Source-NewUI
- Output: `RepoName=Source-NewUI`; folderdiff + status; propose; wait for **yes**

**Example 2** — Unnamed (cwd is the project)

- Input: Check in my TFS changes (prompt in Source-NewUI)
- Output: `RepoName=Source-NewUI` from current prompt project; state it in the proposal

**Example 3** — Differs locally but not checked out

- Input: folderdiff shows 11 code files different; `tf status` shows only 2 checked out
- Output: hash all 11 → `tf checkout` the 9 missing → re-hash (must match) → propose all in-scope 11 → check in after **yes**

**Example 4** — Includes deletes

- Pending: 2 edits, 1 delete under cwd
- Output: grid shows both under **Edited** and the delete under **Deleted** — do not skip deletes

**Example 5** — Login excluded unless asked

- Input: Pending includes `login.aspx` and a product page; user did not ask for login
- Output: propose product page only; leave `login.aspx` pending; check in explicit paths (not blind `.` if that would submit login)

**Example 6** — User explicitly includes login

- Input: Check in all 11 files (list includes `login.aspx`)
- Output: include `login.aspx`; data-safe pend; check in after approval / explicit order

**Example 7** — Hash drift abort

- Input: After `tf checkout`, one file’s SHA-256 no longer matches the pre-pend hash
- Output: stop; do not check in; report which path changed; restore/fix before retrying
