# @mcpfy/testkit

MCP conformance harness and test fixtures for [mcpfy](https://github.com/ishay60/mcpfy) connectors. Drives stdio servers like a real MCP client so connector behavior can be asserted end-to-end.

## What's in here

- A minimal MCP client that speaks JSON-RPC over stdio.
- Helpers for spawning a `mcpfy serve` subprocess, listing tools, and calling them.
- Fixture builders for the common shapes (configs, in-memory SQLite, etc.) that connector test suites need.

This package is intended for use inside the mcpfy monorepo and by anyone writing a third-party connector who wants to assert that their tools behave correctly under the security pipeline.

## Docs

- Architecture → https://github.com/ishay60/mcpfy/blob/develop/ARCHITECTURE.md
- Repo → https://github.com/ishay60/mcpfy

MIT licensed.
