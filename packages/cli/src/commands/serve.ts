import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { extname, basename } from 'node:path';
import pc from 'picocolors';
import { loadConfig } from '@mcpfy/config';
import { StdioTransport } from '@mcpfy/core/transports/stdio';
import { buildServerFromConfig } from '../factory.js';
import { banner, section, kv, ready, hint, sym } from '../ui.js';

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

  if (opts.http) {
    process.stderr.write(
      pc.red('  ✗ HTTP transport arrives in Wave 2. Run without --http for stdio.\n'),
    );
    process.exit(1);
  }

  section('Sources');
  for (const c of connectors) {
    const tools = c.listPrimitiveTools().length;
    process.stderr.write(
      `  ${sym.bullet} ${pc.bold(c.id)}  ${pc.dim(`(${c.kind})`)}  ${pc.dim('—')}  ${pc.cyan(`${tools} tools`)}\n`,
    );
  }

  section('Transport');
  kv('Mode', pc.cyan('stdio'));
  kv('Config', pc.dim(basename(opts.config)));

  const transport = new StdioTransport();
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
