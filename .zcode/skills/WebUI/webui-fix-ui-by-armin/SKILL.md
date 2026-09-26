---
name: webui-fix-design
description: >-
  Applies an approved design spec or chosen design alternative to page source and
  returns DONE or BLOCKED status per item.
disable-model-invocation: false
metadata:
  version: "3.1.0"
  author: Armin Dashti
  category: webui
  tags: [design, fix, implement]
  last_updated: "2026-08-08 09:57:00"
  uuid: e8cc28ad-9ca0-45ab-ae9b-a50cdc5cd88e
---

# WebUI Fix Design

## When to use

- User asks to apply design fixes after a proposal, review, or chosen alternative
- Spec / approved items exist (from chat, [webui-propose-designs](../webui-propose-designs/SKILL.md), or a proposal file)
- Exclusions: do not invent solutions; do not expand beyond the approved spec; no unapproved DB writes; not functional debugging
- Related: [webui-propose-designs](../webui-propose-designs/SKILL.md)

## Objective

1. Accept the approved design spec or chosen alternative
2. Apply each listed fix to the page/source in the active workspace
3. Briefly verify each change landed (browser or source)
4. Return DONE or BLOCKED per item with files touched

## Workflow

### Step 1: Accept inputs

| Input | Meaning |
|-------|---------|
| `spec_result` / approved items | Concrete fixes to apply |
| `chosen_alternative` | Which design alternative to implement when several were proposed |
| `open_target` | Page URL/route/source |

If multiple alternatives were proposed and none chosen, ask once which to implement.

### Step 2: Apply fixes

1. Read every approved solution entry
2. Edit only the listed files/components in the active workspace
3. Prefer shared components/tokens and sibling-page patterns over one-offs
4. Honor `webpageui-standard.md` → `## User preferences` when the approved alternative matches them (e.g. purpose-colored dense filter sections / Taraz pattern)
5. Visual/layout/CSS/presentation unless the approved item explicitly includes behavior
6. After edits, briefly verify in Cursor built-in IDE browser (`cursor-ide-browser`) or source — never the user’s personal browser

### Step 3: Build the result

```text
PAGE: <page_label>
TARGET: <open_target>

Implemented:
1. Issue: ...
   Status: DONE | BLOCKED
   Files touched: ...
   Notes: ...
```

## Safety rules

1. **Never** invent fixes not in the approved spec / chosen alternative.
2. **Never** change field names or bindings unless the approved item explicitly requires it and the user approved.
3. **Never** run unapproved `INSERT`/`UPDATE`/`DELETE`.
4. **Always** mark BLOCKED with a reason when a fix cannot be applied.
5. **Never** assume a specific project or framework — discover paths in the workspace.
6. **Always** verify live pages with Cursor built-in IDE browser (`cursor-ide-browser`) only — never Playwright MCP, browser-use, Browserbase, the user’s working browser, `plugin-browse-browser` local mode, Windows MCP desktop tools for web pages, or OS default-browser open.
7. **Never** interrupt the user’s desktop browsing session.
8. **Always** when the user names form fields by label text and asks to increase/decrease width, change the associated TextBox/input `Width` — not `CustomLabel` `setWidth` — unless they explicitly say label.
9. **Never** place a field label alone on one line with its TextBox or DropDown on the next line — keep each label and its associated TextBox/DropDown on the same line.

## Examples

**Example 1:** Spec with three visual fixes

- Input: approved spacing/label/action-hierarchy items
- Output: Implemented list with DONE/BLOCKED per item

**Example 2:** Multiple alternatives, none chosen

- Input: three design alternatives from propose-designs
- Output: ask which alternative to implement; do not pick silently
