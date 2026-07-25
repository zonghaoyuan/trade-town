import { createHash } from 'node:crypto';
import { TOWN_TRADERS } from '../../../shared/finance';
import type {
  ReplayDayPayload,
  ReplayEvent,
  ReplayMessage,
  ReplayTransaction,
  TownBootstrap,
  TownCitizen,
  TownGameDay,
  TownMarketBar,
  TranslationMap,
} from './types';

export const FRONTEND_AGENT_NAMES = TOWN_TRADERS.slice(0, 8).map((agent) => agent.name);

const MARKET_ACCENTS: Record<string, string> = {
  '002594.SZ': '#e15d57',
  '300750.SZ': '#38a89d',
  '600519.SH': '#d6a13c',
  '601318.SH': '#4c83c3',
  '688981.SH': '#8b6fc0',
};

export function buildReplayDayPayload(args: {
  bootstrap: TownBootstrap;
  history: TownGameDay[];
  dayIndex: number;
  totalDays: number;
  publishedAt: number;
  sessionId: string;
  translations: TranslationMap;
  sourceHash: string;
}): ReplayDayPayload {
  const { bootstrap, history, dayIndex, totalDays, publishedAt, sessionId, translations } = args;
  const day = history[history.length - 1];
  if (!day) throw new Error('Replay history must include the current day.');
  const previousDay = history[history.length - 2];
  const names = agentNames(bootstrap);
  const label = `Day ${dayIndex}/${totalDays} · ${day.trade_date}`;
  const transactions = mapTransactions(day, names, label, translations, sessionId);
  const events = mapEvents(day, transactions, names, label, publishedAt, translations, sessionId);
  const messages = mapMessages(day, names, label, publishedAt, translations, sessionId);
  const bundle = buildDashboardBundle({
    bootstrap,
    history,
    previousDay,
    day,
    dayIndex,
    totalDays,
    translations,
    transactions,
    label,
  });

  return {
    sessionId,
    runId: day.run_id,
    tradeDate: day.trade_date,
    dayIndex,
    totalDays,
    sourceHash: args.sourceHash,
    snapshotJson: JSON.stringify(bundle),
    publishedAt,
    transactions,
    events: events.slice(0, 120),
    messages,
  };
}

