declare module 'cloudflare:node' {
  type WorkerHandler = {
    fetch(request: Request): Response | Promise<Response>;
  };

  export function httpServerHandler(options: { port: number }): WorkerHandler;
}

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
