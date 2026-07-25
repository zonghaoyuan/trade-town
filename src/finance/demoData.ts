import { TOWN_MARKETS, TOWN_TRADERS } from '../../shared/finance';
import { pandaHistoricalMarket, pandaHistoricalMarkets } from './pandaMarket';

export type DashboardMode = 'panda_market' | 'injective_testnet';
export type TradeAction = 'BUY' | 'SELL' | 'HOLD';
export type Tone = 'positive' | 'negative' | 'neutral';

export type DashboardCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DashboardMarket = {
  symbol: string;
  displayName: string;
  assetClass: 'company' | 'commodity';
  lastPrice: number;
  referencePrice: number;
  changePct: number;
  volume: number;
  status: 'planned' | 'launching' | 'active' | 'paused';
  accent: string;
  quoteCurrency?: string;
  priceTick?: number;
  candles: DashboardCandle[];
  indicators: Array<{
    label: string;
    value: string;
    tone: Tone;
  }>;
  sentiment?: {
    bulls: number;
    bears: number;
    holds?: number;
    consensus: number;
    divergence: number;
    camp: string;
  };
};

export type DashboardPosition = {
  symbol: string;
  quantity: number;
  weightPct: number;
  pnl: number;
};

export type DashboardTrader = {
  name: string;
  kind: 'ai' | 'market_maker';
  role: string;
  style: string;
  riskTolerance: number;
  subaccountNonce: number;
  focusSymbols: readonly string[];
  financialState: 'profile_only' | 'verified';
  currency?: string;
  pnl: number;
  activity: string;
  action: TradeAction;
  confidence: number;
  beliefBefore: string;
  beliefAfter: string;
  thesis: string;
  evidence: string[];
  navStart: number;
  navEnd: number;
  cash: number;
  positions: DashboardPosition[];
  riskRejections: number;
  orderCount: number;
  tradeCount: number;
};

export type CausalEvent = {
  id: string;
  time: string;
  kind:
    | 'policy'
    | 'news'
    | 'belief'
    | 'conversation'
    | 'intent'
    | 'risk'
    | 'chain'
    | 'post'
    | 'interaction'
    | 'error';
  actor: string;
  title: string;
  detail: string;
  proof?: string;
};

export type SocialActivity = {
  id: string;
  time: string;
  actor: string;
  type: 'post' | 'reply' | 'repost' | 'graph';
  title: string;
  detail: string;
  impact: string;
};

export type DashboardExecution = {
  id: string;
  time: string;
  agentName: string;
  symbol: string;
  type: 'risk_rejected' | 'order' | 'fill';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  priceUnit?: string;
  state: string;
  isSimulated?: boolean;
  reference?: string;
  reason?: string;
};

export type DashboardError = {
  id: string;
  time: string;
  scope: string;
  message: string;
  recovered: boolean;
};

export type TownSummary = {
  aum: number;
  totalExposure: number;
  volume: number;
  profitableAgents: number;
  topAgent: string;
  topReturnPct: number;
};