function buildDashboardBundle(args: {
  bootstrap: TownBootstrap;
  history: TownGameDay[];
  previousDay?: TownGameDay;
  day: TownGameDay;
  dayIndex: number;
  totalDays: number;
  translations: TranslationMap;
  transactions: ReplayTransaction[];
  label: string;
}) {
  const { bootstrap, history, previousDay, day, dayIndex, totalDays, translations } = args;
  const symbols = bootstrap.symbols.map((item) => item.symbol);
  const markets = day.market_board.map((bar) => mapMarket(bar, history));
  const asOf = marketTimestamp(day.trade_date);
  const events = dashboardEvents(day, bootstrap, translations, args.label);
  const social = day.social.posts.slice(0, 20).map((post, index) => ({
    id: `replay-social-${stableId(`${day.run_id}:${day.trade_date}:${post.post_id}`)}`,
    time: timeLabel(index, 15, 0),
    actor: frontendName(bootstrap, post.agent_id),
    type: 'post' as const,
    title: `${frontendName(bootstrap, post.agent_id)} shared a market view`,
    detail: translated(translations, `post:${post.post_id}`, 'Simulated market view.'),
    impact: `LLM replay · ${day.trade_date}`,
  }));
  const executions = day.transactions.slice(0, 80).flatMap((transaction, index) => {
    const side = transaction.side.toUpperCase();
    const quantity = finite(transaction.quantity);
    if ((side !== 'BUY' && side !== 'SELL') || quantity === undefined || quantity <= 0) return [];
    const price = finite(transaction.fill?.price) ?? marketClose(day, transaction.symbol) ?? 0;
    return [
      {
        id: `replay-execution-${stableId(`${day.run_id}:${day.trade_date}:${transaction.intent_id}`)}`,
        time: timeLabel(index, 9, 30),
        agentName: frontendName(bootstrap, transaction.account_id),
        symbol: transaction.symbol,
        type:
          transaction.risk?.status?.toUpperCase() === 'REJECTED'
            ? ('risk_rejected' as const)
            : transaction.fill
              ? ('fill' as const)
              : ('order' as const),
        side,
        quantity,
        price,
        priceUnit: 'CNY',
        state: transaction.fill ? 'SIMULATED FILLED' : transaction.state ?? 'SIMULATED',
        isSimulated: true,
        reason: `${translated(translations, `risk:${transaction.intent_id}`, 'Simulated risk check completed.')} · SIMULATED_NO_CHAIN`,
      },
    ];
  });
  const dashboards = symbols.map((symbol) => {
    const traders = day.citizens.slice(0, 8).map((citizen, index) =>
      mapTrader({ bootstrap, citizen, previousDay, symbol, translations, index }),
    );
    const profitable = traders.filter((trader) => trader.pnl > 0);
    const top = [...traders].sort((left, right) => right.pnl - left.pnl)[0];
    const aum = finite(day.scoreboard?.aum) ?? traders.reduce((sum, trader) => sum + trader.navEnd, 0);
    return {
      symbol,
      dashboard: {
        dataMode: 'panda_dayview' as const,
        source: 'panda' as const,
        sourceLabel: 'PANDA DAILY · LLM REPLAY',
        runId: day.run_id,
        asOf,
        gatewayStatus: 'read_only' as const,
        markets,
        traders,
        marketMakers: [],
        events,
        social,
        executions,
        summary: {
          aum,
          totalExposure: finite(day.scoreboard?.gross_exposure) ?? 0,
          volume: executions.reduce((sum, item) => sum + item.price * item.quantity, 0),
          profitableAgents: profitable.length,
          topAgent: top?.name ?? 'No active Agent',
          topReturnPct: top && top.navStart > 0 ? (top.pnl / top.navStart) * 100 : 0,
        },
        errors: (day.errors ?? []).map((error, index) => ({
          id: `replay-error-${day.trade_date}-${index}`,
          time: '15:31:00',
          scope: frontendName(bootstrap, error.agent_id ?? ''),
          message: translated(
            translations,
            `error:${index}`,
            `The backend Agent returned ${error.status ?? 'an error'} for this checkpoint.`,
          ),
          recovered: false,
        })),
      },
    };
  });
  return {
    runId: day.run_id,
    tradeDate: day.trade_date,
    dayIndex,
    totalDays,
    status: dayIndex >= totalDays ? 'completed' : 'replaying',
    defaultSymbol: symbols[0] ?? markets[0]?.symbol ?? '',
    dashboards,
  };
}

