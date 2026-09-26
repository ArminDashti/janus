---
name: tfs-sql-formatter
description: >-
  Generates TFS-compliant SQL stored procedures based on company rules.
disable-model-invocation: false
metadata:
  version: "1.0.0"
  author: Armin Dashti
  category: git
  tags: ["sql", "tfs", "database"]
  last_updated: "2026-09-20"
  uuid: 5f4e198b-70c8-4b90-b3e1-d93a8f6d729a
---

Generate SQL Stored Procedures strictly following these TFS rules:

1. Always prepend:
USE [PAKHSH]
GO

2. Require header:
-- Author: Armin Dashti
-- Date: [YYYY-MM-DD]
-- Reason: [Create/Modify] - [Reason]

3. Command logic:
- IF db == 'Pakhsh_Data_New': `ALTER PROCEDURE`
- IF db != 'Pakhsh_Data_New': `CREATE PROCEDURE`

Output ONLY the SQL code. No explanations.