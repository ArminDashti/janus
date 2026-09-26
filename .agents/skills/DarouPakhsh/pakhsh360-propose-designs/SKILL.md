---
description: 
metadata:
  version: 1.0.0
  author: "Armin Dashti"
  tags: []
  last_updated: "2026-09-18 15:50:16"
  uuid: 287a82f2-bf00-442b-9655-02a50dc06f14
---
﻿---
name: pakhsh360-propose-designs
description: >-
  Proposes multiple distinct design alternatives for a page from findings or
  context, with labeled trade-offs, without implementing code.
disable-model-invocation: false
metadata:
  version: "3.0.0"
  author: Armin Dashti
  category: webui
  tags: [design, propose, alternatives]
  last_updated: "2026-08-04 17:05:00"
  uuid: 8883e0cf-45c8-4628-90a2-3b671b22bb29
---

# WebUI Propose Designs

## When to use

- User asks for design proposals, redesign options, or alternative layouts/approaches
- Inputs: review findings, hunt/issue lists, custom goals, or page context
- Exclusions: do not implement code; do not invent issues not evidenced in inputs; do not return only one solution path
- Related: [pakhsh360-evaluate-design-ui-ux](../pakhsh360-evaluate-design-ui-ux/SKILL.md), [pakhsh360-fix-design](../pakhsh360-fix-design/SKILL.md), [webui-evaluate-design-for-custom-request](../webui-evaluate-design-for-custom-request/SKILL.md)

## Objective

1. Accept findings, goals, and page target
2. Produce **multiple distinct design alternatives** (minimum 2; prefer 3 when context allows)
3. Label trade-offs for each alternative
4. Keep each alternative concrete enough for later evaluation or implementation
5. Do not implement

## Workflow

### Step 1: Accept inputs

| Input | Meaning |
|-------|---------|
| `open_target` / `page_label` | Page under discussion |
| Findings / goals | Review Problems, custom request, or stated design goals |
| Constraints | Brand, density, RTL/LTR, must-keep behaviors |

If there is no goal and no findings, ask once what to optimize (clarity, density, hierarchy, etc.).

### Step 2: Extract design problems / goals

From inputs, list the concrete problems or goals to address. Do not invent new defects beyond the evidence or stated goals.

Also load `../pakhsh360-evaluate-design-ui-ux/webpageui-standard.md` → `## User preferences` and treat matching rows as goals. For dense multi-filter / report-filter pages, include the approved Taraz purpose-colored `.filter-section` pattern as a candidate (often the recommended alternative) unless the archetype clearly does not fit.

### Step 3: Draft multiple alternatives

For each alternative:

1. Give a short name (e.g. `A — Dense filters`, `B — Wizard`, `C — Split pane`)
2. Describe the overall structure (sections, hierarchy, primary actions)
3. Map how it addresses each problem/goal
4. List concrete UI changes and likely files/components when known
5. State trade-offs (pros / cons)

Rules:

- Alternatives must be **meaningfully different** (not the same fix reworded)
- Prefer at least **3** when the page has room; never fewer than **2**
- Keep product behavior safe: flag any binding/DB/behavior change as needing approval before [pakhsh360-fix-design](../pakhsh360-fix-design/SKILL.md)

### Step 4: Return proposals

```text
PAGE: <page_label>
TARGET: <open_target>
GOALS / ISSUES:
1. ...

ALTERNATIVES:
### A — <name>
Summary: ...
Addresses: ...
Concrete changes:
- ...
Likely files: ...
Trade-offs: pros … / cons …

### B — <name>
...

### C — <name>
...

RECOMMENDATION (optional): <which fits the stated goals best and why — still leave choice to the human>
```

Return in conversation by default. Write to disk only if the user asks for a file.

## Safety rules

1. **Always** propose multiple distinct alternatives (minimum 2).
2. **Never** implement code in this skill.
3. **Never** invent issues not present in findings or stated goals.
4. **Never** pretend reworded duplicates are separate alternatives.
5. **Always** label trade-offs so the human can choose.

## Examples

**Example 1:** Messy filter page

- Input: review Problems about crowded filters and weak primary action
- Output: three alternatives — denser multi-column filters; collapsible sections; search-first shell — each with trade-offs

**Example 2:** Single vague ask

- Input: “propose designs for this page” with no goals
- Output: ask once what to optimize; then produce ≥2 alternatives