function mapMarket(current: TownMarketBar, history: TownGameDay[]) {
  const lastPrice = finite(current.close) ?? 0;
  const referencePrice = finite(current.pre_close) ?? lastPrice;
  const consensus = current.consensus;
  const rsi = finite(current.rsi_14);
  const sma = finite(current.sma_20);
  const volatility = finite(current.volatility_20);
  return {
    symbol: current.symbol,
    displayName: current.name || current.symbol,
    assetClass: 'company' as const,
    lastPrice,
    referencePrice,
    changePct:
      finite(current.daily_return) !== undefined
        ? finite(current.daily_return)! * 100
        : referencePrice === 0
          ? 0
          : (lastPrice / referencePrice - 1) * 100,
    volume: finite(current.volume) ?? 0,
    status:
      current.tradable === false || (current.trade_status ?? 0) !== 0
        ? ('paused' as const)
        : ('active' as const),
    accent: MARKET_ACCENTS[current.symbol] ?? '#e15d57',
    quoteCurrency: 'CNY',
    candles: history.flatMap((item) => {
      const bar = item.market_board.find((candidate) => candidate.symbol === current.symbol);
      if (!bar) return [];
      const open = finite(bar.open);
      const high = finite(bar.high);
      const low = finite(bar.low);
      const close = finite(bar.close);
      const volume = finite(bar.volume);
      if ([open, high, low, close, volume].some((value) => value === undefined)) return [];
      return [{ time: marketTimestampSeconds(item.trade_date), open, high, low, close, volume }];
    }),
    indicators: [
      {
        label: 'RSI14',
        value: rsi === undefined ? 'N/A' : rsi.toFixed(1),
        tone: rsi === undefined || (rsi >= 45 && rsi <= 55) ? 'neutral' : rsi > 55 ? 'positive' : 'negative',
      },
      {
        label: 'MA20',
        value: sma === undefined ? 'N/A' : sma.toFixed(2),
        tone: sma === undefined ? 'neutral' : lastPrice >= sma ? 'positive' : 'negative',
      },
      {
        label: 'VOL20',
        value: volatility === undefined ? 'N/A' : `${(volatility * 100).toFixed(2)}%`,
        tone: volatility === undefined ? 'neutral' : volatility >= 0.03 ? 'negative' : 'neutral',
      },
    ],
    sentiment: {
      bulls: consensus?.buy_count ?? 0,
      bears: consensus?.sell_count ?? 0,
      holds: consensus?.hold_count ?? 0,
      consensus: consensus?.score ?? 0,
      divergence: consensus?.dispersion ?? 0,
      camp: consensus?.label ?? 'hold',
    },
  };
}

function mapTrader(args: {
  bootstrap: TownBootstrap;
  citizen: TownCitizen;
  previousDay?: TownGameDay;
  symbol: string;
  translations: TranslationMap;
  index: number;
}) {
  const { bootstrap, citizen, previousDay, symbol, translations, index } = args;
  const seed = TOWN_TRADERS[index] ?? TOWN_TRADERS[0];
  const name = frontendName(bootstrap, citizen.agent_id);
  const view = citizen.views?.find((candidate) => candidate.symbol === symbol);
  const direction = Number(view?.direction ?? 0);
  const action = direction > 0 ? 'BUY' : direction < 0 ? 'SELL' : 'HOLD';
  const confidence = Math.max(0, Math.min(1, Number(view?.confidence ?? 0)));
  const navEnd = finite(citizen.account?.equity) ?? 0;
  const previousCitizen = previousDay?.citizens.find((item) => item.agent_id === citizen.agent_id);
  const derivedStart =
    navEnd -
    (finite(citizen.account?.realized_pnl) ?? 0) -
    (finite(citizen.account?.unrealized_pnl) ?? 0);
  const navStart = finite(previousCitizen?.account?.equity) ?? derivedStart;
  const positions = (citizen.positions ?? []).map((position) => {
    const quantity = finite(position.quantity) ?? 0;
    const markPrice = finite(position.mark_price) ?? 0;
    return {
      symbol: position.symbol,
      quantity,
      weightPct: navEnd > 0 ? (Math.abs(quantity * markPrice) / navEnd) * 100 : 0,
      pnl: finite(position.unrealized_pnl) ?? 0,
    };
  });
  return {
    name,
    kind: 'ai' as const,
    role: seed.role,
    style: seed.style,
    riskTolerance: seed.riskTolerance,
    subaccountNonce: index + 1,
    focusSymbols: bootstrap.symbols.map((item) => item.symbol),
    currency: 'CNY',
    pnl: navEnd - navStart,
    activity: `${action} ${symbol} · ${Math.round(confidence * 100)}% confidence`,
    action,
    confidence,
    beliefBefore: translated(
      translations,
      `belief_before:${citizen.agent_id}`,
      `${name} had no prior simulated market view.`,
    ),
    beliefAfter: translated(
      translations,
      `belief_after:${citizen.agent_id}`,
      `${name} updated the simulated market view.`,
    ),
    thesis: translated(
      translations,
      `view:${citizen.agent_id}:${symbol}`,
      `${name} maintained a neutral simulated view on ${symbol}.`,
    ),
    evidence: [
      `Panda daily bar · ${symbol}`,
      `LLM confidence · ${Math.round(confidence * 100)}%`,
      'SIMULATED_NO_CHAIN',
    ],
    navStart,
    navEnd,
    cash: finite(citizen.account?.balance) ?? 0,
    positions,
    riskRejections: citizen.risk_rejections ?? 0,
    orderCount: citizen.order_count ?? 0,
    tradeCount: citizen.fill_count ?? 0,
  };
}

