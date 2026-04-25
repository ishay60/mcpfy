import sqlParser from 'node-sql-parser';
import type { ColumnSchema, TableSchema } from '@mcpfy/core';
import { McpfyError } from '@mcpfy/core';
import type { SqlDialect, SqlQueryResult } from '../dialect.js';

const { Parser } = sqlParser;

type MysqlPool = import('mysql2/promise').Pool;

const READ_OPS = new Set(['select', 'show', 'describe', 'desc', 'explain', 'with']);

export class MysqlDialect implements SqlDialect {
  readonly kind = 'mysql' as const;
  private pool?: MysqlPool;
  private readonly parser = new Parser();

  constructor(private readonly connectionString: string) {}

  async connect(): Promise<void> {
    const mysql = await loadMysql();
    this.pool = mysql.createPool({
      uri: this.connectionString,
      connectionLimit: 4,
      enableKeepAlive: true,
    });
    const c = await this.pool.getConnection();
    try {
      await c.query('SELECT 1');
    } finally {
      c.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = undefined;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; details?: string }> {
    const t0 = Date.now();
    try {
      const c = await this.requirePool().getConnection();
      try {
        await c.query('SELECT 1');
        return { ok: true, latencyMs: Date.now() - t0 };
      } finally {
        c.release();
      }
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: (err as Error).message };
    }
  }

  async listTables(): Promise<TableSchema[]> {
    const c = await this.requirePool().getConnection();
    try {
      const [rows] = (await c.query(
        `SELECT TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS \`name\`
         FROM information_schema.tables
         WHERE TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
         ORDER BY TABLE_SCHEMA, TABLE_NAME`,
      )) as [Array<{ schema: string; name: string }>, unknown];

      const tables: TableSchema[] = [];
      for (const row of rows) {
        const [colRows] = (await c.query(
          `SELECT COLUMN_NAME AS \`name\`, COLUMN_TYPE AS \`type\`,
                  IS_NULLABLE AS \`isNullable\`, COLUMN_KEY AS \`columnKey\`
           FROM information_schema.columns
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY ORDINAL_POSITION`,
          [row.schema, row.name],
        )) as [
          Array<{ name: string; type: string; isNullable: 'YES' | 'NO'; columnKey: string }>,
          unknown,
        ];
        const columns: ColumnSchema[] = colRows.map((cr) => ({
          name: cr.name,
          type: cr.type,
          nullable: cr.isNullable === 'YES',
          primaryKey: cr.columnKey === 'PRI',
        }));
        tables.push({ schema: row.schema, name: row.name, columns });
      }
      return tables;
    } finally {
      c.release();
    }
  }

  async runReadOnly(
    sql: string,
    params: ReadonlyArray<unknown>,
    opts: { rowCap: number; timeoutMs: number; signal?: AbortSignal },
  ): Promise<SqlQueryResult> {
    // 1. AST gate: parse with mysql grammar; refuse anything that isn't a read.
    this.assertReadOnlyOrThrow(sql);

    const c = await this.requirePool().getConnection();
    try {
      // 2. Session read-only.
      await c.query('SET SESSION TRANSACTION READ ONLY');
      await c.query('START TRANSACTION');
      try {
        const [rows, fields] = (await c.query({
          sql: this.injectMaxExecutionTime(sql, opts.timeoutMs),
          values: params as unknown[],
          rowsAsArray: false,
        })) as [Array<Record<string, unknown>>, Array<{ name: string }>];

        const columns = fields?.map((f) => f.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
        const truncated = rows.length > opts.rowCap;
        const sliced = truncated ? rows.slice(0, opts.rowCap) : rows;
        return { columns, rows: sliced, rowCount: sliced.length, truncated };
      } finally {
        await c.query('ROLLBACK').catch(() => {});
      }
    } finally {
      c.release();
    }
  }

  /**
   * MySQL `SET TRANSACTION READ ONLY` is partially honored; some functions
   * (e.g., `SLEEP`, write-time UDFs) bypass it. We pre-screen with a parser
   * that rejects any non-read top-level statement.
   */
  private assertReadOnlyOrThrow(sql: string): void {
    let asts: unknown;
    try {
      asts = this.parser.astify(sql, { database: 'mysql' });
    } catch (err) {
      throw new McpfyError('forbidden.read_only', `Could not parse SQL: ${(err as Error).message}`);
    }
    const list = Array.isArray(asts) ? asts : [asts];
    for (const node of list) {
      const type = ((node as { type?: string })?.type ?? '').toLowerCase();
      if (!READ_OPS.has(type)) {
        throw new McpfyError(
          'forbidden.read_only',
          `Statement is not read-only (got "${type || 'unknown'}")`,
        );
      }
    }
  }

  /** Inject `MAX_EXECUTION_TIME` hint on SELECTs so the server cancels long queries. */
  private injectMaxExecutionTime(sql: string, timeoutMs: number): string {
    const trimmed = sql.replace(/^\s+/, '');
    if (/^select\s/i.test(trimmed) && !/MAX_EXECUTION_TIME/i.test(trimmed)) {
      return trimmed.replace(/^select\s/i, `SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ `);
    }
    return sql;
  }

  private requirePool(): MysqlPool {
    if (!this.pool) throw new McpfyError('connector.not_initialized', 'MysqlDialect not connected');
    return this.pool;
  }
}

async function loadMysql(): Promise<typeof import('mysql2/promise')> {
  try {
    return await import('mysql2/promise');
  } catch {
    throw new McpfyError(
      'connector.missing_dep',
      'The "mysql2" package is required for the mysql dialect. Install it with: pnpm add mysql2',
    );
  }
}
