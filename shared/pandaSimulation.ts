import {
  assessTradeRisk,
  DEFAULT_INITIAL_AGENT_NAV,
  TOWN_TRADERS,
  type TraderProfileSeed,
} from './finance';
import type {
  CausalEvent,
  DashboardError,
  DashboardExecution,
  DashboardMarket,
  DashboardTrader,
  SocialActivity,
  TownSummary,
  TradeAction,
} from './pandaTypes';

type AgentRule = {
  multiplier: number;
  bias: number;
  orderScale: number;
  interpretation: string;
};

type MarketFeatures = {
  date: string;
  dayReturn: number;
  ma20: number;
  rsi14: number;
  volatility20: number;
  volumeRatio: number;
  compositeScore: number;
};

type AgentState = {
  profile: TraderProfileSeed;
  rule: AgentRule;
  cash: number;
  quantity: number;
  averagePrice: number;
  action: TradeAction;
  confidence: number;
  score: number;
  riskRejections: number;
  orderCount: number;
  tradeCount: number;
};

export type PandaSimulationRun = {
  runId: string;
  sentiment: NonNullable<DashboardMarket['sentiment']>;
  traders: DashboardTrader[];
  events: CausalEvent[];
  social: SocialActivity[];
  executions: DashboardExecution[];
  summary: TownSummary;
  errors: DashboardError[];
};

const RUN_SEED = 20260724;
const INITIAL_POSITION_RATIO = 0.2;

const AGENT_RULES: Record<string, AgentRule> = {
  'Mira Chen': {
    multiplier: 0.55,
    bias: -0.08,
    orderScale: 0.8,
    interpretation: 'requires macro confirmation before following a price-only signal',
  },
  'Theo Grant': {
    multiplier: -0.5,
    bias: 0.02,
    orderScale: 0.75,
    interpretation: 'leans toward value and mean reversion instead of short-term momentum',
  },
  'Imani Brooks': {
    multiplier: 1.6,
    bias: 0.05,
    orderScale: 1.45,
    interpretation: 'amplifies confirmed price momentum and above-average volume',
  },
  'Sora Vale': {
    multiplier: 0.8,
    bias: 0,
    orderScale: 0.9,
    interpretation: 'accepts the market snapshot but discounts unsupported narratives',
  },
  'Omar Reyes': {
    multiplier: 0.15,
    bias: -0.02,
    orderScale: 0.6,
    interpretation: 'assigns low weight to an out-of-domain company signal',
  },
  'Lin Park': {
    multiplier: -1.1,
    bias: -0.02,
    orderScale: 1.1,
    interpretation: 'leans against a crowded short-term momentum signal',
  },
  'Jules Hart': {
    multiplier: 0.95,
    bias: 0,
    orderScale: 1,
    interpretation: 'follows the trend only inside portfolio concentration limits',
  },
  'Neha Rao': {
    multiplier: 0.25,
    bias: -0.04,
    orderScale: 0.65,
    interpretation: 'observes the move but keeps directional exposure tightly bounded',
  },
};

/**
 * Replays every visible Panda daily bar in chronological order. No candle after
 * the supplied market snapshot can influence an agent decision or portfolio.
 */
