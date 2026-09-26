# Webpage UI Standard (Audit Baseline)

Companion reference for `webpage-debugging`. Use this checklist when judging whether a page is messy and when writing Issues found categories.

Project design system, tokens, and sibling pages override these defaults when present.

## Discovery before audit

1. Find design tokens / theme: `tokens.*`, `theme.*`, `variables.css`, `tailwind.config.*`, `_variables.scss`
2. Find shared components: `components/`, `Controls/`, `Shared/`
3. Find global styles: `global.css`, `site.css`, `App.css`, master page / layout
4. Open **two similar sibling pages** in the same module — use them as the consistency bar
5. When project rules conflict with defaults below, **project rules win**

## Layout and structure

- [ ] One primary action per section; secondary actions visually subordinate
- [ ] Related fields and actions grouped (fieldset, card, panel, section heading)
- [ ] Aligned to a grid — columns and gutters match sibling pages
- [ ] Full width reserved for data-heavy content (tables, wide forms); no arbitrary max-width on operational screens
- [ ] Unused horizontal whitespace used — related controls/fields on one row (A B C) when desktop width allows; do not stack vertically (A / B / C) unless required by other standards or narrow viewports

## Spacing

- [ ] Project spacing scale used when one exists; otherwise 4px or 8px base (4, 8, 12, 16, 24, 32, 48)
- [ ] Section padding: 16–24px; gap between related controls: 8–12px; gap between sections: 24–32px
- [ ] Controls not butted against container edges without padding
- [ ] Labels consistently above or beside inputs — match the app, do not mix

## Typography and hierarchy

- [ ] Page title largest and distinct; section headings smaller; body readable (typically 14–16px)
- [ ] One font family stack unless the project defines more
- [ ] Muted text only for hints and secondary metadata — not primary labels or required fields
- [ ] Long text truncated or wrapped intentionally; no overflow clipping without ellipsis or wrap

## Color and surfaces

- [ ] Project tokens or existing classes for primary, secondary, danger, success, borders, backgrounds
- [ ] No one-off hex/rgb when a shared variable or class exists
- [ ] Error and validation states use the app's danger color and placement
- [ ] No harsh 1px black borders or default unstyled browser controls on production screens

## Controls and consistency

- [ ] Existing button, input, select, table, modal, and badge components reused
- [ ] One primary button style on the page; destructive actions use danger variant
- [ ] Same control heights within a form row; aligned baselines in toolbars
- [ ] Icons match the app set and size; text labels when icons alone are ambiguous
- [ ] Loading, empty, and error states present where data is fetched or lists can be empty

## Forms

- [ ] Every input has a visible label (or established `aria-label` / `aria-labelledby` pattern)
- [ ] Each label stays on the same line as its TextBox/DropDown — do not leave the label alone on one line with the control on the next line
- [ ] Required fields marked consistently with the rest of the app
- [ ] Tab order follows visual order
- [ ] Validation messages specific and adjacent to the field

## Tables and dense data

- [ ] Column headers align with data type (text left, numbers right when appropriate)
- [ ] Row hover and selection styles match sibling tables
- [ ] Sticky header or pagination when the app already uses that pattern
- [ ] Readable density — row height and cell padding match existing grids

## Accessibility (baseline)

- [ ] Contrast ≥ 4.5:1 normal text; ≥ 3:1 large text and UI boundaries
- [ ] Interactive targets ≥ 44×44px or padded to equivalent click area
- [ ] Focus visible on keyboard navigation — outline not removed without replacement
- [ ] Meaningful images and icons have accessible names
- [ ] Status not conveyed by color alone — text, icon, or pattern added

## Responsive behavior

- [ ] Layout works at supported breakpoints; no unintended horizontal scroll
- [ ] Touch-friendly spacing on mobile when the app is responsive

## Self-check (messy threshold)

Use after inspecting each page. Failures here feed Issues found in the output prompt.

```text
UI standards verification:
- [ ] Matches project design system / sibling pages
- [ ] Clear visual hierarchy (title → sections → actions)
- [ ] Consistent spacing and alignment
- [ ] Unused horizontal space used (related controls on one row when width allows)
- [ ] Reused shared components and tokens (no one-off styles)
- [ ] All inputs labeled; errors clear and localized
- [ ] Primary vs secondary actions distinct
- [ ] Loading / empty / error states handled
- [ ] Contrast and focus acceptable
- [ ] No obvious layout defects at target viewport
```

