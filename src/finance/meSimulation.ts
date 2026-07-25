import {
  type CompiledMeProfile,
  type CreateMeDraft,
  compileMeProfile,
} from '../../shared/createMe';
import { assessTradeRisk } from '../../shared/finance';
import type {
  CausalEvent,
  DashboardExecution,
  DashboardMarket,
  DashboardTrader,
  SocialActivity,
  TownSummary,
} from '../../shared/pandaTypes';
import type { TradeTownDashboard } from './demoData';

export type MeSimulationInput = {
  draft: CreateMeDraft;
  textureUrl: string;
  version?: number;
};

type MeSimulationResult = {
  trader: DashboardTrader;
  executions: DashboardExecution[];
  events: CausalEvent[];
  social: SocialActivity[];
};

type MarketFeatures = {
  date: string;
  ma20: number;
  rsi14: number;
  volatility20: number;
  evidenceSignal: number;
  crowdSignal: number;
};

export function augmentDashboardWithMe(
  dashboard: TradeTownDashboard,
  me: MeSimulationInput | null | undefined,
  symbol: string,
): TradeTownDashboard {
  if (!me) return dashboard;
  const market = dashboard.markets.find((candidate) => candidate.symbol === symbol);
  if (!market) return dashboard;

  const result = buildMeSimulation(
    market,
    me,
    dashboard.traders.map((trader) => trader.name),
  );
  const traders = [...dashboard.traders.filter((trader) => !trader.isUser), result.trader];
  const executions = [
    ...dashboard.executions.filter(
      (execution) => execution.agentName !== result.trader.name,
    ),
    ...result.executions,
  ];
  const sentiment = summarizeSentiment(traders);

  return {
    ...dashboard,
    markets: dashboard.markets.map((candidate) =>
      candidate.symbol === symbol ? { ...candidate, sentiment } : candidate,
    ),
    traders,
    executions,
    events: [...dashboard.events, ...result.events],
    social: [...dashboard.social, ...result.social],
    summary: summarizeTown(traders, executions, dashboard.markets),
  };
}

