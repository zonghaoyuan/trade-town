import { TOWN_TRADERS, deriveSubaccountId } from '../../../shared/finance';
import { loadGatewayConfig } from './config';
import { FinanceCacheClient } from './convex';
import { InjectiveClient } from './injective';
import { InjectiveStreams } from './streams';
import { getEthereumAddress } from '@injectivelabs/sdk-ts';
import { normalizeSpotFills } from './reconcile';

let config: ReturnType<typeof loadGatewayConfig>;
let chain: InjectiveClient;
let cache: FinanceCacheClient;
let streams: InjectiveStreams;
let stopping = false;
let latestBlockHeight = 0;

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
    await wait(config.pollIntervalMs);
    if (!stopping && Date.now() % 60_000 < config.pollIntervalMs) {
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
      const txHash = await chain.submitLimitOrder({
        ...intent,
        limitPrice: intent.limitPrice,
      });
      await cache.recordSubmission(intent.intentId, txHash);
      console.log(`[submitted] ${intent.intentId} ${txHash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await cache.recordFailure(intent.intentId, message);
      console.error(`[failed] ${intent.intentId}: ${message}`);
    }
  }
}

function startStreams() {
  const marketIds = Object.values(config.marketIds);
  const ethereumAddress = chain.operatorAddress
    ? getEthereumAddress(chain.operatorAddress)
    : undefined;
  const subaccountIds = ethereumAddress
    ? TOWN_TRADERS.map((trader) => deriveSubaccountId(ethereumAddress, trader.subaccountNonce))
    : [];
  streams.start({
    marketIds,
    subaccountIds,
    onEvent: ({ stream, receivedAt, payload }) => {
      console.log(`[stream:${stream}] ${new Date(receivedAt).toISOString()}`);
      if (stream === 'trades') {
        void reconcileTrades(payload);
      }
    },
  });
}

async function reconcileTrades(payload: unknown) {
  const symbolByMarketId = new Map(
    Object.entries(config.marketIds).map(([symbol, marketId]) => [marketId.toLowerCase(), symbol]),
  );
  const ethereumAddress = chain.operatorAddress
    ? getEthereumAddress(chain.operatorAddress)
    : undefined;
  const agentBySubaccount = new Map(
    ethereumAddress
      ? TOWN_TRADERS.map((trader) => [
          deriveSubaccountId(ethereumAddress, trader.subaccountNonce).toLowerCase(),
          trader.name,
        ])
      : [],
  );
  const fills = normalizeSpotFills(payload, latestBlockHeight);
  for (const fill of fills) {
    const marketSymbol = symbolByMarketId.get(fill.marketId.toLowerCase());
    const agentName = agentBySubaccount.get(fill.subaccountId.toLowerCase());
    if (!marketSymbol || !agentName) {
      continue;
    }
    await cache.recordFill({ ...fill, marketSymbol, agentName });
  }
  if (fills.length > 0 && latestBlockHeight > 0) {
    await cache.recordCursor(
      'spot-trades',
      `${fills[fills.length - 1].tradeId}:${Date.now()}`,
      latestBlockHeight,
    );
  }
}

async function reportHealth() {
  const health = await chain.health();
  await cache.updateStatus({
    status: health.ok ? (config.mode.replace('-', '_') as 'read_only' | 'signing') : 'degraded',
    operatorAddress: chain.operatorAddress,
    blockHeight: health.blockHeight,
  });
  if (health.ok) {
    latestBlockHeight = health.blockHeight ?? latestBlockHeight;
    console.log(
      `[gateway] ${config.mode} · injective-888 · height ${health.blockHeight ?? 'unknown'} · ${
        Object.keys(config.marketIds).length
      } configured markets`,
    );
  } else {
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
