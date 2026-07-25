'use node';

import { randomUUID } from 'node:crypto';
import { api, internal } from './_generated/api';
import { ActionCtx, internalAction } from './_generated/server';
import { TOWN_TRADERS } from '../shared/finance';
import {
  InjectiveClient,
  type ChainProjection,
  type InjectiveClientConfig,
} from '../services/injective-gateway/src/injective';
import { PROVISION_MARKETS } from '../services/injective-gateway/src/provisionConfig';

const WORKER_LEASE_MS = 5 * 60_000;
const STALE_CLAIM_MS = 2 * 60_000;
const MAX_ORDERS_PER_RUN = 10;

export const runWorker = internalAction({
  args: {},
  handler: async (ctx) => {
    const leaseId = randomUUID();
    const acquired = await ctx.runMutation(internal.finance.acquireInjectiveWorkerLease, {
      leaseId,
      ttlMs: WORKER_LEASE_MS,
    });
    if (!acquired) {
      return { ok: true, skipped: 'worker-lease-held' };
    }

    let runtime: ReturnType<typeof loadRuntimeConfig> | undefined;
    try {
      runtime = loadRuntimeConfig();
      const chain = new InjectiveClient(runtime.chain);
      const health = await chain.health();
      await updateStatus(ctx, runtime, {
        status: health.ok ? runtime.status : 'degraded',
        operatorAddress: chain.operatorAddress,
        blockHeight: health.blockHeight,
        error: health.error,
      });
      if (!health.ok) {
        return { ok: false, error: health.error ?? 'Injective health check failed.' };
      }

      let projection = await fetchProjectionWithRetry(chain, runtime.chain, health.blockHeight);
      await recordProjection(ctx, runtime.controlSecret, projection, health.blockHeight);

      await ctx.runMutation(internal.finance.recoverStaleInjectiveClaims, {
        staleBefore: Date.now() - STALE_CLAIM_MS,
      });

      let submitted = 0;
      if (runtime.chain.mode === 'signing') {
        for (let index = 0; index < MAX_ORDERS_PER_RUN; index += 1) {
          const intent = await ctx.runMutation(internal.finance.claimNextInjectiveIntent, {
            leaseId,
          });
          if (!intent) {
            break;
          }
          if (intent.limitPrice === undefined) {
            await recordFailure(
              ctx,
              runtime.controlSecret,
              intent.intentId,
              'Only limit orders are supported.',
            );
            continue;
          }
          try {
            const submission = await chain.submitLimitOrder({
              ...intent,
              limitPrice: intent.limitPrice,
            });
            await ctx.runMutation(api.finance.recordSubmission, {
              gatewaySecret: runtime.controlSecret,
              intentId: intent.intentId,
              ...submission,
            });
            submitted += 1;
          } catch (error) {
            await recordFailure(
              ctx,
              runtime.controlSecret,
              intent.intentId,
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      }

      if (submitted > 0) {
        projection = await fetchProjectionWithRetry(chain, runtime.chain, health.blockHeight);
        await recordProjection(ctx, runtime.controlSecret, projection, health.blockHeight);
      }

      return {
        ok: true,
        mode: runtime.chain.mode,
        blockHeight: health.blockHeight,
        markets: projection.markets.length,
        accounts: projection.accounts.length,
        orders: projection.orders.length,
        fills: projection.fills.length,
        submitted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (runtime) {
        await updateStatus(ctx, runtime, {
          status: 'degraded',
          error: message,
        }).catch(() => undefined);
      }
      console.error(`[injective-worker] ${message}`);
      return { ok: false, error: message };
    } finally {
      await ctx.runMutation(internal.finance.releaseInjectiveWorkerLease, {
        leaseId,
      });
    }
  },
});

async function fetchProjectionWithRetry(
  chain: InjectiveClient,
  config: InjectiveClientConfig,
  blockHeight?: number,
) {
  try {
    return await chain.fetchProjection(config.marketIds, TOWN_TRADERS, blockHeight);
  } catch {
    await wait(750);
    return await chain.fetchProjection(config.marketIds, TOWN_TRADERS, blockHeight);
  }
}

async function recordProjection(
  ctx: ActionCtx,
  controlSecret: string,
  projection: ChainProjection,
  blockHeight?: number,
) {
  for (const snapshot of projection.markets) {
    await ctx.runMutation(api.finance.recordMarketSnapshot, {
      gatewaySecret: controlSecret,
      ...snapshot,
    });
  }
  for (const snapshot of projection.accounts) {
    await ctx.runMutation(api.finance.recordAccountSnapshot, {
      gatewaySecret: controlSecret,
      ...snapshot,
    });
  }
  for (const order of projection.orders) {
    await ctx.runMutation(api.finance.recordOrder, {
      gatewaySecret: controlSecret,
      ...order,
    });
  }
  for (const fill of projection.fills) {
    await ctx.runMutation(api.finance.recordFill, {
      gatewaySecret: controlSecret,
      ...fill,
    });
  }
  if (projection.fills.length > 0 && blockHeight !== undefined) {
    const latestFill = [...projection.fills].sort(
      (left, right) => right.executedAt - left.executedAt,
    )[0];
    await ctx.runMutation(api.finance.recordChainCursor, {
      gatewaySecret: controlSecret,
      stream: 'spot-trades',
      cursor: `${latestFill.fillKey}:${latestFill.executedAt}`,
      blockHeight,
    });
  }
}

async function updateStatus(
  ctx: ActionCtx,
  runtime: ReturnType<typeof loadRuntimeConfig>,
  status: {
    status: 'read_only' | 'signing' | 'degraded' | 'unconfigured';
    operatorAddress?: string;
    blockHeight?: number;
    error?: string;
  },
) {
  await ctx.runMutation(api.finance.updateGatewayStatus, {
    gatewaySecret: runtime.controlSecret,
    ...status,
  });
}

async function recordFailure(
  ctx: ActionCtx,
  controlSecret: string,
  intentId: string,
  error: string,
) {
  await ctx.runMutation(api.finance.recordFailure, {
    gatewaySecret: controlSecret,
    intentId,
    error,
  });
}

function loadRuntimeConfig() {
  const executionMode = readExecutionMode(optionalEnv('INJECTIVE_EXECUTION_MODE'));
  const operatorAddress = optionalEnv('INJECTIVE_OPERATOR_ADDRESS');
  const configuredPrivateKey = optionalEnv('INJECTIVE_PRIVATE_KEY');
  const controlSecret =
    optionalEnv('INJECTIVE_CONTROL_SECRET') ?? requiredEnv('GATEWAY_SHARED_SECRET');
  const marketIds = Object.fromEntries(
    PROVISION_MARKETS.flatMap((market) => {
      const marketId = optionalEnv(`INJECTIVE_MARKET_${market.symbol}`);
      return marketId ? [[market.symbol, marketId]] : [];
    }),
  );

  if (!operatorAddress) {
    throw new Error('INJECTIVE_OPERATOR_ADDRESS is required for the Convex worker.');
  }
  if (!/^inj1[0-9a-z]{38}$/.test(operatorAddress)) {
    throw new Error('INJECTIVE_OPERATOR_ADDRESS must be a valid Injective bech32 address.');
  }
  if (Object.keys(marketIds).length === 0) {
    throw new Error('At least one INJECTIVE_MARKET_<SYMBOL> variable is required.');
  }
  if (executionMode === 'signing' && !configuredPrivateKey) {
    throw new Error('INJECTIVE_EXECUTION_MODE=signing requires INJECTIVE_PRIVATE_KEY.');
  }
  if (configuredPrivateKey && !/^0x[0-9a-fA-F]{64}$/.test(configuredPrivateKey)) {
    throw new Error('INJECTIVE_PRIVATE_KEY must be a 0x-prefixed 32-byte key.');
  }

  return {
    controlSecret,
    status: executionMode === 'signing' ? ('signing' as const) : ('read_only' as const),
    chain: {
      mode: executionMode,
      privateKey: executionMode === 'signing' ? configuredPrivateKey : undefined,
      operatorAddress,
      marketIds,
    } satisfies InjectiveClientConfig,
  };
}

function readExecutionMode(value: string | undefined): InjectiveClientConfig['mode'] {
  if (!value || value === 'read-only') {
    return 'read-only';
  }
  if (value === 'signing') {
    return 'signing';
  }
  throw new Error('INJECTIVE_EXECUTION_MODE must be read-only or signing.');
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`${name} is required for the Convex Injective worker.`);
  }
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
