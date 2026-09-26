# REST API bug classes

## Status & contract

- Success: POST → 201 (+ Location when applicable); DELETE → 204 or 200 with body — match existing API convention
- Missing resource → 404 not 500
- Conflict (unique/version) → 409 not 500
- Validation → 400/422 with stable error shape
- Wrong method → 405
- Unauthenticated → 401; forbidden → 403 (not 404 unless intentional hide)

## CRUD & state

- Create response id not fetchable
- Update returns 200 but GET shows old data
- Patch replaces unset fields with null/defaults unintentionally
- Delete succeeds twice differently (first 204, second 404 vs 204)
- Soft-delete still appears in default lists

## Identity & authZ (functional)

- Object ID from another user accepted on GET/PUT/DELETE
- Role check missing on mutating routes only
- Auth attribute on controller skipped by a sibling Minimal API route

## Lists

- `page`/`pageSize` ignored or max not enforced (huge payloads)
- Total count disagrees with items
- Stable sort missing → flaky paging
- Filter on wrong field or case-sensitivity surprise

## Errors

- Empty catch; returned success after failure
- EF/SQL errors leaked as 500 without mapping
- ProblemDetails inconsistent across controllers

## Serialization

- Enum as number vs string mismatch with clients
- DateTime Kind/offset shifts
- Extra fields silently dropped; required nested objects null

## Static-analysis shortcuts (no live server)

- Route handler missing `SaveChanges` / transaction complete
- `async void` or fire-and-forget in request path
- `AsNoTracking` on update path
- Wrong entity id from route vs body
- Authorization attribute missing on controller while adjacent ones have it
