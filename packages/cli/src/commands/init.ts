import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { headerBar, panel, footerBar, step, chip, stdoutSink } from '../ui.js';

export interface InitOptions {
  cwd: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  headerBar(
    {
      version: '0.0.1',
      command: 'init',
      subtitle: 'scaffold mcpolyglot.config.ts in this directory',
    },
    stdoutSink,
  );

  const target = resolve(opts.cwd, 'mcpolyglot.config.ts');
  if (existsSync(target)) {
    const proceed = await p.confirm({
      message: `mcpolyglot.config.ts already exists in ${opts.cwd}. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Aborted.');
      return;
    }
  }

  step(1, 3, 'Pick a data source', stdoutSink);
  const kind = await p.select({
    message: 'Pick a data source to start with:',
    options: [
      { value: 'postgres', label: 'PostgreSQL', hint: 'recommended' },
      { value: 'sqlite', label: 'SQLite', hint: 'local file, fastest demo' },
    ],
  });
  if (p.isCancel(kind)) {
    p.cancel('Aborted.');
    return;
  }

  step(2, 3, 'Name the source', stdoutSink);
  const id = await p.text({
    message: 'Source id (used in tool names):',
    initialValue: kind === 'postgres' ? 'pg.main' : 'sqlite.local',
    validate: (v) =>
      v && /^[a-z0-9._-]+$/i.test(v) ? undefined : 'Use letters, digits, dot, hyphen, underscore.',
  });
  if (p.isCancel(id)) return;

  step(3, 3, 'Connection', stdoutSink);
  let url: string;
  if (kind === 'postgres') {
    url = '${env:DATABASE_URL}';
    p.note(
      `Set ${pc.cyan('DATABASE_URL')} in your environment before running ${pc.bold('mcpolyglot serve')}.`,
      'Example',
    );
  } else {
    const path = await p.text({
      message: 'Path to SQLite file:',
      placeholder: './data.db',
      validate: (v) => (v && v.length > 0 ? undefined : 'Required.'),
    });
    if (p.isCancel(path)) return;
    url = path;
  }

  const config = renderConfig({ kind: kind as 'postgres' | 'sqlite', id: id as string, url });
  writeFileSync(target, config, 'utf8');

  stdoutSink('');
  stdoutSink(`  ${chip('OK', 'ok')}  wrote ${pc.bold(target)}`);

  panel(
    {
      title: 'Next',
      lines: [
        `${pc.dim('▸')} ${pc.bold('Validate'.padEnd(10))} ${pc.cyan('mcpolyglot doctor')}`,
        `${pc.dim('▸')} ${pc.bold('List'.padEnd(10))} ${pc.cyan('mcpolyglot tools')}`,
        `${pc.dim('▸')} ${pc.bold('Run'.padEnd(10))} ${pc.cyan('mcpolyglot serve')}`,
      ],
    },
    stdoutSink,
  );

  panel(
    {
      title: 'Wire into your agent',
      lines: [
        `${pc.bold('Claude Desktop')}  ${pc.dim('~/Library/Application Support/Claude/claude_desktop_config.json')}`,
        `${pc.bold('Cursor')}         ${pc.dim('~/.cursor/mcp.json')}`,
        `${pc.bold('Claude Code')}    ${pc.dim('claude mcp add mcpolyglot -- npx -y @mcpolyglot/cli serve')}`,
      ],
    },
    stdoutSink,
  );

  footerBar(['docs: github.com/ishay60/mcpolyglot'], stdoutSink);
}

function renderConfig(opts: { kind: 'postgres' | 'sqlite'; id: string; url: string }): string {
  return `import { defineConfig } from '@mcpolyglot/config';

export default defineConfig({
  server: { name: 'mcpolyglot', version: '0.0.1' },
  transport: { kind: 'stdio' },
  sources: [
    {
      id: '${opts.id}',
      kind: '${opts.kind}',
      url: '${opts.url}',
      scopes: ['schema:read', 'tables:read', 'query:raw'],
      perEntityTools: { enabled: false },
      limits: { rowCap: 200, timeoutMs: 10_000, maxBytes: 262144 },
      redact: {
        columns: [],
        patterns: [],
      },
    },
  ],
  audit: { path: '~/.mcpolyglot/audit.log' },
  rateLimit: { defaultPerMinute: 30, maxConcurrent: 5 },
  security: { wrapMode: 'strict' },
});
`;
}
