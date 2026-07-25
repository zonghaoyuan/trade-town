import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

async function main() {
  const convexUrl = required('CONVEX_URL');
  const sharedSecret = required('TOWN_REPLAY_SHARED_SECRET');
  const sessionId = required('TOWN_REPLAY_SESSION_ID');
  const runId = required('TOWN_RUN_ID');
  const totalDays = Number(process.env.TOWN_REPLAY_TOTAL_DAYS ?? 30);
  if (!Number.isInteger(totalDays) || totalDays < 1) throw new Error('Invalid replay total days.');
  const client = new ConvexHttpClient(convexUrl);
  await client.mutation((api as any).townReplay.markWaiting, {
    sharedSecret,
    sessionId,
    runId,
    dayIndex: 0,
    totalDays,
    detail: 'Replay mode activated before world startup.',
  });
  console.log(JSON.stringify({ sessionId, status: 'waiting' }));
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
