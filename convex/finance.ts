import { ConvexError, v } from 'convex/values';
import { MutationCtx, internalMutation, mutation, query } from './_generated/server';
import {
  assessTradeRisk,
  DEFAULT_INITIAL_AGENT_NAV,
  DEFAULT_MARKET_MAKERS,
  DEFAULT_VISIBLE_AI_AGENTS,
  makeOrderCid,
  TOWN_MARKETS,
  TOWN_TRADERS,
} from '../shared/finance';
import type { TownFinanceActivityFeed } from '../shared/activity';
import { buildEventFeed, buildTransactionFeed } from './finance/activity';

const DEFAULT_CONFIG_KEY = 'default';

export const dashboard = query({
  handler: async (ctx) => {
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    const [markets, traders, events, intents, chainMarkets, chainAccounts, chainOrders, fills] =
      await Promise.all([
        ctx.db.query('marketCatalog').collect(),
        ctx.db.query('traderProfiles').collect(),
        ctx.db.query('marketEvents').withIndex('by_time').order('desc').take(24),
        ctx.db.query('tradeIntents').withIndex('by_state').take(24),
        ctx.db.query('chainMarketSnapshots').collect(),
        ctx.db.query('chainAccountSnapshots').collect(),
        ctx.db.query('chainOrders').order('desc').take(40),
        ctx.db.query('fills').withIndex('by_executed_at').order('desc').take(40),
      ]);
    const chainFresh =
      config?.lastIndexerSyncAt !== undefined && Date.now() - config.lastIndexerSyncAt < 2 * 60_000;
    const freshChainMarkets = chainMarkets.filter(
      (market) => Date.now() - market.observedAt < 2 * 60_000,
    );
    const freshChainAccounts = chainAccounts.filter(
      (account) => Date.now() - account.observedAt < 2 * 60_000,
    );
    return {
      source:
        chainFresh &&
        freshChainMarkets.length > 0 &&
        (config?.gatewayStatus === 'signing' || config?.gatewayStatus === 'read_only')
          ? ('injective' as const)
          : ('preview' as const),
      config,
      markets,
      traders,
      chainMarkets: freshChainMarkets,
      chainAccounts: freshChainAccounts,
      chainOrders,
      fills,
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
      await migrateLegacySeedCapital(ctx);
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
      marketMakerCount: DEFAULT_MARKET_MAKERS,
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
      await ctx.db.insert('portfolioSnapshots', {
        agentName: trader.name,
        subaccountNonce: trader.subaccountNonce,
        townUsdAvailable: DEFAULT_INITIAL_AGENT_NAV,
        townUsdTotal: DEFAULT_INITIAL_AGENT_NAV,
        netAssetValue: DEFAULT_INITIAL_AGENT_NAV,
        pnl: 0,
        positions: [],
        observedAt: now,
      });
    }

    const policyEventId = `policy-${now}`;
    await ctx.db.insert('marketEvents', {
      eventId: policyEventId,
      kind: 'policy',
      source: 'Town Central Bank',
      headline: 'Rate decision scenario is armed',
      summary:
        'Preview event only. Enable the Convex Injective worker and publish a scenario before agents can produce chain-backed orders.',
      severity: 0.72,
      symbols: ['ACME', 'NOVA', 'AURUM'],
      occurredAt: now,
    });
    await ctx.db.insert('agentBeliefs', {
      agentName: 'Mira Chen',
      symbol: 'ACME',
      thesis: 'Higher discount rates pressure leveraged industrial expansion plans.',
      sentiment: -0.58,
      confidence: 0.73,
      drivers: ['rate sensitivity', 'debt refinancing', 'infrastructure demand'],
      sourceEventIds: [policyEventId],
      updatedAt: now,
    });
    return configId;
  },
});

