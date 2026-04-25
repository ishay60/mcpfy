import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface StdioClientHandle {
  client: Client;
  close(): Promise<void>;
}

export async function connectStdioClient(opts: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): Promise<StdioClientHandle> {
  const transport = new StdioClientTransport({
    command: opts.command,
    args: opts.args ?? [],
    env: opts.env,
  });
  const client = new Client({ name: 'mcpfy-testkit', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);
  return {
    client,
    async close() {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    },
  };
}
