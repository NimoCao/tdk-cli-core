// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import type { BackendLanguageProvider } from "./types.js";

export function getBackendIndexTemplate(name: string) {
  return `import { Hono } from 'hono';

const app = new Hono();

// Health check endpoint (required by TILT_RESOURCE_DEFAULTS.star)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: '${name}' });
});

app.get('/health/live', (c) => {
  return c.json({ status: 'alive', timestamp: Date.now() });
});

app.get('/health/ready', async (c) => {
  const dependencies: Record<string, string> = {};
  let allReady = true;

  // Add dependency checks here (database, cache, etc.)
  // Mark allReady = false if any dependency is unhealthy

  const status = allReady ? 'ready' : 'not_ready';
  return c.json({ status, dependencies }, allReady ? 200 : 503);
});

app.get('/', (c) => {
  return c.json({
    service: '${name}',
    version: '1.0.0',
    endpoints: ['/health', '/health/live', '/health/ready']
  });
});

const port = process.env.PORT || 3000;
console.log('\\n🚀 ${name} running on http://localhost:' + port);
console.log('📊 Health check: http://localhost:' + port + '/health\\n');

export default {
  port,
  fetch: app.fetch,
};
`;
}

/**
 * The historical default. Package scripts, tsconfig, Dockerfile, and the vitest smoke test stay in
 * the shared scaffold so omitted-language output is byte-identical to before providers existed.
 */
export const bunBackendProvider: BackendLanguageProvider = {
  id: "bun",
  label: "Bun + Hono",
  installHint: "bun install",
};
