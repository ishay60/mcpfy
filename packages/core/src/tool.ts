import type { ZodTypeAny, infer as ZodInfer } from 'zod';

export const ALL_SCOPES = [
  'schema:read',
  'tables:read',
  'tables:write',
  'query:raw',
  'http:call',
] as const;

export type Scope = (typeof ALL_SCOPES)[number];

export const DEFAULT_SCOPES: readonly Scope[] = ['schema:read', 'tables:read'];

export interface ContentBlock {
  type: 'text' | 'json';
  text?: string;
  data?: unknown;
}

export interface ToolResult {
  content: ContentBlock[];
  isError?: boolean;
  metadata?: {
    rows?: number;
    truncated?: boolean;
    durationMs?: number;
    redactionsApplied?: number;
  };
}

export interface ToolExecLimits {
  rowCap: number;
  timeoutMs: number;
  maxBytes: number;
}

export interface ToolExecCtx {
  sessionId: string;
  scopes: Set<Scope>;
  signal: AbortSignal;
  limits: ToolExecLimits;
  logger: {
    debug: (msg: string, fields?: Record<string, unknown>) => void;
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
    error: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

export type ToolHandler<S extends ZodTypeAny = ZodTypeAny> = (
  args: ZodInfer<S>,
  ctx: ToolExecCtx,
) => Promise<ToolResult>;

export interface ToolDefinition<S extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: S;
  scopes: readonly Scope[];
  readOnly: boolean;
  handler: ToolHandler<S>;
}
