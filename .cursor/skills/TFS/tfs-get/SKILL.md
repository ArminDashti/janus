---
name: tfs-get
description: >-
  Gets latest TFVC changes into the workspace using tf get, guided by
  reference.md and examples.md in this folder.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: devops
  tags: [tfs, tfvc, get]
  last_updated: "2026-08-02 11:25:00"
  uuid: 3ff991f2-d27f-44c9-808c-10672a0b0f52
---

# TFS / TFVC Get

## When to use

- User asks to get latest, `tf get`, or sync a TFVC workspace
- Parent router: `tfs`
- See also: [reference.md](reference.md), [examples.md](examples.md)

## Objective

1. Resolve the correct TFVC workspace for the current machine/user
2. Run get/latest for the requested path or workspace
3. Report conflicts or skipped items clearly

## Workflow

### Step 1: Read local docs

- Read [reference.md](reference.md) and [examples.md](examples.md) in this folder
- Confirm collection/workspace with the user if not already known in this session

### Step 2: Get latest

- Run the documented `tf get` flow for the target path
- Do not invent collection URLs or workspace names

### Step 3: Report

- Summarize updated / up-to-date / conflicted files

## Safety rules

1. **Never** hardcode TFVC collection or workspace paths from a prior session.
2. **Always** prefer the reference/examples in this folder over memory.
3. **Never** discard unresolved conflicts silently.

## Examples

**Example:**

- Input: "Get latest on the Pakhsh workspace"
- Output: Confirms workspace → `tf get` → reports results
