import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';

export interface AuditLoggerOptions {
  path?: string;
}

export class AuditLogger {
  private readonly path: string;
  private dirEnsured = false;

  constructor(opts: AuditLoggerOptions = {}) {
    this.path = expandHome(opts.path ?? '~/.mcpolyglot/audit.log');
  }

  async append(entry: Record<string, unknown>): Promise<void> {
    if (!this.dirEnsured) {
      await mkdir(dirname(this.path), { recursive: true });
      this.dirEnsured = true;
    }
    await appendFile(this.path, JSON.stringify(entry) + '\n', 'utf8');
  }
}

function expandHome(p: string): string {
  if (p.startsWith('~')) return p.replace(/^~/, homedir());
  return p;
}
