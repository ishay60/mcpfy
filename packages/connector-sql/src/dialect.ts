import type { TableSchema } from '@mcpfy/core';

export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export interface SqlDialect {
  readonly kind: 'postgres' | 'mysql' | 'mariadb' | 'sqlite';
  connect(): Promise<void>;
  close(): Promise<void>;
  ping(): Promise<{ ok: boolean; latencyMs: number; details?: string }>;
  listTables(): Promise<TableSchema[]>;
  /** Run a read-only query with timeout + row cap. Implementations MUST refuse writes. */
  runReadOnly(
    sql: string,
    params: ReadonlyArray<unknown>,
    opts: { rowCap: number; timeoutMs: number; signal?: AbortSignal },
  ): Promise<SqlQueryResult>;
}
