import { defineConfig } from '@mcpfy/config';

export default defineConfig({
  server: { name: 'mcpfy', version: '0.0.1' },
  transport: { kind: 'stdio' },
  sources: [
    {
      id: 'mysql.main',
      kind: 'mysql',
      url: '${env:DATABASE_URL}',
      scopes: ['schema:read', 'tables:read', 'query:raw'],
      perEntityTools: { enabled: false },
      limits: { rowCap: 200, timeoutMs: 10_000, maxBytes: 262144 },
      redact: {
        columns: ['app.users.password_hash', 'app.users.api_key'],
        patterns: [],
      },
    },
  ],
  audit: { path: '~/.mcpfy/audit.log' },
  rateLimit: { defaultPerMinute: 30, maxConcurrent: 5 },
  security: { wrapMode: 'strict' },
});
