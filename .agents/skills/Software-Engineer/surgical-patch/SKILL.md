---
name: surgical-patch
description: >-
  Fix bugs and small behavior changes at the narrowest responsible layer. Use when regression proof, preserved surrounding behavior, and task-relevant tests matter.
metadata:
  version: 1.0.0
  author: "Armin Dashti"
  category: 
  tags: []
  last_updated: "2026-09-10 13:33:02"
  uuid: 5d2aaeb1-6a8b-43e5-a22d-1f54618b9d74
---
# Surgical patch

Reproduce failure first when economical; otherwise capture strongest available evidence.

- Trace symptom to responsible mechanism.
- Change narrowest layer that owns incorrect behavior.
- Preserve unrelated behavior and user changes.
- Avoid cleanup, renaming, and abstraction outside fix.
- Add only regression proof relevant to task.

Run focused proof plus nearest affected gate. Stop when failure is fixed and regression proof passes.
