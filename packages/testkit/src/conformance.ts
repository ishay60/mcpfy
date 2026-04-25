import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export interface ConformanceReport {
  passed: string[];
  failed: Array<{ name: string; reason: string }>;
}

/** Run a tiny MCP conformance suite against an already-connected client. */
export async function runConformance(client: Client): Promise<ConformanceReport> {
  const passed: string[] = [];
  const failed: ConformanceReport['failed'] = [];

  await check('tools/list returns array', async () => {
    const r = await client.listTools();
    if (!Array.isArray(r.tools)) throw new Error('tools is not an array');
  });

  await check('every tool has name + inputSchema', async () => {
    const r = await client.listTools();
    for (const t of r.tools) {
      if (!t.name) throw new Error('missing name');
      if (!t.inputSchema || typeof t.inputSchema !== 'object') {
        throw new Error(`tool ${t.name} missing inputSchema`);
      }
    }
  });

  return { passed, failed };

  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed.push(name);
    } catch (err) {
      failed.push({ name, reason: (err as Error).message });
    }
  }
}
