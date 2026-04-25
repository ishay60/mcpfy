import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface Transport {
  readonly kind: 'stdio' | 'http';
  start(server: Server): Promise<void>;
  stop(): Promise<void>;
}
