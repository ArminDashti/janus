---
name: suggest-for-improving
description: >-
  Lists real improvement suggestions across any relevant domain (security,
  UI/UX, REST, and others) as a Title / Description markdown table,
  with a red or blue circle beside each title and no filler.
disable-model-invocation: false
metadata:
  version: "2.2.0"
  author: Armin Dashti
  category: communication
  tags: [suggest, improve, security, ux, restful, recommendations]
  last_updated: "2026-09-02 15:15:00"
  uuid: 9dafc510-046e-4401-825c-e4ac405a9de9
---

# Suggest for Improving

## When

- User asks to suggest, improve, refine, or recommend next improvements
- After work this turn (feature, fix, skill, API, UI, server, docs) if a real gap remains
- Agent sees a concrete improvement in any domain that applies to this work
- Exclusions: does not replace the main answer; does not invent filler; does not duplicate Turn Report next-step rows; does not limit itself to skills or docs
- Related: `../work-completion-report/` (Turn Report stays last), `../simplify-response/`

## How

1. Look at the current work (what the user named, plus what this turn actually touched) — not a generic wishlist and not only the last file.
2. Scan every domain that applies. The list is open; these are examples, not a cap:

   | Domain | Look for |
   |--------|----------|
   | Security | Auth, secrets, injection, access, TLS, least privilege |
   | UI / UX | Layout, empty/error states, forms, navigation, accessibility |
   | REST / API | Status codes, verbs, errors, versioning, idempotency, contracts |
   | Data | Schema, validation, migrations, integrity |
   | Performance | Slow paths, N+1, payload size, caching |
   | Reliability | Failures, retries, timeouts, logging |
   | Ops | Deploy, backup, monitoring, config |
   | Other | Any other domain that clearly applies (mobile, VPN, tests, and so on) |

3. Keep only real suggestions. Drop guesses, style nits, domains that do not apply, and items already done this turn.
4. Split each remaining item:
   - **Red** — Strongly recommend
   - **Blue** — If is implemented would be nice
5. Emit the **Format of response** block: heading `💡 Suggestion:`, then a two-column markdown table — header row `Title | Description`, separator row, then data rows. Put 🔴 or 🔵 **beside** the title text in the Title cell (prefix: `🔴 <Title>` or `🔵 <Title>`). Name the domain in Title when it helps (for example `Login form` vs a vague “improve security”).
6. Place this block after the main answer and **before** Turn Report.
7. If there is nothing real to suggest, omit the whole block.

## Always

1. **Always** use the heading `💡 Suggestion:` exactly (emoji + space + `Suggestion:`).
2. **Always** use this grid pattern: heading, column header row, separator row, then data rows.
3. **Always** use exactly two column headers: `Title`, `Description`.
4. **Always** list red rows first, then blue rows.
5. **Always** prefix the Title cell with 🔴 (Strongly recommend) or 🔵 (If is implemented would be nice) — circle beside the title, not a separate column.
6. **Always** scan every domain that applies to this work (security, UI/UX, REST, and others) — not only skills, docs, or the last file.
7. **Always** keep Title short and Description one concrete line (what to change — not a tutorial).
8. **Always** omit the block when there are no real suggestions.

## Never

1. **Never** put a blue row before a red row.
2. **Never** invent filler, `None` rows, or fake improvements.
3. **Never** omit the column header row or separator row.
4. **Never** add a third column (for example `Circle` as its own column).
5. **Never** use green circles, scores, or decimal ratings for these suggestions.
6. **Never** mix Turn Report `### Suggestions` (optional next-step grid) with this block — this skill uses `💡 Suggestion:` + the Title / Description table only.
7. **Never** suggest work that was already completed in this turn.
8. **Never** write this block after Turn Report.
9. **Never** restrict suggestions to one domain (for example only skills, or only UI) when another domain clearly applies.
10. **Never** treat the domain table as a closed list — add a domain when the work needs it.

## Example

**Input:** Login page + `POST /api/login` shipped; password in query string; no empty-state on the user list; 200 returned on validation failure.

**Output:**

```markdown
💡 Suggestion:
| Title | Description |
|-------|-------------|
| 🔴 Query string | Stop sending the password in the query string; use the request body over HTTPS |
| 🔴 Status code | Return 400 (not 200) when login validation fails |
| 🔵 Empty state | Add an empty state on the user list when there are no rows |
```

Wrong: blue before red. Wrong: `None`. Wrong: no column headers. Wrong: green circles. Wrong: a separate Circle column. Wrong: only a docs/skill nit when security or REST is broken. Wrong: a score table.

## Format of response

```markdown
💡 Suggestion:
| Title | Description |
|-------|-------------|
| 🔴 <Title> | <description> |
| 🔵 <Title> | <description> |
```

- Grid pattern: heading, header row, separator row, data rows.
- Exactly two columns: `Title`, `Description`.
- Circle (🔴 or 🔵) sits beside the title inside the Title cell — not in its own column.
- First every 🔴 row (Strongly recommend), then every 🔵 row (If is implemented would be nice).
- Zero or more rows of each color. If both colors exist, red group first.
- Rows may mix domains; still sort by color only (all red, then all blue) — do not group by domain.
- No extra heading. No filler `None` rows. Omit the whole block when there are no real suggestions.
