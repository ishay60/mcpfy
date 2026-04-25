import type { TableSchema, ColumnSchema } from '@mcpfy/core';
import { McpfyError } from '@mcpfy/core';
import type { SqlDialect, SqlQueryResult } from '../dialect.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BetterSqlite3Database = any;

export class SqliteDialect implements SqlDialect {
  readonly kind = 'sqlite' as const;
  private db?: BetterSqlite3Database;

  /**
   * @param fileOrUri Either an absolute path or a `sqlite://` URI.
   *                  The file is opened **read-only** regardless of caller intent.
   */
  constructor(private readonly fileOrUri: string) {}

  async connect(): Promise<void> {
    const Database = await loadSqlite();
    const path = this.resolvePath();
    const db = new Database(path, { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    this.db = db;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = undefined;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; details?: string }> {
    const t0 = Date.now();
    try {
      this.requireDb().prepare('SELECT 1').get();
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: (err as Error).message };
    }
  }

  async listTables(): Promise<TableSchema[]> {
    const db = this.requireDb();
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;

    return tables.map(({ name }) => {
      const cols = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;
      const columns: ColumnSchema[] = cols.map((c) => ({
        name: c.name,
        type: c.type || 'ANY',
        nullable: c.notnull === 0,
        primaryKey: c.pk > 0,
      }));
      return { name, columns };
    });
  }

  async runReadOnly(
    sql: string,
    params: ReadonlyArray<unknown>,
    opts: { rowCap: number; timeoutMs: number; signal?: AbortSignal },
  ): Promise<SqlQueryResult> {
    const db = this.requireDb();
    if (opts.signal?.aborted) throw new McpfyError('aborted', 'Aborted before execution');

    // SQLite is synchronous via better-sqlite3 — `query_only` pragma + readonly handle blocks writes.
    const stmt = db.prepare(sql);
    if (!stmt.reader) {
      throw new McpfyError('forbidden.read_only', 'Statement is not read-only');
    }
    const startedAt = Date.now();
    const all = stmt.all(...(params as unknown[])) as Array<Record<string, unknown>>;
    if (Date.now() - startedAt > opts.timeoutMs) {
      throw new McpfyError('timeout', `Query exceeded ${opts.timeoutMs}ms`);
    }
    const truncated = all.length > opts.rowCap;
    const rows = truncated ? all.slice(0, opts.rowCap) : all;
    const columns = rows[0]
      ? Object.keys(rows[0])
      : ((stmt.columns() as Array<{ name: string }>).map((c) => c.name) ?? []);
    return { columns, rows, rowCount: rows.length, truncated };
  }

  private requireDb(): BetterSqlite3Database {
    if (!this.db) throw new McpfyError('connector.not_initialized', 'SqliteDialect not connected');
    return this.db;
  }

  private resolvePath(): string {
    const v = this.fileOrUri;
    if (v.startsWith('sqlite://')) return v.replace(/^sqlite:\/\//, '');
    return v;
  }
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSqlite(): Promise<any> {
  try {
    const mod = (await import('better-sqlite3')) as unknown as {
      default?: unknown;
    };
    return mod.default ?? mod;
  } catch {
    throw new McpfyError(
      'connector.missing_dep',
      'The "better-sqlite3" package is required for the sqlite dialect. Install it with: pnpm add better-sqlite3',
    );
  }
}
