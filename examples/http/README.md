# Streamable HTTP transport

Run mcpfy as a long-lived HTTP service instead of a per-client stdio process. This is the right shape for:

- multi-tenant deployments behind a TLS-terminating proxy,
- shared dev environments where every team member's IDE talks to one mcpfy,
- remote MCP integration with [Claude.ai's "Custom Connectors"](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers).

## 1. Pick a bearer token

```bash
export MCPFY_BEARER_TOKEN="$(openssl rand -base64 24)"
export DATABASE_URL="postgres://user:pass@localhost:5432/app"
```

If you skip `MCPFY_BEARER_TOKEN`, mcpfy mints a fresh token on every start and prints it on stderr. That's fine for poking around with `curl` — useless for any client that needs a stable secret.

## 2. Start the server

```bash
npx @mcpfy/cli serve --config ./mcpfy.config.ts
```

You'll see something like:

```text
  ▲  mcpfy  v0.0.1
     one config, every database your agent needs

  Sources
  • pg.main  (postgres)  —  3 tools

  Transport
  ➜  Mode    streamable-http
  ➜  URL     http://127.0.0.1:7337/mcp
  ➜  Health  http://127.0.0.1:7337/healthz
  ➜  Token   <your token>
  ➜  Config  mcpfy.config.ts

  ready in 142 ms
```

You can also flip the transport from the command line without touching the config:

```bash
npx @mcpfy/cli serve --http --port 7337 --host 127.0.0.1
```

## 3. Smoke test

```bash
# Health probe (no auth)
curl http://127.0.0.1:7337/healthz

# Without auth, /mcp returns 401 with a WWW-Authenticate header.
curl -i http://127.0.0.1:7337/mcp

# Authed list_tools call
curl -s http://127.0.0.1:7337/mcp \
  -H "Authorization: Bearer $MCPFY_BEARER_TOKEN" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Security defaults

The Streamable HTTP transport is read-only-secure by default:

- **Loopback by default.** `host: '127.0.0.1'` keeps the listener off the network. Binding to a non-loopback address logs a `http.bound_non_loopback` warning recommending you front it with a reverse proxy that does TLS.
- **Bearer auth required on `/mcp`.** Comparison is constant-time (`timingSafeEqual`); auth failures return `401` with `WWW-Authenticate: Bearer realm="mcpfy"`.
- **Tokens never appear in logs.** Startup logs include only a fingerprint (`first4…last4`); audit and error logs don't touch the token at all.
- **`/healthz`** is unauthenticated by design so liveness probes don't need to carry a secret.

For production, terminate TLS at a reverse proxy (Caddy, nginx, an ALB) and forward to the loopback port. Don't expose `--host 0.0.0.0` directly.

## OAuth (Wave 3)

The config schema already accepts `auth.type: 'oauth'` with `issuer`, `audience`, and an optional `jwksUri`. The verifier middleware lands in Wave 3 alongside the OpenAPI connector.