function mapTransactions(
  day: TownGameDay,
  names: Map<string, string>,
  label: string,
  translations: TranslationMap,
  sessionId: string,
): ReplayTransaction[] {
  return day.transactions.slice(0, 80).flatMap((item) => {
    const side = item.side.toLowerCase();
    const quantity = finite(item.quantity);
    if ((side !== 'buy' && side !== 'sell') || quantity === undefined || quantity <= 0) return [];
    const rejected = item.risk?.status?.toUpperCase() === 'REJECTED';
    const originalState = item.state?.toUpperCase();
    const state: ReplayTransaction['state'] = rejected
      ? 'risk_rejected'
      : originalState === 'CANCELLED'
        ? 'cancelled'
        : originalState === 'FAILED'
          ? 'failed'
          : item.fill
            ? 'proposed'
            : 'queued';
    return [
      {
        intentId: `replay:${stableId(`${sessionId}:${day.run_id}:${day.trade_date}:${item.intent_id}`)}`,
        agentName: names.get(item.account_id) ?? 'Town Agent',
        subaccountNonce: Math.max(0, [...names.keys()].indexOf(item.account_id) + 1),
        symbol: item.symbol,
        side: side as 'buy' | 'sell',
        quantity,
        limitPrice: finite(item.fill?.price),
        rationale: `${label} · ${translated(translations, `risk:${item.intent_id}`, 'Simulated risk check completed.')} · SIMULATED_NO_CHAIN`,
        state,
        riskCode: rejected ? 'simulated_risk_rejected' : undefined,
      },
    ];
  });
}

function mapEvents(
  day: TownGameDay,
  transactions: ReplayTransaction[],
  names: Map<string, string>,
  label: string,
  publishedAt: number,
  translations: TranslationMap,
  sessionId: string,
) {
  const events: ReplayEvent[] = [
    {
      eventId: replayId(sessionId, day.trade_date, 'day'),
      kind: 'news',
      source: 'Town Replay',
      headline: label,
      summary: 'LLM Agents processed this historical market checkpoint. Simulation only; no Injective chain proof.',
      severity: 0.2,
      symbols: day.market_board.map((item) => item.symbol),
      occurredAt: publishedAt,
    },
  ];
  for (const [index, citizen] of day.citizens.slice(0, 8).entries()) {
    const name = names.get(citizen.agent_id) ?? 'Town Agent';
    events.push({
      eventId: replayId(sessionId, day.trade_date, `belief:${citizen.agent_id}`),
      kind: 'belief',
      source: name,
      headline: `${name} updated a market belief`,
      summary: `${label} · ${translated(translations, `belief_after:${citizen.agent_id}`, `${name} updated a simulated belief.`)}`,
      severity: Math.min(1, Math.abs(Number(citizen.belief_after?.belief_score ?? 0))),
      symbols: [...new Set((citizen.views ?? []).map((view) => view.symbol))].slice(0, 8),
      occurredAt: publishedAt + 100 + index,
    });
  }
  for (const [index, transaction] of transactions.slice(0, 40).entries()) {
    events.push({
      eventId: replayId(sessionId, day.trade_date, `intent:${transaction.intentId}`),
      kind: transaction.state === 'risk_rejected' ? 'risk' : 'intent',
      source: transaction.agentName,
      headline:
        transaction.state === 'risk_rejected'
          ? `${transaction.agentName} was blocked by simulated risk control`
          : `${transaction.agentName} formed a simulated ${transaction.side.toUpperCase()} intent`,
      summary: transaction.rationale,
      severity: transaction.state === 'risk_rejected' ? 0.65 : 0.35,
      symbols: [transaction.symbol],
      occurredAt: publishedAt + 300 + index,
    });
  }
  return events;
}

