import { TOWN_TRADERS } from '../../shared/finance';
import type {
  CausalEvent,
  DashboardCandle,
  DashboardError,
  DashboardExecution,
  DashboardMarket,
  DashboardTrader,
  InjectiveAccountView,
  SocialActivity,
  TownSummary,
} from '../../shared/pandaTypes';
import {
  buildPandaMarketsAtDay,
  PANDA_REPLAY_DAY_COUNT,
  pandaHistoricalMarket,
} from './pandaMarket';
import { buildPandaSimulationRun } from './pandaSimulation';

export type DashboardMode = 'panda_dayview' | 'injective_testnet' | 'local_sim';
export type {
  CausalEvent,
  DashboardCandle,
  DashboardError,
  DashboardExecution,
  DashboardMarket,
  DashboardPosition,
  DashboardTrader,
  InjectiveAccountView,
  SocialActivity,
  TownSummary,
  TradeAction,
  Tone,
} from '../../shared/pandaTypes';

export type TradeTownDashboard = {
  dataMode: DashboardMode;
  source: 'preview' | 'panda' | 'injective';
  sourceLabel: string;
  runId?: string;
  asOf: number;
  gatewayStatus: 'unconfigured' | 'read_only' | 'signing' | 'degraded';
  blockHeight?: number;
  operatorAddress?: string;
  markets: DashboardMarket[];
  traders: DashboardTrader[];
  marketMakers: DashboardTrader[];
  events: CausalEvent[];
  social: SocialActivity[];
  executions: DashboardExecution[];
  summary: TownSummary;
  errors: DashboardError[];
};

const DAY_START = Math.floor(Date.UTC(2026, 6, 24, 1, 30, 0) / 1000);

function makeCandles(closes: number[], start = DAY_START, interval = 30 * 60): DashboardCandle[] {
  return closes.map((close, index) => {
    const open = index === 0 ? close * 0.994 : closes[index - 1];
    const spread = Math.max(close * (0.004 + (index % 3) * 0.0014), 0.02);
    return {
      time: start + index * interval,
      open,
      high: Math.max(open, close) + spread,
      low: Math.max(0, Math.min(open, close) - spread * 0.86),
      close,
      volume: 68_000 + index * 8_400 + (index % 4) * 18_000,
    };
  });
}

const injectivePreviewMarket: DashboardMarket = {
  symbol: 'ACME',
  displayName: 'Acme Industries',
  assetClass: 'company',
  lastPrice: 0,
  referencePrice: 0,
  changePct: 0,
  volume: 0,
  status: 'planned',
  accent: '#ffb84d',
  quoteCurrency: 'INJ',
  priceTick: 0.0001,
  candles: [],
  indicators: [
    { label: 'SOURCE', value: 'NO CHAIN DATA', tone: 'neutral' },
    { label: 'ORDERS', value: '0', tone: 'neutral' },
    { label: 'FILLS', value: '0', tone: 'neutral' },
  ],
};

const marketMakers: DashboardTrader[] = TOWN_TRADERS.slice(8).map((trader) => ({
  ...trader,
  currency: 'INJ',
  pnl: 0,
  activity: 'Awaiting a chain-backed account observation',
  action: 'HOLD',
  confidence: 1,
  beliefBefore: 'Deterministic quoting policy active.',
  beliefAfter: 'Inventory skew remains inside limits.',
  thesis: 'Provide two-sided liquidity within the configured loss limit.',
  evidence: ['maker-policy-v1'],
  navStart: 0,
  navEnd: 0,
  cash: 0,
  positions: [],
  riskRejections: 0,
  orderCount: 0,
  tradeCount: 0,
}));

const injectivePreviewTraders: DashboardTrader[] = TOWN_TRADERS.slice(0, 8).map((trader) => ({
  ...trader,
  currency: 'INJ',
  pnl: 0,
  activity: 'Awaiting confirmed testnet state',
  action: 'HOLD',
  confidence: 0,
  beliefBefore: 'No chain-backed market observation yet.',
  beliefAfter: 'Waiting for the Injective gateway and confirmed fills.',
  thesis: 'Do not infer portfolio state from Panda simulation data.',
  evidence: ['injective-gateway-unconfigured'],
  navStart: 10,
  navEnd: 10,
  cash: 10,
  positions: [],
  riskRejections: 0,
  orderCount: 0,
  tradeCount: 0,
}));

