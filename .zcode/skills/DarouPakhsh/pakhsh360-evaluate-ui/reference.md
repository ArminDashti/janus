# Global Web UI Standard — Visual Reference

Screenshots in `references/` are **approved examples** of the global look. Apply the patterns below to any web stack. Do not require a specific framework, server control, or CSS class name to call a page “standard”.

## Reference screenshots

| File | Archetype | Patterns illustrated |
|------|-----------|----------------------|
| `01-data-entry-search-grid.png` | Data entry + list | Stacked section cards; entry form; search strip; distinct table header; centered icon+text actions |
| `02-multi-section-filters.png` | Dense filters | App chrome; breadcrumbs; purpose-colored filter sections; multi-column checkboxes; clear date ranges |
| `03-search-filters-shell.png` | Search / filters | Page title context; white filter card; centered search action |

## Shell

- Distinct top app bar when the product has global navigation
- Side navigation when the product uses a module menu
- Calm page background; content in white/surface cards with light borders and rounded corners
- Breadcrumb or equivalent path when navigation is deep

Judge presence and clarity of chrome on **apps that have it**. A simple standalone page needs clear title and content structure, not a forced sidebar.

## Sections

Universal structure:

1. Colored or strongly distinct header (title + collapse control when collapsible)
2. Padded body
3. Rounded card; light border; consistent gap between stacked sections

**Default panels** (entry, search, simple filters): one primary header color, white body.

**Multi-group filters:** different header tints by purpose (e.g. primary / entities / dates) so groups are scannable — still a coherent palette, not random colors.

**Inner captions:** optional short labels inside the body for subsections.

## Forms

- Visible labels; consistent label↔control alignment
- Match page direction (RTL or LTR)
- Required marker consistent across the page
- Related fields on shared rows when width allows
- Field width matches content expectation
- Dense option lists in multi-column grids when that matches the archetype
- Date ranges: consistent control pattern (segmented day/month/year or a shared date picker — pick one system and stick to it)

## Actions

| Role | Expectation |
|------|-------------|
| Primary | Strongest visual weight |
| Secondary | Quieter surface (outline / neutral) |
| Danger | Clearly destructive (typically red text/icon or danger variant) |
| Search / special | Recognizable icon+text; placed with its filter block |

Action clusters belong with the block they affect, usually centered under that block.

## Tables

- Distinct header treatment (e.g. soft tint)
- Zebra or equivalent row separation; hover feedback when interactive
- Comfortable cell padding; readable density
- Destructive row actions visually marked as danger
- Use the full content width unless the layout intentionally constrains it

## Color & type

- Coherent primary / surface / border / danger roles
- One font system appropriate to the product locale
- No page-local competing themes

Exact hex values in a given codebase are implementation details. The standard cares that roles are **consistent and readable**.

## What not to flag

- Missing a particular legacy control type or class name
- File extension (`.aspx`, `.tsx`, `.vue`, …)
- Server vs client rendering
- Presence/absence of a specific library — unless the **visible** result breaks the rules above

## Anti-patterns

- Unstructured control dumps with no section hierarchy
- Mixed primary action styles on one toolbar without hierarchy
- Unlabeled inputs; required state unclear
- Tables with no header distinction or unreadable density
- Overflow, overlap, or clipped content at normal desktop widths
- Status conveyed by color alone when text/icon is needed
