# mcpfy

> Turn your databases and APIs into [Model Context Protocol](https://modelcontextprotocol.io) servers — secured, schema-aware, open-source, npm-installable.

[![CI](https://github.com/ishay60/mcpfy/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/ishay60/mcpfy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange)](#status)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](.nvmrc)

```text
  ▲  mcpfy  v0.0.1
     one config, every database your agent needs

Commands:
  init      Interactively scaffold an mcpfy.config.ts
  serve     Start the mcpfy MCP server (stdio or HTTP)
  doctor    Validate config, ping sources, list tools
  tools     List all tools mcpfy would expose
```

## Why

The official `@modelcontextprotocol/server-postgres` is archived and unmaintained. Existing alternatives are either single-vendor (Supabase, Neon), uneven per-DB community servers, or SaaS-orchestration plays. None ship a unified, schema-aware, security-first multi-DB story out of the box.

mcpfy is that story. One config, one CLI, every database your agent needs.

## Quickstart

```bash
# In a project directory
npx @mcpfy/cli init       # interactive wizard
npx @mcpfy/cli doctor     # validate config, ping sources, list tools
npx @mcpfy/cli serve      # start the MCP server (stdio by default)
```

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcpfy": {
      "command": "npx",
      "args": ["-y", "@mcpfy/cli", "serve", "--config", "/abs/path/to/mcpfy.config.ts"],
      "env": { "DATABASE_URL": "postgres://user:pass@localhost:5432/db" }
    }
  }
}
```

Restart Claude Desktop and ask:

> _List the tables in my database, then sample 5 rows from `users`._

End-to-end recipes for each connector live under [`examples/`](./examples).

## Features

### Connectors

| Connector    | Read-only enforcement                                         | Status    |
| ------------ | ------------------------------------------------------------- | --------- |
| PostgreSQL   | `BEGIN READ ONLY` + `pg_query_raw`                            | ✅ Wave 1 |
| SQLite       | `query_only` pragma, attached read-only                       | ✅ Wave 1 |
| MySQL        | AST gate + `SET TRANSACTION READ ONLY` + `MAX_EXECUTION_TIME` | ✅ Wave 2 |
| MongoDB      | `find` / `aggregate` only; `$out` / `$merge` rejected         | ✅ Wave 2 |
| REST/OpenAPI | Method allow-list, host pinning                               | 🚧 Wave 3 |

### Transports

- **stdio** — for Claude Desktop / Cursor / Claude Code. (Wave 1)
- **Streamable HTTP** — bearer-auth, loopback by default, `/healthz` probe, JSON logs. (Wave 2)

```bash
npx @mcpfy/cli serve --http --port 7337
# ➜ URL    http://127.0.0.1:7337/mcp
# ➜ Token  k4P9…X2vQ   (auto-generated; pin via config for stable deployments)
```

See [`examples/http`](./examples/http) for full wiring.

### Tools

Out of the box every connector exposes the right primitives — no per-table glue code:

- SQL: `list_tables`, `describe_table`, `query` (parameterized, read-only)
- Mongo: `list_collections`, `describe_collection`, `find`, `aggregate`

Opt-in per-table tools (`users.find_by_email`, etc.) are scaffolded by `mcpfy init` and land fully in Wave 3.

### Security baked in

mcpfy enforces a fixed pipeline around every tool call. Connectors cannot bypass it:

```
scope check → rate limit → timeout → handler → redact → size cap → untrusted-wrap → audit
```

- **Read-only by default** — writes require explicit `tables:write` scope.
- **Per-dialect read-only enforcement** (`BEGIN READ ONLY`, `query_only` pragma, `SET TRANSACTION READ ONLY` + AST gate, mongo aggregation `$out`/`$merge` rejection).
- **Built-in redaction** of emails, JWTs, AWS keys, GitHub tokens, SSNs, credit-card numbers.
- **Column-level deny lists** (e.g., `public.users.password_hash`).
- **JSONL audit log** of every call (no raw args / results — only argshash + metadata).
- **Token-bucket rate limiting** per session per tool.
- **Prompt-injection wrapper** around every result (the [Supabase + Cursor lesson](https://aembit.io/blog/the-ultimate-guide-to-mcp-security-vulnerabilities/)).
- **Secrets only via** `${env:NAME}`, `${file:./path}`, or `${keychain:item}` — never literals in config.

The whole pipeline is documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Repository Layout

```
packages/
  core/              @mcpfy/core               server, registry, transports, Connector iface
  cli/               @mcpfy/cli                bin: mcpfy
  config/            @mcpfy/config             zod schema, secret resolvers
  security/          @mcpfy/security           scopes, redaction, audit, rate limit, wrap
  connector-sql/     @mcpfy/connector-sql      Postgres, MySQL/MariaDB, SQLite
  connector-mongo/   @mcpfy/connector-mongo    MongoDB
  testkit/           @mcpfy/testkit            MCP conformance harness
examples/
  postgres/          stdio + claude desktop / cursor / claude code
  sqlite/            stdio
  mysql/             stdio
  mongo/             stdio
  http/              streamable-http + bearer
```

## Development

```bash
corepack enable
pnpm install
pnpm build
pnpm test
```

CI (matrix: ubuntu / macOS × Node 20 / 22) runs format check, typecheck, build, and unit tests on every push and PR.

## Status

**Wave 2 alpha** — Postgres, SQLite, MySQL, and MongoDB connectors over stdio or Streamable HTTP. The non-bypassable security pipeline (scope → rate-limit → redact → size-cap → wrap → audit) is in place and unit-tested. Integration tests against real databases land next.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and [CONTRIBUTING.md](./CONTRIBUTING.md) to get involved.

## License

MIT — see [LICENSE](./LICENSE).
