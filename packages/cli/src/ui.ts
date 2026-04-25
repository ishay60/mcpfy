import pc from 'picocolors';

/** Where to write display output. Stdio MCP servers must keep stdout clean. */
export type Sink = (s: string) => void;
export const stderrSink: Sink = (s) => {
  process.stderr.write(s + '\n');
};
export const stdoutSink: Sink = (s) => {
  // eslint-disable-next-line no-console
  console.log(s);
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Symbols                                                               */
/* ────────────────────────────────────────────────────────────────────── */

export const sym = {
  ok: pc.green('✓'),
  err: pc.red('✗'),
  warn: pc.yellow('!'),
  info: pc.cyan('›'),
  arrow: pc.dim('➜'),
  bullet: pc.dim('•'),
  pipe: pc.dim('│'),
  hor: pc.dim('─'),
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Banner                                                                */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Vite/Astro-style banner: triangle, duotone wordmark, version chip, tagline.
 *
 *   ▲ mcpfy v0.0.1
 *     turn your databases into MCP servers
 */
export function banner(opts: { version: string; tagline?: string }, sink: Sink = stderrSink): void {
  const wordmark =
    pc.cyan('m') + pc.cyan('c') + pc.cyan('p') + pc.magenta('f') + pc.magenta('y');
  const triangle = pc.cyan('▲');
  const ver = pc.dim(`v${opts.version}`);
  sink('');
  sink(`  ${triangle}  ${pc.bold(wordmark)}  ${ver}`);
  if (opts.tagline) sink(`     ${pc.dim(opts.tagline)}`);
  sink('');
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Status lines                                                          */
/* ────────────────────────────────────────────────────────────────────── */

export function ok(label: string, detail?: string, sink: Sink = stderrSink): void {
  sink(`  ${sym.ok} ${label}${detail ? '  ' + pc.dim(detail) : ''}`);
}
export function err(label: string, detail?: string, sink: Sink = stderrSink): void {
  sink(`  ${sym.err} ${pc.red(label)}${detail ? '  ' + pc.dim(detail) : ''}`);
}
export function warn(label: string, detail?: string, sink: Sink = stderrSink): void {
  sink(`  ${sym.warn} ${pc.yellow(label)}${detail ? '  ' + pc.dim(detail) : ''}`);
}
export function info(label: string, detail?: string, sink: Sink = stderrSink): void {
  sink(`  ${sym.info} ${label}${detail ? '  ' + pc.dim(detail) : ''}`);
}
export function bullet(label: string, detail?: string, sink: Sink = stderrSink): void {
  sink(`  ${sym.bullet} ${label}${detail ? '  ' + pc.dim(detail) : ''}`);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Layout                                                                */
/* ────────────────────────────────────────────────────────────────────── */

export function section(title: string, sink: Sink = stderrSink): void {
  sink('');
  sink(`  ${pc.bold(title)}`);
}

/** Vite-style "Local / Network" key/value column. Right-pads keys for alignment. */
export function kv(label: string, value: string, sink: Sink = stderrSink): void {
  const pad = label.padEnd(8);
  sink(`  ${sym.arrow}  ${pc.bold(pad)} ${value}`);
}

export function divider(sink: Sink = stderrSink): void {
  sink(`  ${sym.hor.repeat(50)}`);
}

/** "ready in 123 ms" — the universal CLI flex. */
export function ready(ms: number, sink: Sink = stderrSink): void {
  sink('');
  sink(`  ${pc.green('ready')} ${pc.dim(`in ${ms} ms`)}`);
  sink('');
}

export function hint(text: string, sink: Sink = stderrSink): void {
  sink(`  ${pc.dim(text)}`);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Tables                                                                */
/* ────────────────────────────────────────────────────────────────────── */

export interface Column {
  header: string;
  width?: number;
  color?: (s: string) => string;
}

export function table(columns: Column[], rows: string[][], sink: Sink = stderrSink): void {
  const widths = columns.map((c, i) =>
    Math.max(c.width ?? 0, c.header.length, ...rows.map((r) => stripAnsi(r[i] ?? '').length)),
  );
  const head = columns.map((c, i) => pc.bold(pc.dim(c.header.padEnd(widths[i]!)))).join('  ');
  sink(`  ${head}`);
  sink(`  ${widths.map((w) => sym.hor.repeat(w)).join('  ')}`);
  for (const row of rows) {
    const line = columns
      .map((c, i) => {
        const cell = row[i] ?? '';
        const padded = padRightAnsi(cell, widths[i]!);
        return c.color ? c.color(padded) : padded;
      })
      .join('  ');
    sink(`  ${line}`);
  }
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function padRightAnsi(s: string, width: number): string {
  const visible = stripAnsi(s).length;
  return s + ' '.repeat(Math.max(0, width - visible));
}

/** Styled URL — cyan + underline, the Vite/Astro/Wrangler look. */
export function link(url: string, label = url): string {
  return pc.cyan(pc.underline(label === url ? url : label));
}
