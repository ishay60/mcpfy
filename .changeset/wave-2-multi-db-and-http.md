---
'@mcpfy/connector-sql': minor
'@mcpfy/connector-mongo': minor
'@mcpfy/core': minor
'@mcpfy/cli': minor
'@mcpfy/config': patch
---

Wave 2: multi-DB + remote.

- **@mcpfy/connector-sql**: add **MySQL/MariaDB dialect** with read-only enforcement. The session is opened with `SET TRANSACTION READ ONLY`, every `SELECT` gets a `MAX_EXECUTION_TIME` hint, and a `node-sql-parser` AST gate rejects any non-read top-level statement before it reaches the server.
- **@mcpfy/connector-mongo**: new package. Sample-based schema inference, `list_collections` / `describe_collection` / `find` / `aggregate` primitives, `$out` and `$merge` aggregation stages rejected.
- **@mcpfy/core**: new `StreamableHttpTransport` (`@mcpfy/core/transports/streamable-http`) wrapping the SDK's `StreamableHTTPServerTransport`. Bearer-token auth via constant-time comparison, `WWW-Authenticate` challenge on 401, `/healthz` endpoint, loud warning when bound to a non-loopback host.
- **@mcpfy/cli**: `mcpfy serve --http` boots the HTTP transport, prints the URL/token banner, and respects `cfg.transport` when no flag is passed. Auto-generates a bearer token if none is configured.
- **@mcpfy/config**: MySQL/MariaDB and Mongo source kinds are now wired through to real connectors instead of throwing.
