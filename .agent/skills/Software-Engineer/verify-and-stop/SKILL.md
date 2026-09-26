---
name: verify-and-stop
description: >-
  Prove existing work meets acceptance conditions without expanding scope. Use for validation-only tasks, completion checks, focused gate runs, and last-mile proof.
metadata:
  version: 1.0.0
  author: "Armin Dashti"
  category: 
  tags: []
  last_updated: "2026-09-10 13:33:02"
  uuid: 55891004-0e95-4c9c-b2ee-2d4b78ef2465
---
# Verify and stop

Translate acceptance conditions into smallest sufficient proof set.

- Reuse still-current results with matching repository state.
- Run focused checks before wider gates.
- Distinguish pass, fail, unavailable, and blocked exactly.
- Do not edit product code unless verification request includes fixes.
- Do not add polish, cleanup, or unrelated tests after criteria pass.

Stop immediately when acceptance proof is complete. Report commands, results, and unresolved risk only.