**Messy** when any of:

- Two or more self-check categories fail
- Page clearly diverges from sibling/reference pages
- Controls unstyled, misaligned, or cramped enough to hurt usability
- Primary actions, labels, or errors hard to find or read

## Issue category map

| Category | Map to when |
|----------|-------------|
| layout | misalignment, no grid, cramped sections, wasted horizontal whitespace (stacked when a row fits) |
| spacing | no padding, inconsistent gaps |
| typography | weak hierarchy, unreadable sizes |
| controls | mixed button styles, default browser inputs |
| forms | missing labels, unclear required markers |
| tables | dense rows, misaligned columns |
| accessibility | low contrast, no focus, color-only status |
| consistency | one-off colors/fonts vs sibling pages |
| responsive | horizontal scroll, broken breakpoints |
| states | missing loading, empty, or error UI |

## Defaults (when no project scale)

| Item | Value |
|------|-------|
| Spacing base | 4px or 8px: 4, 8, 12, 16, 24, 32, 48 |
| Section padding | 16–24px |
| Control gap | 8–12px within groups; 24–32px between sections |
| Body text | 14–16px equivalent |
| Min contrast | 4.5:1 normal; 3:1 large / chrome |
| Min touch target | 44×44px |

## Conflict rules

| Situation | Rule |
|-----------|------|
| Project design system exists | Follow it |
| No design system | Mirror the two most similar existing pages |
| User asks for explicit style | User request wins if accessibility baseline holds |
| User preference recorded below | User preference wins over defaults in this file if accessibility baseline holds |
| Legacy page with mixed patterns | Match the dominant pattern on that module's other pages |

## User preferences

Captured likes/dislikes for webpage-debugging audits. These override defaults in this file when they conflict (accessibility baseline still holds). Add new entries with `add-preference-to-webpageui-standard`.

