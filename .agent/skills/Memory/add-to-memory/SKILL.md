---
name: add-to-memory
description: >-
  Routes lasting memory writes to the matching sibling skill for experience,
  human preference, personality, or memory maintenance.
disable-model-invocation: false
metadata:
  version: "2.4.0"
  author: Armin Dashti
  category: memory
  tags: [memory, preference, experience, router, webpageui, like-changes]
  last_updated: "2026-08-12 00:45:00"
  uuid: 565b55d4-9cb1-4d71-a159-96bceb537239
---

# Add to Memory

## When to use

- User asks to save an experience, preference, personality note, webpage UI preference, or maintain memory stores
- User says **I like it**, **I like these changes**, **from now on**, **always**, **save as preference**, or **log this experience**
- Exclusions: does not implement app features — stores memory only
- Sibling skills (read and follow the matching one fully):
  - `../add-to-memory-experience/` — project Q&A learnings → `./exprience/exprience.md`
  - `../memory-add-human-preference/` — lasting preferences, liked changes, and WebUI standard entries
  - `../add-to-memory-human-personality/` — personality traits for the human
  - `../add-to-memory-maintain/` — memory store maintenance

## Objective

1. Classify the memory write type
2. Read the matching sibling `SKILL.md` and follow it completely
3. Confirm what was stored and where

## Workflow

### Step 1: Route

| Ask | Sibling skill |
|-----|----------------|
| Problem, issue, fix, lesson learned, experience | `../add-to-memory-experience/SKILL.md` |
| Liked recent changes / webpage UI preference / lasting preference / "from now on" / "I like it" | `../memory-add-human-preference/SKILL.md` |
| Personality / how the human thinks or communicates | `../add-to-memory-human-personality/SKILL.md` |
| Clean, migrate, or maintain memory files | `../add-to-memory-maintain/SKILL.md` |

If unclear, ask one focused question before writing.

### Step 2: Execute

1. Read `C:/Users/<USER>/.cursor/skills/<skill-name>/SKILL.md` for the routed sibling (resolve `<USER>` via `$env:USERPROFILE`)
2. Follow that skill’s workflow fully (do not improvise a parallel store)
3. Confirm path and saved text to the user

## Safety rules

1. **Always** read and follow the sibling skill before writing.
2. **Never** invent experiences, preferences, or personality traits the user did not state or show.
3. **Never** implement app UI/API changes in this skill — store only.
4. **Never** duplicate an existing entry in the same store.

## Examples

**Example 1:** Preference (stated rule)

- Input: "From now on always prefer MCP for GitHub"
- Route: `memory-add-human-preference/` → AGENTS.md Learned User Preferences

**Example 2:** Liked changes

- Input: "I like these changes — save as preference"
- Route: `memory-add-human-preference/` (liked-changes mode)

**Example 3:** Experience

- Input: "Save this: ODBC timeout was fixed by raising CommandTimeout"
- Route: `add-to-memory-experience/` → `./exprience/exprience.md`
