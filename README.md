# mcpfy

> Turn your databases and APIs into [Model Context Protocol](https://modelcontextprotocol.io) servers — secured, schema-aware, open-source, npm-installable.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](.nvmrc)

## Why

The official `@modelcontextprotocol/server-postgres` is archived and unmaintained. Existing alternatives are either single-vendor (Supabase, Neon), uneven per-DB community servers, or SaaS-orchestration plays. None ship a unified, schema-aware, security-first multi-DB story out of the box.

mcpfy is that story. One config, one CLI, every database your agent needs.

## Quickstart

```bash
# In a project directory
npx @mcpfy/cli init       # interactive wizard
npx @mcpfy/cli doctor     # validate config, ping sources
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

## Features (v0.1)

- **Connectors**: PostgreSQL, SQLite (Wave 1) → MySQL, MongoDB (Wave 2) → REST/OpenAPI (Wave 3).
- **Transports**: stdio (Wave 1) and Streamable HTTP (Wave 2).
- **Tools**: `list_tables`, `describe_table`, `query` (read-only). Opt-in per-table tools coming in Wave 3.
- **Security baked in**:
  - Read-only by default — writes require explicit `tables:write` scope.
  - Per-dialect read-only enforcement (`BEGIN READ ONLY`, `query_only` pragma).
  - Built-in redaction of emails, JWTs, AWS keys, GitHub tokens, SSNs, credit-card numbers.
  - Column-level deny lists (e.g., `users.password_hash`).
  - JSONL audit log of every call (no raw args / results).
  - Token-bucket rate limiting per session per tool.
  - Prompt-injection wrapper around every result (the [Supabase + Cursor lesson](https://aembit.io/blog/the-ultimate-guide-to-mcp-security-vulnerabilities/)).
  - Secrets only via `${env:NAME}`, `${file:./path}`, or `${keychain:item}`.

## Repository Layout

```
packages/
  core/              @mcpfy/core         server, registry, transports, Connector iface
  cli/               @mcpfy/cli          bin: mcpfy
  config/            @mcpfy/config       zod schema, secret resolvers
  security/          @mcpfy/security     scopes, redaction, audit, rate limit, wrap
  connector-sql/     @mcpfy/connector-sql  Postgres + SQLite (+ MySQL in Wave 2)
  testkit/           @mcpfy/testkit      MCP conformance harness
examples/            host configs (Claude Desktop, Cursor, Claude Code)
```

## Development

```bash
corepack enable
pnpm install
pnpm build
pnpm test
```

## Status

Wave 1 alpha — Postgres + SQLite + stdio. See the [implementation plan](./PLAN.md) for the full roadmap.

## License

MIT — see [LICENSE](./LICENSE).
