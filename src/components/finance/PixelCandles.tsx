import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';

export default function PixelCandles({
  values,
  symbol,
}: {
  values: readonly number[];
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const candles = useMemo(() => toCandles(values), [values]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 142,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: '#33253a' },
        textColor: '#8b9bb4',
        fontFamily: '"VCR OSD Mono", monospace',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: '#3f2832' },
        horzLines: { color: '#4a3140' },
      },
      rightPriceScale: {
        borderColor: '#181425',
        scaleMargins: { top: 0.16, bottom: 0.14 },
      },
      timeScale: {
        borderColor: '#181425',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 1,
        barSpacing: 11,
        minBarSpacing: 5,
      },
      crosshair: {
        vertLine: { color: '#fec742', labelBackgroundColor: '#743f39' },
        horzLine: { color: '#fec742', labelBackgroundColor: '#743f39' },
      },
      localization: {
        priceFormatter: (price: number) => (price >= 1000 ? price.toFixed(1) : price.toFixed(2)),
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#8ccf5b',
      downColor: '#e15d57',
      borderUpColor: '#b6e38f',
      borderDownColor: '#ff7973',
      wickUpColor: '#b6e38f',
      wickDownColor: '#ff7973',
      priceLineColor: '#fec742',
      lastValueVisible: true,
    });
    series.setData(candles);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles]);

  return (
    <div className="pixel-candle-wrap">
      <div className="pixel-candle-label">
        <span>{symbol} · 5M</span>
        <strong>Town Exchange</strong>
      </div>
      <div
        ref={containerRef}
        className="pixel-candle-chart"
        aria-label={`${symbol} candlestick chart`}
      />
    </div>
  );
}

function toCandles(values: readonly number[]): CandlestickData<UTCTimestamp>[] {
  const start = Math.floor(Date.UTC(2026, 6, 23, 1, 0, 0) / 1000);

  return values.map((close, index) => {
    const open = index === 0 ? close * 0.997 : values[index - 1];
    const spread = Math.max(close * (0.0035 + (index % 3) * 0.0012), 0.01);
    return {
      time: (start + index * 300) as UTCTimestamp,
      open,
      high: Math.max(open, close) + spread,
      low: Math.max(0, Math.min(open, close) - spread),
      close,
    };
  });
}