function mapMessages(
  day: TownGameDay,
  names: Map<string, string>,
  label: string,
  publishedAt: number,
  translations: TranslationMap,
  sessionId: string,
) {
  const messages: ReplayMessage[] = [];
  for (const [index, post] of day.social.posts.slice(0, 20).entries()) {
    const author = names.get(post.agent_id) ?? 'Town Agent';
    const authorIndex = Math.max(0, FRONTEND_AGENT_NAMES.findIndex((candidate) => candidate === author));
    const recipient = FRONTEND_AGENT_NAMES[(authorIndex + 1) % FRONTEND_AGENT_NAMES.length];
    const identity = `${sessionId}:${day.trade_date}:${post.post_id}`;
    messages.push({
      conversationId: `c:${stableNumericId(identity)}`,
      messageUuid: `replay-${stableId(identity)}`,
      authorName: author,
      recipientName: recipient,
      text: `[${label}] ${translated(translations, `post:${post.post_id}`, `${author} shared a simulated market view.`)}`,
      occurredAt: publishedAt + 200 + index,
    });
  }
  return messages;
}

function dashboardEvents(
  day: TownGameDay,
  bootstrap: TownBootstrap,
  translations: TranslationMap,
  label: string,
) {
  return [
    {
      id: `dashboard-day-${day.trade_date}`,
      time: '09:00:00',
      kind: 'news' as const,
      actor: 'Town Replay',
      title: label,
      detail: 'Five PandaAI daily bars were released to eight LLM Agents.',
    },
    ...day.citizens.slice(0, 8).map((citizen, index) => ({
      id: `dashboard-belief-${day.trade_date}-${citizen.agent_id}`,
      time: timeLabel(index, 14, 30),
      kind: 'belief' as const,
      actor: frontendName(bootstrap, citizen.agent_id),
      title: `${frontendName(bootstrap, citizen.agent_id)} updated a belief`,
      detail: translated(
        translations,
        `belief_after:${citizen.agent_id}`,
        `${frontendName(bootstrap, citizen.agent_id)} updated a simulated belief.`,
      ),
    })),
  ];
}

function agentNames(bootstrap: TownBootstrap) {
  return new Map(
    bootstrap.agents.map((agent, index) => [
      agent.agent_id,
      FRONTEND_AGENT_NAMES[index] ?? `Town Agent ${index + 1}`,
    ]),
  );
}

function frontendName(bootstrap: TownBootstrap, agentId: string) {
  const index = bootstrap.agents.findIndex((agent) => agent.agent_id === agentId);
  return FRONTEND_AGENT_NAMES[index] ?? `Town Agent ${index < 0 ? 'Unknown' : index + 1}`;
}

function marketClose(day: TownGameDay, symbol: string) {
  return finite(day.market_board.find((bar) => bar.symbol === symbol)?.close);
}

function finite(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function translated(values: TranslationMap, id: string, fallback: string) {
  return values[id]?.trim() || fallback;
}

function timeLabel(index: number, hour: number, minute: number) {
  const seconds = index % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function marketTimestamp(value: string) {
  return Date.parse(`${value}T15:00:00+08:00`);
}

function marketTimestampSeconds(value: string) {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 1000);
}

function replayId(sessionId: string, tradeDate: string, suffix: string) {
  return `replay:${stableId(`${sessionId}:${tradeDate}:${suffix}`)}`;
}

function stableNumericId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 1_500_000_000 + ((hash >>> 0) % 500_000_000);
}

function stableId(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}
