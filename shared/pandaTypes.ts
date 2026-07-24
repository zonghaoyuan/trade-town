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