export function buildPandaSimulationRun(market: DashboardMarket): PandaSimulationRun {
  if (market.candles.length === 0) {
    throw new Error(`Panda simulation requires at least one candle for ${market.symbol}.`);
  }

  const latestFeatures = deriveFeatures(market, market.candles.length - 1);
  const runId = `panda-${market.symbol.replace(/[^a-z0-9]/gi, '-')}-${latestFeatures.date}-${RUN_SEED}`;
  const firstPrice = market.candles[0].close;
  const initialQuantity = Math.floor(
    (DEFAULT_INITIAL_AGENT_NAV * INITIAL_POSITION_RATIO) / firstPrice,
  );
  const initialCash = DEFAULT_INITIAL_AGENT_NAV - initialQuantity * firstPrice;
  const executions: DashboardExecution[] = [];
  const states: AgentState[] = TOWN_TRADERS.filter((profile) => profile.kind === 'ai').map(
    (profile) => {
      const rule = AGENT_RULES[profile.name];
      if (!rule) throw new Error(`Missing Panda simulation rule for ${profile.name}.`);
      return {
        profile,
        rule,
        cash: initialCash,
        quantity: initialQuantity,
        averagePrice: firstPrice,
        action: 'HOLD',
        confidence: 0.52,
        score: 0,
        riskRejections: 0,
        orderCount: 0,
        tradeCount: 0,
      };
    },
  );

  for (let dayIndex = 1; dayIndex < market.candles.length; dayIndex += 1) {
    const candle = market.candles[dayIndex];
    const features = deriveFeatures(market, dayIndex);

    for (const [agentIndex, state] of states.entries()) {
      const navBefore = state.cash + state.quantity * candle.close;
      const score = clamp(
        features.compositeScore * state.rule.multiplier + state.rule.bias,
        -1,
        1,
      );
      const action: TradeAction = score > 0.12 ? 'BUY' : score < -0.12 ? 'SELL' : 'HOLD';
      const confidence = round(clamp(0.52 + Math.abs(score) * 1.2, 0.52, 0.92), 3);
      state.action = action;
      state.confidence = confidence;
      state.score = score;
      if (action === 'HOLD') continue;

      const requestedRatio = clamp(
        (0.012 + Math.abs(score) * 0.035) * state.rule.orderScale,
        0.006,
        0.065,
      );
      const unboundedQuantity = Math.max(
        1,
        Math.floor((navBefore * requestedRatio) / candle.close),
      );
      const requestedQuantity =
        action === 'SELL' ? Math.min(state.quantity, unboundedQuantity) : unboundedQuantity;
      if (requestedQuantity <= 0) {
        state.action = 'HOLD';
        continue;
      }

      const risk = assessTradeRisk({
        side: action === 'SELL' ? 'sell' : 'buy',
        quantity: requestedQuantity,
        limitPrice: candle.close,
        cash: state.cash,
        currentPosition: state.quantity,
        netAssetValue: navBefore,
        maxOrderNavRatio: 0.04 + state.profile.riskTolerance * 0.08,
        maxPositionNavRatio: 0.28 + state.profile.riskTolerance * 0.15,
      });
      const date = pandaDate(candle.time);
      const occurrenceBase = candle.time * 1000 + 7 * 60 * 60 * 1000;
      const executionKey = `${market.symbol}-${date}-${agentIndex + 1}`;
      state.orderCount += 1;

      if (!risk.accepted) {
        state.riskRejections += 1;
        executions.push({
          id: `${executionKey}-rejected`,
          time: clock(12 + agentIndex),
          occurredAt: occurrenceBase + (12 + agentIndex) * 1000,
          agentName: state.profile.name,
          symbol: market.symbol,
          type: 'risk_rejected',
          side: action,
          quantity: requestedQuantity,
          price: candle.close,
          priceUnit: market.quoteCurrency ?? 'CNY',
          state: 'REJECTED',
          isSimulated: true,
          reference: `paper:${executionKey}:rejected`,
          reason: risk.reason,
        });
        continue;
      }

      executions.push({
        id: `${executionKey}-order`,
        time: clock(12 + agentIndex),
        occurredAt: occurrenceBase + (12 + agentIndex) * 1000,
        agentName: state.profile.name,
        symbol: market.symbol,
        type: 'order',
        side: action,
        quantity: requestedQuantity,
        price: candle.close,
        priceUnit: market.quoteCurrency ?? 'CNY',
        state: 'ACCEPTED',
        isSimulated: true,
        reference: `paper:${executionKey}:order`,
      });

      if (action === 'BUY') {
        const previousCost = state.quantity * state.averagePrice;
        state.cash -= requestedQuantity * candle.close;
        state.quantity += requestedQuantity;
        state.averagePrice =
          (previousCost + requestedQuantity * candle.close) / state.quantity;
      } else {
        state.cash += requestedQuantity * candle.close;
        state.quantity -= requestedQuantity;
        if (state.quantity === 0) state.averagePrice = 0;
      }
      state.tradeCount += 1;

      executions.push({
        id: `${executionKey}-fill`,
        time: clock(20 + agentIndex),
        occurredAt: occurrenceBase + (20 + agentIndex) * 1000,
        agentName: state.profile.name,
        symbol: market.symbol,
        type: 'fill',
        side: action,
        quantity: requestedQuantity,
        price: candle.close,
        priceUnit: market.quoteCurrency ?? 'CNY',
        state: 'FILLED',
        isSimulated: true,
        reference: `paper:${executionKey}:fill`,
      });
    }
  }

  const traders = states.map((state) => buildTrader(state, market, latestFeatures));
  const buyCount = traders.filter((trader) => trader.action === 'BUY').length;
  const sellCount = traders.filter((trader) => trader.action === 'SELL').length;
  const holdCount = traders.length - buyCount - sellCount;
  const largestCamp = Math.max(buyCount, sellCount, holdCount);
  const sentiment: PandaSimulationRun['sentiment'] = {
    bulls: buyCount,
    bears: sellCount,
    holds: holdCount,
    consensus: round((largestCamp / traders.length) * 100, 0),
    divergence: round(100 - (largestCamp / traders.length) * 100, 0),
    camp:
      holdCount === largestCamp
        ? 'CAUTIOUS'
        : buyCount > sellCount
          ? 'BULLISH'
          : sellCount > buyCount
            ? 'BEARISH'
            : 'SPLIT',
  };

  const latestDate = pandaDate(market.candles[market.candles.length - 1].time);
  const latestExecutions = executions.filter((execution) =>
    execution.id.includes(`-${latestDate}-`),
  );
  const fills = executions.filter((execution) => execution.type === 'fill');
  const latestFills = latestExecutions.filter((execution) => execution.type === 'fill');
  const latestRejected = latestExecutions.filter(
    (execution) => execution.type === 'risk_rejected',
  );
  const topTrader = [...traders].sort((left, right) => right.navEnd - left.navEnd)[0];
  const summary: TownSummary = {
    aum: round(
      traders.reduce((sum, trader) => sum + trader.navEnd, 0),
      2,
    ),
    totalExposure: round(
      traders.reduce(
        (sum, trader) =>
          sum +
          trader.positions.reduce(
            (positionSum, position) => positionSum + position.quantity * market.lastPrice,
            0,
          ),
        0,
      ),
      2,
    ),
    volume: round(
      fills.reduce((sum, execution) => sum + execution.quantity * execution.price, 0),
      2,
    ),
    profitableAgents: traders.filter((trader) => trader.pnl > 0).length,
    topAgent: topTrader.name,
    topReturnPct: round((topTrader.pnl / topTrader.navStart) * 100, 2),
  };

  return {
    runId,
    sentiment,
    traders,
    executions,
    events: buildEvents(
      runId,
      market,
      latestFeatures,
      traders,
      latestFills,
      latestRejected,
    ),
    social: buildSocial(runId, market, latestFeatures, traders),
    summary,
    errors: [],
  };
}

