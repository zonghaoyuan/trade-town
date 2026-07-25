import { TOWN_TRADERS } from '../../shared/finance';
import type {
  CausalEvent,
  DashboardCandle,
  DashboardError,
  DashboardExecution,
  DashboardMarket,
  DashboardTrader,
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

export function buildPandaDayViewDashboards(dayIndex: number) {
  const datasets = buildPandaMarketsAtDay(dayIndex);
  const simulationRuns = new Map(
    datasets.map((dataset) => [
      dataset.market.symbol,
      buildPandaSimulationRun(dataset.market),
    ]),
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

export const pandaDayViewDashboards = buildPandaDayViewDashboards(
  PANDA_REPLAY_DAY_COUNT - 1,
);

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
