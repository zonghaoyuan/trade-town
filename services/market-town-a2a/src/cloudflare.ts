import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { createA2AApp } from './app';
import { loadA2AConfig } from './config';

const WORKER_HTTP_PORT = 3000;
const config = loadA2AConfig({
  ...(env as unknown as NodeJS.ProcessEnv),
  A2A_PORT: String(WORKER_HTTP_PORT),
});
const app = createA2AApp(config);

app.listen(WORKER_HTTP_PORT);

export default httpServerHandler({ port: WORKER_HTTP_PORT });