export function buildPandaDayViewDashboards(dayIndex: number) {
  const datasets = buildPandaMarketsAtDay(dayIndex);
  const simulationRuns = new Map(
    datasets.map((dataset) => [dataset.market.symbol, buildPandaSimulationRun(dataset.market)]),
  );
  const markets: DashboardMarket[] = datasets.map((dataset) => ({
    ...dataset.market,
    sentiment: simulationRuns.get(dataset.market.symbol)!.sentiment,
  }));

  return Object.fromEntries(
    datasets.map((dataset) => {
      const run = simulationRuns.get(dataset.market.symbol)!;
      return [
        dataset.market.symbol,
        {
          dataMode: 'panda_dayview',
          source: 'panda',
          sourceLabel: 'PANDA DAILY · GENERATED REPLAY',
          runId: run.runId,
          asOf: dataset.asOf,
          gatewayStatus: 'read_only',
          markets,
          traders: run.traders,
          marketMakers: [],
          events: run.events,
          social: run.social,
          executions: run.executions,
          summary: run.summary,
          errors: run.errors,
        } satisfies TradeTownDashboard,
      ];
    }),
  ) as Record<string, TradeTownDashboard>;
}

export const pandaDayViewDashboards = buildPandaDayViewDashboards(PANDA_REPLAY_DAY_COUNT - 1);

export const pandaDayViewDashboard = pandaDayViewDashboards[pandaHistoricalMarket.market.symbol];

export const injectivePreviewDashboard: TradeTownDashboard = {
  dataMode: 'injective_testnet',
  source: 'preview',
  sourceLabel: 'INJECTIVE TESTNET · PREVIEW',
  asOf: DAY_START,
  gatewayStatus: 'unconfigured',
  markets: [injectivePreviewMarket],
  traders: injectivePreviewTraders,
  marketMakers,
  events: [],
  social: [],
  executions: [],
  summary: {
    aum: 80,
    totalExposure: 0,
    volume: 0,
    profitableAgents: 0,
    topAgent: 'No confirmed fills',
    topReturnPct: 0,
  },
  errors: [
    {
      id: 'error-chain-01',
      time: '09:29:58',
      scope: 'Injective Gateway',
      message: 'Signing is not configured. Testnet values are preview-only.',
      recovered: false,
    },
  ],
};

// Kept for the existing offline town preview.
export const previewDashboard = pandaDayViewDashboard;

