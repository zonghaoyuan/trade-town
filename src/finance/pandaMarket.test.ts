import { pandaHistoricalMarket } from './pandaMarket';

describe('Panda market adapter', () => {
  it('maps the real 000001.SZ export into a dashboard market', () => {
    const { market } = pandaHistoricalMarket;

    expect(market.symbol).toBe('000001.SZ');
    expect(market.displayName).toBe('平安银行');
    expect(market.lastPrice).toBe(11.95);
    expect(market.referencePrice).toBe(11.83);
    expect(market.changePct).toBeCloseTo(1.01437, 5);
    expect(market.volume).toBe(135_184_636);
  });

  it('keeps all valid daily bars in ascending chart order', () => {
    const { candles } = pandaHistoricalMarket.market;

    expect(candles).toHaveLength(241);
    expect(candles[0]).toMatchObject({
      open: 9.39,
      high: 9.42,
      low: 9.21,
      close: 9.21,
    });
    expect(candles[candles.length - 1]).toMatchObject({
      open: 11.78,
      high: 11.97,
      low: 11.78,
      close: 11.95,
    });
    expect(
      candles.every((candle, index) => index === 0 || candle.time > candles[index - 1].time),
    ).toBe(true);
  });

  it('derives indicators without inventing agent sentiment', () => {
    const { market } = pandaHistoricalMarket;

    expect(market.indicators.map((indicator) => indicator.label)).toEqual([
      'RSI14',
      'MA20',
      'VOL20',
    ]);
    expect(market.indicators[1].value).toBe('11.69');
    expect(market.sentiment).toBeUndefined();
  });

  it('uses the final market date as the dashboard as-of date', () => {
    expect(new Date(pandaHistoricalMarket.asOf).toISOString().slice(0, 10)).toBe('2024-12-30');
  });
});
