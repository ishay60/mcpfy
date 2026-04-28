# mcpolyglot

> Turn your databases and APIs into [Model Context Protocol](https://modelcontextprotocol.io) servers — secured, schema-aware, open-source, npm-installable.

[![CI](https://github.com/ishay60/mcpolyglot/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/ishay60/mcpolyglot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange)](#status)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](.nvmrc)

```text
$ mcpolyglot doctor --config ./mcpolyglot.config.json

  ▲  mcpolyglot  v0.0.1
     doctor — validate config and connectivity


  Config
  ✓ parsed  ./mcpolyglot.config.json

  Sources
  ✓ sqlite.demo  sql · 2 ms
  • tools  3 registered
      • sqlite.demo.list_tables  [schema:read]
      • sqlite.demo.describe_table  [schema:read]
      • sqlite.demo.query  [tables:read, query:raw]

  Summary
  ✓ all systems go  mcpolyglot is ready to serve
  run: mcpolyglot serve
```

More captured outputs (`--help`, `tools`, `serve --http`) and a regenerate script live under [`docs/demo/`](./docs/demo).

## Why

The official `@modelcontextprotocol/server-postgres` is archived and unmaintained. Existing alternatives are either single-vendor (Supabase, Neon), uneven per-DB community servers, or SaaS-orchestration plays. None ship a unified, schema-aware, security-first multi-DB story out of the box.

mcpolyglot is that story. One config, one CLI, every database your agent needs.

### How it compares

|                               | mcpolyglot                                                                      | `server-postgres` (archived) | Vendor MCPs (Supabase / Neon / …) | DIY MCP server       |
| ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------- | --------------------------------- | -------------------- |
| **Databases supported**       | Postgres, SQLite, MySQL, Mongo                                                  | Postgres only                | One vendor's hosted DB            | Whatever you wire up |
| **Read-only enforcement**     | At the DB layer (per dialect) **and** at the application layer (scopes)         | DB-layer only                | Varies by vendor                  | You write it         |
| **Built-in PII redaction**    | Yes — emails, JWTs, AWS keys, GH tokens, SSNs, CC#s, plus per-column deny lists | No                           | Varies                            | You write it         |
| **Audit log**                 | Yes — JSONL, no raw args / results                                              | No                           | Varies                            | You write it         |
| **Prompt-injection wrapping** | Yes — every result wrapped in `<mcpolyglot-data>`                               | No                           | Varies                            | You write it         |
| **Transports**                | stdio + Streamable HTTP (bearer auth, `/healthz`)                               | stdio only                   | Varies                            | You write it         |
| **Status**                    | Wave 2 alpha, actively maintained                                               | Archived                     | Vendor-supported                  | Yours to own         |
| **Lock-in**                   | None — your DB, your config                                                     | None                         | Vendor's DB                       | None                 |

Vendor MCPs are great if you've already committed to that vendor's stack. mcpolyglot is the option when you want one consistent surface across the databases you actually have.

## Quickstart

```bash
# In a project directory
npx @mcpolyglot/cli init       # interactive wizard
npx @mcpolyglot/cli doctor     # validate config, ping sources, list tools
npx @mcpolyglot/cli serve      # start the MCP server (stdio by default)
```

Add to Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcpolyglot": {
      "command": "npx",
      "args": ["-y", "@mcpolyglot/cli", "serve", "--config", "/abs/path/to/mcpolyglot.config.ts"],
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
- **Streamable HTTP** — bearer or OAuth (JWT/JWKS), loopback by default, `/healthz` probe, JSON logs. (Wave 2 + Wave 3)

```bash
npx @mcpolyglot/cli serve --http --port 7337
# ➜ URL    http://127.0.0.1:7337/mcp
# ➜ Token  k4P9…X2vQ   (auto-generated; pin via config for stable deployments)
```

See [`examples/http`](./examples/http) for full wiring.

### Tools

Out of the box every connector exposes the right primitives — no per-table glue code:

- SQL: `list_tables`, `describe_table`, `query` (parameterized, read-only)
- Mongo: `list_collections`, `describe_collection`, `find`, `aggregate`

Opt-in per-table tools (`users.find_by_email`, etc.) are scaffolded by `mcpolyglot init` and land fully in Wave 3.

### Security baked in

mcpolyglot enforces a fixed pipeline around every tool call. Connectors cannot bypass it:

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
  core/              @mcpolyglot/core               server, registry, transports, Connector iface
  cli/               @mcpolyglot/cli                bin: mcpolyglot
  config/            @mcpolyglot/config             zod schema, secret resolvers
  security/          @mcpolyglot/security           scopes, redaction, audit, rate limit, wrap
  connector-sql/     @mcpolyglot/connector-sql      Postgres, MySQL/MariaDB, SQLite
  connector-mongo/   @mcpolyglot/connector-mongo    MongoDB
  testkit/           @mcpolyglot/testkit            MCP conformance harness
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