function buildTrader(
  state: AgentState,
  market: DashboardMarket,
  features: MarketFeatures,
): DashboardTrader {
  const navEnd = state.cash + state.quantity * market.lastPrice;
  const positionValue = state.quantity * market.lastPrice;
  const pnl = navEnd - DEFAULT_INITIAL_AGENT_NAV;
  const actionOutcome =
    state.action === 'HOLD'
      ? 'does not clear this profile’s decision threshold'
      : `produces a simulated ${state.action} intent under deterministic risk limits`;

  return {
    ...state.profile,
    focusSymbols: [market.symbol],
    currency: market.quoteCurrency ?? 'CNY',
    pnl: round(pnl, 2),
    activity:
      state.action === 'HOLD'
        ? `Holding after ${features.date} Panda close`
        : `Latest signal: simulated ${state.action}`,
    action: state.action,
    confidence: state.confidence,
    beliefBefore: `${market.displayName} entered this replay day from the prior close; every agent originally received the same 1,000,000 CNY NAV and 20% model allocation.`,
    beliefAfter: `${state.profile.name} ${state.rule.interpretation}; the current composite signal ${actionOutcome}.`,
    thesis: `${market.displayName} closed ${features.dayReturn >= 0 ? 'up' : 'down'} ${Math.abs(
      features.dayReturn,
    ).toFixed(2)}% at ${market.lastPrice.toFixed(2)}, versus MA20 ${features.ma20.toFixed(
      2,
    )}. The portfolio reflects only Panda bars through this date.`,
    evidence: [
      `PANDA:daily_bars:${market.symbol}:${features.date}`,
      `close=${market.lastPrice.toFixed(2)} preClose=${market.referencePrice.toFixed(2)} dayReturn=${features.dayReturn.toFixed(2)}%`,
      `MA20=${features.ma20.toFixed(2)} RSI14=${features.rsi14.toFixed(1)} VOL20=${features.volatility20.toFixed(1)}%`,
      `rule:${state.profile.name}:${state.rule.multiplier.toFixed(2)}:${state.rule.bias.toFixed(2)}`,
    ],
    navStart: DEFAULT_INITIAL_AGENT_NAV,
    navEnd: round(navEnd, 2),
    cash: round(state.cash, 2),
    positions:
      state.quantity > 0
        ? [
            {
              symbol: market.symbol,
              quantity: state.quantity,
              weightPct: round((positionValue / navEnd) * 100, 1),
              pnl: round(
                state.quantity * (market.lastPrice - state.averagePrice),
                2,
              ),
            },
          ]
        : [],
    riskRejections: state.riskRejections,
    orderCount: state.orderCount,
    tradeCount: state.tradeCount,
  };
}