export function buildMeSimulation(
  market: DashboardMarket,
  me: MeSimulationInput,
  reservedNames: readonly string[] = [],
): MeSimulationResult {
  const compiled = compileMeProfile(me.draft);
  const features = deriveFeatures(market);
  const name = getMeAgentName(me.draft.displayName, reservedNames);
  const score = decisionScore(me.draft, compiled, market, features);
  const threshold =
    compiled.tradeFrequency === 'high'
      ? 0.07
      : compiled.tradeFrequency === 'low'
        ? 0.17
        : 0.11;
  const action = score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'HOLD';
  const confidence = round(
    clamp(0.48 + Math.abs(score) * 0.72 + me.draft.conviction / 500, 0.5, 0.96),
    3,
  );
  const runKey = [
    'me',
    slug(name),
    market.symbol,
    features.date,
    me.version ?? 'local',
  ].join('-');
  const navStart = 100_000;
  const initialWeightPct = clamp(compiled.maxPositionPct * 0.45, 4, 13);
  const initialQuantity = Math.max(
    1,
    Math.floor((navStart * (initialWeightPct / 100)) / market.referencePrice),
  );
  const initialCash = navStart - initialQuantity * market.referencePrice;
  const requestedRatio = clamp(
    0.018 + Math.abs(score) * (0.035 + compiled.riskTolerance / 1_000),
    0.015,
    Math.min(0.1, compiled.maxPositionPct / 100 / 2),
  );
  const requestedQuantity =
    action === 'HOLD'
      ? 0
      : action === 'SELL'
        ? Math.min(
            initialQuantity,
            Math.max(1, Math.floor((navStart * requestedRatio) / market.lastPrice)),
          )
        : Math.max(1, Math.floor((navStart * requestedRatio) / market.lastPrice));
  const risk =
    action === 'HOLD'
      ? null
      : assessTradeRisk({
          side: action === 'SELL' ? 'sell' : 'buy',
          quantity: requestedQuantity,
          limitPrice: market.lastPrice,
          cash: initialCash,
          currentPosition: initialQuantity,
          netAssetValue: navStart,
          maxOrderNavRatio: Math.min(0.12, compiled.maxPositionPct / 100 / 2),
          maxPositionNavRatio: compiled.maxPositionPct / 100,
        });

  let endQuantity = initialQuantity;
  let endCash = initialCash;
  let endAveragePrice = market.referencePrice;
  let riskRejections = 0;
  let orderCount = 0;
  let tradeCount = 0;
  const executions: DashboardExecution[] = [];

  if (action !== 'HOLD' && risk) {
    orderCount = 1;
    const order: DashboardExecution = {
      id: `${runKey}-order`,
      time: '15:00:14',
      agentName: name,
      symbol: market.symbol,
      type: risk.accepted ? 'order' : 'risk_rejected',
      side: action,
      quantity: requestedQuantity,
      price: market.lastPrice,
      priceUnit: market.quoteCurrency ?? 'CNY',
      state: risk.accepted ? 'ACCEPTED' : 'REJECTED',
      isSimulated: true,
      reference: `sim:${runKey}:order`,
      reason: risk.accepted ? undefined : risk.reason,
    };
    executions.push(order);

    if (risk.accepted) {
      tradeCount = 1;
      if (action === 'BUY') {
        endCash -= requestedQuantity * market.lastPrice;
        endAveragePrice =
          (initialQuantity * market.referencePrice + requestedQuantity * market.lastPrice) /
          (initialQuantity + requestedQuantity);
        endQuantity += requestedQuantity;
      } else {
        endCash += requestedQuantity * market.lastPrice;
        endQuantity -= requestedQuantity;
      }
      executions.push({
        ...order,
        id: `${runKey}-fill`,
        time: '15:00:22',
        type: 'fill',
        state: 'FILLED',
        reference: `sim:${runKey}:fill`,
      });
    } else {
      riskRejections = 1;
    }
  }

  const navEnd = endCash + endQuantity * market.lastPrice;
  const positionValue = endQuantity * market.lastPrice;
  const pnl = navEnd - navStart;
  const actionOutcome =
    action === 'HOLD'
      ? 'held because the combined evidence did not clear the profile threshold'
      : risk?.accepted
        ? `completed a simulated ${action} fill inside the configured limits`
        : `proposed ${action}, but the deterministic risk layer rejected it`;
  const currency = market.quoteCurrency ?? 'CNY';
  const trader: DashboardTrader = {
    name,
    kind: 'ai',
    isUser: true,
    avatarUrl: me.textureUrl,
    role: 'User financial digital twin',
    style: `${compiled.decisionStyle}; ${compiled.tradeFrequency}-frequency; ${compiled.holdingPeriodDays}-day horizon.`,
    riskTolerance: compiled.riskTolerance / 100,
    subaccountNonce: 11,
    focusSymbols: [market.symbol],
    currency,
    pnl: round(pnl, 2),
    activity:
      action === 'HOLD'
        ? `Simulated HOLD after ${features.date} Panda close`
        : risk?.accepted
          ? `Simulated ${action} filled from user profile`
          : `Simulated ${action} blocked by user risk limits`,
    action,
    confidence,
    beliefBefore: `${name} began with a ${initialWeightPct.toFixed(
      1,
    )}% model allocation and ${compiled.cashBufferPct}% target cash buffer.`,
    beliefAfter: `${name} weighted sourced price evidence and town consensus using the saved Create ME profile, then ${actionOutcome}.`,
    thesis: `${market.displayName} closed ${market.changePct >= 0 ? 'up' : 'down'} ${Math.abs(
      market.changePct,
    ).toFixed(2)}%. The ME score was ${score.toFixed(
      3,
    )}, with social signals weighted ${compiled.socialSignalWeight}/100. This is a deterministic simulation, not investment advice.`,
    evidence: [
      `PANDA:daily_bars:${market.symbol}:${features.date}`,
      `profile:me:v${me.version ?? 'local'}`,
      `riskTolerance=${compiled.riskTolerance} maxPosition=${compiled.maxPositionPct}% cashBuffer=${compiled.cashBufferPct}%`,
      `MA20=${features.ma20.toFixed(2)} RSI14=${features.rsi14.toFixed(
        1,
      )} VOL20=${features.volatility20.toFixed(1)}%`,
    ],
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
  };

  const events: CausalEvent[] = [
    {
      id: `${runKey}-belief`,
      time: '15:00:13',
      kind: 'belief',
      actor: name,
      title: 'ME profile generated a market belief',
      detail: trader.beliefAfter,
      proof: `profile:me:v${me.version ?? 'local'}`,
    },
    {
      id: `${runKey}-decision`,
      time: risk?.accepted ? '15:00:22' : '15:00:14',
      kind: risk?.accepted ? 'intent' : action === 'HOLD' ? 'belief' : 'risk',
      actor: name,
      title:
        action === 'HOLD'
          ? 'ME retained its model position'
          : risk?.accepted
            ? `ME simulated ${action} and updated its portfolio`
            : `ME ${action} intent was blocked`,
      detail: trader.activity,
      proof: risk?.accepted ? `sim:${runKey}` : `profile:me:v${me.version ?? 'local'}`,
    },
  ];
  const social: SocialActivity[] = [
    {
      id: `${runKey}-social`,
      time: '15:00:12',
      actor: name,
      type: 'post',
      title: `${market.symbol} user-Agent view: ${action}`,
      detail: trader.thesis,
      impact: `${Math.round(confidence * 100)}% confidence · simulated`,
    },
  ];

  return { trader, executions, events, social };
}

export function getMeAgentName(displayName: string, reservedNames: readonly string[]) {
  const base = displayName.trim().slice(0, 20) || 'ME';
  return reservedNames.includes(base) ? `${base} · ME` : base;
}

