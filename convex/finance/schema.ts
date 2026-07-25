import { defineTable } from 'convex/server';
import { v } from 'convex/values';

const tradeSide = v.union(v.literal('buy'), v.literal('sell'));
const orderState = v.union(
  v.literal('proposed'),
  v.literal('risk_rejected'),
  v.literal('queued'),
  v.literal('submitting'),
  v.literal('submitted'),
  v.literal('confirmed'),
  v.literal('cancelled'),
  v.literal('failed'),
);

export const financeTables = {
  townReplaySessions: defineTable({
    sessionId: v.string(),
    runId: v.string(),
    status: v.union(
      v.literal('replaying'),
      v.literal('waiting'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    active: v.boolean(),
    currentTradeDate: v.optional(v.string()),
    dayIndex: v.number(),
    totalDays: v.number(),
    publishedAt: v.optional(v.number()),
    detail: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_active', ['active', 'updatedAt'])
    .index('by_run', ['runId', 'updatedAt']),

  townReplayDays: defineTable({
    sessionId: v.string(),
    runId: v.string(),
    tradeDate: v.string(),
    dayIndex: v.number(),
    totalDays: v.number(),
    sourceHash: v.string(),
    // Optional only for schema migration of pre-v2 rows; publishDay requires every field.
    translationMode: v.optional(v.union(v.literal('llm'), v.literal('already_english'))),
    translationSourceHash: v.optional(v.string()),
    translationContentHash: v.optional(v.string()),
    translationCacheVersion: v.optional(v.number()),
    translationBatchCount: v.optional(v.number()),
    translationItemCount: v.optional(v.number()),
    snapshotJson: v.string(),
    publishedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session_day', ['sessionId', 'dayIndex'])
    .index('by_session_date', ['sessionId', 'tradeDate']),

  financeConfig: defineTable({
    key: v.string(),
    worldId: v.optional(v.id('worlds')),
    network: v.literal('injective-888'),
    gatewayStatus: v.union(
      v.literal('unconfigured'),
      v.literal('read_only'),
      v.literal('signing'),
      v.literal('degraded'),
    ),
    operatorAddress: v.optional(v.string()),
    visibleAgentCount: v.number(),
    marketMakerCount: v.number(),
    lastChainHeight: v.optional(v.number()),
    lastChainSyncAt: v.optional(v.number()),
    lastIndexerSyncAt: v.optional(v.number()),
    lastGatewayError: v.optional(v.string()),
    workerLeaseId: v.optional(v.string()),
    workerLeaseExpiresAt: v.optional(v.number()),
    lastWorkerRunAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_key', ['key']),

  marketCatalog: defineTable({
    symbol: v.string(),
    displayName: v.string(),
    assetClass: v.union(v.literal('company'), v.literal('commodity')),
    description: v.string(),
    baseToken: v.string(),
    quoteToken: v.literal('TOWNUSD'),
    baseDenom: v.string(),
    quoteDenom: v.string(),
    marketId: v.optional(v.string()),
    minPriceTick: v.string(),
    minQuantityTick: v.string(),
    status: v.union(
      v.literal('planned'),
      v.literal('launching'),
      v.literal('active'),
      v.literal('paused'),
    ),
    referencePrice: v.number(),
    lastPrice: v.optional(v.number()),
    change24h: v.optional(v.number()),
    volume24h: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_symbol', ['symbol'])
    .index('by_status', ['status']),

  traderProfiles: defineTable({
    worldId: v.optional(v.id('worlds')),
    agentName: v.string(),
    playerId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    kind: v.union(v.literal('ai'), v.literal('market_maker')),
    role: v.string(),
    style: v.string(),
    riskTolerance: v.number(),
    subaccountNonce: v.number(),
    subaccountId: v.optional(v.string()),
    focusSymbols: v.array(v.string()),
    enabled: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_name', ['agentName'])
    .index('by_world', ['worldId'])
    .index('by_subaccount', ['subaccountId']),

  agentBeliefs: defineTable({
    agentName: v.string(),
    symbol: v.string(),
    thesis: v.string(),
    sentiment: v.number(),
    confidence: v.number(),
    drivers: v.array(v.string()),
    sourceEventIds: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index('by_agent', ['agentName', 'updatedAt'])
    .index('by_symbol', ['symbol', 'updatedAt']),

  marketEvents: defineTable({
    eventId: v.string(),
    kind: v.union(
      v.literal('policy'),
      v.literal('news'),
      v.literal('conversation'),
      v.literal('belief'),
      v.literal('intent'),
      v.literal('order'),
      v.literal('fill'),
      v.literal('risk'),
    ),
    source: v.string(),
    headline: v.string(),
    summary: v.string(),
    severity: v.number(),
    symbols: v.array(v.string()),
    parentEventId: v.optional(v.string()),
    txHash: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
    occurredAt: v.number(),
  })
    .index('by_event_id', ['eventId'])
    .index('by_time', ['occurredAt'])
    .index('by_kind', ['kind', 'occurredAt']),

  tradeIntents: defineTable({
    intentId: v.string(),
    agentName: v.string(),
    subaccountNonce: v.number(),
    symbol: v.string(),
    side: tradeSide,
    orderType: v.union(v.literal('limit'), v.literal('market')),
    quantity: v.number(),
    limitPrice: v.optional(v.number()),
    rationale: v.string(),
    beliefEventId: v.optional(v.string()),
    executionMode: v.optional(v.union(v.literal('simulated'), v.literal('injective'))),
    state: orderState,
    riskCode: v.optional(v.string()),
    cid: v.string(),
    txHash: v.optional(v.string()),
    orderHash: v.optional(v.string()),
    error: v.optional(v.string()),
    claimId: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    attemptCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_intent_id', ['intentId'])
    .index('by_cid', ['cid'])
    .index('by_order_hash', ['orderHash'])
    .index('by_state', ['state', 'createdAt'])
    .index('by_execution_state', ['executionMode', 'state', 'createdAt'])
    .index('by_agent', ['agentName', 'createdAt'])
    .index('by_updated_at', ['updatedAt']),

  chainTransactions: defineTable({
    txHash: v.string(),
    intentId: v.optional(v.string()),
    purpose: v.string(),
    state: v.union(
      v.literal('broadcast'),
      v.literal('included'),
      v.literal('failed'),
      v.literal('reorged'),
    ),
    blockHeight: v.optional(v.number()),
    rawLog: v.optional(v.string()),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index('by_hash', ['txHash'])
    .index('by_intent', ['intentId']),

  chainOrders: defineTable({
    cid: v.string(),
    orderHash: v.optional(v.string()),
    intentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    marketSymbol: v.string(),
    marketId: v.string(),
    subaccountId: v.string(),
    side: tradeSide,
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
    txHash: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_cid', ['cid'])
    .index('by_order_hash', ['orderHash'])
    .index('by_intent', ['intentId'])
    .index('by_subaccount', ['subaccountId', 'updatedAt'])
    .index('by_market', ['marketSymbol', 'updatedAt']),

  fills: defineTable({
    fillKey: v.optional(v.string()),
    tradeId: v.string(),
    intentId: v.optional(v.string()),
    orderHash: v.optional(v.string()),
    cid: v.optional(v.string()),
    executionSide: v.optional(v.string()),
    marketSymbol: v.string(),
    marketId: v.string(),
    agentName: v.string(),
    subaccountId: v.string(),
    side: tradeSide,
    price: v.number(),
    quantity: v.number(),
    fee: v.number(),
    txHash: v.optional(v.string()),
    blockHeight: v.optional(v.number()),
    executedAt: v.number(),
  })
    .index('by_fill_key', ['fillKey'])
    .index('by_trade_id', ['tradeId'])
    .index('by_agent', ['agentName', 'executedAt'])
    .index('by_market', ['marketSymbol', 'executedAt'])
    .index('by_executed_at', ['executedAt']),

  chainMarketSnapshots: defineTable({
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
  })
    .index('by_symbol', ['marketSymbol'])
    .index('by_market_id', ['marketId']),

  chainAccountSnapshots: defineTable({
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
  })
    .index('by_agent', ['agentName'])
    .index('by_agent_market', ['agentName', 'marketSymbol'])
    .index('by_subaccount', ['subaccountId'])
    .index('by_observed_at', ['observedAt']),

  portfolioSnapshots: defineTable({
    agentName: v.string(),
    subaccountNonce: v.number(),
    subaccountId: v.optional(v.string()),
    townUsdAvailable: v.number(),
    townUsdTotal: v.number(),
    netAssetValue: v.number(),
    pnl: v.number(),
    positions: v.array(
      v.object({
        symbol: v.string(),
        quantity: v.number(),
        averagePrice: v.number(),
        markPrice: v.number(),
      }),
    ),
    blockHeight: v.optional(v.number()),
    observedAt: v.number(),
  })
    .index('by_agent', ['agentName', 'observedAt'])
    .index('by_subaccount', ['subaccountId', 'observedAt']),

  chainCursors: defineTable({
    stream: v.string(),
    cursor: v.string(),
    blockHeight: v.number(),
    updatedAt: v.number(),
  }).index('by_stream', ['stream']),

  characterLooks: defineTable({
    ownerId: v.string(),
    version: v.number(),
    requestId: v.optional(v.string()),
    presetId: v.string(),
    character: v.string(),
    textureUrl: v.string(),
    source: v.union(v.literal('lpc_curated_preset'), v.literal('lpc_composed')),
    storageId: v.optional(v.id('_storage')),
    schemaVersion: v.optional(v.number()),
    generatorCommit: v.optional(v.string()),
    appearance: v.optional(
      v.object({
        skinTone: v.string(),
        hairStyle: v.string(),
        hairColor: v.string(),
        topStyle: v.string(),
        topColor: v.string(),
        bottomStyle: v.string(),
        bottomColor: v.string(),
        shoesStyle: v.string(),
      }),
    ),
    licenseManifest: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index('by_owner', ['ownerId', 'version']),

  userProfiles: defineTable({
    ownerId: v.string(),
    displayName: v.string(),
    activeVersion: v.number(),
    activePresetId: v.string(),
    activeCharacter: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_owner', ['ownerId']),

  userProfileVersions: defineTable({
    ownerId: v.string(),
    version: v.number(),
    requestId: v.optional(v.string()),
    displayName: v.string(),
    presetId: v.string(),
    inputs: v.object({
      investmentGoal: v.union(
        v.literal('growth'),
        v.literal('income'),
        v.literal('preservation'),
        v.literal('learning'),
      ),
      horizon: v.union(v.literal('short'), v.literal('medium'), v.literal('long')),
      maxDrawdownPct: v.number(),
      conviction: v.number(),
      socialInfluence: v.number(),
      lossAversion: v.number(),
      scenarios: v.array(
        v.union(
          v.literal('market_crash'),
          v.literal('missed_rally'),
          v.literal('crowd_fomo'),
          v.literal('thesis_challenged'),
          v.literal('unexpected_cash'),
        ),
      ),
      scenarioAnswers: v.optional(
        v.object({
          market_crash: v.optional(
            v.union(v.literal('cautious'), v.literal('measured'), v.literal('aggressive')),
          ),
          missed_rally: v.optional(
            v.union(v.literal('cautious'), v.literal('measured'), v.literal('aggressive')),
          ),
          crowd_fomo: v.optional(
            v.union(v.literal('cautious'), v.literal('measured'), v.literal('aggressive')),
          ),
          thesis_challenged: v.optional(
            v.union(v.literal('cautious'), v.literal('measured'), v.literal('aggressive')),
          ),
          unexpected_cash: v.optional(
            v.union(v.literal('cautious'), v.literal('measured'), v.literal('aggressive')),
          ),
        }),
      ),
    }),
    compiled: v.object({
      riskTolerance: v.number(),
      holdingPeriodDays: v.number(),
      cashBufferPct: v.number(),
      maxPositionPct: v.number(),
      tradeFrequency: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
      socialSignalWeight: v.number(),
      stopLossDiscipline: v.number(),
      decisionStyle: v.string(),
      riskFlags: v.array(v.string()),
    }),
    createdAt: v.number(),
  })
    .index('by_owner', ['ownerId', 'version'])
    .index('by_request', ['ownerId', 'requestId']),
};
