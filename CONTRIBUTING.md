# Contributing to mcpfy

Thanks for considering a contribution.

## Quickstart

```bash
corepack enable
pnpm install
pnpm build
pnpm test
```

## Project layout

This is a pnpm + Turborepo monorepo. Each package under `packages/` is published independently. See the [README](./README.md#repository-layout) for the package map.

## Conventions

- TypeScript strict mode, ESM only.
- Public types live in each package's `src/index.ts`.
- The security pipeline in `@mcpfy/core/server.ts` is non-bypassable. Connectors must not perform their own auth, redaction, audit, or rate-limit logic.
- Tests use [vitest](https://vitest.dev). Integration tests use [testcontainers](https://node.testcontainers.org) and only run on Ubuntu CI.
- Conventional commits.

## Adding a connector

1. Create `packages/connector-<kind>/` mirroring `packages/connector-sql/`.
2. Implement `Connector` from `@mcpfy/core`.
3. Expose `listPrimitiveTools()` only — leave per-entity generation for a follow-up.
4. Use the supplied `ToolExecCtx.signal` for cancellation.
5. Never read secrets directly — accept them as already-resolved strings; the `@mcpfy/cli` factory resolves `${env:...}` etc.

## Filing security issues

See [SECURITY.md](./SECURITY.md). **Do not** open public issues for vulnerabilities.

## Releasing

We use [changesets](https://github.com/changesets/changesets). Every PR with a behavior change must include a changeset (`pnpm changeset`).