export type TradeTownDashboard = {
  dataMode: DashboardMode;
  source: 'preview' | 'panda' | 'injective';
  sourceLabel: string;
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

const pandaSymbols = pandaHistoricalMarkets.map(({ market }) => market.symbol);
const pandaAsOf = Math.max(...pandaHistoricalMarkets.map((dataset) => dataset.asOf));
const pandaVolume = pandaHistoricalMarkets.reduce(
  (total, dataset) => total + dataset.market.volume,
  0,
);

function profileOnlyTrader(
  trader: (typeof TOWN_TRADERS)[number],
  currency: string,
  focusSymbols: readonly string[],
): DashboardTrader {
  return {
    name: trader.name,
    kind: 'ai',
    role: trader.role,
    style: trader.style,
    riskTolerance: trader.riskTolerance,
    subaccountNonce: trader.subaccountNonce,
    focusSymbols,
    financialState: 'profile_only',
    currency,
    pnl: 0,
    activity: 'Monitoring sourced market data',
    action: 'HOLD',
    confidence: 0,
    beliefBefore: 'No generated financial belief is loaded.',
    beliefAfter: 'Waiting for a verified agent decision.',
    thesis: 'Market observations are available; no synthetic trading conclusion was generated.',
    evidence: [],
    navStart: 0,
    navEnd: 0,
    cash: 0,
    positions: [],
    riskRejections: 0,
    orderCount: 0,
    tradeCount: 0,
  };
}

const pandaTraders = TOWN_TRADERS.filter((trader) => trader.kind === 'ai').map((trader) => {
  const profile = profileOnlyTrader(trader, 'CNY', pandaSymbols);
  return {
    ...profile,
    activity: `Monitoring ${pandaHistoricalMarkets.length} sourced PandaAI markets`,
    evidence: pandaHistoricalMarkets.map(
      (dataset) =>
        `PANDA:${dataset.method}:${dataset.market.symbol}:${dataset.endDate}:${dataset.datasetId}`,
    ),
  };
});

const pandaMarketEvents: CausalEvent[] = pandaHistoricalMarkets.map((dataset, index) => ({
  id: `panda-${dataset.market.symbol}-${dataset.endDate}`,
  time: `15:00:${String(index).padStart(2, '0')}`,
  kind: 'news',
  actor: 'PandaAI Data Service',
  title: `${dataset.market.symbol} daily market data loaded`,
  detail: `${dataset.barCount} sourced daily bars are available through ${dataset.endDate}. No orders, positions, P&L or sentiment were generated.`,
  proof: `PANDA:${dataset.method}:${dataset.market.symbol}:${dataset.endDate}:${dataset.datasetId}`,
}));

export const pandaDayViewDashboard: TradeTownDashboard = {
  dataMode: 'panda_market',
  source: 'panda',
  sourceLabel: `PANDAAI DAILY · ${pandaHistoricalMarkets.length} SOURCED MARKETS · THROUGH ${pandaHistoricalMarket.endDate}`,
  asOf: pandaAsOf,
  gatewayStatus: 'read_only',
  markets: pandaHistoricalMarkets.map((dataset) => dataset.market),
  traders: pandaTraders,
  marketMakers: [],
  events: pandaMarketEvents,
  social: [],
  executions: [],
  summary: {
    aum: 0,
    totalExposure: 0,
    volume: pandaVolume,
    profitableAgents: 0,
    topAgent: 'No verified financial data',
    topReturnPct: 0,
  },
  errors: [],
};

// Transitional compatibility for the pre-Activity shell. Every symbol points to
// the same sourced dashboard; the selected symbol only changes the visible market.
export const pandaDayViewDashboards = Object.fromEntries(
  pandaSymbols.map((symbol) => [symbol, pandaDayViewDashboard]),
) as Record<string, TradeTownDashboard>;

const injectiveProfiles = TOWN_TRADERS.filter((trader) => trader.kind === 'ai').map((trader) =>
  profileOnlyTrader(
    trader,
    'INJ',
    TOWN_MARKETS.map((market) => market.symbol),
  ),
);

export const injectivePreviewDashboard: TradeTownDashboard = {
  dataMode: 'injective_testnet',
  source: 'preview',
  sourceLabel: 'INJECTIVE TESTNET · NO VERIFIED MARKET SNAPSHOT',
  asOf: Date.now(),
  gatewayStatus: 'unconfigured',
  markets: [],
  traders: injectiveProfiles,
  marketMakers: [],
  events: [],
  social: [],
  executions: [],
  summary: {
    aum: 0,
    totalExposure: 0,
    volume: 0,
    profitableAgents: 0,
    topAgent: 'No verified financial data',
    topReturnPct: 0,
  },
  errors: [
    {
      id: 'injective-unavailable',
      time: '--:--',
      scope: 'Injective Gateway',
      message: 'No verified chain snapshot is connected. Preview financial values are disabled.',
      recovered: false,
    },
  ],
};

export const previewDashboard = pandaDayViewDashboard;

export function mergeLiveDashboard(value: any): TradeTownDashboard {
  if (!value?.config || value.source !== 'injective') {
    return injectivePreviewDashboard;
  }

  const markets: DashboardMarket[] = (value.markets ?? [])
    .filter((market: any) => Number.isFinite(market.lastPrice))
    .map((market: any): DashboardMarket => {
      const catalog = TOWN_MARKETS.find((candidate) => candidate.symbol === market.symbol);
      const lastPrice = Number(market.lastPrice);
      const observedAt = Number(market.updatedAt ?? value.config.lastChainSyncAt ?? Date.now());
      const volume = Number.isFinite(market.volume24h) ? Number(market.volume24h) : 0;
      return {
        symbol: market.symbol,
        displayName: market.displayName,
        assetClass: market.assetClass,
        lastPrice,
        referencePrice: lastPrice,
        changePct: 0,
        volume,
        status: market.status,
        accent: catalog?.accent ?? '#00d2ff',
        quoteCurrency: 'INJ',
        priceTick: Number.parseFloat(market.minPriceTick || '0.0001'),
        candles: [
          {
            time: Math.floor(observedAt / 1000),
            open: lastPrice,
            high: lastPrice,
            low: lastPrice,
            close: lastPrice,
            volume,
          },
        ],
        indicators: [
          { label: 'CHAIN LAST', value: formatIndicator(lastPrice), tone: 'neutral' },
          { label: 'FILLED VALUE', value: formatIndicator(volume), tone: 'neutral' },
        ],
      };
    });

  const traders = injectiveProfiles.map((profile) => {
    const live = value.traders?.find((trader: any) => trader.agentName === profile.name);
    return live
      ? {
          ...profile,
          role: live.role,
          style: live.style,
          riskTolerance: live.riskTolerance,
          subaccountNonce: live.subaccountNonce,
        }
      : profile;
  });

  const events = (value.events ?? [])
    .filter((event: any) => event.txHash || event.blockHeight)
    .map(
      (event: any): CausalEvent => ({
        id: event.eventId,
        time: new Date(event.occurredAt).toLocaleTimeString('en-GB', { hour12: false }),
        kind: 'chain',
        actor: event.source,
        title: event.headline,
        detail: event.summary,
        proof: event.txHash ?? undefined,
      }),
    );

  return {
    ...injectivePreviewDashboard,
    source: 'injective',
    sourceLabel: 'INJECTIVE TESTNET · VERIFIED CHAIN DATA',
    asOf: value.config.lastChainSyncAt ?? Date.now(),
    gatewayStatus: value.config.gatewayStatus,
    blockHeight: value.config.lastChainHeight,
    operatorAddress: value.config.operatorAddress,
    markets,
    traders,
    events,
    summary: {
      ...injectivePreviewDashboard.summary,
      volume: markets.reduce((sum, market) => sum + market.volume, 0),
    },
    errors: [],
  };
}

function formatIndicator(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 4,
  }).format(value);
}
