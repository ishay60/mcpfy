# @mcpfy/cli

The `mcpfy` command-line interface. Scaffolds a config, validates connectivity, lists tools, and serves the MCP server over stdio or Streamable HTTP.

```bash
npx @mcpfy/cli init       # interactive wizard
npx @mcpfy/cli doctor     # validate config, ping sources, list tools
npx @mcpfy/cli tools      # list tools mcpfy would expose
npx @mcpfy/cli serve      # start the MCP server (stdio)
npx @mcpfy/cli serve --http --port 7337   # start over Streamable HTTP
```

## Commands

| Command  | Purpose                                                                |
| -------- | ---------------------------------------------------------------------- |
| `init`   | Interactively scaffold an `mcpfy.config.ts` in the current directory.  |
| `doctor` | Load + validate config, resolve secrets, ping each source, list tools. |
| `tools`  | Print every tool mcpfy would expose for the current config.            |
| `serve`  | Start the server. `--http` flips to Streamable HTTP with bearer auth.  |

`serve --http` prints the bearer token, MCP URL, and `/healthz` URL on stderr. Pin the token in your config (`transport.auth.token`) for stable deployments; omit it to mint a fresh token on each start.

Stdio servers must keep stdout clean, so all CLI output goes to stderr.

## Docs

- Full README → https://github.com/ishay60/mcpfy
- Architecture → https://github.com/ishay60/mcpfy/blob/develop/ARCHITECTURE.md
- Examples → https://github.com/ishay60/mcpfy/tree/develop/examples

MIT licensed.