async function migrateLegacySeedCapital(ctx: MutationCtx) {
  const snapshots = await ctx.db.query('portfolioSnapshots').collect();
  for (const snapshot of snapshots) {
    const isLegacySeed =
      snapshot.subaccountId === undefined &&
      snapshot.blockHeight === undefined &&
      snapshot.positions.length === 0 &&
      snapshot.netAssetValue === 100_000 &&
      snapshot.townUsdTotal === 100_000 &&
      snapshot.pnl === 0;
    if (!isLegacySeed) continue;
    await ctx.db.patch(snapshot._id, {
      townUsdAvailable: DEFAULT_INITIAL_AGENT_NAV,
      townUsdTotal: DEFAULT_INITIAL_AGENT_NAV,
      netAssetValue: DEFAULT_INITIAL_AGENT_NAV,
    });
  }
}

export const proposeTrade = mutation({
  args: {
    gatewaySecret: v.string(),
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
    assertGatewaySecret(args.gatewaySecret);
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
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (config?.gatewayStatus !== 'signing') {
      throw new ConvexError('Injective signing is not enabled.');
    }
    const [account, chainMarket] = await Promise.all([
      ctx.db
        .query('chainAccountSnapshots')
        .withIndex('by_agent_market', (q) =>
          q.eq('agentName', args.agentName).eq('marketSymbol', args.symbol),
        )
        .unique(),
      ctx.db
        .query('chainMarketSnapshots')
        .withIndex('by_symbol', (q) => q.eq('marketSymbol', args.symbol))
        .unique(),
    ]);
    if (!account || !chainMarket) {
      throw new ConvexError('No fresh Injective account and market snapshot is available.');
    }
    if (!String(chainMarket.status).toLowerCase().includes('active')) {
      throw new ConvexError(`Injective market ${args.symbol} is not active.`);
    }
    if (
      Date.now() - account.observedAt > 2 * 60_000 ||
      Date.now() - chainMarket.observedAt > 2 * 60_000
    ) {
      throw new ConvexError('Injective account or market data is stale.');
    }
    const notional = args.quantity * args.limitPrice;
    if (
      !Number.isFinite(args.quantity) ||
      !Number.isFinite(args.limitPrice) ||
      args.quantity <= 0 ||
      args.limitPrice <= 0
    ) {
      throw new ConvexError('Quantity and price must be positive finite values.');
    }
    if (notional + Number.EPSILON < chainMarket.minNotional) {
      throw new ConvexError(
        `Order notional must be at least ${chainMarket.minNotional} ${chainMarket.quoteDenom}.`,
      );
    }
    if (!isTickAligned(args.quantity, chainMarket.minQuantityTick)) {
      throw new ConvexError(
        `Quantity must align to the ${chainMarket.minQuantityTick} minimum quantity tick.`,
      );
    }
    if (!isTickAligned(args.limitPrice, chainMarket.minPriceTick)) {
      throw new ConvexError(
        `Price must align to the ${chainMarket.minPriceTick} minimum price tick.`,
      );
    }
    const markPrice =
      chainMarket.lastPrice ??
      (chainMarket.bestBid !== undefined && chainMarket.bestAsk !== undefined
        ? (chainMarket.bestBid + chainMarket.bestAsk) / 2
        : args.limitPrice);
    const netAssetValue = account.quoteTotal + account.baseTotal * markPrice;
    let risk = assessTradeRisk({
      side: args.side,
      quantity: args.quantity,
      limitPrice: args.limitPrice,
      cash: account.quoteAvailable,
      currentPosition: account.baseTotal,
      netAssetValue,
      maxOrderNavRatio: 0.04 + trader.riskTolerance * 0.12,
      maxPositionNavRatio: 0.16 + trader.riskTolerance * 0.22,
    });
    if (args.side === 'sell' && args.quantity > account.baseAvailable) {
      risk = {
        accepted: false,
        code: 'insufficient_cash',
        reason: `Available ${args.symbol} balance is insufficient.`,
        notional: args.quantity * args.limitPrice,
      };
    }
    const now = Date.now();
    const cid = makeOrderCid(trader.subaccountNonce, args.intentId);
    const state = risk.accepted ? ('queued' as const) : ('risk_rejected' as const);
    const { gatewaySecret: _gatewaySecret, ...intent } = args;
    const id = await ctx.db.insert('tradeIntents', {
      ...intent,
      subaccountNonce: trader.subaccountNonce,
      orderType: 'limit',
      executionMode: 'injective',
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
      severity: Math.min(1, risk.notional / Math.max(1, netAssetValue)),
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
      .withIndex('by_execution_state', (q) =>
        q.eq('executionMode', 'injective').eq('state', 'queued'),
      )
      .order('asc')
      .take(limit);
  },
});

export const acquireInjectiveWorkerLease = internalMutation({
  args: {
    leaseId: v.string(),
    ttlMs: v.number(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (!config) {
      return false;
    }
    const now = Date.now();
    if (
      config.workerLeaseId &&
      config.workerLeaseId !== args.leaseId &&
      (config.workerLeaseExpiresAt ?? 0) > now
    ) {
      return false;
    }
    await ctx.db.patch(config._id, {
      workerLeaseId: args.leaseId,
      workerLeaseExpiresAt: now + Math.max(30_000, Math.min(args.ttlMs, 10 * 60_000)),
      lastWorkerRunAt: now,
      updatedAt: now,
    });
    return true;
  },
});

export const releaseInjectiveWorkerLease = internalMutation({
  args: {
    leaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (!config || config.workerLeaseId !== args.leaseId) {
      return false;
    }
    await ctx.db.patch(config._id, {
      workerLeaseId: undefined,
      workerLeaseExpiresAt: undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const recoverStaleInjectiveClaims = internalMutation({
  args: {
    staleBefore: v.number(),
  },
  handler: async (ctx, args) => {
    const stale = await ctx.db
      .query('tradeIntents')
      .withIndex('by_execution_state', (q) =>
        q.eq('executionMode', 'injective').eq('state', 'submitting'),
      )
      .take(100);
    let recovered = 0;
    for (const intent of stale) {
      if ((intent.claimedAt ?? intent.updatedAt) > args.staleBefore) {
        continue;
      }
      await ctx.db.patch(intent._id, {
        state: 'queued',
        claimId: undefined,
        claimedAt: undefined,
        error: undefined,
        updatedAt: Date.now(),
      });
      recovered += 1;
    }
    return recovered;
  },
});

export const claimNextInjectiveIntent = internalMutation({
  args: {
    leaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (
      !config ||
      config.workerLeaseId !== args.leaseId ||
      (config.workerLeaseExpiresAt ?? 0) <= Date.now()
    ) {
      return null;
    }
    const intent = await ctx.db
      .query('tradeIntents')
      .withIndex('by_execution_state', (q) =>
        q.eq('executionMode', 'injective').eq('state', 'queued'),
      )
      .order('asc')
      .first();
    if (!intent) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(intent._id, {
      state: 'submitting',
      claimId: args.leaseId,
      claimedAt: now,
      attemptCount: (intent.attemptCount ?? 0) + 1,
      error: undefined,
      updatedAt: now,
    });
    return {
      intentId: intent.intentId,
      cid: intent.cid,
      symbol: intent.symbol,
      side: intent.side,
      quantity: intent.quantity,
      limitPrice: intent.limitPrice,
      subaccountNonce: intent.subaccountNonce,
    };
  },
});

export const recordSubmission = mutation({
  args: {
    gatewaySecret: v.string(),
    intentId: v.string(),
    txHash: v.string(),
    orderHash: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
    rawLog: v.optional(v.string()),
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
      claimId: undefined,
      claimedAt: undefined,
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
        state: args.blockHeight === undefined ? 'broadcast' : 'included',
        blockHeight: args.blockHeight,
        rawLog: args.rawLog?.slice(0, 2_000),
        createdAt: now,
        confirmedAt: args.blockHeight === undefined ? undefined : now,
      });
    } else if (args.blockHeight !== undefined) {
      await ctx.db.patch(existingTx._id, {
        state: 'included',
        blockHeight: args.blockHeight,
        rawLog: args.rawLog?.slice(0, 2_000),
        confirmedAt: now,
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
      claimId: undefined,
      claimedAt: undefined,
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
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (!config) {
      throw new ConvexError('Run finance.bootstrapTown before starting the Injective worker.');
    }
    const now = Date.now();
    await ctx.db.patch(config._id, {
      gatewayStatus: args.status,
      operatorAddress: args.operatorAddress,
      lastChainHeight: args.blockHeight,
      lastChainSyncAt: args.blockHeight === undefined ? config.lastChainSyncAt : now,
      lastGatewayError: args.error?.slice(0, 500),
      updatedAt: now,
    });
  },
});

export const recordMarketSnapshot = mutation({
  args: {
    gatewaySecret: v.string(),
    marketSymbol: v.string(),
    marketId: v.string(),
    ticker: v.string(),
    status: v.string(),
    baseDenom: v.string(),
    quoteDenom: v.string(),
    baseDecimals: v.number(),
    quoteDecimals: v.number(),
    minPriceTick: v.number(),
    minQuantityTick: v.number(),
    minNotional: v.number(),
    bestBid: v.optional(v.number()),
    bestAsk: v.optional(v.number()),
    lastPrice: v.optional(v.number()),
    recentVolume: v.number(),
    orderbookSequence: v.optional(v.number()),
    observedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const { gatewaySecret: _gatewaySecret, ...snapshot } = args;
    const previous = await ctx.db
      .query('chainMarketSnapshots')
      .withIndex('by_symbol', (q) => q.eq('marketSymbol', args.marketSymbol))
      .unique();
    if (previous) {
      await ctx.db.patch(previous._id, snapshot);
    } else {
      await ctx.db.insert('chainMarketSnapshots', snapshot);
    }
    const config = await ctx.db
      .query('financeConfig')
      .withIndex('by_key', (q) => q.eq('key', DEFAULT_CONFIG_KEY))
      .unique();
    if (config) {
      await ctx.db.patch(config._id, {
        lastIndexerSyncAt: args.observedAt,
        lastGatewayError: undefined,
        updatedAt: args.observedAt,
      });
    }
    return previous?._id;
  },
});

export const recordAccountSnapshot = mutation({
  args: {
    gatewaySecret: v.string(),
    agentName: v.string(),
    subaccountNonce: v.number(),
    subaccountId: v.string(),
    marketSymbol: v.string(),
    quoteDenom: v.string(),
    quoteAvailable: v.number(),
    quoteTotal: v.number(),
    baseDenom: v.string(),
    baseAvailable: v.number(),
    baseTotal: v.number(),
    blockHeight: v.optional(v.number()),
    observedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const { gatewaySecret: _gatewaySecret, ...snapshot } = args;
    const previous = await ctx.db
      .query('chainAccountSnapshots')
      .withIndex('by_agent_market', (q) =>
        q.eq('agentName', args.agentName).eq('marketSymbol', args.marketSymbol),
      )
      .unique();
    if (previous) {
      await ctx.db.patch(previous._id, snapshot);
    } else {
      await ctx.db.insert('chainAccountSnapshots', snapshot);
    }
    const trader = await ctx.db
      .query('traderProfiles')
      .withIndex('by_name', (q) => q.eq('agentName', args.agentName))
      .unique();
    if (trader && trader.subaccountId !== args.subaccountId) {
      await ctx.db.patch(trader._id, {
        subaccountId: args.subaccountId,
        updatedAt: args.observedAt,
      });
    }
    return previous?._id;
  },
});

export const recordOrder = mutation({
  args: {
    gatewaySecret: v.string(),
    cid: v.string(),
    orderHash: v.optional(v.string()),
    agentName: v.optional(v.string()),
    marketSymbol: v.string(),
    marketId: v.string(),
    subaccountId: v.string(),
    side: v.union(v.literal('buy'), v.literal('sell')),
    price: v.number(),
    quantity: v.number(),
    filledQuantity: v.optional(v.number()),
    state: v.union(
      v.literal('booked'),
      v.literal('partial'),
      v.literal('filled'),
      v.literal('cancelled'),
      v.literal('failed'),
    ),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const cid = args.cid;
    const orderHash = args.orderHash;
    const intent = cid
      ? await ctx.db
          .query('tradeIntents')
          .withIndex('by_cid', (q) => q.eq('cid', cid))
          .unique()
      : null;
    const byHash = orderHash
      ? await ctx.db
          .query('chainOrders')
          .withIndex('by_order_hash', (q) => q.eq('orderHash', orderHash))
          .unique()
      : null;
    const previous =
      byHash ??
      (await ctx.db
        .query('chainOrders')
        .withIndex('by_cid', (q) => q.eq('cid', cid))
        .unique());
    const { gatewaySecret: _gatewaySecret, ...order } = args;
    const value = {
      ...order,
      intentId: intent?.intentId,
      txHash: intent?.txHash,
    };
    if (previous) {
      await ctx.db.patch(previous._id, value);
    } else {
      await ctx.db.insert('chainOrders', value);
    }
    if (intent) {
      const intentState =
        args.state === 'cancelled'
          ? ('cancelled' as const)
          : args.state === 'failed'
            ? ('failed' as const)
            : ('confirmed' as const);
      await ctx.db.patch(intent._id, {
        state: intentState,
        orderHash: args.orderHash ?? intent.orderHash,
        claimId: undefined,
        claimedAt: undefined,
        updatedAt: args.updatedAt,
      });
    }
    return previous?._id;
  },
});

export const recordFill = mutation({
  args: {
    gatewaySecret: v.string(),
    fillKey: v.string(),
    tradeId: v.string(),
    orderHash: v.optional(v.string()),
    cid: v.optional(v.string()),
    executionSide: v.optional(v.string()),
    marketSymbol: v.string(),
    marketId: v.string(),
    agentName: v.string(),
    subaccountId: v.string(),
    side: v.union(v.literal('buy'), v.literal('sell')),
    price: v.number(),
    quantity: v.number(),
    fee: v.number(),
    txHash: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
    executedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const existing = await ctx.db
      .query('fills')
      .withIndex('by_fill_key', (q) => q.eq('fillKey', args.fillKey))
      .unique();
    if (existing) {
      return existing._id;
    }
    const cid = args.cid;
    const orderHash = args.orderHash;
    const intentByCid = cid
      ? await ctx.db
          .query('tradeIntents')
          .withIndex('by_cid', (q) => q.eq('cid', cid))
          .unique()
      : null;
    const intent =
      intentByCid ??
      (orderHash
        ? await ctx.db
            .query('tradeIntents')
            .withIndex('by_order_hash', (q) => q.eq('orderHash', orderHash))
            .unique()
        : null);
    const submission = intent?.txHash
      ? await ctx.db
          .query('chainTransactions')
          .withIndex('by_hash', (q) => q.eq('txHash', intent.txHash as string))
          .unique()
      : null;
    const { gatewaySecret: _gatewaySecret, ...rawFill } = args;
    const fill = {
      ...rawFill,
      intentId: intent?.intentId,
      txHash: args.txHash ?? intent?.txHash,
      blockHeight: args.blockHeight ?? submission?.blockHeight,
    };
    const fillId = await ctx.db.insert('fills', fill);
    if (intent) {
      await ctx.db.patch(intent._id, {
        state: 'confirmed',
        orderHash: args.orderHash ?? intent.orderHash,
        claimId: undefined,
        claimedAt: undefined,
        updatedAt: args.executedAt,
      });
    }
    await ctx.db.insert('marketEvents', {
      eventId: `fill-${args.fillKey}`,
      kind: 'fill',
      source: args.agentName,
      headline: `${args.agentName} filled ${args.side.toUpperCase()} ${args.quantity} ${
        args.marketSymbol
      }`,
      summary: `Confirmed at ${args.price} INJ on Injective Testnet · trade ${args.tradeId}.`,
      severity: 0.5,
      symbols: [args.marketSymbol],
      txHash: fill.txHash,
      blockHeight: fill.blockHeight,
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
  const expected =
    process.env.INJECTIVE_CONTROL_SECRET?.trim() ?? process.env.GATEWAY_SHARED_SECRET?.trim();
  if (!expected || provided !== expected) {
    throw new ConvexError('Injective control authentication failed.');
  }
}

function isTickAligned(value: number, tick: number) {
  if (!Number.isFinite(tick) || tick <= 0) {
    return false;
  }
  const tickCount = value / tick;
  return Math.abs(tickCount - Math.round(tickCount)) <= 1e-8;
}
