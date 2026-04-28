import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyResult } from 'jose';

export interface OAuthVerifierOptions {
  /** OIDC issuer URL. Required. Token `iss` must match exactly. */
  issuer: string;
  /** Expected `aud` claim. Required. */
  audience: string;
  /**
   * JWKS endpoint. If omitted, defaults to `${issuer}/.well-known/jwks.json`,
   * which matches the convention used by Auth0, Okta, Keycloak, AWS Cognito,
   * and most other OIDC providers.
   */
  jwksUri?: string;
  /**
   * Allowed clock skew, in seconds, when checking `exp` / `nbf`. Defaults to 30s
   * — enough to absorb NTP drift between issuer and verifier without weakening
   * expiry semantics.
   */
  clockToleranceSeconds?: number;
}

/** Successful verification carries the subject and the full payload. */
export interface OAuthVerifyOk {
  ok: true;
  sub?: string;
  payload: JWTPayload;
}

/** Failed verification carries a stable reason code suitable for logs / 401s. */
export interface OAuthVerifyErr {
  ok: false;
  /**
   * Stable, machine-readable reason. Mapped from the `code` jose throws
   * (e.g. `ERR_JWT_EXPIRED`) so callers can render `error_description`
   * without leaking stack traces.
   */
  reason: string;
}

export type OAuthVerifyResult = OAuthVerifyOk | OAuthVerifyErr;

export interface OAuthVerifier {
  /** Validate a Bearer token's signature, issuer, audience, and timing. */
  verify(token: string): Promise<OAuthVerifyResult>;
}

/**
 * Build an OAuth bearer-token verifier backed by a remote JWKS. The JWKS is
 * fetched on first use and cached / rotated by `jose` automatically (default
 * 10-minute cooldown, 30-second timeout). Verification enforces:
 *
 * - signature against a JWKS-resolved key
 * - `iss` exact-match
 * - `aud` exact-match
 * - `exp` / `nbf` within `clockToleranceSeconds`
 *
 * The verifier is intentionally minimal: scope mapping (e.g. translating an
 * OAuth `scope` claim into the mcpolyglot scope set) is the caller's job, not
 * the transport's. The transport's only contract is "the bearer is valid".
 */
export function createOAuthVerifier(opts: OAuthVerifierOptions): OAuthVerifier {
  const jwksUri = opts.jwksUri ?? defaultJwksUri(opts.issuer);
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  const clockTolerance = opts.clockToleranceSeconds ?? 30;

  return {
    async verify(token: string): Promise<OAuthVerifyResult> {
      try {
        const result: JWTVerifyResult = await jwtVerify(token, jwks, {
          issuer: opts.issuer,
          audience: opts.audience,
          clockTolerance,
        });
        return { ok: true, sub: result.payload.sub, payload: result.payload };
      } catch (e) {
        return { ok: false, reason: classifyError(e) };
      }
    },
  };
}

/** Strip a trailing slash from issuer before joining the JWKS path. */
function defaultJwksUri(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
}

/**
 * Map `jose` errors and other failures to a small, stable set of reason
 * strings. Anything we don't recognize collapses to `invalid_token` so we
 * never leak verifier internals into a 401 response.
 */
function classifyError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = String((e as { code: unknown }).code);
    switch (code) {
      case 'ERR_JWT_EXPIRED':
        return 'token_expired';
      case 'ERR_JWT_CLAIM_VALIDATION_FAILED':
        return 'claim_validation_failed';
      case 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED':
        return 'signature_invalid';
      case 'ERR_JWKS_NO_MATCHING_KEY':
        return 'unknown_key';
      case 'ERR_JWKS_TIMEOUT':
        return 'jwks_unavailable';
      default:
        return 'invalid_token';
    }
  }
  return 'invalid_token';
}
