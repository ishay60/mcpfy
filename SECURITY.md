# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities **privately** by opening a [GitHub security advisory](https://github.com/ishay60/mcpfy/security/advisories/new). Do not file public issues for security problems.

We aim to acknowledge reports within 72 hours and to disclose fixes within 90 days.

## Scope

mcpfy's threat model assumes:

1. **The MCP client is trusted** (Claude Desktop, Cursor, Claude Code on the user's machine).
2. **The model is untrusted.** Tool results are wrapped before reaching the model, but no LLM can be fully sandboxed against prompt injection. Treat agent actions as actions taken by the model, not by you.
3. **Database content is untrusted.** Tool results are passed through redaction and an "untrusted data" wrapper before being returned to the client.
4. **Secrets are resolved at runtime.** Literal credentials in config are rejected by `mcpfy doctor` with a warning.

## Hardening checklist for self-hosting

- Run `mcpfy serve --http` behind a reverse proxy with TLS.
- Bind to `127.0.0.1` for single-user setups.
- Use a database role with read-only permissions even though mcpfy enforces read-only at the protocol level.
- Enable `tables:write` scope only on isolated dev databases.
- Review `~/.mcpfy/audit.log` periodically.

## Known limitations (alpha)

- The current rate limiter is in-process only.
- The HTTP transport (Wave 2) ships with bearer auth as the default; OAuth 2.1 + PKCE is opt-in.
- Per-table write tools (Wave 3) require explicit scope opt-in but do not yet support row-level filters.
