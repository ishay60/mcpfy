# MySQL example

A minimal mcpfy config that exposes a single MySQL (or MariaDB) database to Claude Desktop, Cursor, or Claude Code over stdio.

## 1. Install

```bash
npx @mcpfy/cli --version
```

The MySQL driver (`mysql2`) is pulled in as an optional dep of `@mcpfy/connector-sql`; you don't need to install it separately.

## 2. Configure

Set `DATABASE_URL` in your environment:

```bash
export DATABASE_URL="mysql://user:pass@localhost:3306/app"
```

## 3. Validate

```bash
npx @mcpfy/cli doctor --config ./mcpfy.config.ts
```

You should see `✓ mysql.main: connected` and the list of generated tools.

## 4. Wire into your agent

- **Claude Desktop** — copy [`claude-desktop.json`](./claude-desktop.json) into `~/Library/Application Support/Claude/claude_desktop_config.json` (replace the absolute path) and restart.
- **Cursor** — copy [`cursor.json`](./cursor.json) into `~/.cursor/mcp.json`.
- **Claude Code** — run [`./claude-code.sh`](./claude-code.sh).

Then ask: _"List the tables and sample 5 rows from the largest one."_

## What you get

| Tool                        | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `mysql.main.list_tables`    | All tables across non-system schemas, with columns.          |
| `mysql.main.describe_table` | One table's columns, types, and primary key.                 |
| `mysql.main.query`          | Read-only SQL with parameterized args, row cap, and timeout. |

## How read-only is enforced

mcpfy's MySQL dialect refuses anything that isn't a read, even before MySQL sees it:

1. **AST gate** — the SQL is parsed with `node-sql-parser` (mysql grammar). Top-level statement type must be `select` / `show` / `describe` / `explain` / `with`. Anything else (`UPDATE`, `INSERT`, `DROP`, multi-statement injections) is rejected.
2. **`SET SESSION TRANSACTION READ ONLY` + `START TRANSACTION`** — server-side belt for the AST-gate suspenders.
3. **`MAX_EXECUTION_TIME` hint** is injected into the SELECT so MySQL itself cancels long queries (in addition to the client-side `AbortController`).
4. Results are passed through redaction (emails / JWTs / SSNs / etc.) and wrapped in an `<mcpfy-data>` "untrusted-data" block before reaching the model.
