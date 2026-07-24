import { ConvexError, v } from 'convex/values';
import { MutationCtx, mutation, query } from './_generated/server';
import {
  assessTradeRisk,
  DEFAULT_VISIBLE_AI_AGENTS,
  makeOrderCid,
  TOWN_MARKETS,
  TOWN_TRADERS,
} from '../shared/finance';
import type { TownFinanceActivityFeed } from '../shared/activity';
import { buildEventFeed, buildTransactionFeed } from './finance/activity';

const DEFAULT_CONFIG_KEY = 'default';
const RETIRED_TRADER_NAMES = new Set(['Delta-7', 'Sigma-2']);

export const dashboard = query({
  handler: async (ctx) => {
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    const [markets, traders, events, intents] = await Promise.all([
      ctx.db.query('marketCatalog').collect(),
      ctx.db.query('traderProfiles').collect(),
      ctx.db.query('marketEvents').withIndex('by_time').order('desc').take(24),
      ctx.db.query('tradeIntents').withIndex('by_state').take(24),
    ]);
    return {
      source:
        config?.gatewayStatus === 'signing' || config?.gatewayStatus === 'read_only'
          ? ('injective' as const)
          : ('preview' as const),
      config,
      markets,
      traders: traders.filter(
        (trader) => trader.enabled && !RETIRED_TRADER_NAMES.has(trader.agentName),
      ),
      events,
      intents: intents.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const activityFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<TownFinanceActivityFeed> => {
    const limit = Math.max(1, Math.min(args.limit ?? 30, 80));
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    const [intents, fills, events] = await Promise.all([
      ctx.db.query('tradeIntents').withIndex('by_updated_at').order('desc').take(limit),
      ctx.db.query('fills').withIndex('by_executed_at').order('desc').take(limit),
      ctx.db.query('marketEvents').withIndex('by_time').order('desc').take(limit),
    ]);

    return {
      gatewayStatus: config?.gatewayStatus ?? 'unconfigured',
      blockHeight: config?.lastChainHeight,
      transactions: buildTransactionFeed(intents, fills, limit),
      events: buildEventFeed(events),
    };
  },
});

export const bootstrapTown = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (existing) {
      await retireLegacyFinancialFixtures(ctx);
      await ctx.db.patch(existing._id, {
        visibleAgentCount: DEFAULT_VISIBLE_AI_AGENTS,
        marketMakerCount: undefined,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    const now = Date.now();
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    const configId = await ctx.db.insert('financeConfig', {
      key: DEFAULT_CONFIG_KEY,
      worldId: worldStatus?.worldId,
      network: 'injective-888',
      gatewayStatus: 'unconfigured',
      visibleAgentCount: DEFAULT_VISIBLE_AI_AGENTS,
      updatedAt: now,
    });

    for (const market of TOWN_MARKETS) {
      await ctx.db.insert('marketCatalog', {
        symbol: market.symbol,
        displayName: market.displayName,
        assetClass: market.assetClass,
        description: market.description,
        baseToken: market.baseToken,
        quoteToken: market.quoteToken,
        baseDenom: `factory/<operator-address>/${market.baseToken.toLowerCase()}`,
        quoteDenom: 'factory/<operator-address>/townusd',
        minPriceTick: market.minPriceTick,
        minQuantityTick: market.minQuantityTick,
        status: 'planned',
        referencePrice: market.referencePrice,
        updatedAt: now,
      });
    }

    for (const trader of TOWN_TRADERS) {
      await ctx.db.insert('traderProfiles', {
        worldId: worldStatus?.worldId,
        agentName: trader.name,
        kind: trader.kind,
        role: trader.role,
        style: trader.style,
        riskTolerance: trader.riskTolerance,
        subaccountNonce: trader.subaccountNonce,
        focusSymbols: [...trader.focusSymbols],
        enabled: true,
        updatedAt: now,
      });
    }
    return configId;
  },
});

export const retireLegacyFixtures = mutation({
  handler: async (ctx) => {
    const result = await retireLegacyFinancialFixtures(ctx);
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (config) {
      await ctx.db.patch(config._id, {
        visibleAgentCount: DEFAULT_VISIBLE_AI_AGENTS,
        marketMakerCount: undefined,
        updatedAt: Date.now(),
      });
    }
    return result;
  },
});

export const proposeTrade = mutation({
  args: {
    intentId: v.string(),
    agentName: v.string(),
    symbol: v.string(),
    side: v.union(v.literal('buy'), v.literal('sell')),
    quantity: v.number(),
    limitPrice: v.number(),
    rationale: v.string(),
    beliefEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query('tradeIntents')
      .withIndex('by_intent_id', (q) => q.eq('intentId', args.intentId))
      .unique();
    if (previous) {
      return { id: previous._id, state: previous.state, riskCode: previous.riskCode };
    }
    const trader = await ctx.db
      .query('traderProfiles')
      .withIndex('by_name', (q) => q.eq('agentName', args.agentName))
      .unique();
    if (!trader || !trader.enabled) {
      throw new ConvexError('Unknown or disabled trader.');
    }
    const market = await ctx.db
      .query('marketCatalog')
      .withIndex('by_symbol', (q) => q.eq('symbol', args.symbol))
      .unique();
    if (!market) {
      throw new ConvexError('Unknown market.');
    }
    const portfolio = await ctx.db
      .query('portfolioSnapshots')
      .withIndex('by_agent', (q) => q.eq('agentName', args.agentName))
      .order('desc')
      .first();
    if (!portfolio) {
      throw new ConvexError('No confirmed portfolio snapshot is available.');
    }
    const currentPosition =
      portfolio.positions.find((position) => position.symbol === args.symbol)?.quantity ?? 0;
    const risk = assessTradeRisk({
      side: args.side,
      quantity: args.quantity,
      limitPrice: args.limitPrice,
      cash: portfolio.townUsdAvailable,
      currentPosition,
      netAssetValue: portfolio.netAssetValue,
      maxOrderNavRatio: 0.04 + trader.riskTolerance * 0.12,
      maxPositionNavRatio: 0.16 + trader.riskTolerance * 0.22,
    });
    const now = Date.now();
    const cid = makeOrderCid(trader.subaccountNonce, args.intentId);
    const state = risk.accepted ? ('queued' as const) : ('risk_rejected' as const);
    const id = await ctx.db.insert('tradeIntents', {
      ...args,
      subaccountNonce: trader.subaccountNonce,
      orderType: 'limit',
      state,
      riskCode: risk.code,
      cid,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('marketEvents', {
      eventId: `intent-${args.intentId}`,
      kind: risk.accepted ? 'intent' : 'risk',
      source: args.agentName,
      headline: risk.accepted
        ? `${args.agentName} queued a ${args.side} intent`
        : `${args.agentName}'s order was blocked`,
      summary: risk.accepted ? args.rationale : risk.reason,
      severity: Math.min(1, risk.notional / Math.max(1, portfolio.netAssetValue)),
      symbols: [args.symbol],
      parentEventId: args.beliefEventId,
      occurredAt: now,
    });
    return { id, state, riskCode: risk.code };
  },
});

export const pendingIntents = query({
  args: {
    gatewaySecret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
    return await ctx.db
      .query('tradeIntents')
      .withIndex('by_state', (q) => q.eq('state', 'queued'))
      .order('asc')
      .take(limit);
  },
});

export const recordSubmission = mutation({
  args: {
    gatewaySecret: v.string(),
    intentId: v.string(),
    txHash: v.string(),
    orderHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const intent = await ctx.db
      .query('tradeIntents')
      .withIndex('by_intent_id', (q) => q.eq('intentId', args.intentId))
      .unique();
    if (!intent) {
      throw new ConvexError('Unknown intent.');
    }
    const now = Date.now();
    await ctx.db.patch(intent._id, {
      state: 'submitted',
      txHash: args.txHash,
      orderHash: args.orderHash,
      updatedAt: now,
    });
    const existingTx = await ctx.db
      .query('chainTransactions')
      .withIndex('by_hash', (q) => q.eq('txHash', args.txHash))
      .unique();
    if (!existingTx) {
      await ctx.db.insert('chainTransactions', {
        txHash: args.txHash,
        intentId: args.intentId,
        purpose: `spot-order:${intent.symbol}`,
        state: 'broadcast',
        createdAt: now,
      });
    }
  },
});

export const recordFailure = mutation({
  args: {
    gatewaySecret: v.string(),
    intentId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const intent = await ctx.db
      .query('tradeIntents')
      .withIndex('by_intent_id', (q) => q.eq('intentId', args.intentId))
      .unique();
    if (!intent) {
      return;
    }
    await ctx.db.patch(intent._id, {
      state: 'failed',
      error: args.error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});

export const updateGatewayStatus = mutation({
  args: {
    gatewaySecret: v.string(),
    status: v.union(
      v.literal('read_only'),
      v.literal('signing'),
      v.literal('degraded'),
      v.literal('unconfigured'),
    ),
    operatorAddress: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (!config) {
      throw new ConvexError('Run finance.bootstrapTown before starting the Gateway.');
    }
    const now = Date.now();
    await ctx.db.patch(config._id, {
      gatewayStatus: args.status,
      operatorAddress: args.operatorAddress,
      lastChainHeight: args.blockHeight,
      lastChainSyncAt: args.blockHeight === undefined ? config.lastChainSyncAt : now,
      updatedAt: now,
    });
  },
});

export const recordFill = mutation({
  args: {
    gatewaySecret: v.string(),
    tradeId: v.string(),
    marketSymbol: v.string(),
    marketId: v.string(),
    agentName: v.string(),
    subaccountId: v.string(),
    side: v.union(v.literal('buy'), v.literal('sell')),
    price: v.number(),
    quantity: v.number(),
    fee: v.number(),
    txHash: v.string(),
    blockHeight: v.number(),
    executedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const existing = await ctx.db
      .query('fills')
      .withIndex('by_trade_id', (q) => q.eq('tradeId', args.tradeId))
      .unique();
    if (existing) {
      return existing._id;
    }
    const { gatewaySecret: _gatewaySecret, ...fill } = args;
    const fillId = await ctx.db.insert('fills', fill);
    const market = await ctx.db
      .query('marketCatalog')
      .withIndex('by_symbol', (q) => q.eq('symbol', args.marketSymbol))
      .unique();
    if (market) {
      const volume = args.price * args.quantity;
      await ctx.db.patch(market._id, {
        marketId: args.marketId,
        status: 'active',
        lastPrice: args.price,
        volume24h: (market.volume24h ?? 0) + volume,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.insert('marketEvents', {
      eventId: `fill-${args.tradeId}`,
      kind: 'fill',
      source: args.agentName,
      headline: `${args.agentName} filled ${args.side.toUpperCase()} ${args.quantity} ${
        args.marketSymbol
      }`,
      summary: `Confirmed at ${args.price} INJ on Injective Testnet.`,
      severity: 0.5,
      symbols: [args.marketSymbol],
      txHash: args.txHash,
      blockHeight: args.blockHeight,
      occurredAt: args.executedAt,
    });
    return fillId;
  },
});

export const recordChainCursor = mutation({
  args: {
    gatewaySecret: v.string(),
    stream: v.string(),
    cursor: v.string(),
    blockHeight: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const existing = await ctx.db
      .query('chainCursors')
      .withIndex('by_stream', (q) => q.eq('stream', args.stream))
      .unique();
    const value = {
      cursor: args.cursor,
      blockHeight: args.blockHeight,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
      return existing._id;
    }
    return await ctx.db.insert('chainCursors', {
      stream: args.stream,
      ...value,
    });
  },
});

function assertGatewaySecret(provided: string) {
  const expected = process.env.GATEWAY_SHARED_SECRET;
  if (!expected || provided !== expected) {
    throw new ConvexError('Gateway authentication failed.');
  }
}

async function retireLegacyFinancialFixtures(ctx: MutationCtx) {
  let deletedProfiles = 0;
  let deletedPortfolios = 0;
  let deletedBeliefs = 0;
  let deletedPreviewEvents = 0;

  for (const agentName of RETIRED_TRADER_NAMES) {
    const profiles = await ctx.db
      .query('traderProfiles')
      .withIndex('by_name', (q) => q.eq('agentName', agentName))
      .collect();
    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
      deletedProfiles += 1;
    }

    const portfolios = await ctx.db
      .query('portfolioSnapshots')
      .withIndex('by_agent', (q) => q.eq('agentName', agentName))
      .collect();
    for (const portfolio of portfolios) {
      await ctx.db.delete(portfolio._id);
      deletedPortfolios += 1;
    }

    const beliefs = await ctx.db
      .query('agentBeliefs')
      .withIndex('by_agent', (q) => q.eq('agentName', agentName))
      .collect();
    for (const belief of beliefs) {
      await ctx.db.delete(belief._id);
      deletedBeliefs += 1;
    }
  }

  const allPortfolios = await ctx.db.query('portfolioSnapshots').collect();
  for (const portfolio of allPortfolios) {
    if (portfolio.blockHeight === undefined && portfolio.subaccountId === undefined) {
      await ctx.db.delete(portfolio._id);
      deletedPortfolios += 1;
    }
  }

  const previewEvents = await ctx.db
    .query('marketEvents')
    .filter((q) => q.eq(q.field('source'), 'Town Central Bank'))
    .collect();
  for (const event of previewEvents) {
    if (event.headline === 'Rate decision scenario is armed' && !event.txHash) {
      const seededBeliefs = await ctx.db
        .query('agentBeliefs')
        .withIndex('by_agent', (q) => q.eq('agentName', 'Mira Chen'))
        .collect();
      for (const belief of seededBeliefs) {
        if (belief.sourceEventIds.includes(event.eventId)) {
          await ctx.db.delete(belief._id);
          deletedBeliefs += 1;
        }
      }
      await ctx.db.delete(event._id);
      deletedPreviewEvents += 1;
    }
  }

  return {
    retiredNames: [...RETIRED_TRADER_NAMES],
    deletedProfiles,
    deletedPortfolios,
    deletedBeliefs,
    deletedPreviewEvents,
  };
}
