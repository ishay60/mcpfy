---
'@mcpolyglot/core': minor
'@mcpolyglot/cli': minor
---

Wire OAuth (JWT + JWKS) verification into the Streamable HTTP transport.

When `auth.type: 'oauth'` is set in the config, the transport now verifies bearer JWTs against the configured issuer/audience and a remote JWKS (cached + rotated by `jose`). The default JWKS path is `${issuer}/.well-known/jwks.json`, matching the convention used by Auth0, Okta, Keycloak, Cognito, and most OIDC providers.

- New module: `@mcpolyglot/core` exposes `createOAuthVerifier({ issuer, audience, jwksUri? })` from `@mcpolyglot/core/transports/streamable-http`.
- `StreamableHttpTransport` now accepts a discriminated `auth: { kind: 'bearer' | 'oauth', ... }` option. The legacy `bearerToken` field is preserved for back-compat.
- 401 responses include an RFC 6750 `WWW-Authenticate` challenge with `error="invalid_token"` and an `error_description` mapped from a small, stable set of reasons (`token_expired`, `signature_invalid`, `claim_validation_failed`, `unknown_key`, `invalid_token`).
- `mcpolyglot serve` now renders `Auth: oauth · <issuer>` and `Audience: <aud>` instead of the bearer token line when running in OAuth mode.
- `examples/http/README.md` documents the OAuth setup with a curl + client-credentials walkthrough.

Adds `jose` (^5.9.6) as a direct dependency of `@mcpolyglot/core`.
