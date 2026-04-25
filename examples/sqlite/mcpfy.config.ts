import { defineConfig } from '@mcpfy/config';

export default defineConfig({
  server: { name: 'mcpfy', version: '0.0.1' },
  transport: { kind: 'stdio' },
  sources: [
    {
      id: 'sqlite.local',
      kind: 'sqlite',
      url: './data.db',
      scopes: ['schema:read', 'tables:read', 'query:raw'],
      perEntityTools: { enabled: false },
      limits: { rowCap: 200, timeoutMs: 10_000, maxBytes: 262144 },
      redact: { columns: [], patterns: [] },
    },
  ],
  audit: { path: '~/.mcpfy/audit.log' },
  rateLimit: { defaultPerMinute: 30, maxConcurrent: 5 },
  security: { wrapMode: 'strict' },
});
