import { randomUUID, createHash } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Connector, PerEntityConfig } from './connector.js';
import type { Transport } from './transport.js';
import {
  type Scope,
  type ToolDefinition,
  type ToolExecCtx,
  type ToolExecLimits,
  type ToolResult,
  DEFAULT_SCOPES,
} from './tool.js';
import { McpfyError, ScopeError, TimeoutError } from './errors.js';

export interface SecurityHooks {
  /** Reject if the granted scopes don't cover the tool's required scopes. */
  checkScopes(toolName: string, required: readonly Scope[], granted: ReadonlySet<Scope>): void;
  /** Token-bucket / concurrency check. Throws RateLimitError on violation. */
  checkRateLimit(toolName: string, sessionId: string): Promise<void>;
  /** Run after the handler — strip secrets, drop denied columns, etc. Returns result and count. */
  redact(toolName: string, result: ToolResult): { result: ToolResult; redactionsApplied: number };
  /** Hard cap on serialized output bytes. Truncates and flips metadata.truncated. */
  enforceSize(toolName: string, result: ToolResult, maxBytes: number): ToolResult;
  /** Wrap untrusted data so the LLM treats it as data, not instructions. */
  wrapUntrusted(result: ToolResult): ToolResult;
  /** Append one JSONL line per call. Never logs raw args / results. */
  audit(entry: AuditEntry): Promise<void>;
}

export interface SecurityServices {
  hooks: SecurityHooks;
  defaultLimits: ToolExecLimits;
  defaultScopes: readonly Scope[];
}

export interface AuditEntry {
  ts: string;
  sessionId: string;
  tool: string;
  argsHash: string;
  scopes: Scope[];
  durationMs: number;
  rows?: number;
  truncated?: boolean;
  redactionsApplied?: number;
  error?: { code: string; message: string };
}

export interface McpfyServerOptions {
  name?: string;
  version?: string;
  connectors: Connector[];
  perEntity?: Record<string, PerEntityConfig>;
  scopes?: readonly Scope[];
  security: SecurityServices;
  logger?: {
    debug: (msg: string, fields?: Record<string, unknown>) => void;
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
    error: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

export class McpfyServer {
  private readonly server: Server;
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly connectors: Connector[];
  private readonly perEntity: Record<string, PerEntityConfig>;
  private readonly scopes: Set<Scope>;
  private readonly security: SecurityServices;
  private readonly sessionId = randomUUID();
  private readonly logger: NonNullable<McpfyServerOptions['logger']>;
  private transport?: Transport;

  constructor(opts: McpfyServerOptions) {
    this.connectors = opts.connectors;
    this.perEntity = opts.perEntity ?? {};
    this.scopes = new Set(opts.scopes ?? DEFAULT_SCOPES);
    this.security = opts.security;
    this.logger = opts.logger ?? makeNoopLogger();

    this.server = new Server(
      { name: opts.name ?? 'mcpfy', version: opts.version ?? '0.0.1' },
      { capabilities: { tools: {} } },
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7' }) as Record<
          string,
          unknown
        >,
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const def = this.tools.get(req.params.name);
      if (!def) {
        throw new McpfyError('tool.not_found', `Unknown tool: ${req.params.name}`);
      }
      const internal = await this.executeTool(def, req.params.arguments ?? {});
      return toMcpResult(internal);
    });
  }

  async start(transport: Transport): Promise<void> {
    for (const c of this.connectors) {
      await c.init({ logger: this.logger });
      for (const tool of c.listPrimitiveTools()) {
        this.registerTool(tool);
      }
      const cfg = this.perEntity[c.id];
      if (cfg?.enabled) {
        for (const tool of c.generatePerEntityTools(cfg)) {
          this.registerTool(tool);
        }
      }
    }
    this.transport = transport;
    await transport.start(this.server);
    this.logger.info('mcpfy.started', {
      sessionId: this.sessionId,
      transport: transport.kind,
      tools: this.tools.size,
    });
  }

  async stop(): Promise<void> {
    await this.transport?.stop();
    for (const c of this.connectors) {
      await c.close();
    }
    await this.server.close();
  }

  private registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new McpfyError('tool.duplicate', `Duplicate tool name: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Fixed pipeline: scope check → rate limit → timeout → handler →
   * redaction → size cap → untrusted-wrap → audit log → response.
   * Connectors cannot bypass.
   */
  private async executeTool(def: ToolDefinition, rawArgs: unknown): Promise<ToolResult> {
    const started = Date.now();
    const argsHash = hashArgs(rawArgs);
    let result: ToolResult | undefined;
    let errorEntry: AuditEntry['error'];

    try {
      // 1. scope check
      this.security.hooks.checkScopes(def.name, def.scopes, this.scopes);

      // 2. rate limit
      await this.security.hooks.checkRateLimit(def.name, this.sessionId);

      // 3. timeout
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.security.defaultLimits.timeoutMs);

      const ctx: ToolExecCtx = {
        sessionId: this.sessionId,
        scopes: this.scopes,
        signal: ac.signal,
        limits: this.security.defaultLimits,
        logger: this.logger,
      };

      try {
        const parsed = def.inputSchema.parse(rawArgs);
        result = await def.handler(parsed, ctx);
      } finally {
        clearTimeout(timer);
        if (ac.signal.aborted && !result) {
          throw new TimeoutError(`Tool ${def.name} exceeded ${ctx.limits.timeoutMs}ms`);
        }
      }

      // 4. redaction
      const redacted = this.security.hooks.redact(def.name, result);
      result = redacted.result;

      // 5. size cap
      result = this.security.hooks.enforceSize(
        def.name,
        result,
        this.security.defaultLimits.maxBytes,
      );

      // 6. untrusted-data wrapper
      result = this.security.hooks.wrapUntrusted(result);

      result.metadata = {
        ...result.metadata,
        durationMs: Date.now() - started,
        redactionsApplied: redacted.redactionsApplied,
      };

      return result;
    } catch (err) {
      const e = err as Error & { code?: string };
      errorEntry = { code: e.code ?? 'internal_error', message: e.message };
      if (err instanceof ScopeError || err instanceof TimeoutError) {
        return {
          content: [{ type: 'text', text: e.message }],
          isError: true,
          metadata: { durationMs: Date.now() - started },
        };
      }
      throw err;
    } finally {
      await this.security.hooks.audit({
        ts: new Date().toISOString(),
        sessionId: this.sessionId,
        tool: def.name,
        argsHash,
        scopes: Array.from(this.scopes),
        durationMs: Date.now() - started,
        rows: result?.metadata?.rows,
        truncated: result?.metadata?.truncated,
        redactionsApplied: result?.metadata?.redactionsApplied,
        error: errorEntry,
      });
    }
  }
}

function hashArgs(args: unknown): string {
  return createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex').slice(0, 16);
}

/** Translate mcpfy's internal ToolResult into the MCP CallToolResult shape. */
function toMcpResult(r: ToolResult): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  return {
    content: r.content.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text ?? '' };
      return { type: 'text', text: JSON.stringify(b.data ?? null, null, 2) };
    }),
    ...(r.isError ? { isError: true } : {}),
  };
}

function makeNoopLogger(): NonNullable<McpfyServerOptions['logger']> {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}
