import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Carries an `McpolyglotServer`'s JSON-RPC traffic. Two implementations ship today —
 * `StdioTransport` (Claude Desktop / Cursor / Claude Code) and
 * `StreamableHttpTransport` (long-lived HTTP service with bearer auth).
 */
export interface Transport {
  readonly kind: 'stdio' | 'http';
  /** Wire the transport to the MCP server and start accepting traffic. */
  start(server: Server): Promise<void>;
  /** Stop accepting traffic and close any underlying sockets. Must be idempotent. */
  stop(): Promise<void>;
}
