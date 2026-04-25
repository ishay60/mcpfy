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

export interface StreamableHttpTransportOptions {
  host: string;
  port: number;
  /** Bearer token required on the Authorization header. Auto-generated if omitted. */
  bearerToken?: string;
  /** Where to log server startup banner / auth-failure events. Stderr by default. */
  logger?: {
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

export class StreamableHttpTransport implements Transport {
  readonly kind = 'http' as const;
  readonly bearerToken: string;
  private readonly host: string;
  private readonly port: number;
  private readonly logger: NonNullable<StreamableHttpTransportOptions['logger']>;
  private inner?: StreamableHTTPServerTransport;
  private httpServer?: HttpServer;

  constructor(opts: StreamableHttpTransportOptions) {
    this.host = opts.host;
    this.port = opts.port;
    this.bearerToken = opts.bearerToken ?? generateToken();
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

    this.logger.info('http.listening', {
      host: this.host,
      port: this.port,
      // Tokens are sensitive; emit a fingerprint not the token itself.
      tokenFingerprint: fingerprint(this.bearerToken),
    });
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

    if (!this.checkAuth(req)) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Bearer realm="mcpolyglot"');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (!this.inner) {
      res.statusCode = 503;
      res.end();
      return;
    }
    await this.inner.handleRequest(req, res);
  }

  private checkAuth(req: IncomingMessage): boolean {
    const header = req.headers.authorization ?? '';
    const expected = `Bearer ${this.bearerToken}`;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
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