function deriveFeatures(market: DashboardMarket, dayIndex: number): MarketFeatures {
  const visible = market.candles.slice(0, dayIndex + 1);
  const latest = visible[visible.length - 1];
  const previous = visible[visible.length - 2];
  const reference = previous?.close ?? latest.open;
  const closes = visible.slice(-20).map((candle) => candle.close);
  const ma20 = mean(closes);
  const returns = visible
    .slice(-15)
    .map((candle, index, values) =>
      index === 0
        ? 0
        : values[index - 1].close === 0
          ? 0
          : candle.close / values[index - 1].close - 1,
    );
  const rsi14 = calculateRsi(returns.slice(1));
  const volatility20 = calculateVolatility(returns.slice(1));
  const dayReturn = reference === 0 ? 0 : (latest.close / reference - 1) * 100;
  const trendScore = clamp((latest.close / Math.max(ma20, 0.000001) - 1) * 10, -1, 1);
  const rsiScore = clamp((rsi14 - 50) / 50, -1, 1);
  const dayScore = clamp(dayReturn / 10, -1, 1);
  const previousVolumes = visible.slice(-21, -1).map((candle) => candle.volume);
  const volumeAverage = mean(previousVolumes.length > 0 ? previousVolumes : [latest.volume]);
  const volumeRatio = latest.volume / Math.max(1, volumeAverage);
  const volumeScore = clamp(volumeRatio - 1, -1, 1);
  const compositeScore = trendScore * 0.45 + dayScore * 0.2 + rsiScore * 0.2 + volumeScore * 0.15;

  return {
    date: pandaDate(latest.time).replaceAll('-', ''),
    dayReturn,
    ma20,
    rsi14,
    volatility20,
    volumeRatio,
    compositeScore,
  };
}

