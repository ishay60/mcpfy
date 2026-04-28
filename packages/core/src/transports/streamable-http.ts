import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '../transport.js';
import { createOAuthVerifier, type OAuthVerifier, type OAuthVerifierOptions } from './oauth.js';

/** Bearer-token mode: a fixed shared secret on the `Authorization` header. */
export interface BearerAuthOptions {
  kind: 'bearer';
  /** Pre-shared bearer token. Auto-generated if omitted. */
  token?: string;
}

/** OAuth mode: signature + claim verification against a JWKS. */
export interface OAuthAuthOptions extends OAuthVerifierOptions {
  kind: 'oauth';
}

export type HttpAuthOptions = BearerAuthOptions | OAuthAuthOptions;

export interface StreamableHttpTransportOptions {
  host: string;
  port: number;
  /**
   * Auth strategy. Defaults to `{ kind: 'bearer' }` (auto-generated token)
   * for back-compat with the original API.
   */
  auth?: HttpAuthOptions;
  /**
   * @deprecated Pass `auth: { kind: 'bearer', token }` instead. Retained so
   * existing callers (and the CLI's `--http` flag without OAuth config)
   * keep working unchanged.
   */
  bearerToken?: string;
  /** Where to log server startup banner / auth-failure events. Stderr by default. */
  logger?: {
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

type ResolvedAuth =
  | { kind: 'bearer'; token: string }
  | { kind: 'oauth'; verifier: OAuthVerifier; issuer: string; audience: string };

export class StreamableHttpTransport implements Transport {
  readonly kind = 'http' as const;
  /** Bearer token in use, or `undefined` when running in OAuth mode. */
  readonly bearerToken: string | undefined;
  readonly authKind: 'bearer' | 'oauth';
  private readonly host: string;
  private readonly port: number;
  private readonly auth: ResolvedAuth;
  private readonly logger: NonNullable<StreamableHttpTransportOptions['logger']>;
  private inner?: StreamableHTTPServerTransport;
  private httpServer?: HttpServer;

  constructor(opts: StreamableHttpTransportOptions) {
    this.host = opts.host;
    this.port = opts.port;
    this.auth = resolveAuth(opts);
    this.authKind = this.auth.kind;
    this.bearerToken = this.auth.kind === 'bearer' ? this.auth.token : undefined;
    this.logger = opts.logger ?? {
      info: (msg, fields) =>
        process.stderr.write(JSON.stringify({ level: 'info', msg, ...(fields ?? {}) }) + '\n'),
      warn: (msg, fields) =>
        process.stderr.write(JSON.stringify({ level: 'warn', msg, ...(fields ?? {}) }) + '\n'),
    };
  }

  async start(server: McpServer): Promise<void> {
    this.inner = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    this.inner.onerror = (err) => {
      this.logger.warn('http.transport.error', { error: err.message });
    };
    await server.connect(this.inner);

    this.httpServer = createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        this.logger.warn('http.handler.error', {
          error: (err as Error).message,
          stack: (err as Error).stack,
        });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once('error', reject);
      this.httpServer!.listen(this.port, this.host, () => {
        this.httpServer!.off('error', reject);
        resolve();
      });
    });

    const fields: Record<string, unknown> = {
      host: this.host,
      port: this.port,
      auth: this.auth.kind,
    };
    if (this.auth.kind === 'bearer') {
      // Tokens are sensitive; emit a fingerprint not the token itself.
      fields.tokenFingerprint = fingerprint(this.auth.token);
    } else {
      fields.issuer = this.auth.issuer;
      fields.audience = this.auth.audience;
    }
    this.logger.info('http.listening', fields);

    if (!isLoopback(this.host)) {
      this.logger.warn('http.bound_non_loopback', {
        host: this.host,
        recommendation: 'put behind a reverse proxy with TLS',
      });
    }
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
      this.httpServer = undefined;
    }
    await this.inner?.close();
    this.inner = undefined;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const authResult = await this.checkAuth(req);
    if (!authResult.ok) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', wwwAuthenticate(this.auth.kind, authResult.reason));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized', reason: authResult.reason }));
      return;
    }

    if (!this.inner) {
      res.statusCode = 503;
      res.end();
      return;
    }
    await this.inner.handleRequest(req, res);
  }

  private async checkAuth(
    req: IncomingMessage,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      return { ok: false, reason: 'missing_bearer' };
    }
    const token = header.slice('Bearer '.length);

    if (this.auth.kind === 'bearer') {
      const expected = this.auth.token;
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return { ok: false, reason: 'invalid_token' };
      return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'invalid_token' };
    }

    const result = await this.auth.verifier.verify(token);
    if (!result.ok) {
      this.logger.warn('http.oauth.rejected', { reason: result.reason });
      return { ok: false, reason: result.reason };
    }
    return { ok: true };
  }
}

function resolveAuth(opts: StreamableHttpTransportOptions): ResolvedAuth {
  // Back-compat: legacy `bearerToken` arg wins if no `auth` was supplied.
  if (!opts.auth) {
    return { kind: 'bearer', token: opts.bearerToken ?? generateToken() };
  }
  if (opts.auth.kind === 'bearer') {
    return { kind: 'bearer', token: opts.auth.token ?? opts.bearerToken ?? generateToken() };
  }
  return {
    kind: 'oauth',
    verifier: createOAuthVerifier(opts.auth),
    issuer: opts.auth.issuer,
    audience: opts.auth.audience,
  };
}

function wwwAuthenticate(kind: 'bearer' | 'oauth', reason: string): string {
  const errorCode = mapReasonToWwwError(reason);
  // RFC 6750 §3 — `error` and `error_description` belong on Bearer challenges.
  if (kind === 'bearer') {
    return `Bearer realm="mcpolyglot", error="${errorCode}"`;
  }
  return `Bearer realm="mcpolyglot", error="${errorCode}", error_description="${reason}"`;
}

function mapReasonToWwwError(reason: string): string {
  switch (reason) {
    case 'missing_bearer':
      return 'invalid_request';
    case 'token_expired':
    case 'invalid_token':
    case 'signature_invalid':
    case 'unknown_key':
    case 'claim_validation_failed':
      return 'invalid_token';
    default:
      return 'invalid_token';
  }
}

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

function fingerprint(token: string): string {
  // first 4 + last 4 — enough to recognize, not enough to recover
  return token.slice(0, 4) + '…' + token.slice(-4);
}

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}
