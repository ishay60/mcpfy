import type { ToolDefinition } from './tool.js';

export type ConnectorKind = 'sql' | 'mongo' | 'openapi';

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  foreignKey?: { table: string; column: string };
}

export interface TableSchema {
  schema?: string;
  name: string;
  columns: ColumnSchema[];
  rowCountEstimate?: number;
  comment?: string;
}

export interface CollectionSchema {
  name: string;
  sampledFields: Array<{ path: string; types: string[]; nullable: boolean }>;
  documentCountEstimate?: number;
}

export interface OperationSchema {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  parameters: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    required: boolean;
    type: string;
  }>;
  requestBody?: { contentType: string; schemaRef?: string };
}

export type SchemaSnapshot =
  | { kind: 'sql'; tables: TableSchema[] }
  | { kind: 'mongo'; collections: CollectionSchema[] }
  | { kind: 'openapi'; operations: OperationSchema[] };

export interface PerEntityConfig {
  enabled: boolean;
  include?: string[];
  exclude?: string[];
}

export interface ConnectorInitCtx {
  logger: {
    debug: (msg: string, fields?: Record<string, unknown>) => void;
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
    error: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

export interface Connector {
  readonly id: string;
  readonly kind: ConnectorKind;
  init(ctx: ConnectorInitCtx): Promise<void>;
  close(): Promise<void>;
  introspect(): Promise<SchemaSnapshot>;
  listPrimitiveTools(): ToolDefinition[];
  generatePerEntityTools(cfg: PerEntityConfig): ToolDefinition[];
  health(): Promise<{ ok: boolean; latencyMs: number; details?: string }>;
}
