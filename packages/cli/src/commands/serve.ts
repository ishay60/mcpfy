import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { extname, basename } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '@mcpfy/config';
import { StdioTransport } from '@mcpfy/core/transports/stdio';
import { StreamableHttpTransport } from '@mcpfy/core/transports/streamable-http';
import { buildServerFromConfig } from '../factory.js';
import { banner, section, kv, ready, hint, sym, link } from '../ui.js';

export interface ServeOptions {
  config: string;
  http: boolean;
  host: string;
  port: number;
}

export async function serveCommand(opts: ServeOptions): Promise<void> {
  const startedAt = Date.now();

  if (extname(opts.config) === '.ts' || extname(opts.config) === '.mts') {
    try {
      register('tsx/esm', pathToFileURL('./'));
    } catch {
      // tsx unavailable — config loader will throw a clear error if it tries.
    }
  }

  banner({ version: '0.0.1', tagline: 'one config, every database your agent needs' });

  const cfg = await loadConfig(opts.config);
  const { server, connectors } = await buildServerFromConfig(cfg);

  section('Sources');
  for (const c of connectors) {
    const tools = c.listPrimitiveTools().length;
    process.stderr.write(
      `  ${sym.bullet} ${pc.bold(c.id)}  ${pc.dim(`(${c.kind})`)}  ${pc.dim('—')}  ${pc.cyan(`${tools} tools`)}\n`,
    );
  }

  section('Transport');
  // --http flag overrides config; otherwise honor cfg.transport.kind.
  const wantHttp = opts.http || cfg.transport.kind === 'http';
  const httpHost = cfg.transport.kind === 'http' && !opts.http ? cfg.transport.host : opts.host;
  const httpPort = cfg.transport.kind === 'http' && !opts.http ? cfg.transport.port : opts.port;
  const configuredToken =
    cfg.transport.kind === 'http' && cfg.transport.auth.type === 'bearer'
      ? cfg.transport.auth.token
      : undefined;

  let transport: StdioTransport | StreamableHttpTransport;
  if (wantHttp) {
    const httpTransport = new StreamableHttpTransport({
      host: httpHost,
      port: httpPort,
      ...(configuredToken ? { bearerToken: configuredToken } : {}),
    });
    transport = httpTransport;
    kv('Mode', pc.cyan('streamable-http'));
    kv('URL', link(`http://${httpHost}:${httpPort}/mcp`));
    kv('Health', link(`http://${httpHost}:${httpPort}/healthz`));
    kv('Token', pc.yellow(httpTransport.bearerToken));
    kv('Config', pc.dim(basename(opts.config)));
  } else {
    transport = new StdioTransport();
    kv('Mode', pc.cyan('stdio'));
    kv('Config', pc.dim(basename(opts.config)));
  }

  await server.start(transport);

  ready(Date.now() - startedAt);
  hint('Press Ctrl+C to stop. Audit log: ~/.mcpfy/audit.log');

  const shutdown = async () => {
    process.stderr.write(pc.dim('\n  shutting down…\n'));
    await server.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
