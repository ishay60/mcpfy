# @mcpfy/security

The non-bypassable security middleware for [mcpfy](https://github.com/ishay60/mcpfy). Implements every phase of the pipeline that wraps tool calls in `@mcpfy/core`.

## What's in here

- **`ScopeGuard`** — refuses tools whose required scopes aren't in the granted set.
- **`RateLimiter`** — token bucket per session per tool, plus a max-concurrent gate.
- **`Redactor`** — built-in regex set (emails, JWTs, AWS access keys, GitHub tokens, SSNs, credit-card numbers) plus per-table column deny lists.
- **`AuditLogger`** — JSONL appender for `~/.mcpfy/audit.log`. Logs argshash + metadata; never raw args or results.
- **`wrapUntrusted` / `enforceSize`** — `<mcpfy-data>` prompt-injection wrapper and a hard byte cap on serialized output.
- **`defaultSecurityHooks(opts)`** — composes all of the above into the `SecurityHooks` shape `McpfyServer` expects.
- **`composeHooks(...hooks)`** — chain custom hooks alongside the defaults.

## Why a separate package

Connectors, the CLI, and any embedding host all need to construct the security hooks the same way. Keeping them in one package makes that boring and reviewable.

## Docs

- Architecture → https://github.com/ishay60/mcpfy/blob/develop/ARCHITECTURE.md
- Pipeline overview → see "The security pipeline" section in ARCHITECTURE.md

MIT licensed.
