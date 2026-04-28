---
'@mcpolyglot/cli': minor
'@mcpolyglot/core': minor
'@mcpolyglot/config': minor
'@mcpolyglot/connector-sql': minor
'@mcpolyglot/connector-mongo': minor
---

Refresh CLI UI in a Copilot-CLI flavor and bump zod to v4.

- New UI primitives in `@mcpolyglot/cli`: a boxed `headerBar` with a sub-command pill, pill-chip status indicators (`[ OK ]`, `[ ERR ]`, `[ READY ]`), section dividers, a `panel` for "next steps" callouts, a `footerBar` for hints, and a `step(n/total)` indicator for the `init` wizard.
- `doctor`, `serve`, `tools`, and `init` adopt the new layout. The light `banner` is retained for compatibility.
- `@mcpolyglot/core` now uses zod v4's built-in `z.toJSONSchema()` instead of the `zod-to-json-schema` package, dropping one dep.
- `@mcpolyglot/config`, `@mcpolyglot/connector-sql`, and `@mcpolyglot/connector-mongo` upgraded to zod 4. `ZodTypeAny` was replaced with a permissive `AnyZodSchema` alias in core so existing connector handlers keep working without explicit generic annotations.
- `@mcpolyglot/cli` upgraded `@clack/prompts` to v1 (validate signatures now allow `undefined`).
