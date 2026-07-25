export type TownBootstrapAgent = {
  agent_id: string;
  display_name: string;
};

export type TownBootstrap = {
  run_id: string;
  trading_days: string[];
  symbols: Array<{ symbol: string; name?: string }>;
  agents: TownBootstrapAgent[];
};

export type TownProgress = {
  status: string;
  completed_trading_days?: number;
  completed_days?: number;
  expected_trading_days?: number;
  total_days?: number;
};

export type TownMarketBar = {
  symbol: string;
  name?: string;
  date: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  pre_close: string | number;
  volume: string | number;
  daily_return?: string | number;
  sma_20?: string | number | null;
  rsi_14?: string | number | null;
  volatility_20?: string | number | null;
  tradable?: boolean;
  trade_status?: number;
  consensus?: {
    label?: string;
    score?: number;
    dispersion?: number;
    buy_count?: number;
    sell_count?: number;
    hold_count?: number;
  } | null;
};

export type TownView = {
  symbol: string;
  direction?: number;
  confidence?: number;
  exposure?: number;
  rationale?: string;
};

export type TownPosition = {
  symbol: string;
  quantity: string | number;
  average_entry: string | number;
  mark_price: string | number;
  unrealized_pnl: string | number;
};

export type TownCitizen = {
  agent_id: string;
  display_name?: string;
  role?: string;
  strategy?: string;
  belief_before?: { belief_text?: string; belief_score?: number };
  belief_after?: {
    belief_text?: string;
    belief_score?: number;
    memory_summary?: string;
    status?: string;
  };
  views?: TownView[];
  account?: {
    balance?: string | number;
    equity?: string | number;
    realized_pnl?: string | number;
    unrealized_pnl?: string | number;
  } | null;
  positions?: TownPosition[];
  risk_rejections?: number;
  order_count?: number;
  fill_count?: number;
};

export type TownTransaction = {
  intent_id: string;
  account_id: string;
  agent_name?: string;
  symbol: string;
  side: string;
  quantity: string | number;
  state?: string;
  risk?: { status?: string; reason?: string };
  fill?: {
    price?: string | number;
    quantity?: string | number;
    simulation_label?: string;
  } | null;
  simulation_label?: string;
};

export type TownPost = {
  post_id: string;
  agent_id: string;
  content: string;
  post_type?: string;
};

export type TownGameDay = {
  run_id: string;
  trade_date: string;
  market_board: TownMarketBar[];
  citizens: TownCitizen[];
  transactions: TownTransaction[];
  social: { posts: TownPost[] };
  scoreboard?: {
    aum?: string | number;
    gross_exposure?: string | number;
    realized_pnl?: string | number;
    unrealized_pnl?: string | number;
  };
  errors?: Array<{ agent_id?: string; status?: string; error?: string }>;
};

export type TranslationMap = Record<string, string>;

export type ReplayTransaction = {
  intentId: string;
  agentName: string;
  subaccountNonce: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  limitPrice?: number;
  rationale: string;
  state: 'proposed' | 'risk_rejected' | 'queued' | 'confirmed' | 'cancelled' | 'failed';
  riskCode?: string;
};

export type ReplayEvent = {
  eventId: string;
  kind: 'news' | 'conversation' | 'belief' | 'intent' | 'risk';
  source: string;
  headline: string;
  summary: string;
  severity: number;
  symbols: string[];
  occurredAt: number;
};

export type ReplayMessage = {
  conversationId: string;
  messageUuid: string;
  authorName: string;
  recipientName: string;
  text: string;
  occurredAt: number;
};

export type ReplayDayPayload = {
  sessionId: string;
  runId: string;
  tradeDate: string;
  dayIndex: number;
  totalDays: number;
  sourceHash: string;
  translationMode: 'llm' | 'already_english';
  translationSourceHash: string;
  translationContentHash: string;
  translationCacheVersion: 2;
  translationBatchCount: number;
  translationItemCount: number;
  snapshotJson: string;
  publishedAt: number;
  transactions: ReplayTransaction[];
  events: ReplayEvent[];
  messages: ReplayMessage[];
};
