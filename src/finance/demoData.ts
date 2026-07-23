import { TOWN_MARKETS, TOWN_TRADERS } from '../../shared/finance';

export type DashboardMarket = {
  symbol: string;
  displayName: string;
  assetClass: 'company' | 'commodity';
  lastPrice: number;
  referencePrice: number;
  change24h: number;
  volume24h: number;
  status: 'planned' | 'launching' | 'active' | 'paused';
  accent: string;
  series: readonly number[];
};

export type DashboardTrader = {
  name: string;
  kind: 'ai' | 'market_maker';
  role: string;
  style: string;
  riskTolerance: number;
  subaccountNonce: number;
  focusSymbols: readonly string[];
  pnl: number;
  activity: string;
};

export type CausalEvent = {
  id: string;
  time: string;
  kind: 'policy' | 'news' | 'belief' | 'conversation' | 'intent' | 'risk' | 'chain';
  actor: string;
  title: string;
  detail: string;
  proof?: string;
};

export type TradeTownDashboard = {
  source: 'preview' | 'injective';
  gatewayStatus: 'unconfigured' | 'read_only' | 'signing' | 'degraded';
  blockHeight?: number;
  operatorAddress?: string;
  markets: DashboardMarket[];
  traders: DashboardTrader[];
  events: CausalEvent[];
};

const marketState = {
  ACME: {
    lastPrice: 38.42,
    change24h: -9.86,
    volume24h: 1_420_800,
    series: [43, 42.8, 43.1, 42.4, 42.7, 41.9, 41.2, 40.8, 39.7, 40.1, 39.1, 38.42],
  },
  NOVA: {
    lastPrice: 83.91,
    change24h: -2.88,
    volume24h: 982_400,
    series: [86, 86.8, 85.9, 87.1, 86.3, 85.8, 84.9, 85.4, 84.7, 84.2, 83.7, 83.91],
  },
  AURUM: {
    lastPrice: 2428.6,
    change24h: 2.03,
    volume24h: 3_804_100,
    series: [2380, 2384, 2392, 2390, 2401, 2408, 2402, 2415, 2418, 2424, 2421, 2428.6],
  },
  CRUDE: {
    lastPrice: 72.64,
    change24h: -0.74,
    volume24h: 2_201_900,
    series: [73.2, 73.5, 73.1, 72.9, 73.4, 73.2, 72.7, 72.5, 72.8, 72.4, 72.7, 72.64],
  },
} as const;

const agentState: Record<string, { pnl: number; activity: string }> = {
  'Mira Chen': { pnl: 1420, activity: 'Revising ACME fair value' },
  'Theo Grant': { pnl: -310, activity: 'Reading the company filing' },
  'Imani Brooks': { pnl: -1840, activity: 'Walking to the exchange' },
  'Sora Vale': { pnl: 220, activity: 'Publishing a rate bulletin' },
  'Omar Reyes': { pnl: 980, activity: 'Checking commodity flows' },
  'Lin Park': { pnl: 610, activity: 'Mapping the fear cascade' },
  'Jules Hart': { pnl: -720, activity: 'Cutting portfolio beta' },
  'Neha Rao': { pnl: 0, activity: 'Monitoring order concentration' },
  'Delta-7': { pnl: 386, activity: 'Quoting ACME · NOVA' },
  'Sigma-2': { pnl: 244, activity: 'Quoting AURUM · CRUDE' },
};

export const previewDashboard: TradeTownDashboard = {
  source: 'preview',
  gatewayStatus: 'read_only',
  blockHeight: 134_432_446,
  markets: TOWN_MARKETS.map((market) => ({
    symbol: market.symbol,
    displayName: market.displayName,
    assetClass: market.assetClass,
    referencePrice: market.referencePrice,
    status: 'planned',
    accent: market.accent,
    ...marketState[market.symbol as keyof typeof marketState],
  })),
  traders: TOWN_TRADERS.map((trader) => ({
    ...trader,
    ...agentState[trader.name],
  })),
  events: [
    {
      id: 'evt-policy-01',
      time: '09:30:00',
      kind: 'policy',
      actor: 'Town Central Bank',
      title: 'Policy rate raised by 75 bps',
      detail: 'The surprise decision tightens funding conditions across the town.',
    },
    {
      id: 'evt-news-02',
      time: '09:30:18',
      kind: 'news',
      actor: 'Sora Vale',
      title: 'Bulletin reaches the town square',
      detail: 'Sora links the decision to ACME refinancing and NOVA duration risk.',
    },
    {
      id: 'evt-belief-03',
      time: '09:30:41',
      kind: 'belief',
      actor: 'Mira Chen',
      title: 'ACME belief turns bearish',
      detail: 'Fair value falls to 39.10 TOWNUSD with 73% confidence.',
    },
    {
      id: 'evt-conversation-04',
      time: '09:31:09',
      kind: 'conversation',
      actor: 'Mira → Imani',
      title: 'The thesis spreads through conversation',
      detail: 'Imani combines the macro view with weakening price momentum.',
    },
    {
      id: 'evt-intent-05',
      time: '09:31:34',
      kind: 'intent',
      actor: 'Imani Brooks',
      title: 'SELL 120 ACME @ 40.02',
      detail: 'The BDI layer emits a structured limit-order intent.',
    },
    {
      id: 'evt-risk-06',
      time: '09:31:35',
      kind: 'risk',
      actor: 'Risk engine',
      title: 'Intent accepted',
      detail: 'Order notional is 4.8% of NAV and remains inside concentration limits.',
    },
    {
      id: 'evt-chain-07',
      time: '09:31:43',
      kind: 'chain',
      actor: 'Injective Testnet',
      title: 'Scenario order confirmed',
      detail: 'The replay closes only after a chain fill; preview data is illustrative.',
      proof: '0x71…a9c · preview',
    },
  ],
};

export function mergeLiveDashboard(value: any): TradeTownDashboard {
  if (!value?.config || value.markets?.length === 0) {
    return previewDashboard;
  }
  const marketsBySymbol = new Map(value.markets.map((market: any) => [market.symbol, market]));
  return {
    ...previewDashboard,
    source: value.source,
    gatewayStatus: value.config.gatewayStatus,
    blockHeight: value.config.lastChainHeight,
    operatorAddress: value.config.operatorAddress,
    markets: previewDashboard.markets.map((preview) => {
      const live = marketsBySymbol.get(preview.symbol) as any;
      return live
        ? {
            ...preview,
            status: live.status,
            lastPrice: live.lastPrice ?? preview.lastPrice,
            change24h: live.change24h ?? preview.change24h,
            volume24h: live.volume24h ?? preview.volume24h,
          }
        : preview;
    }),
    traders:
      value.traders?.length > 0
        ? previewDashboard.traders.map((preview) => {
            const live = value.traders.find((trader: any) => trader.agentName === preview.name);
            return live
              ? {
                  ...preview,
                  role: live.role,
                  style: live.style,
                  riskTolerance: live.riskTolerance,
                  subaccountNonce: live.subaccountNonce,
                }
              : preview;
          })
        : previewDashboard.traders,
    events:
      value.events?.length > 0
        ? value.events.map((event: any) => ({
            id: event.eventId,
            time: new Date(event.occurredAt).toLocaleTimeString('en-GB', { hour12: false }),
            kind: event.kind === 'fill' || event.kind === 'order' ? 'chain' : event.kind,
            actor: event.source,
            title: event.headline,
            detail: event.summary,
            proof: event.txHash
              ? `${event.txHash.slice(0, 6)}…${event.txHash.slice(-3)}`
              : undefined,
          }))
        : previewDashboard.events,
  };
}
