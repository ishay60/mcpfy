import pc from 'picocolors';
import { loadConfig, looksLikeLiteralCredential } from '@mcpfy/config';
import { buildServerFromConfig } from '../factory.js';
import { banner, section, ok, err, warn, bullet, hint, stdoutSink, sym } from '../ui.js';

export interface DoctorOptions {
  config: string;
}

export async function doctorCommand(opts: DoctorOptions): Promise<boolean> {
  let allOk = true;

  banner({ version: '0.0.1', tagline: 'doctor — validate config and connectivity' }, stdoutSink);

  let cfg;
  try {
    cfg = await loadConfig(opts.config);
    section('Config', stdoutSink);
    ok(`parsed`, opts.config, stdoutSink);
  } catch (e) {
    section('Config', stdoutSink);
    err(`failed to parse`, (e as Error).message, stdoutSink);
    return false;
  }

  // Credential heuristic
  const literalUrls = cfg.sources.filter(
    (s) => 'url' in s && looksLikeLiteralCredential(s.url),
  );
  if (literalUrls.length > 0) {
    for (const s of literalUrls) {
      warn(
        `${s.id}: url looks like a literal credential`,
        'use ${env:NAME}, ${file:./path}, or ${keychain:item}',
        stdoutSink,
      );
    }
  }

  section('Sources', stdoutSink);
  const { connectors, server } = await buildServerFromConfig(cfg);
  for (const c of connectors) {
    try {
      await c.init({
        logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      });
      const h = await c.health();
      if (h.ok) {
        ok(c.id, `${c.kind} · ${h.latencyMs} ms`, stdoutSink);
      } else {
        allOk = false;
        err(c.id, h.details ?? 'unhealthy', stdoutSink);
      }
      const tools = c.listPrimitiveTools();
      bullet(pc.dim('tools'), pc.cyan(`${tools.length}`) + pc.dim(` registered`), stdoutSink);
      for (const t of tools) {
        process.stdout.write(
          `      ${sym.bullet} ${pc.bold(t.name)}  ${pc.dim('[')}${pc.cyan(t.scopes.join(', '))}${pc.dim(']')}\n`,
        );
      }
      await c.close();
    } catch (e) {
      allOk = false;
      err(c.id, (e as Error).message, stdoutSink);
    }
  }

  await server.stop().catch(() => {});

  section('Summary', stdoutSink);
  if (allOk) {
    ok('all systems go', 'mcpfy is ready to serve', stdoutSink);
  } else {
    err('one or more checks failed', 'see errors above', stdoutSink);
  }
  hint('run: mcpfy serve', stdoutSink);
  process.stdout.write('\n');
  return allOk;
}
