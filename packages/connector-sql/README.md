# @mcpolyglot/connector-sql

SQL connector for [mcpolyglot](https://github.com/ishay60/mcpolyglot). One package, three dialects: **Postgres**, **MySQL/MariaDB**, and **SQLite**. Read-only by default with per-dialect enforcement at the database boundary.

## Tools exposed

For every SQL source mcpolyglot generates:

- `<id>.list_tables` — every table across non-system schemas, with columns.
- `<id>.describe_table` — one table's columns, types, and primary key.
- `<id>.query` — read-only SQL with parameterized args, row cap, and timeout.

(Opt-in per-table tools like `users.find_by_email` are scaffolded by `mcpolyglot init` and land fully in Wave 3.)

## How read-only is enforced

| Dialect  | Enforcement                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Postgres | `BEGIN READ ONLY` transaction; rolled back at the end of every call.                                          |
| SQLite   | `PRAGMA query_only = 1`; database opened read-only when possible.                                             |
| MySQL    | AST gate (`node-sql-parser` mysql grammar) + `SET SESSION TRANSACTION READ ONLY` + `MAX_EXECUTION_TIME` hint. |

The AST gate matters on MySQL because `SET TRANSACTION READ ONLY` is partially honored — the parser refuses anything whose top-level statement isn't a read.

## Drivers are optional deps

The dialect drivers (`pg`, `mysql2`, `better-sqlite3`) are declared as `optionalDependencies`. Install only what you use.

## Docs

- Architecture → https://github.com/ishay60/mcpolyglot/blob/develop/ARCHITECTURE.md
- Examples →
  - [examples/postgres](https://github.com/ishay60/mcpolyglot/tree/develop/examples/postgres)
  - [examples/mysql](https://github.com/ishay60/mcpolyglot/tree/develop/examples/mysql)
  - [examples/sqlite](https://github.com/ishay60/mcpolyglot/tree/develop/examples/sqlite)

MIT licensed.
