---
name: pakhsh-database
description: By this skill you can work with my workplace database.
disable-model-invocation: false
metadata:
  version: 1.0.0
  author: "Armin Dashti"
  category: 
  tags: []
  last_updated: "2026-08-01 13:03:19"
  uuid: 1406ea2e-b6e0-4b13-a6b3-e7b0454d38d9
---
## Connection
Use environment variables only — never hardcode credentials in rules, skills, or repos.

| Variable | Purpose |
|----------|---------|
| `PAKHSH_DATA_NEW_DB_SQL_SERVER_CONNECTION_STRING` | Full ADO connection string (preferred) |
| `PAKHSH_DB_SERVER` | Server host |
| `PAKHSH_DB_NAME` | Database name |
| `PAKHSH_DB_USER` | Username |
| `PAKHSH_DB_PASSWORD` | Password (required if not using the full connection string) |
| Driver | ODBC Driver 17 for SQL Server |

## Connect to database
- If there is an MCP, you can use it.
- If there isn't an MCP, use sqlcmd



## Safety Rules
- Only run `SELECT` unless the user explicitly requests `INSERT`, `UPDATE`, or `DELETE`.
- Use `TOP N`, narrow `WHERE` filters, and known IDs. Never scan full tables.
- `ORDER BY ... DESC` then `TOP` when sampling rows.
- No unbounded `UPDATE`/`DELETE`, no large inserts during debugging.
- Confirm with the user before any data-changing statement.
- ***DO NOT*** use `SELECT` for huge data, I'm not only perosn working on this DB and my co-worker are working as well. 

## Common Schemas
Global: Users (`Afrad`), locations, shared master data
Sales: Sales orders, reports, IMED
Purchase: Suppliers (`TaminKonandeh`)
WareHouse: Inventory, kardex, sefaresh
FinancialAccounting: Accounts, sanad, tafsily
AssetAccounting: Fixed assets (amval)
Budget: Budget / sorat maly
dbo: System tables, permissions

## Difference
- Don't look for perfect logic in the database, it was created and maintain with bunch of low-iq and asshole. so, you must think twice when encounter unknown things in the database.
- Most of names in the database was wrriten in Finglish, for example, they call TaminKonandeh instead of using Supplier.

## Optimization
- For new query, SP and ... always write them in optimziation way with considering the versionb of SQL server.
- If you work on a SP (e.g. for edit) and see any bug or any suggestion for improve performancem, tell the human.
- If human ask you to optimize a query or scripts, first of all, with current (old) scripts, sample some varied small data and store them and then optimize the script, if the old data nad new data are match          toghther, it means the optimization is succesful.


