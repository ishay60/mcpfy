# PostgreSQL example

A minimal mcpolyglot config that exposes a single Postgres database to Claude Desktop, Cursor, or Claude Code over stdio.

## 1. Install

```bash
npx @mcpolyglot/cli --version
```

## 2. Configure

Copy `.env.example` to `.env` and fill in your `DATABASE_URL`:

```bash
cp .env.example .env
```

## 3. Validate

```bash
DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-) \
  npx @mcpolyglot/cli doctor --config ./mcpolyglot.config.ts
```

You should see `✓ pg.main: connected` and the list of generated tools.

## 4. Wire into your agent

- **Claude Desktop** — copy [`claude-desktop.json`](./claude-desktop.json) into `~/Library/Application Support/Claude/claude_desktop_config.json` (replace the absolute path) and restart.
- **Cursor** — copy [`cursor.json`](./cursor.json) into `~/.cursor/mcp.json`.
- **Claude Code** — run [`./claude-code.sh`](./claude-code.sh).

Then ask: _"List the tables and sample 5 rows from the largest one."_

## What you get

| Tool                     | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `pg.main.list_tables`    | All tables and their columns.                            |
| `pg.main.describe_table` | One table's columns, types, primary key.                 |
| `pg.main.query`          | Read-only SQL with parameterized args, row cap, timeout. |

All results are passed through redaction (emails / JWTs / SSNs / etc.), wrapped in an `<mcpolyglot-data>` "untrusted-data" block, and logged to `~/.mcpolyglot/audit.log`.
