import { defineConfig } from '@mcpfy/config';

export default defineConfig({
  server: { name: 'mcpfy', version: '0.0.1' },
  transport: {
    kind: 'http',
    host: '127.0.0.1', // bind to loopback by default; put behind a TLS proxy for non-local
    port: 7337,
    auth: {
      type: 'bearer',
      // Pin a long-lived token via env so clients have something stable to send.
      // Omit this whole `token` line and mcpfy will mint a fresh token on each
      // start and print it on stderr (great for ad-hoc, useless for clients).
      token: '${env:MCPFY_BEARER_TOKEN}',
    },
  },
  sources: [
    {
      id: 'pg.main',
      kind: 'postgres',
      url: '${env:DATABASE_URL}',
      scopes: ['schema:read', 'tables:read', 'query:raw'],
      perEntityTools: { enabled: false },
      limits: { rowCap: 200, timeoutMs: 10_000, maxBytes: 262144 },
      redact: { columns: ['public.users.password_hash'], patterns: [] },
    },
  ],
  audit: { path: '~/.mcpfy/audit.log' },
  rateLimit: { defaultPerMinute: 60, maxConcurrent: 8 },
  security: { wrapMode: 'strict' },
});
