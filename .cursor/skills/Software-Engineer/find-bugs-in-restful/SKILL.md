---
name: find-bug-in-restful
description: >-
  Hunts functional bugs in RESTful APIs using contract analysis, code traces,
  and targeted requests, then reports reproducible defects with evidence.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: bug-hunter
  tags: [rest, api, bug, defect, debugging, http]
  last_updated: "2026-08-03 23:10:00"
  uuid: 0b0be2f2-7dda-4a35-b93c-c87d9898fb52
---

# Find Bug in Restful

## When to use

- User asks to find bugs, defects, or incorrect behavior in a REST API
- Suspected wrong status codes, broken CRUD, bad validation, pagination, or authz logic bugs
- After implementing endpoints and before/without a full formal test pass
- Exclusions: security/penetration focus (`find-security-issue` / nested REST security skill), architecture anti-patterns (`detect-anti-pattern`), full depth matrix testing as primary goal (`test-restful-api`)
- Related: `test-restful-api`, `structured-debug`, `find-security-issue`

## Objective

1. Inventory endpoints and expected contracts from code/OpenAPI
2. Hunt high-probability functional bugs with evidence (code and/or HTTP)
3. Report each bug with repro steps, expected vs actual, and likely root cause
4. Avoid unverified speculation; mark suspicions separately

## Workflow

### Step 1: Establish target

- [ ] Resolve base URL / environment (local, Docker, staging) — ask if missing
- [ ] Prefer running API when possible; otherwise static analysis only and label confidence **Code-only**
- [ ] Load OpenAPI/Swagger if present; else build inventory from controllers/Minimal API routes
- [ ] Note auth scheme (JWT, cookie, API key) and how to obtain a token for tests

### Step 2: Build hunt matrix

For each endpoint record: method, path, auth, request shape, expected success status, idempotency.

Prioritize:

1. Write paths (POST/PUT/PATCH/DELETE)
2. Auth-protected resources and IDOR-prone IDs
3. List endpoints with filter/paging
4. Recently changed routes (git diff) when scope is “what we just broke”

### Step 3: Hunt by bug class

Use code read + HTTP when live. Catalog: [reference.md](reference.md).

| Class | Checks |
|-------|--------|
| Contract | Wrong status (200 vs 201/204/404/409); error body inconsistent; Content-Type; missing required fields accepted |
| CRUD integrity | Create then GET missing/partial; update no-ops; delete still GET 200; wrong resource updated |
| Validation | Missing/invalid fields return 500 instead of 400; silent coercion; bypass via extra/unknown fields |
| AuthZ | Authenticated but unauthorized role succeeds; access other users’ IDs; missing auth returns 500 not 401 |
| Query/paging | Off-by-one; pageSize ignored; sort SQL-injectable or ignored; filter ignored or AND/OR wrong |
| Concurrency/idempotency | Duplicate POST creates duplicates when idempotency promised; lost updates on PATCH |
| Mapping | Null refs; enum mismatch; timezone/date wrong; decimal precision; boolean as string |
| Persistence | Soft-delete still listed; unique constraint → 500; transactions partial commit |
| Routing | Ambiguous routes; trailing slash; method not allowed vs 404 |

For each candidate: one-variable repro. Prefer smallest payload.

### Step 4: Confirm

A **Confirmed** bug needs:

- Repro steps (method, URL, headers, body)
- Expected vs actual (status and/or body field)
- Evidence: response snippet and/or code location

Else **Suspected** with what would confirm it.

Do not exploit beyond proving the functional defect. No destructive production actions.

### Step 5: Report

```markdown
# REST API bug hunt — <base URL or project>

## Summary
- Confirmed: N | Suspected: M | Endpoints covered: K

## Confirmed bugs
### B1. <title> — <Severity>
- Endpoint: `METHOD /path`
- Repro: …
- Expected: …
- Actual: …
- Evidence: …
- Likely cause: `path` — …
- Fix hint: …

## Suspected
- …

## Coverage notes
- Not exercised: …
```

Severity guide:

| Severity | Example |
|----------|---------|
| Critical | Data loss, wrong tenant data mutation, authz bypass that mutates |
| High | Incorrect persisted state; broken primary CRUD |
| Medium | Wrong status/contract; paging wrong; validation → 500 |
| Low | Cosmetic body inconsistency; minor mapping oddity |

Offer fixes only if the user asks. For deep “why”, hand off to `structured-debug`.

## Safety rules

1. **Always** separate Confirmed vs Suspected.
2. **Always** include repro for Confirmed bugs.
3. **Always** prefer non-production environments; ask before any write against shared/staging data.
4. **Never** invent bugs without code or HTTP evidence.
5. **Never** run destructive deletes/updates on production without explicit approval.
6. **Never** turn this into a security pentest — route authz *logic bugs* here; vulns/exploits to security skills.
7. **Never** skip asking for base URL/credentials when live calls are required and missing.
8. **Always** ask before installing tools/packages (user rule).

## Examples

**Example 1:** Create/GET mismatch

- Repro: `POST /api/orders` → 201 with `id`; `GET /api/orders/{id}` → 404
- Cause: create saves to DbContext but missing `SaveChangesAsync`
- Report: **High / Confirmed**

**Example 2:** Validation → 500

- Repro: `POST /api/items` with missing `name` → 500 raw exception
- Cause: no model validation filter; null ref in service
- Report: **Medium / Confirmed** — expected 400 with problem details

## Additional resources

- Bug class checklist: [reference.md](reference.md)
