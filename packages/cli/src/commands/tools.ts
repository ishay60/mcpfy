import pc from 'picocolors';
import { loadConfig } from '@mcpolyglot/config';
import { buildServerFromConfig } from '../factory.js';
import { headerBar, section, table, footerBar, stdoutSink } from '../ui.js';

export interface ToolsOptions {
  config: string;
}

export async function toolsCommand(opts: ToolsOptions): Promise<void> {
  headerBar(
    { version: '0.0.1', command: 'tools', subtitle: 'preview generated MCP tools' },
    stdoutSink,
  );

  const cfg = await loadConfig(opts.config);
  const { connectors } = await buildServerFromConfig(cfg);

  const rows: string[][] = [];
  for (const c of connectors) {
    await c.init({
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    });
    for (const tool of c.listPrimitiveTools()) {
      rows.push([
        pc.bold(tool.name),
        tool.readOnly ? pc.green('read-only') : pc.yellow('read-write'),
        pc.cyan(tool.scopes.join(', ')),
        pc.dim(tool.description),
      ]);
    }
    await c.close();
  }

  section(`${rows.length} tool(s)`, stdoutSink);
  table(
    [{ header: 'NAME' }, { header: 'MODE' }, { header: 'SCOPES' }, { header: 'DESCRIPTION' }],
    rows,
    stdoutSink,
  );
  footerBar(
    [
      `serve: ${pc.cyan('mcpolyglot serve --config ' + opts.config)}`,
      `docs: ${pc.cyan('github.com/ishay60/mcpolyglot')}`,
    ],
    stdoutSink,
  );
}
