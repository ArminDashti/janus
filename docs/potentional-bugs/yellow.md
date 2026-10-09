# Potential bugs — yellow

**[POST /api/sync]** — concurrent syncs are not serialized; two overlapping
syncs could re-copy the same resources. Low risk locally (single-user), add an
in-flight guard if the API ever serves concurrent clients.
