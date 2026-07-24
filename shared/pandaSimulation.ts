import { assessTradeRisk, TOWN_TRADERS } from './finance';
import type {
  CausalEvent,
  DashboardError,
  DashboardExecution,
  DashboardMarket,
  DashboardTrader,
  SocialActivity,
  TownSummary,
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
  trendScore: number;
  compositeScore: number;
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

const AGENT_RULES: Record<string, AgentRule> = {
  'Mira Chen': {
    multiplier: 0.55,
    bias: -0.08,
    orderScale: 1,
    interpretation: 'requires macro confirmation before following a price-only signal',
  },
  'Theo Grant': {
    multiplier: -0.5,
    bias: 0.02,
    orderScale: 1,
    interpretation: 'treats price strength without valuation evidence as inconclusive',
  },
  'Imani Brooks': {
    multiplier: 1.6,
    bias: 0.05,
    orderScale: 2.4,
    interpretation: 'amplifies confirmed price momentum and above-average volume',
  },
  'Sora Vale': {
    multiplier: 0.8,
    bias: 0,
    orderScale: 1,
    interpretation: 'accepts the market snapshot but discounts unsupported narratives',
  },
  'Omar Reyes': {
    multiplier: 0.15,
    bias: -0.02,
    orderScale: 1,
    interpretation: 'assigns low weight to an out-of-domain company signal',
  },
  'Lin Park': {
    multiplier: -1.1,
    bias: -0.02,
    orderScale: 1,
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
    orderScale: 1,
    interpretation:
      'observes the move but avoids directional exposure without manipulation evidence',
  },
};

export function buildPandaSimulationRun(market: DashboardMarket): PandaSimulationRun {
  const features = deriveFeatures(market);
  const runId = `panda-${market.symbol.replace(/[^a-z0-9]/gi, '-')}-${features.date}-${RUN_SEED}`;
  const executions: DashboardExecution[] = [];

  const traders = TOWN_TRADERS.filter((profile) => profile.kind === 'ai').map((profile, index) => {
    const rule = AGENT_RULES[profile.name];
    if (!rule) {
      throw new Error(`Missing Panda simulation rule for ${profile.name}.`);
    }

    const score = clamp(features.compositeScore * rule.multiplier + rule.bias, -1, 1);
    const action = score > 0.12 ? 'BUY' : score < -0.12 ? 'SELL' : 'HOLD';
    const confidence = round(clamp(0.52 + Math.abs(score) * 1.2, 0.52, 0.92), 3);
    const navStart = 100_000;
    const initialWeight = 0.18 + index * 0.015;
    const initialQuantity = Math.floor((navStart * initialWeight) / market.referencePrice);
    const initialCash = navStart - initialQuantity * market.referencePrice;
    const averagePrice = market.referencePrice * (0.985 + (index % 4) * 0.008);
    const requestedRatio =
      action === 'HOLD' ? 0 : clamp((0.035 + Math.abs(score) * 0.18) * rule.orderScale, 0.01, 0.25);
    const requestedQuantity =
      action === 'HOLD'
        ? 0
        : Math.max(1, Math.floor((navStart * requestedRatio) / market.lastPrice));
    const side = action === 'SELL' ? 'sell' : 'buy';
    const risk =
      action === 'HOLD'
        ? null
        : assessTradeRisk({
            side,
            quantity: requestedQuantity,
            limitPrice: market.lastPrice,
            cash: initialCash,
            currentPosition: initialQuantity,
            netAssetValue: navStart,
            maxOrderNavRatio: 0.04 + profile.riskTolerance * 0.08,
            maxPositionNavRatio: 0.28 + profile.riskTolerance * 0.15,
          });

    let endQuantity = initialQuantity;
    let endCash = initialCash;
    let endAveragePrice = averagePrice;
    let riskRejections = 0;
    let orderCount = 0;
    let tradeCount = 0;

    if (action !== 'HOLD' && risk) {
      orderCount = 1;
      const orderId = `${runId}-order-${index + 1}`;
      if (!risk.accepted) {
        riskRejections = 1;
        executions.push({
          id: orderId,
          time: clock(12 + index),
          agentName: profile.name,
          symbol: market.symbol,
          type: 'risk_rejected',
          side: action,
          quantity: requestedQuantity,
          price: market.lastPrice,
          priceUnit: 'CNY',
          state: 'REJECTED',
          isSimulated: true,
          reference: `sim:${orderId}`,
          reason: risk.reason,
        });
      } else {
        executions.push({
          id: orderId,
          time: clock(12 + index),
          agentName: profile.name,
          symbol: market.symbol,
          type: 'order',
          side: action,
          quantity: requestedQuantity,
          price: market.lastPrice,
          priceUnit: 'CNY',
          state: 'ACCEPTED',
          isSimulated: true,
          reference: `sim:${orderId}`,
        });

        tradeCount = 1;
        if (action === 'BUY') {
          endCash -= requestedQuantity * market.lastPrice;
          endAveragePrice =
            (initialQuantity * averagePrice + requestedQuantity * market.lastPrice) /
            (initialQuantity + requestedQuantity);
          endQuantity += requestedQuantity;
        } else {
          endCash += requestedQuantity * market.lastPrice;
          endQuantity -= requestedQuantity;
        }

        executions.push({
          id: `${runId}-fill-${index + 1}`,
          time: clock(20 + index),
          agentName: profile.name,
          symbol: market.symbol,
          type: 'fill',
          side: action,
          quantity: requestedQuantity,
          price: market.lastPrice,
          priceUnit: 'CNY',
          state: 'FILLED',
          isSimulated: true,
          reference: `sim:${runId}:fill:${index + 1}`,
        });
      }
    }

    const navEnd = endCash + endQuantity * market.lastPrice;
    const pnl = navEnd - navStart;
    const positionValue = endQuantity * market.lastPrice;
    const evidence = [
      `PANDA:daily_bars:${market.symbol}:${features.date}`,
      `close=${market.lastPrice.toFixed(2)} preClose=${market.referencePrice.toFixed(2)} dayReturn=${features.dayReturn.toFixed(2)}%`,
      `MA20=${features.ma20.toFixed(2)} RSI14=${features.rsi14.toFixed(1)} VOL20=${features.volatility20.toFixed(1)}%`,
      `rule:${profile.name}:${rule.multiplier.toFixed(2)}:${rule.bias.toFixed(2)}`,
    ];
    const decisionOutcome =
      action === 'HOLD'
        ? 'does not clear this profile’s decision threshold'
        : risk?.accepted
          ? `produces a risk-approved simulated ${action} intent`
          : `produces a ${action} intent that the deterministic risk layer rejects`;

    return {
      ...profile,
      focusSymbols: [market.symbol],
      currency: 'CNY',
      pnl: round(pnl, 2),
      activity:
        action === 'HOLD'
          ? `Holding after ${features.date} Panda close`
          : risk?.accepted
            ? `Simulated ${action} filled from Panda close`
            : `Simulated ${action} blocked by risk`,
      action,
      confidence,
      beliefBefore: `${market.displayName} previously closed at ${market.referencePrice.toFixed(
        2,
      )}; no new position change was assumed before the Panda snapshot.`,
      beliefAfter: `${profile.name} ${rule.interpretation}; the composite signal ${decisionOutcome}.`,
      thesis: `${market.displayName} closed ${features.dayReturn >= 0 ? 'up' : 'down'} ${Math.abs(
        features.dayReturn,
      ).toFixed(2)}% at ${market.lastPrice.toFixed(2)}, versus MA20 ${features.ma20.toFixed(
        2,
      )}. This is a deterministic replay decision, not investment advice.`,
      evidence,
      navStart,
      navEnd: round(navEnd, 2),
      cash: round(endCash, 2),
      positions:
        endQuantity > 0
          ? [
              {
                symbol: market.symbol,
                quantity: endQuantity,
                weightPct: round((positionValue / navEnd) * 100, 1),
                pnl: round(endQuantity * (market.lastPrice - endAveragePrice), 2),
              },
            ]
          : [],
      riskRejections,
      orderCount,
      tradeCount,
    } satisfies DashboardTrader;
  });

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

  const filled = executions.filter((execution) => execution.type === 'fill');
  const rejected = executions.filter((execution) => execution.type === 'risk_rejected');
  const topTrader = [...traders].sort((left, right) => right.pnl - left.pnl)[0];
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
      filled.reduce((sum, execution) => sum + execution.quantity * execution.price, 0),
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
    events: buildEvents(runId, market, features, traders, filled, rejected),
    social: buildSocial(runId, market, features, traders),
    summary,
    errors: [],
  };
}

