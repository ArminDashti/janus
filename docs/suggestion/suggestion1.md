# Suggestion: surface sync results, not just a spinner

`POST /api/sync` returns only the fresh scan; the sidebar Sync button gives no
per-resource "updated / unchanged / failed" feedback. Returning a summary
(counts of copied resources, errors) and showing a toast would make manual sync
verifiable. Rough effort: small (extend sync service to collect results, add a
toast component).
