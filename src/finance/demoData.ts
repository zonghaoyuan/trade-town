import { TOWN_TRADERS } from '../../shared/finance';

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
  candles: DashboardCandle[];
  indicators: Array<{
    label: string;
    value: string;
    tone: Tone;
  }>;
  sentiment: {
    bulls: number;
    bears: number;
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

const pandaMarkets: DashboardMarket[] = [
  {
    symbol: 'ACME',
    displayName: 'Acme Industries',
    assetClass: 'company',
    lastPrice: 96.42,
    referencePrice: 100,
    changePct: -3.58,
    volume: 1_420_800,
    status: 'active',
    accent: '#ffb84d',
    candles: makeCandles([100.1, 100.8, 99.9, 99.2, 98.7, 99.1, 97.8, 97.2, 96.8, 96.42]),
    indicators: [
      { label: 'RSI', value: '37.8', tone: 'negative' },
      { label: 'MA20', value: '99.40', tone: 'negative' },
      { label: 'VOL', value: '2.4%', tone: 'neutral' },
    ],
    sentiment: { bulls: 2, bears: 5, consensus: 72, divergence: 38, camp: 'BEARISH' },
  },
  {
    symbol: 'NOVA',
    displayName: 'Nova Compute',
    assetClass: 'company',
    lastPrice: 83.91,
    referencePrice: 86.4,
    changePct: -2.88,
    volume: 982_400,
    status: 'active',
    accent: '#4fd1c5',
    candles: makeCandles([86.4, 87.1, 86.6, 86.9, 85.8, 85.1, 84.7, 84.3, 83.7, 83.91]),
    indicators: [
      { label: 'RSI', value: '42.6', tone: 'negative' },
      { label: 'MA20', value: '85.72', tone: 'negative' },
      { label: 'VOL', value: '1.9%', tone: 'neutral' },
    ],
    sentiment: { bulls: 3, bears: 4, consensus: 61, divergence: 46, camp: 'SPLIT' },
  },
  {
    symbol: 'LUMA',
    displayName: 'Luma Health',
    assetClass: 'company',
    lastPrice: 54.28,
    referencePrice: 52.9,
    changePct: 2.61,
    volume: 746_200,
    status: 'active',
    accent: '#8ccf5b',
    candles: makeCandles([52.9, 53.2, 52.8, 53.4, 53.1, 53.8, 54.2, 54.6, 54.1, 54.28]),
    indicators: [
      { label: 'RSI', value: '58.4', tone: 'positive' },
      { label: 'MA20', value: '53.51', tone: 'positive' },
      { label: 'VOL', value: '1.3%', tone: 'neutral' },
    ],
    sentiment: { bulls: 5, bears: 2, consensus: 68, divergence: 31, camp: 'BULLISH' },
  },
  {
    symbol: 'VELA',
    displayName: 'Vela Logistics',
    assetClass: 'company',
    lastPrice: 71.66,
    referencePrice: 72.1,
    changePct: -0.61,
    volume: 611_900,
    status: 'active',
    accent: '#7ab5ff',
    candles: makeCandles([72.1, 72.5, 72.2, 71.8, 72.4, 72.0, 71.7, 71.5, 71.9, 71.66]),
    indicators: [
      { label: 'RSI', value: '49.1', tone: 'neutral' },
      { label: 'MA20', value: '71.98', tone: 'neutral' },
      { label: 'VOL', value: '0.8%', tone: 'positive' },
    ],
    sentiment: { bulls: 3, bears: 3, consensus: 50, divergence: 57, camp: 'NEUTRAL' },
  },
  {
    symbol: 'FORGE',
    displayName: 'Forge Robotics',
    assetClass: 'company',
    lastPrice: 128.74,
    referencePrice: 124.2,
    changePct: 3.66,
    volume: 1_108_300,
    status: 'active',
    accent: '#f4d35e',
    candles: makeCandles([124.2, 124.9, 125.4, 124.8, 126.1, 126.8, 127.5, 128.2, 127.9, 128.74]),
    indicators: [
      { label: 'RSI', value: '64.2', tone: 'positive' },
      { label: 'MA20', value: '126.18', tone: 'positive' },
      { label: 'VOL', value: '2.1%', tone: 'neutral' },
    ],
    sentiment: { bulls: 6, bears: 1, consensus: 79, divergence: 24, camp: 'BULLISH' },
  },
];

const agentSnapshots: Array<
  Pick<
    DashboardTrader,
    | 'pnl'
    | 'activity'
    | 'action'
    | 'confidence'
    | 'beliefBefore'
    | 'beliefAfter'
    | 'thesis'
    | 'evidence'
    | 'navStart'
    | 'navEnd'
    | 'cash'
    | 'positions'
    | 'riskRejections'
    | 'orderCount'
    | 'tradeCount'
  >
> = [
  {
    pnl: 1420,
    activity: 'Revising ACME fair value',
    action: 'SELL',
    confidence: 0.82,
    beliefBefore: 'ACME refinancing risk is manageable.',
    beliefAfter: 'The rate shock materially weakens ACME coverage ratios.',
    thesis: 'Higher funding costs compress fair value before demand can recover.',
    evidence: ['rate-bulletin-01', 'acme-debt-note', 'post-sora-14'],
    navStart: 100_000,
    navEnd: 101_420,
    cash: 48_200,
    positions: [
      { symbol: 'ACME', quantity: 220, weightPct: 21, pnl: -580 },
      { symbol: 'LUMA', quantity: 410, weightPct: 22, pnl: 1220 },
    ],
    riskRejections: 0,
    orderCount: 3,
    tradeCount: 2,
  },
  {
    pnl: -310,
    activity: 'Reading the company filing',
    action: 'HOLD',
    confidence: 0.66,
    beliefBefore: 'ACME trades below long-run replacement value.',
    beliefAfter: 'The discount is attractive, but the catalyst is still missing.',
    thesis: 'Wait for balance-sheet confirmation before buying the panic.',
    evidence: ['acme-filing-07', 'post-mira-22'],
    navStart: 100_000,
    navEnd: 99_690,
    cash: 56_800,
    positions: [
      { symbol: 'ACME', quantity: 310, weightPct: 30, pnl: -890 },
      { symbol: 'VELA', quantity: 180, weightPct: 13, pnl: 580 },
    ],
    riskRejections: 1,
    orderCount: 1,
    tradeCount: 0,
  },
  {
    pnl: -1840,
    activity: 'Walking to the exchange',
    action: 'SELL',
    confidence: 0.74,
    beliefBefore: 'Price weakness may reverse with the broader market.',
    beliefAfter: 'Momentum and social confirmation now point lower.',
    thesis: 'The downside trend is accelerating after the rumor cascade.',
    evidence: ['price-signal-acme', 'reply-lin-08', 'post-rumor-03'],
    navStart: 100_000,
    navEnd: 98_160,
    cash: 62_400,
    positions: [
      { symbol: 'NOVA', quantity: 290, weightPct: 25, pnl: -1120 },
      { symbol: 'ACME', quantity: 130, weightPct: 13, pnl: -720 },
    ],
    riskRejections: 1,
    orderCount: 4,
    tradeCount: 3,
  },
  {
    pnl: 220,
    activity: 'Publishing a rate bulletin',
    action: 'HOLD',
    confidence: 0.91,
    beliefBefore: 'Policy risk is underpriced by the town.',
    beliefAfter: 'The confirmed rate shock is negative, but the default rumor is unverified.',
    thesis: 'Separate the verified macro shock from the unsupported solvency claim.',
    evidence: ['central-bank-brief', 'source-check-09'],
    navStart: 100_000,
    navEnd: 100_220,
    cash: 78_500,
    positions: [{ symbol: 'VELA', quantity: 300, weightPct: 21, pnl: 220 }],
    riskRejections: 0,
    orderCount: 0,
    tradeCount: 0,
  },
  {
    pnl: 980,
    activity: 'Rotating into defensive names',
    action: 'BUY',
    confidence: 0.69,
    beliefBefore: 'The shock will broadly weaken cyclical demand.',
    beliefAfter: 'LUMA has the cleanest defensive earnings profile.',
    thesis: 'Relative resilience matters more than headline direction.',
    evidence: ['sector-flow-11', 'luma-guidance'],
    navStart: 100_000,
    navEnd: 100_980,
    cash: 44_600,
    positions: [
      { symbol: 'LUMA', quantity: 620, weightPct: 33, pnl: 1340 },
      { symbol: 'FORGE', quantity: 170, weightPct: 22, pnl: -360 },
    ],
    riskRejections: 0,
    orderCount: 2,
    tradeCount: 2,
  },
  {
    pnl: 610,
    activity: 'Mapping the fear cascade',
    action: 'BUY',
    confidence: 0.63,
    beliefBefore: 'Crowd fear is elevated but still evidence-based.',
    beliefAfter: 'The rumor has pushed ACME sentiment beyond fundamentals.',
    thesis: 'A small contrarian position is justified after risk sizing.',
    evidence: ['social-graph-diff-03', 'consensus-acme', 'correction-draft'],
    navStart: 100_000,
    navEnd: 100_610,
    cash: 52_900,
    positions: [
      { symbol: 'ACME', quantity: 260, weightPct: 25, pnl: 260 },
      { symbol: 'FORGE', quantity: 170, weightPct: 22, pnl: 350 },
    ],
    riskRejections: 1,
    orderCount: 2,
    tradeCount: 1,
  },
  {
    pnl: -720,
    activity: 'Cutting portfolio beta',
    action: 'SELL',
    confidence: 0.77,
    beliefBefore: 'Diversification can absorb a modest policy surprise.',
    beliefAfter: 'Cross-asset correlation is rising faster than the risk budget allows.',
    thesis: 'Reduce ACME and NOVA exposure to restore the drawdown limit.',
    evidence: ['portfolio-stress-04', 'correlation-snapshot'],
    navStart: 100_000,
    navEnd: 99_280,
    cash: 58_300,
    positions: [
      { symbol: 'ACME', quantity: 180, weightPct: 17, pnl: -520 },
      { symbol: 'NOVA', quantity: 160, weightPct: 14, pnl: -200 },
    ],
    riskRejections: 2,
    orderCount: 4,
    tradeCount: 2,
  },
  {
    pnl: 0,
    activity: 'Monitoring order concentration',
    action: 'HOLD',
    confidence: 0.88,
    beliefBefore: 'Order flow remains within normal concentration bands.',
    beliefAfter: 'Sell intent is clustering around the same social source.',
    thesis: 'Pause new exposure while checking for coordinated behavior.',
    evidence: ['order-cluster-12', 'social-edge-rumor'],
    navStart: 100_000,
    navEnd: 100_000,
    cash: 100_000,
    positions: [],
    riskRejections: 2,
    orderCount: 0,
    tradeCount: 0,
  },
];

const pandaTraders: DashboardTrader[] = TOWN_TRADERS.slice(0, 8).map((trader, index) => ({
  ...trader,
  ...agentSnapshots[index],
}));

const marketMakers: DashboardTrader[] = TOWN_TRADERS.slice(8).map((trader) => ({
  ...trader,
  pnl: trader.name === 'Delta-7' ? 386 : 244,
  activity: trader.name === 'Delta-7' ? 'Quoting ACME · NOVA' : 'Quoting LUMA · FORGE',
  action: 'HOLD',
  confidence: 1,
  beliefBefore: 'Deterministic quoting policy active.',
  beliefAfter: 'Inventory skew remains inside limits.',
  thesis: 'Provide two-sided liquidity within the configured loss limit.',
  evidence: ['maker-policy-v1'],
  navStart: 100_000,
  navEnd: trader.name === 'Delta-7' ? 100_386 : 100_244,
  cash: 50_000,
  positions: [],
  riskRejections: 0,
  orderCount: 12,
  tradeCount: 5,
}));

const timelineEvents: CausalEvent[] = [
  {
    id: 'evt-policy-01',
    time: '09:30:00',
    kind: 'policy',
    actor: 'Town Central Bank',
    title: 'Policy rate raised by 100 bps',
    detail: 'The surprise decision tightens funding conditions across the town.',
  },
  {
    id: 'evt-post-02',
    time: '09:30:18',
    kind: 'post',
    actor: 'Sora Vale',
    title: 'Verified bulletin reaches the town',
    detail: 'Sora separates the confirmed rate shock from company-specific speculation.',
  },
  {
    id: 'evt-belief-03',
    time: '09:30:41',
    kind: 'belief',
    actor: 'Mira Chen',
    title: 'ACME belief turns bearish',
    detail: 'Fair value falls to 96.80 TOWNUSD with 82% confidence.',
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
    id: 'evt-risk-05',
    time: '09:31:35',
    kind: 'risk',
    actor: 'Risk engine',
    title: 'Jules order reduced by 42%',
    detail: 'The requested order exceeded the portfolio concentration limit.',
  },
  {
    id: 'evt-fill-06',
    time: '09:31:43',
    kind: 'chain',
    actor: 'Panda execution sim',
    title: 'Imani sell order filled',
    detail: 'The DayView records a simulated fill and portfolio update.',
    proof: 'sim_8f1d…c21a',
  },
];

const socialActivities: SocialActivity[] = [
  {
    id: 'social-01',
    time: '09:30:18',
    actor: 'Sora Vale',
    type: 'post',
    title: 'Rate bulletin published',
    detail: 'Verified policy news is shared with all eight residents.',
    impact: '+8 reached',
  },
  {
    id: 'social-02',
    time: '09:30:52',
    actor: 'Imani Brooks',
    type: 'repost',
    title: 'ACME stress thesis amplified',
    detail: 'The post adds an unverified claim about an imminent liquidity crisis.',
    impact: '+3 bearish',
  },
  {
    id: 'social-03',
    time: '09:31:06',
    actor: 'Lin Park',
    type: 'graph',
    title: 'Fear cluster forms',
    detail: 'Four new influence edges appear around the rumor source.',
    impact: '+4 edges',
  },
  {
    id: 'social-04',
    time: '09:31:29',
    actor: 'Neha Rao',
    type: 'reply',
    title: 'Source quality challenged',
    detail: 'A supervisor reply reduces confidence in the default rumor.',
    impact: '-11 consensus',
  },
];

const simulatedExecutions: DashboardExecution[] = [
  {
    id: 'exec-01',
    time: '09:31:32',
    agentName: 'Imani Brooks',
    symbol: 'ACME',
    type: 'order',
    side: 'SELL',
    quantity: 120,
    price: 97.02,
    state: 'FILLED',
    isSimulated: true,
    reference: 'sim_8f1d…c21a',
  },
  {
    id: 'exec-02',
    time: '09:31:35',
    agentName: 'Jules Hart',
    symbol: 'ACME',
    type: 'risk_rejected',
    side: 'SELL',
    quantity: 260,
    price: 96.88,
    state: 'RESIZED',
    isSimulated: true,
    reason: 'Concentration limit: order reduced to 150 ACME.',
  },
  {
    id: 'exec-03',
    time: '09:31:43',
    agentName: 'Mira Chen',
    symbol: 'ACME',
    type: 'fill',
    side: 'SELL',
    quantity: 80,
    price: 96.72,
    state: 'FILLED',
    isSimulated: true,
    reference: 'sim_2b90…78df',
  },
  {
    id: 'exec-04',
    time: '09:32:08',
    agentName: 'Omar Reyes',
    symbol: 'LUMA',
    type: 'fill',
    side: 'BUY',
    quantity: 140,
    price: 54.12,
    state: 'FILLED',
    isSimulated: true,
    reference: 'sim_64aa…50c1',
  },
];

export const pandaDayViewDashboard: TradeTownDashboard = {
  dataMode: 'panda_dayview',
  source: 'panda',
  sourceLabel: 'PANDA DAYVIEW · MOCK DATA',
  asOf: Date.UTC(2026, 6, 24, 9, 35, 0),
  gatewayStatus: 'read_only',
  markets: pandaMarkets,
  traders: pandaTraders,
  marketMakers,
  events: timelineEvents,
  social: socialActivities,
  executions: simulatedExecutions,
  summary: {
    aum: 800_350,
    totalExposure: 342_800,
    volume: 4_869_600,
    profitableAgents: 4,
    topAgent: 'Mira Chen',
    topReturnPct: 1.42,
  },
  errors: [
    {
      id: 'error-01',
      time: '09:30:26',
      scope: 'NOVA indicators',
      message: 'Factor service timed out; cached MA20 used.',
      recovered: true,
    },
    {
      id: 'error-02',
      time: '09:31:14',
      scope: 'Imani decision',
      message: 'First LLM response failed schema validation; retry succeeded.',
      recovered: true,
    },
  ],
};

export const injectivePreviewDashboard: TradeTownDashboard = {
  ...pandaDayViewDashboard,
  dataMode: 'injective_testnet',
  source: 'preview',
  sourceLabel: 'INJECTIVE TESTNET · PREVIEW',
  gatewayStatus: 'unconfigured',
  markets: pandaMarkets.filter((market) => market.symbol === 'ACME'),
  traders: pandaTraders.map((trader) => ({
    ...trader,
    pnl: 0,
    activity: 'Awaiting confirmed testnet state',
    action: 'HOLD',
    confidence: 0,
    beliefBefore: 'No chain-backed market observation yet.',
    beliefAfter: 'Waiting for the Injective gateway and confirmed fills.',
    thesis: 'Do not infer portfolio state from Panda simulation data.',
    evidence: ['injective-gateway-unconfigured'],
    navEnd: trader.navStart,
    cash: trader.navStart,
    positions: [],
    riskRejections: 0,
    orderCount: 0,
    tradeCount: 0,
  })),
  marketMakers,
  events: timelineEvents.slice(0, 4),
  social: socialActivities.slice(0, 2),
  executions: [],
  summary: {
    aum: 800_000,
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
            proof: event.txHash
              ? `${event.txHash.slice(0, 6)}…${event.txHash.slice(-3)}`
              : undefined,
          }))
        : injectivePreviewDashboard.events,
  };
}