function buildEvents(
  runId: string,
  market: DashboardMarket,
  features: MarketFeatures,
  traders: DashboardTrader[],
  fills: DashboardExecution[],
  rejected: DashboardExecution[],
): CausalEvent[] {
  const buyCount = traders.filter((trader) => trader.action === 'BUY').length;
  const sellCount = traders.filter((trader) => trader.action === 'SELL').length;
  const holdCount = traders.length - buyCount - sellCount;
  const occurredAt = market.candles[market.candles.length - 1].time * 1000 + 7 * 60 * 60 * 1000;
  const events: CausalEvent[] = [
    {
      id: `${runId}-market`,
      time: '15:00:00',
      occurredAt,
      kind: 'news',
      actor: 'PandaAI dataset',
      title: `${market.symbol} historical daily bar replayed`,
      detail: `${market.displayName} closed at ${market.lastPrice.toFixed(2)}, ${signed(
        features.dayReturn,
      )}% versus the prior close.`,
      proof: `PANDA:daily_bars:${market.symbol}:${features.date}`,
    },
    {
      id: `${runId}-indicators`,
      time: '15:00:02',
      occurredAt: occurredAt + 2_000,
      kind: 'belief',
      actor: 'Deterministic indicator engine',
      title: 'Market features derived without future data',
      detail: `MA20 ${features.ma20.toFixed(2)}, RSI14 ${features.rsi14.toFixed(
        1,
      )}, VOL20 ${features.volatility20.toFixed(1)}%.`,
      proof: `run:${runId}`,
    },
    {
      id: `${runId}-decisions`,
      time: '15:00:05',
      occurredAt: occurredAt + 5_000,
      kind: 'intent',
      actor: 'Eight town agents',
      title: 'Daily decisions and portfolio marks updated',
      detail: `${buyCount} BUY, ${sellCount} SELL and ${holdCount} HOLD decisions share the same Panda cutoff date.`,
      proof: `run:${runId}:decisions`,
    },
    {
      id: `${runId}-risk`,
      time: '15:00:12',
      occurredAt: occurredAt + 12_000,
      kind: 'risk',
      actor: 'Deterministic risk engine',
      title: `${rejected.length} paper intent(s) rejected today`,
      detail: 'Cash, order-size and concentration limits were checked before each paper fill.',
      proof: `run:${runId}:risk`,
    },
    {
      id: `${runId}-fills`,
      time: '15:00:20',
      occurredAt: occurredAt + 20_000,
      kind: 'chain',
      actor: 'Panda replay simulator',
      title: `${fills.length} paper fill(s) applied today`,
      detail: 'Agent NAVs were recomputed from paper fills. No A-share or Injective order was submitted.',
      proof: `paper:${runId}`,
    },
  ];

  if (Math.abs(features.dayReturn) >= 3 || features.volumeRatio >= 1.8) {
    events.splice(1, 0, {
      id: `${runId}-anomaly`,
      time: '15:00:01',
      occurredAt: occurredAt + 1_000,
      kind: 'news',
      actor: 'Panda replay event detector',
      title: Math.abs(features.dayReturn) >= 3 ? 'Large daily move detected' : 'Volume spike detected',
      detail: `Computed event: return ${signed(features.dayReturn)}%, volume ${features.volumeRatio.toFixed(
        2,
      )}× the trailing average.`,
      proof: `computed:${market.symbol}:${features.date}`,
    });
  }
  return events;
}

function buildSocial(
  runId: string,
  market: DashboardMarket,
  features: MarketFeatures,
  traders: DashboardTrader[],
): SocialActivity[] {
  const momentum = traders.find((trader) => trader.name === 'Imani Brooks')!;
  const contrarian = traders.find((trader) => trader.name === 'Lin Park')!;
  return [
    {
      id: `${runId}-social-1`,
      time: '15:00:04',
      actor: 'Sora Vale',
      type: 'post',
      title: `${market.symbol} close summary published`,
      detail: `Close ${market.lastPrice.toFixed(2)}, ${signed(
        features.dayReturn,
      )}%, MA20 ${features.ma20.toFixed(2)}. Source: Panda daily bars.`,
      impact: '+8 agents reached',
    },
    {
      id: `${runId}-social-2`,
      time: '15:00:07',
      actor: momentum.name,
      type: 'repost',
      title: `Momentum interpretation: ${momentum.action}`,
      detail: momentum.beliefAfter,
      impact: `${Math.round(momentum.confidence * 100)}% confidence`,
    },
    {
      id: `${runId}-social-3`,
      time: '15:00:09',
      actor: contrarian.name,
      type: 'reply',
      title: `Contrarian interpretation: ${contrarian.action}`,
      detail: contrarian.beliefAfter,
      impact: 'disagreement preserved',
    },
  ];
}

function pandaDate(time: number) {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

function calculateRsi(returns: number[]) {
  if (returns.length === 0) return 50;
  const gains = returns.reduce((sum, value) => sum + Math.max(0, value), 0);
  const losses = returns.reduce((sum, value) => sum + Math.max(0, -value), 0);
  if (losses === 0) return gains === 0 ? 50 : 100;
  return 100 - 100 / (1 + gains / losses);
}

function calculateVolatility(returns: number[]) {
  if (returns.length < 2) return 0;
  const average = mean(returns);
  const variance =
    returns.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function clock(second: number) {
  return `15:00:${String(second).padStart(2, '0')}`;
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
