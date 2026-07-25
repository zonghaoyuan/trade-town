import dotenv from 'dotenv';
import { TOWN_TRADERS } from '../../../shared/finance';
import { loadGatewayConfig } from './config';
import { FinanceCacheClient } from './convex';
import { InjectiveClient } from './injective';
import { InjectiveStreams } from './streams';

dotenv.config({ path: process.env.GATEWAY_ENV_FILE ?? '.env.local' });

let config: ReturnType<typeof loadGatewayConfig>;
let chain: InjectiveClient;
let cache: FinanceCacheClient;
let streams: InjectiveStreams;
let stopping = false;
let latestBlockHeight = 0;
let nextProjectionSyncAt = 0;
let nextHealthCheckAt = 0;
let projectionSync: Promise<void> | undefined;

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  config = loadGatewayConfig();
  chain = new InjectiveClient(config);
  cache = new FinanceCacheClient(config);
  streams = new InjectiveStreams();
  await reportHealth();
  await syncProjection();
  if (config.once) {
    return;
  }
  startStreams();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await runLoop();
}

async function runLoop() {
  while (!stopping) {
    if (config.mode === 'signing') {
      await drainSigningQueue();
    }
    if (Date.now() >= nextProjectionSyncAt) {
      await syncProjection();
    }
    await wait(config.pollIntervalMs);
    if (!stopping && Date.now() >= nextHealthCheckAt) {
      await reportHealth();
    }
  }
}

async function drainSigningQueue() {
  const intents = await cache.pendingIntents();
  for (const intent of intents) {
    if (stopping) {
      return;
    }
    if (intent.limitPrice === undefined) {
      await cache.recordFailure(intent.intentId, 'Only limit orders are supported in the MVP.');
      continue;
    }
    try {
      // This sequential loop is the signer queue. It prevents account sequence races.
      const submission = await chain.submitLimitOrder({
        ...intent,
        limitPrice: intent.limitPrice,
      });
      await cache.recordSubmission(intent.intentId, submission);
      console.log(`[submitted] ${intent.intentId} ${submission.txHash}`);
      await syncProjection();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await cache.recordFailure(intent.intentId, message);
      console.error(`[failed] ${intent.intentId}: ${message}`);
    }
  }
}

function startStreams() {
  const marketIds = Object.values(config.marketIds);
  streams.start({
    marketIds,
    onEvent: ({ stream, receivedAt, payload }) => {
      if (stream !== 'trades' || !containsTrade(payload)) {
        return;
      }
      console.log(`[stream:${stream}] ${new Date(receivedAt).toISOString()}`);
      // Streams are invalidation hints. Coalesce bursts and let the single polling
      // loop perform the authoritative backfill instead of multiplying indexer calls.
      nextProjectionSyncAt = Math.min(nextProjectionSyncAt, Date.now() + 1_000);
    },
  });
}

async function syncProjection() {
  if (projectionSync) {
    return projectionSync;
  }
  projectionSync = (async () => {
    nextProjectionSyncAt = Date.now() + config.syncIntervalMs;
    if (Object.keys(config.marketIds).length === 0) {
      return;
    }
    try {
      const projection = await fetchProjectionWithRetry();
      await Promise.all([
        ...projection.markets.map((snapshot) => cache.recordMarketSnapshot(snapshot)),
        ...projection.accounts.map((snapshot) => cache.recordAccountSnapshot(snapshot)),
      ]);
      for (const order of projection.orders) {
        await cache.recordOrder(order);
      }
      for (const fill of projection.fills) {
        await cache.recordFill(fill);
      }
      if (projection.fills.length > 0 && latestBlockHeight > 0) {
        const latestFill = [...projection.fills].sort(
          (left, right) => right.executedAt - left.executedAt,
        )[0];
        await cache.recordCursor(
          'spot-trades',
          `${latestFill.fillKey}:${latestFill.executedAt}`,
          latestBlockHeight,
        );
      }
      console.log(
        `[sync] ${projection.markets.length} market · ${projection.accounts.length} accounts · ${projection.orders.length} orders · ${projection.fills.length} fills`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[sync] ${message}`);
      await cache.updateStatus({
        status: 'degraded',
        operatorAddress: chain.operatorAddress,
        blockHeight: latestBlockHeight || undefined,
        error: message,
      });
    }
  })().finally(() => {
    projectionSync = undefined;
  });
  return projectionSync;
}

async function fetchProjectionWithRetry() {
  try {
    return await chain.fetchProjection(
      config.marketIds,
      TOWN_TRADERS,
      latestBlockHeight || undefined,
    );
  } catch (error) {
    await wait(750);
    return await chain.fetchProjection(
      config.marketIds,
      TOWN_TRADERS,
      latestBlockHeight || undefined,
    );
  }
}

async function reportHealth() {
  const health = await chain.health();
  await cache.updateStatus({
    status: health.ok ? (config.mode.replace('-', '_') as 'read_only' | 'signing') : 'degraded',
    operatorAddress: chain.operatorAddress,
    blockHeight: health.blockHeight,
    error: health.error,
  });
  if (health.ok) {
    latestBlockHeight = health.blockHeight ?? latestBlockHeight;
    nextHealthCheckAt = Date.now() + 60_000;
    console.log(
      `[gateway] ${config.mode} · injective-888 · height ${health.blockHeight ?? 'unknown'} · ${
        Object.keys(config.marketIds).length
      } configured markets`,
    );
  } else {
    nextHealthCheckAt = Date.now() + 15_000;
    console.error(`[gateway] health check failed: ${health.error}`);
  }
}

function stop() {
  stopping = true;
  streams.stop();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function containsTrade(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const envelope = payload as {
    trade?: { tradeId?: unknown };
    trades?: Array<{ tradeId?: unknown }>;
  };
  return (
    typeof envelope.trade?.tradeId === 'string' ||
    envelope.trades?.some((trade) => typeof trade.tradeId === 'string') === true
  );
}
