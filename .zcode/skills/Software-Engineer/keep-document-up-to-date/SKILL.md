---
name: keep-document-up-to-date
description: >-
  Keeps project documentation current: directory trees, general docs, WebUI
  pages lists, and RESTful API endpoint lists matched to the codebase.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: documentation
  tags: [docs, dir-tree, webui-pages, api-endpoints, keep-up-to-date]
  last_updated: "2026-08-12 00:15:00"
  uuid: 6098ee85-1a84-4030-8911-c94ea1a90454
---

# Keep Document Up to Date

## When to use

- User asks to update, refresh, or keep docs in sync with the codebase
- Agent changed routes, pages, endpoints, or folder layout and docs must match
- User names dir-tree, pages list, endpoint list, or general app/docs markdown
- Exclusions: does not invent features that are not in code; does not rewrite unrelated prose for style alone
- Merges former: `doc-dir-tree-keep-up-to-date`, `doc-keep-up-to-date`, `doc-keep-up-to-date-webui-pages-list`, `doc-restful-api-keep-up-to-date-endpoint-list`

## Objective

1. Select which doc target(s) to update (tree, general, pages, endpoints)
2. Scan the live codebase (and existing doc paths) for ground truth
3. Update only the matching markdown inventory/docs so they match reality
4. Confirm paths touched and what changed

## Workflow

### Step 1: Choose targets

| Ask / signal | Target mode |
|--------------|-------------|
| Directory tree / `dirs.md` / folder layout | **Dir tree** |
| WebUI pages / routes / pages list | **WebUI pages** |
| REST endpoints / API route list | **API endpoints** |
| General app logic / README / feature docs | **General docs** |
| “Keep docs up to date” with no subtype | Infer from recent code changes; if unclear, ask one question |

Run only the modes needed this turn (can run several in one pass when the user asked for all).

### Step 2: Resolve doc paths

1. Prefer paths the user named
2. Else look under project `docs/`, `.armin/`, or root inventories the repo already uses
3. Typical names (adapt to what exists): `dirs.md` / `directory-tree.md`, `pages.md` / `webui-pages.md`, `endpoints.md` / `api-endpoints.md`, feature READMEs
4. If no doc file exists and the user wants one created, create a lean inventory file at the conventional path

### Step 3: Gather ground truth

| Mode | Source of truth |
|------|-----------------|
| Dir tree | Actual project folders (exclude `.git`, `node_modules`, `bin`, `obj`, `.cursor`, build artifacts) |
| WebUI pages | Router files, page components, route tables |
| API endpoints | Route registrations, controllers, OpenAPI/Swagger if present |
| General docs | Changed modules + existing doc claims — verify each claim against code |

### Step 4: Update docs

- Prefer tables or compact trees over essays
- Add missing entries; remove or mark gone entries that no longer exist
- Keep existing section order and style when the file already has a layout
- Do not invent endpoints, pages, or folders that are not in the codebase

### Step 5: Confirm

```text
Docs updated:
- Mode(s): <dir-tree | webui-pages | api-endpoints | general>
- Files: <paths>
- Summary: <added / removed / corrected counts or short note>
```

## Safety rules

1. **Always** treat the codebase as source of truth over stale docs.
2. **Always** use forward slashes in paths written in docs and confirmations.
3. **Never** invent pages, endpoints, or directories that do not exist in code.
4. **Never** delete an entire doc file unless the user explicitly asks.
5. **Never** dump huge generated trees into chat — write the file and summarize.
6. **Always** exclude build/vendor/agent noise folders from dir trees unless the user asks to include them.

## Examples

**Example 1:** API endpoints after route change

- Input: “Update the endpoint list doc”
- Flow: find endpoints markdown → scan Gin/Django/etc. routes → sync table → confirm

**Example 2:** WebUI pages list

- Input: “Keep the pages list up to date”
- Flow: read router → update pages inventory → drop removed routes

**Example 3:** Dir tree

- Input: “Refresh dirs.md”
- Flow: walk project tree with exclusions → rewrite compact tree → confirm path