export function mergeLiveDashboard(value: any): TradeTownDashboard {
  if (!value?.config || value.markets?.length === 0) {
    return injectivePreviewDashboard;
  }

  const chainMarket = value.chainMarkets?.find((market: any) => market.marketSymbol === 'ACME');
  const chainVerified = value.source === 'injective' && chainMarket;
  const chainPrice =
    chainMarket?.lastPrice ??
    (chainMarket?.bestBid !== undefined && chainMarket?.bestAsk !== undefined
      ? (chainMarket.bestBid + chainMarket.bestAsk) / 2
      : 0);
  const markets: DashboardMarket[] = chainVerified
    ? [
        {
          ...injectivePreviewMarket,
          lastPrice: chainPrice,
          referencePrice: chainPrice,
          changePct: 0,
          volume: chainMarket.recentVolume ?? 0,
          status: normalizeMarketStatus(chainMarket.status),
          priceTick: chainMarket.minPriceTick,
          candles:
            chainMarket.lastPrice && chainMarket.lastPrice > 0
              ? [
                  {
                    time: Math.floor(chainMarket.observedAt / 1000),
                    open: chainMarket.lastPrice,
                    high: chainMarket.lastPrice,
                    low: chainMarket.lastPrice,
                    close: chainMarket.lastPrice,
                    volume: chainMarket.recentVolume ?? 0,
                  },
                ]
              : [],
          indicators: [
            {
              label: 'STATUS',
              value: String(chainMarket.status).toUpperCase(),
              tone: 'neutral',
            },
            {
              label: 'OPEN ORDERS',
              value: String(
                value.chainOrders?.filter((order: any) =>
                  ['booked', 'partial'].includes(order.state),
                ).length ?? 0,
              ),
              tone: 'neutral',
            },
            {
              label: 'FILLS',
              value: String(value.fills?.length ?? 0),
              tone: 'neutral',
            },
          ],
        },
      ]
    : injectivePreviewDashboard.markets;

  const traderProfiles = new Map(
    (value.traders ?? []).map((trader: any) => [trader.agentName, trader]),
  );
  const mapTrader = (preview: DashboardTrader) =>
    mergeInjectiveTrader(
      preview,
      traderProfiles.get(preview.name),
      value.chainAccounts ?? [],
      value.chainOrders ?? [],
      value.fills ?? [],
      chainPrice,
    );
  const traders = injectivePreviewDashboard.traders.map(mapTrader);
  const liveMarketMakers = injectivePreviewDashboard.marketMakers.map(mapTrader);
  const executions = buildInjectiveExecutions(value.chainOrders ?? [], value.fills ?? []);
  const allAccounts: InjectiveAccountView[] = [...traders, ...liveMarketMakers].flatMap((trader) =>
    trader.injectiveAccount ? [trader.injectiveAccount] : [],
  );
  const totalQuote = allAccounts.reduce((sum, account) => sum + account.quoteTotal, 0);
  const totalBase = allAccounts.reduce((sum, account) => sum + account.baseTotal, 0);
  const syncAt = value.config.lastIndexerSyncAt ?? value.config.lastChainSyncAt;

  return {
    ...injectivePreviewDashboard,
    source: value.source,
    sourceLabel:
      value.source === 'injective'
        ? 'INJECTIVE TESTNET · CHAIN DATA'
        : 'INJECTIVE TESTNET · PREVIEW',
    gatewayStatus: value.config.gatewayStatus,
    blockHeight: value.config.lastChainHeight,
    operatorAddress: value.config.operatorAddress,
    asOf: syncAt ? Math.floor(syncAt / 1000) : injectivePreviewDashboard.asOf,
    markets,
    traders,
    marketMakers: liveMarketMakers,
    executions,
    summary: {
      aum: totalQuote + totalBase * chainPrice,
      totalExposure: totalBase * chainPrice,
      volume: chainMarket?.recentVolume ?? 0,
      profitableAgents: 0,
      topAgent: value.fills?.length > 0 ? value.fills[0].agentName : 'No confirmed fills',
      topReturnPct: 0,
    },
    errors:
      value.source === 'injective'
        ? []
        : [
            {
              id: 'injective-sync-status',
              time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
              scope: 'Injective Gateway',
              message:
                value.config.lastGatewayError ??
                'Injective chain data is unavailable or stale; no preview values are treated as verified.',
              recovered: false,
            },
          ],
    events:
      value.events?.length > 0
        ? value.events.map((event: any) => ({
            id: event.eventId,
            time: new Date(event.occurredAt).toLocaleTimeString('en-GB', { hour12: false }),
            kind: event.kind === 'fill' || event.kind === 'order' ? 'chain' : event.kind,
            actor: event.source,
            title: event.headline,
            detail: event.summary,
            proof: event.txHash ?? undefined,
          }))
        : injectivePreviewDashboard.events,
  };
}

