import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

async function main() {
  const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error('CONVEX_URL or VITE_CONVEX_URL is required.');
  const client = new ConvexHttpClient(convexUrl);
  let status = await client.query((api as any).world.defaultWorldStatus, {});
  if (!status) {
    await client.mutation((api as any).init.default, {});
    status = await client.query((api as any).world.defaultWorldStatus, {});
  }
  if (!status) throw new Error('Convex world initialization did not create a default world.');
  if (status.status !== 'running') {
    await client.mutation((api as any).testing.resume, {});
    status = await client.query((api as any).world.defaultWorldStatus, {});
  }
  console.log(JSON.stringify({ worldId: status?.worldId, status: status?.status }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
