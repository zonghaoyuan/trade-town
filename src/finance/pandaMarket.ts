import pandaMarketExport from '../../data/panda_market_000001_SZ_20240101_20241230.json';
import type { DashboardMarket, Tone } from './demoData';

type PandaDailyBar = {
  symbol: string;
  date: string;
  close: number;
  high: number;
  limit_down: number;
  limit_up: number;
  low: number;
  name: string;
  open: number;
  pre_close: number;
  trade_status: number;
  volume: number;
  amount: number;
};

type PandaMarketExport = {
  symbol: string;
  start_date: string;
  end_date: string;
  exported_at: string;
  get_stock_daily: PandaDailyBar[];
};

export type PandaMarketAdapterResult = {
  market: DashboardMarket;
  asOf: number;
  exportedAt: string;
};

export function adaptPandaMarketExport(source: PandaMarketExport): PandaMarketAdapterResult {
  const bars = [...source.get_stock_daily]
    .filter((bar) => bar.symbol === source.symbol && isValidBar(bar))
    .sort((left, right) => left.date.localeCompare(right.date));

  if (bars.length === 0) {
    throw new Error(`Panda market export for ${source.symbol} contains no valid daily bars.`);
  }

  const latest = bars[bars.length - 1];
  const ma20 = mean(bars.slice(-20).map((bar) => bar.close));
  const rsi14 = calculateRsi(bars.slice(-14));
  const volatility20 = calculateAnnualizedVolatility(bars.slice(-20));

  return {
    market: {
      symbol: latest.symbol,
      displayName: latest.name,
      assetClass: 'company',
      lastPrice: latest.close,
      referencePrice: latest.pre_close,
      changePct: percentChange(latest.close, latest.pre_close),
      volume: latest.volume,
      status: latest.trade_status === 0 ? 'active' : 'paused',
      accent: '#e15d57',
      quoteCurrency: 'CNY',
      candles: bars.map((bar) => ({
        time: parsePandaDateSeconds(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      indicators: [
        {
          label: 'RSI14',
          value: rsi14.toFixed(1),
          tone: directionalTone(rsi14, 45, 55),
        },
        {
          label: 'MA20',
          value: ma20.toFixed(2),
          tone: latest.close >= ma20 ? 'positive' : 'negative',
        },
        {
          label: 'VOL20',
          value: `${volatility20.toFixed(0)}%`,
          tone: volatilityTone(volatility20),
        },
      ],
    },
    asOf: parsePandaDateSeconds(latest.date) * 1000,
    exportedAt: source.exported_at,
  };
}

function isValidBar(bar: PandaDailyBar) {
  return (
    /^\d{8}$/.test(bar.date) &&
    [bar.open, bar.high, bar.low, bar.close, bar.pre_close, bar.volume].every(Number.isFinite) &&
    bar.high >= Math.max(bar.open, bar.close) &&
    bar.low <= Math.min(bar.open, bar.close) &&
    bar.high >= bar.low &&
    bar.volume >= 0
  );
}

function parsePandaDateSeconds(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid Panda market date: ${value}`);
  }

  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 1000);
}

function percentChange(value: number, reference: number) {
  return reference === 0 ? 0 : (value / reference - 1) * 100;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function calculateRsi(bars: PandaDailyBar[]) {
  let gains = 0;
  let losses = 0;

  for (const bar of bars) {
    const dailyReturn = bar.pre_close === 0 ? 0 : bar.close / bar.pre_close - 1;
    if (dailyReturn >= 0) {
      gains += dailyReturn;
    } else {
      losses -= dailyReturn;
    }
  }

  if (losses === 0) return gains === 0 ? 50 : 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateAnnualizedVolatility(bars: PandaDailyBar[]) {
  const returns = bars.map((bar) => (bar.pre_close === 0 ? 0 : bar.close / bar.pre_close - 1));
  if (returns.length < 2) return 0;

  const average = mean(returns);
  const variance =
    returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function directionalTone(value: number, lower: number, upper: number): Tone {
  if (value < lower) return 'negative';
  if (value > upper) return 'positive';
  return 'neutral';
}

function volatilityTone(value: number): Tone {
  if (value >= 30) return 'negative';
  if (value <= 15) return 'positive';
  return 'neutral';
}

export const pandaHistoricalMarket = adaptPandaMarketExport(pandaMarketExport as PandaMarketExport);
