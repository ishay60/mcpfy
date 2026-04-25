# @mcpfy/core

The runtime that powers [mcpfy](https://github.com/ishay60/mcpfy). Defines the `Connector` interface, the `McpfyServer`, the transport abstraction, and the non-bypassable security pipeline that wraps every tool call.

You usually don't depend on this directly — install [`@mcpfy/cli`](https://www.npmjs.com/package/@mcpfy/cli) instead. Use this package when you want to embed mcpfy in your own host or write a custom connector.

## What's in here

- **`McpfyServer`** — wires connectors, security hooks, and a transport into an MCP-compliant server. Every tool call goes through the same pipeline:
  ```
  scope check → rate limit → timeout → handler → redact → size cap → wrap → audit
  ```
  Connectors can't opt out.
- **`Connector`** — the interface a data-source adapter implements (`init`, `close`, `health`, `introspect`, `listPrimitiveTools`, `generatePerEntityTools`).
- **`Transport`** — minimal contract; ships with `StdioTransport` and `StreamableHttpTransport`.
- **`ToolDefinition`** — `{ name, description, inputSchema (zod), scopes, readOnly, handler }`.

## Subpath exports

```ts
import { McpfyServer } from '@mcpfy/core';
import { StdioTransport } from '@mcpfy/core/transports/stdio';
import { StreamableHttpTransport } from '@mcpfy/core/transports/streamable-http';
```

## Docs

- Architecture → https://github.com/ishay60/mcpfy/blob/develop/ARCHITECTURE.md
- Pipeline source → [`src/server.ts`](./src/server.ts) (`executeTool`)

MIT licensed.
