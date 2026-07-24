import {
  injectivePreviewDashboard,
  mergeLiveDashboard,
  pandaDayViewDashboard,
} from './demoData';

describe('real-data dashboard boundary', () => {
  test('uses the PandaAI export without generating financial activity', () => {
    expect(pandaDayViewDashboard.source).toBe('panda');
    expect(pandaDayViewDashboard.markets.map((market) => market.symbol)).toEqual(['000001.SZ']);
    expect(pandaDayViewDashboard.markets[0].candles).toHaveLength(241);
    expect(pandaDayViewDashboard.traders).toHaveLength(8);
    expect(
      pandaDayViewDashboard.traders.every(
        (trader) => trader.kind === 'ai' && trader.financialState === 'profile_only',
      ),
    ).toBe(true);
    expect(pandaDayViewDashboard.executions).toEqual([]);
    expect(pandaDayViewDashboard.social).toEqual([]);
    expect(pandaDayViewDashboard.summary).toEqual({ volume: 135_184_636 });
  });

  test('does not invent an Injective fallback snapshot', () => {
    expect(injectivePreviewDashboard.markets).toEqual([]);
    expect(injectivePreviewDashboard.executions).toEqual([]);
    expect(mergeLiveDashboard(undefined)).toBe(injectivePreviewDashboard);
  });
});
