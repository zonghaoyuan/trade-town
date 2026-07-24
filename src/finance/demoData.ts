import { TOWN_TRADERS } from '../../shared/finance';
import { pandaHistoricalMarket } from './pandaMarket';
import { buildPandaSimulationRun } from './pandaSimulation';

export type DashboardMode = 'panda_dayview' | 'injective_testnet' | 'local_sim';
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
  isSimulated: boolean;
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

const pandaSimulationRun = buildPandaSimulationRun(pandaHistoricalMarket.market);
const pandaMarkets: DashboardMarket[] = [
  {
    ...pandaHistoricalMarket.market,
    sentiment: pandaSimulationRun.sentiment,
  },
];

const injectivePreviewMarket: DashboardMarket = {
  symbol: 'ACME',
  displayName: 'Acme Industries',
  assetClass: 'company',
  lastPrice: 0.0964,
  referencePrice: 0.1,
  changePct: -3.58,
  volume: 14_208,
  status: 'active',
  accent: '#ffb84d',
  quoteCurrency: 'INJ',
  priceTick: 0.0001,
  candles: makeCandles([
    0.1001, 0.1008, 0.0999, 0.0992, 0.0987, 0.0991, 0.0978, 0.0972, 0.0968, 0.0964,
  ]),
  indicators: [
    { label: 'RUN Δ', value: '-3.58%', tone: 'negative' },
    { label: 'LAST', value: '0.0964', tone: 'neutral' },
    { label: 'VOLUME', value: '14.2K', tone: 'neutral' },
  ],
};

const marketMakers: DashboardTrader[] = TOWN_TRADERS.slice(8).map((trader) => ({
  ...trader,
  currency: 'INJ',
  pnl: trader.name === 'Delta-7' ? 0.0386 : 0.0244,
  activity: trader.name === 'Delta-7' ? 'Quoting ACME · NOVA' : 'Quoting LUMA · FORGE',
  action: 'HOLD',
  confidence: 1,
  beliefBefore: 'Deterministic quoting policy active.',
  beliefAfter: 'Inventory skew remains inside limits.',
  thesis: 'Provide two-sided liquidity within the configured loss limit.',
  evidence: ['maker-policy-v1'],
  navStart: 10,
  navEnd: trader.name === 'Delta-7' ? 10.0386 : 10.0244,
  cash: 5,
  positions: [],
  riskRejections: 0,
  orderCount: 12,
  tradeCount: 5,
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

export const pandaDayViewDashboard: TradeTownDashboard = {
  dataMode: 'panda_dayview',
  source: 'panda',
  sourceLabel: 'PANDA DAILY · GENERATED REPLAY',
  runId: pandaSimulationRun.runId,
  asOf: pandaHistoricalMarket.asOf,
  gatewayStatus: 'read_only',
  markets: pandaMarkets,
  traders: pandaSimulationRun.traders,
  marketMakers: [],
  events: pandaSimulationRun.events,
  social: pandaSimulationRun.social,
  executions: pandaSimulationRun.executions,
  summary: pandaSimulationRun.summary,
  errors: pandaSimulationRun.errors,
};

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

  const liveAcme = value.markets.find((market: any) => market.symbol === 'ACME');
  const markets = injectivePreviewDashboard.markets.map((preview) =>
    liveAcme
      ? {
          ...preview,
          status: liveAcme.status,
          lastPrice: liveAcme.lastPrice ?? preview.lastPrice,
          changePct: liveAcme.change24h ?? preview.changePct,
          volume: liveAcme.volume24h ?? preview.volume,
        }
      : preview,
  );

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
    markets,
    traders: injectivePreviewDashboard.traders.map((preview) => {
      const live = value.traders?.find((trader: any) => trader.agentName === preview.name);
      return live
        ? {
            ...preview,
            role: live.role,
            style: live.style,
            riskTolerance: live.riskTolerance,
            subaccountNonce: live.subaccountNonce,
          }
        : preview;
    }),
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
