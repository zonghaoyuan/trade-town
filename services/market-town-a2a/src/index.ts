import 'dotenv/config';
import { createA2AApp } from './app';
import { loadA2AConfig } from './config';

const config = loadA2AConfig();
const app = createA2AApp(config);
const server = app.listen(config.port, () => {
  console.log(`[A2A] Service: ${config.publicBaseUrl}`);
  console.log(`[A2A] Agent Card: ${config.publicBaseUrl}/.well-known/agent-card.json`);
  console.log(`[A2A] JSON-RPC: ${config.publicBaseUrl}/a2a/v1`);
  console.log(
    `[A2A] Mode: ${config.executionMode}; persistence: ${config.convexUrl ? 'convex' : 'memory'}`,
  );
});

server.on('error', (error) => {
  console.error('[A2A] Failed to start:', error);
  process.exitCode = 1;
});
