import { buildReplayDayPayload, FRONTEND_AGENT_NAMES } from './map';
import type { TownBootstrap, TownGameDay, TranslationMap } from './types';

const symbols = ['002594.SZ', '300750.SZ', '600519.SH', '601318.SH', '688981.SH'];

function bootstrap(): TownBootstrap {
  return {
    run_id: 'run-1',
    trading_days: ['2025-01-02', '2025-01-03'],
    symbols: symbols.map((symbol) => ({ symbol })),
    agents: FRONTEND_AGENT_NAMES.map((_, index) => ({
      agent_id: `agent-${index + 1}`,
      display_name: `Backend ${index + 1}`,
    })),
  };
}

function day(tradeDate: string, closeOffset: number): TownGameDay {
  return {
    run_id: 'run-1',
    trade_date: tradeDate,
    market_board: symbols.map((symbol, index) => ({
      symbol,
      name: symbol,
      date: tradeDate,
      open: 100 + index + closeOffset,
      high: 102 + index + closeOffset,
      low: 99 + index + closeOffset,
      close: 101 + index + closeOffset,
      pre_close: 100 + index + closeOffset,
      volume: 1_000 + index,
      tradable: true,
      trade_status: 0,
      rsi_14: 55,
      sma_20: 100,
      volatility_20: 0.02,
      consensus: { label: 'buy', score: 0.4, buy_count: 5, sell_count: 1, hold_count: 2 },
    })),
    citizens: FRONTEND_AGENT_NAMES.map((_, index) => ({
      agent_id: `agent-${index + 1}`,
      belief_before: { belief_text: `Prior belief ${index}`, belief_score: 0.1 },
      belief_after: {
        belief_text: `Updated belief ${index}`,
        belief_score: 0.5,
        memory_summary: `Memory ${index}`,
        status: 'ACTIVE',
      },
      views: symbols.map((symbol) => ({
        symbol,
        direction: symbol === symbols[0] ? 1 : 0,
        confidence: 0.75,
        exposure: 0.2,
        rationale: `Rationale ${index} ${symbol}`,
      })),
      account: {
        balance: 90_000,
        equity: 100_000 + index + closeOffset,
        realized_pnl: 0,
        unrealized_pnl: closeOffset,
      },
      positions: [],
      risk_rejections: 0,
      order_count: 1,
      fill_count: 1,
    })),
    transactions: [
      {
        intent_id: `intent-${tradeDate}`,
        account_id: 'agent-1',
        symbol: symbols[0],
        side: 'BUY',
        quantity: 2,
        state: 'CONFIRMED',
        risk: { status: 'ACCEPTED', reason: 'Risk check passed.' },
        fill: { price: 101 + closeOffset },
        simulation_label: 'SIMULATED_NO_CHAIN',
      },
    ],
    social: {
      posts: [{ post_id: `post-${tradeDate}`, agent_id: 'agent-1', content: 'English post.' }],
    },
    scoreboard: { aum: 800_000, gross_exposure: 100_000 },
    errors: [],
  };
}

function translations(days: TownGameDay[]): TranslationMap {
  const result: TranslationMap = {};
  for (const item of days) {
    for (const citizen of item.citizens) {
      result[`belief_before:${citizen.agent_id}`] = citizen.belief_before!.belief_text!;
      result[`belief_after:${citizen.agent_id}`] = citizen.belief_after!.belief_text!;
      result[`memory:${citizen.agent_id}`] = citizen.belief_after!.memory_summary!;
      for (const view of citizen.views!) {
        result[`view:${citizen.agent_id}:${view.symbol}`] = view.rationale!;
      }
    }
    for (const post of item.social.posts) result[`post:${post.post_id}`] = post.content;
    for (const transaction of item.transactions) {
      result[`risk:${transaction.intent_id}`] = transaction.risk!.reason!;
    }
  }
  return result;
}

describe('30-day Town replay mapping', () => {
  test('updates five prices and accumulates candles through the current trading day', () => {
    const history = [day('2025-01-02', 0), day('2025-01-03', 3)];
    const payload = buildReplayDayPayload({
      bootstrap: bootstrap(),
      history,
      dayIndex: 2,
      totalDays: 30,
      publishedAt: 1_000,
      sessionId: 'session-1',
      translations: translations(history),
      sourceHash: 'hash',
    });
    const bundle = JSON.parse(payload.snapshotJson);
    expect(bundle.dashboards).toHaveLength(5);
    const first = bundle.dashboards[0].dashboard;
    expect(first.markets).toHaveLength(5);
    expect(first.markets[0]).toMatchObject({
      symbol: symbols[0],
      lastPrice: 104,
      referencePrice: 103,
    });
    expect(first.markets[0].candles).toHaveLength(2);
    expect(first.traders).toHaveLength(8);
    expect(first.traders[0]).toMatchObject({ name: FRONTEND_AGENT_NAMES[0], action: 'BUY' });
    expect(first.traders[0].navEnd).toBeCloseTo(1_000_030);
    expect(first.traders[1].navEnd).toBeCloseTo((100_004 / 100_001) * 1_000_000);
    expect(first.summary.aum).toBeCloseTo(
      first.traders.reduce((sum: number, trader: { navEnd: number }) => sum + trader.navEnd, 0),
    );
  });

  test('normalizes every LLM agent to the same 1M CNY starting capital', () => {
    const history = [day('2025-01-02', 0)];
    const payload = buildReplayDayPayload({
      bootstrap: bootstrap(),
      history,
      dayIndex: 1,
      totalDays: 30,
      publishedAt: 1_000,
      sessionId: 'session-1',
      translations: translations(history),
      sourceHash: 'hash',
    });
    const first = JSON.parse(payload.snapshotJson).dashboards[0].dashboard;
    expect(
      first.traders.every(
        (trader: { navEnd: number }) => Math.abs(trader.navEnd - 1_000_000) < 0.001,
      ),
    ).toBe(true);
    expect(first.summary.aum).toBeCloseTo(8_000_000);
  });

  test('keeps simulated fills out of Injective proof fields and is stable across retries', () => {
    const history = [day('2025-01-02', 0)];
    const input = {
      bootstrap: bootstrap(),
      history,
      dayIndex: 1,
      totalDays: 30,
      publishedAt: 1_000,
      sessionId: 'session-1',
      translations: translations(history),
      sourceHash: 'hash',
    };
    const first = buildReplayDayPayload(input);
    const second = buildReplayDayPayload(input);
    expect(first.transactions[0]).toMatchObject({ state: 'proposed', side: 'buy' });
    expect(first.transactions[0].rationale).toContain('SIMULATED_NO_CHAIN');
    expect(first.events.every((event) => !('txHash' in event))).toBe(true);
    expect(first.events.map((event) => event.eventId)).toEqual(
      second.events.map((event) => event.eventId),
    );
  });
});
