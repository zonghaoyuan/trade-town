import {
  injectivePreviewDashboard,
  mergeLiveDashboard,
  pandaDayViewDashboard,
} from './demoData';

describe('real-data dashboard boundary', () => {
  test('keeps all five sourced PandaAI markets without generated financial activity', () => {
    expect(pandaDayViewDashboard.source).toBe('panda');
    expect(pandaDayViewDashboard.markets.map((market) => market.symbol)).toEqual([
      '002594.SZ',
      '300750.SZ',
      '600519.SH',
      '601318.SH',
      '688981.SH',
    ]);
    expect(pandaDayViewDashboard.markets.every((market) => market.candles.length === 304)).toBe(
      true,
    );
    expect(pandaDayViewDashboard.traders).toHaveLength(8);
    expect(
      pandaDayViewDashboard.traders.every(
        (trader) =>
          trader.kind === 'ai' &&
          trader.financialState === 'profile_only' &&
          trader.pnl === 0 &&
          trader.positions.length === 0 &&
          trader.orderCount === 0 &&
          trader.tradeCount === 0,
      ),
    ).toBe(true);
    expect(pandaDayViewDashboard.executions).toEqual([]);
    expect(pandaDayViewDashboard.social).toEqual([]);
    expect(pandaDayViewDashboard.markets.every((market) => !('sentiment' in market))).toBe(true);
  });

  test('does not invent an Injective fallback snapshot', () => {
    expect(injectivePreviewDashboard.markets).toEqual([]);
    expect(injectivePreviewDashboard.executions).toEqual([]);
    expect(mergeLiveDashboard(undefined)).toBe(injectivePreviewDashboard);
  });
});
