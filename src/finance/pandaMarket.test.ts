import { pandaHistoricalMarket, pandaHistoricalMarkets } from './pandaMarket';

describe('Panda market adapter', () => {
  it('maps all five real PandaAI market datasets', () => {
    expect(pandaHistoricalMarkets.map(({ market }) => [market.symbol, market.displayName])).toEqual(
      [
        ['002594.SZ', '比亚迪'],
        ['300750.SZ', '宁德时代'],
        ['600519.SH', '贵州茅台'],
        ['601318.SH', '中国平安'],
        ['688981.SH', '中芯国际'],
      ],
    );
  });

  it('uses BYD as the default dashboard market', () => {
    const { market } = pandaHistoricalMarket;

    expect(market.symbol).toBe('002594.SZ');
    expect(market.displayName).toBe('比亚迪');
    expect(market.lastPrice).toBe(97.72);
    expect(market.referencePrice).toBe(99.75);
    expect(market.changePct).toBeCloseTo(-2.0350877, 5);
    expect(market.volume).toBe(40_285_887);
  });

  it('keeps all valid daily bars in ascending chart order', () => {
    for (const { market } of pandaHistoricalMarkets) {
      const { candles } = market;
      expect(candles).toHaveLength(304);
      expect(
        candles.every((candle, index) => index === 0 || candle.time > candles[index - 1].time),
      ).toBe(true);
    }

    const { candles } = pandaHistoricalMarket.market;
    expect(candles[0]).toMatchObject({
      open: 338.04,
      high: 338.04,
      low: 307.31,
      close: 327.38,
    });
    expect(candles[candles.length - 1]).toMatchObject({
      open: 99.98,
      high: 100.2,
      low: 97.38,
      close: 97.72,
    });
  });

  it('uses the indicators supplied in the PandaAI datasets', () => {
    const { market } = pandaHistoricalMarket;

    expect(market.indicators.map((indicator) => indicator.label)).toEqual([
      'RSI14',
      'MA20',
      'VOL20',
    ]);
    expect(market.indicators.map((indicator) => indicator.value)).toEqual([
      '54.6',
      '96.12',
      '1.50%',
    ]);
    expect(market.sentiment).toBeUndefined();
  });

  it('uses the final market date as the dashboard as-of date', () => {
    expect(new Date(pandaHistoricalMarket.asOf).toISOString().slice(0, 10)).toBe('2025-12-31');
  });

  it('preserves PandaAI dataset provenance for downstream A2A reports', () => {
    expect(pandaHistoricalMarket).toMatchObject({
      source: 'PandaAI',
      method: 'daily_bars',
      datasetId: 'panda-cn-a-2025-v1',
      schemaVersion: '1.1',
      instrumentType: 'SIMULATED_PERPETUAL_REFERENCE',
      startDate: '2024-10-08',
      endDate: '2025-12-31',
      barCount: 304,
    });
  });
});