| Title | Category | Standard | File |
|-------|----------|----------|------|
| Supplier / seller popup triggers (تامین کننده · فروشنده) | controls | Prefer multi-select entity popups (`PopUpccTaminKonandeh*`, `PopUpccForoshandeh`) as one-line triggers: button text then 2–3px gap then Material icon (`factory` for تامین‌کننده, `storefront` for فروشنده); hide redundant external matching labels; fill results into a DropDownList/select (not a tall ListBox) | [../add-preference-to-webpageui-standard/preferences/tamin-konandeh-popup-trigger.md](../add-preference-to-webpageui-standard/preferences/tamin-konandeh-popup-trigger.md) |
| Horizontal search filter row | layout | Prefer search/filter controls (e.g. ماه، سال، شماره پرسنلی) and the primary جستجو action on one horizontal flex row; avoid stacking each filter on its own line when desktop width allows | [../add-preference-to-webpageui-standard/preferences/horizontal-search-filter-row.md](../add-preference-to-webpageui-standard/preferences/horizontal-search-filter-row.md) |
| Horizontal entity-picker columns | layout | Prefer report entity pickers (مشتری/گروه، کالا، فروشنده، مسیر توزیع) as side-by-side columns in one table row; each column stacks its trigger (popup / mode dropdown / tree) above its result control — avoid stacking these pickers as full-width vertical blocks | [../add-preference-to-webpageui-standard/preferences/horizontal-entity-picker-columns.md](../add-preference-to-webpageui-standard/preferences/horizontal-entity-picker-columns.md) |
| Aligned data-entry form grid | forms | Prefer data-entry form sections as equal-column CSS grids with a fixed-width label column so labels and inputs align vertically across rows; avoid jagged/staircase field rows and uneven label widths | [../add-preference-to-webpageui-standard/preferences/aligned-data-entry-form-grid.md](../add-preference-to-webpageui-standard/preferences/aligned-data-entry-form-grid.md) |
| Aligned search filter grid | forms | Always lay out multi-field search/filter strips as an equal-column CSS grid with a fixed-width label column so labels and inputs align vertically across wrapped rows; never leave jagged label/input starts from content-sized labels | [../add-preference-to-webpageui-standard/preferences/aligned-search-filter-grid.md](../add-preference-to-webpageui-standard/preferences/aligned-search-filter-grid.md) |
| Dense readable worklist grid | tables | Prefer worklist GridViews with high-contrast headers (white text on teal), visible cell borders, compact row padding, and clamped long notes — avoid sparse tall rows, missing borders, and low-contrast header text; row action buttons stay in separate columns (see `grid-buttons-separate-columns`) | [../add-preference-to-webpageui-standard/preferences/dense-readable-worklist-grid.md](../add-preference-to-webpageui-standard/preferences/dense-readable-worklist-grid.md) |
| Maximize horizontal whitespace | layout | Prefer laying related controls/fields on one horizontal row (A B C) when desktop width has unused whitespace; avoid stacking them vertically (A / B / C) when a horizontal layout does not compromise other webpageui standards (alignment, spacing, labels, accessibility, responsive) | [../add-preference-to-webpageui-standard/preferences/maximize-horizontal-whitespace.md](../add-preference-to-webpageui-standard/preferences/maximize-horizontal-whitespace.md) |
| Scrollable multi-section FormBox column | layout | Prefer multi-section operational pages (data entry + worklists + related panels) as stacked `.FormBox` sections in one scrollable `#upForm` column so every section stays reachable; avoid clipping later sections under `overflow: hidden` without panel/page scroll | [../add-preference-to-webpageui-standard/preferences/scrollable-multi-section-formbox.md](../add-preference-to-webpageui-standard/preferences/scrollable-multi-section-formbox.md) |
| Label and control on same line | forms | Avoid placing a field label alone on one line with its TextBox or DropDown on the next line — keep each label and its associated TextBox/DropDown on the same line | [../../memory/memory-add-human-preference/preferences/label-control-same-line.md](../../memory/memory-add-human-preference/preferences/label-control-same-line.md) |
| Purpose-colored dense filter sections | layout | Prefer dense multi-filter / report-filter pages as purpose-tinted `.filter-section` blocks (distinct header tint per purpose such as level, centers, document types, report options, coding), with constrained MultiChild scroll shells, labeled option groups, and related controls on `.form-row` lines — avoid unstructured `<br>` dumps, MultiChild overflow, and unlabeled radio clusters (approved Taraz pattern) | [../../memory/memory-add-human-preference/preferences/purpose-colored-dense-filter-sections.md](../../memory/memory-add-human-preference/preferences/purpose-colored-dense-filter-sections.md) |
| Grid center, no horizontal scroll | tables | Always center-align cells in all grids and data tables; do not allow left/right horizontal scrolling — reduce grid/table font size and tighten cell padding so columns fit the host width (wrap/break long text as needed) | [../../memory/memory-add-human-preference/preferences/grid-center-no-horizontal-scroll.md](../../memory/memory-add-human-preference/preferences/grid-center-no-horizontal-scroll.md) |
| Grid buttons fit cell | tables | Always fit any button inside a grid or data-table cell to that cell — do not let the global 110×45 button floor overflow the cell; shrink padding and font to the cell size as needed | [../../memory/memory-add-human-preference/preferences/grid-buttons-fit-cell.md](../../memory/memory-add-human-preference/preferences/grid-buttons-fit-cell.md) |
| Grid button text black | tables | Always use black text on buttons inside grids or data-table cells so labels stay readable on light (white) button backgrounds — override ForeColor=White and primary white button labels in cells | [../../memory/memory-add-human-preference/preferences/grid-button-text-black.md](../../memory/memory-add-human-preference/preferences/grid-button-text-black.md) |
| Grid buttons separate columns | tables | Always keep each grid or data-table action button in its own separate column — do not merge multiple row actions into one shared عملیات (or similar) column | [../../memory/memory-add-human-preference/preferences/grid-buttons-separate-columns.md](../../memory/memory-add-human-preference/preferences/grid-buttons-separate-columns.md) |

## Related

| Item | Path |
|------|------|
| Parent skill | `.cursor/skills/webpage-debugging/SKILL.md` |
| Capture preference skill | `.cursor/skills/add-preference-to-webpageui-standard/SKILL.md` |
| Full standards skill | `.cursor/skills/webpage-standards/SKILL.md` |