function deriveFeatures(market: DashboardMarket): MarketFeatures {
  const latest = market.candles[market.candles.length - 1];
  const closes = market.candles.slice(-20).map((candle) => candle.close);
  const ma20 = mean(closes);
  const rsi14 = numberIndicator(market, 'RSI14');
  const volatility20 = numberIndicator(market, 'VOL20');
  const dayReturn = market.changePct;
  const trendScore = clamp((market.lastPrice / ma20 - 1) * 10, -1, 1);
  const rsiScore = clamp((rsi14 - 50) / 50, -1, 1);
  const dayScore = clamp(dayReturn / 10, -1, 1);
  const volumeAverage = mean(market.candles.slice(-21, -1).map((candle) => candle.volume));
  const volumeScore = clamp(latest.volume / Math.max(1, volumeAverage) - 1, -1, 1);
  const compositeScore = trendScore * 0.45 + dayScore * 0.2 + rsiScore * 0.2 + volumeScore * 0.15;

  return {
    date: new Date(latest.time * 1000).toISOString().slice(0, 10).replaceAll('-', ''),
    dayReturn,
    ma20,
    rsi14,
    volatility20,
    trendScore,
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

  return [
    {
      id: `${runId}-market`,
      time: '15:00:00',
      kind: 'news',
      actor: 'Panda Data',
      title: `${market.symbol} historical close loaded`,
      detail: `${market.displayName} closed at ${market.lastPrice.toFixed(2)}, ${signed(
        features.dayReturn,
      )}% versus the adjusted previous close.`,
      proof: `PANDA:daily_bars:${market.symbol}:${features.date}`,
    },
    {
      id: `${runId}-indicators`,
      time: '15:00:02',
      kind: 'belief',
      actor: 'Deterministic indicator engine',
      title: 'Market features derived from Panda bars',
      detail: `MA20 ${features.ma20.toFixed(2)}, RSI14 ${features.rsi14.toFixed(
        1,
      )}, VOL20 ${features.volatility20.toFixed(1)}%.`,
      proof: `run:${runId}`,
    },
    {
      id: `${runId}-decisions`,
      time: '15:00:05',
      kind: 'intent',
      actor: 'Eight town agents',
      title: 'Structured decisions generated',
      detail: `${buyCount} BUY, ${sellCount} SELL and ${holdCount} HOLD decisions share the same Panda snapshot.`,
      proof: `run:${runId}:decisions`,
    },
    {
      id: `${runId}-social`,
      time: '15:00:08',
      kind: 'interaction',
      actor: 'Town social layer',
      title: 'Momentum and contrarian views exchanged',
      detail:
        'The social record preserves disagreement without changing the confirmed market bars.',
      proof: `run:${runId}:social`,
    },
    {
      id: `${runId}-risk`,
      time: '15:00:12',
      kind: 'risk',
      actor: 'Deterministic risk engine',
      title: `${rejected.length} simulated intent(s) rejected`,
      detail: 'Cash, order-size and concentration limits were evaluated before any simulated fill.',
      proof: `run:${runId}:risk`,
    },
    {
      id: `${runId}-fills`,
      time: '15:00:20',
      kind: 'chain',
      actor: 'Panda replay simulator',
      title: `${fills.length} simulated fill(s) applied`,
      detail:
        'Portfolio snapshots were recomputed from accepted simulated fills; no real A-share order was submitted.',
      proof: `sim:${runId}`,
    },
  ];
}

function buildSocial(
  runId: string,
  market: DashboardMarket,
  features: MarketFeatures,
  traders: DashboardTrader[],
): SocialActivity[] {
  const momentum = traders.find((trader) => trader.name === 'Imani Brooks')!;
  const contrarian = traders.find((trader) => trader.name === 'Lin Park')!;
  const supervisor = traders.find((trader) => trader.name === 'Neha Rao')!;

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
    {
      id: `${runId}-social-4`,
      time: '15:00:11',
      actor: supervisor.name,
      type: 'graph',
      title: 'Evidence boundary attached',
      detail:
        'Panda bars are factual inputs; every belief, social interaction and order remains simulated.',
      impact: `run:${runId}`,
    },
  ];
}

function numberIndicator(market: DashboardMarket, label: string) {
  const indicator = market.indicators.find((item) => item.label === label);
  const parsed = Number.parseFloat(indicator?.value ?? '');
  if (!Number.isFinite(parsed)) {
    throw new Error(`Panda simulation requires numeric ${label}.`);
  }
  return parsed;
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