function mergeInjectiveTrader(
  preview: DashboardTrader,
  profile: any,
  accounts: any[],
  orders: any[],
  fills: any[],
  markPrice: number,
): DashboardTrader {
  const account = accounts.find((candidate) => candidate.agentName === preview.name);
  if (!account) {
    return profile
      ? {
          ...preview,
          role: profile.role,
          style: profile.style,
          riskTolerance: profile.riskTolerance,
          subaccountNonce: profile.subaccountNonce,
        }
      : preview;
  }
  const agentOrders = orders
    .filter((order) => order.subaccountId === account.subaccountId)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const agentFills = fills
    .filter((fill) => fill.subaccountId === account.subaccountId)
    .sort((left, right) => right.executedAt - left.executedAt);
  const latestOrder = agentOrders[0];
  const latestFill = agentFills[0];
  const lastAction = buildLastAction(latestOrder, latestFill);
  const nav = account.quoteTotal + account.baseTotal * markPrice;
  const baseValue = account.baseTotal * markPrice;
  const injectiveAccount: InjectiveAccountView = {
    subaccountId: account.subaccountId,
    subaccountNonce: account.subaccountNonce,
    quoteDenom: account.quoteDenom,
    quoteAvailable: account.quoteAvailable,
    quoteTotal: account.quoteTotal,
    baseDenom: account.baseDenom,
    baseAvailable: account.baseAvailable,
    baseTotal: account.baseTotal,
    openOrderCount: agentOrders.filter((order) => ['booked', 'partial'].includes(order.state))
      .length,
    fillCount: agentFills.length,
    observedAt: account.observedAt,
    blockHeight: account.blockHeight,
    lastAction,
  };
  return {
    ...preview,
    role: profile?.role ?? preview.role,
    style: profile?.style ?? preview.style,
    riskTolerance: profile?.riskTolerance ?? preview.riskTolerance,
    subaccountNonce: account.subaccountNonce,
    currency: 'INJ',
    pnl: 0,
    activity: lastAction
      ? `${lastAction.state} · ${lastAction.side} ${lastAction.quantity} ACME`
      : 'Chain balance verified · no orders yet',
    action: lastAction?.side ?? 'HOLD',
    confidence: 0,
    evidence: lastAction?.txHash
      ? [lastAction.txHash]
      : lastAction?.tradeId
        ? [lastAction.tradeId]
        : ['injective-account-snapshot'],
    navStart: nav,
    navEnd: nav,
    cash: account.quoteAvailable,
    positions:
      account.baseTotal > 0
        ? [
            {
              symbol: 'ACME',
              quantity: account.baseTotal,
              weightPct: nav > 0 ? (baseValue / nav) * 100 : 0,
              pnl: 0,
            },
          ]
        : [],
    orderCount: agentOrders.length,
    tradeCount: agentFills.length,
    injectiveAccount,
  };
}

function buildLastAction(order: any, fill: any): InjectiveAccountView['lastAction'] {
  if (!order && !fill) return undefined;
  if (fill && (!order || fill.executedAt >= order.updatedAt)) {
    return {
      side: String(fill.side).toUpperCase() as 'BUY' | 'SELL',
      quantity: fill.quantity,
      price: fill.price,
      state: 'FILLED',
      occurredAt: fill.executedAt,
      txHash: fill.txHash,
      orderHash: fill.orderHash,
      tradeId: fill.tradeId,
    };
  }
  return {
    side: String(order.side).toUpperCase() as 'BUY' | 'SELL',
    quantity: order.quantity,
    price: order.price,
    state: String(order.state).toUpperCase(),
    occurredAt: order.updatedAt,
    txHash: order.txHash,
    orderHash: order.orderHash,
  };
}

function buildInjectiveExecutions(orders: any[], fills: any[]): DashboardExecution[] {
  return [
    ...orders.map((order) => ({
      id: `injective-order-${order.orderHash ?? order.cid}`,
      time: new Date(order.updatedAt).toLocaleTimeString('en-GB', { hour12: false }),
      occurredAt: order.updatedAt,
      agentName: order.agentName ?? 'Town Agent',
      symbol: order.marketSymbol,
      type: 'order' as const,
      side: String(order.side).toUpperCase() as 'BUY' | 'SELL',
      quantity: order.quantity,
      price: order.price,
      priceUnit: 'INJ',
      state: order.state,
      isSimulated: false,
      reference: order.txHash ?? order.orderHash,
    })),
    ...fills.map((fill) => ({
      id: `injective-fill-${fill.fillKey ?? fill.tradeId}`,
      time: new Date(fill.executedAt).toLocaleTimeString('en-GB', { hour12: false }),
      occurredAt: fill.executedAt,
      agentName: fill.agentName,
      symbol: fill.marketSymbol,
      type: 'fill' as const,
      side: String(fill.side).toUpperCase() as 'BUY' | 'SELL',
      quantity: fill.quantity,
      price: fill.price,
      priceUnit: 'INJ',
      state: 'filled',
      isSimulated: false,
      reference: fill.txHash ?? fill.orderHash ?? fill.tradeId,
    })),
  ].sort((left, right) => (right.occurredAt ?? 0) - (left.occurredAt ?? 0));
}

function normalizeMarketStatus(value: string): DashboardMarket['status'] {
  const normalized = value.toLowerCase();
  if (normalized.includes('active')) return 'active';
  if (normalized.includes('pause')) return 'paused';
  if (normalized.includes('launch')) return 'launching';
  return 'planned';
}