function decisionScore(
  draft: CreateMeDraft,
  compiled: CompiledMeProfile,
  market: DashboardMarket,
  features: MarketFeatures,
) {
  const evidenceWeight = 0.72 + draft.conviction / 500;
  const socialWeight = compiled.socialSignalWeight / 100;
  let score =
    features.evidenceSignal * evidenceWeight +
    features.crowdSignal * socialWeight * 0.32;

  if (market.changePct < 0 && draft.scenarios.includes('market_crash')) {
    score +=
      draft.scenarioAnswers.market_crash === 'aggressive'
        ? 0.14
        : draft.scenarioAnswers.market_crash === 'cautious'
          ? -0.14
          : -0.04;
  }
  if (market.changePct > 0 && draft.scenarios.includes('missed_rally')) {
    score +=
      draft.scenarioAnswers.missed_rally === 'aggressive'
        ? 0.12
        : draft.scenarioAnswers.missed_rally === 'cautious'
          ? -0.1
          : 0.02;
  }
  if (draft.scenarios.includes('thesis_challenged')) {
    score *=
      draft.scenarioAnswers.thesis_challenged === 'aggressive'
        ? 1.12
        : draft.scenarioAnswers.thesis_challenged === 'cautious'
          ? 0.72
          : 0.9;
  }

  const volatilityPenalty =
    clamp(features.volatility20 / 100, 0, 0.5) * (draft.lossAversion / 100) * 0.25;
  score -= Math.sign(score || market.changePct) * volatilityPenalty;
  return clamp(score, -1, 1);
}

function deriveFeatures(market: DashboardMarket): MarketFeatures {
  const latest = market.candles[market.candles.length - 1];
  const closes = market.candles.slice(-20).map((candle) => candle.close);
  const ma20 = mean(closes.length > 0 ? closes : [market.referencePrice]);
  const rsi14 = numberIndicator(market, 'RSI14', 50);
  const volatility20 = numberIndicator(market, 'VOL20', 0);
  const trendScore = clamp((market.lastPrice / Math.max(ma20, 0.000001) - 1) * 10, -1, 1);
  const dayScore = clamp(market.changePct / 10, -1, 1);
  const rsiScore = clamp((rsi14 - 50) / 50, -1, 1);
  const evidenceSignal = trendScore * 0.5 + dayScore * 0.3 + rsiScore * 0.2;
  const sentiment = market.sentiment;
  const sentimentTotal = sentiment
    ? sentiment.bulls + sentiment.bears + (sentiment.holds ?? 0)
    : 0;
  const crowdSignal =
    sentiment && sentimentTotal > 0
      ? (sentiment.bulls - sentiment.bears) / sentimentTotal
      : 0;

  return {
    date: new Date((latest?.time ?? 0) * 1000).toISOString().slice(0, 10).replaceAll('-', ''),
    ma20,
    rsi14,
    volatility20,
    evidenceSignal,
    crowdSignal,
  };
}

function summarizeSentiment(traders: DashboardTrader[]) {
  const bulls = traders.filter((trader) => trader.action === 'BUY').length;
  const bears = traders.filter((trader) => trader.action === 'SELL').length;
  const holds = traders.length - bulls - bears;
  const largestCamp = Math.max(bulls, bears, holds);
  const consensus = round((largestCamp / Math.max(1, traders.length)) * 100, 0);
  return {
    bulls,
    bears,
    holds,
    consensus,
    divergence: 100 - consensus,
    camp:
      holds === largestCamp
        ? 'CAUTIOUS'
        : bulls > bears
          ? 'BULLISH'
          : bears > bulls
            ? 'BEARISH'
            : 'SPLIT',
  };
}

function summarizeTown(
  traders: DashboardTrader[],
  executions: DashboardExecution[],
  markets: DashboardMarket[],
): TownSummary {
  const fills = executions.filter((execution) => execution.type === 'fill');
  const topTrader = [...traders].sort((left, right) => right.pnl - left.pnl)[0];
  return {
    aum: round(
      traders.reduce((sum, trader) => sum + trader.navEnd, 0),
      2,
    ),
    totalExposure: round(
      traders.reduce(
        (sum, trader) =>
          sum +
          trader.positions.reduce((positionSum, position) => {
            const price =
              markets.find((market) => market.symbol === position.symbol)?.lastPrice ?? 0;
            return positionSum + position.quantity * price;
          }, 0),
        0,
      ),
      2,
    ),
    volume: round(
      fills.reduce((sum, fill) => sum + fill.quantity * fill.price, 0),
      2,
    ),
    profitableAgents: traders.filter((trader) => trader.pnl > 0).length,
    topAgent: topTrader?.name ?? 'No agents',
    topReturnPct: topTrader ? round((topTrader.pnl / topTrader.navStart) * 100, 2) : 0,
  };
}

function numberIndicator(market: DashboardMarket, label: string, fallback: number) {
  const value = Number.parseFloat(
    market.indicators.find((indicator) => indicator.label === label)?.value ?? '',
  );
  return Number.isFinite(value) ? value : fallback;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
