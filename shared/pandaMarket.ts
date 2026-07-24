import bydDataset from '../data/panda/markets/002594.SZ.json';
import catlDataset from '../data/panda/markets/300750.SZ.json';
import moutaiDataset from '../data/panda/markets/600519.SH.json';
import pingAnDataset from '../data/panda/markets/601318.SH.json';
import smicDataset from '../data/panda/markets/688981.SH.json';
import type { DashboardMarket, Tone } from './pandaTypes';

type PandaNumericValue = number | string | null;

type PandaDatasetBar = {
  symbol: string;
  date: string;
  close: PandaNumericValue;
  high: PandaNumericValue;
  limit_down: PandaNumericValue;
  limit_up: PandaNumericValue;
  low: PandaNumericValue;
  name: string;
  open: PandaNumericValue;
  pre_close: PandaNumericValue;
  trade_status: number;
  tradable: boolean;
  volume: PandaNumericValue;
  amount: PandaNumericValue;
  daily_return: PandaNumericValue;
  sma_20: PandaNumericValue;
  ema_20: PandaNumericValue;
  rsi_14: PandaNumericValue;
  macd: PandaNumericValue;
  volatility_20: PandaNumericValue;
  instrument_type: string;
  quote_currency: string;
};

export type PandaMarketDataset = {
  schema_version: string;
  dataset_id: string;
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  quote_currency: string;
  instrument_type: string;
  bars: PandaDatasetBar[];
};

type NormalizedPandaBar = {
  symbol: string;
  date: string;
  close: number;
  high: number;
  low: number;
  name: string;
  open: number;
  preClose: number;
  tradeStatus: number;
  tradable: boolean;
  volume: number;
  sma20: number | null;
  rsi14: number | null;
  volatility20: number | null;
};

export type PandaMarketAdapterResult = {
  market: DashboardMarket;
  asOf: number;
  source: 'PandaAI';
  method: 'daily_bars';
  datasetId: string;
  schemaVersion: string;
  instrumentType: string;
  startDate: string;
  endDate: string;
  barCount: number;
};

const MARKET_ACCENTS: Record<string, string> = {
  '002594.SZ': '#e15d57',
  '300750.SZ': '#38a89d',
  '600519.SH': '#d6a13c',
  '601318.SH': '#4c83c3',
  '688981.SH': '#8b6fc0',
};

const PANDA_MARKET_DATASETS = [
  bydDataset,
  catlDataset,
  moutaiDataset,
  pingAnDataset,
  smicDataset,
] as PandaMarketDataset[];

export function adaptPandaMarketDataset(source: PandaMarketDataset): PandaMarketAdapterResult {
  const bars = source.bars
    .filter((bar) => bar.symbol === source.symbol)
    .map(normalizeBar)
    .filter((bar): bar is NormalizedPandaBar => bar !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (bars.length === 0) {
    throw new Error(`Panda market dataset for ${source.symbol} contains no valid daily bars.`);
  }

  const latest = bars[bars.length - 1];
  const ma20 = latest.sma20 ?? mean(bars.slice(-20).map((bar) => bar.close));
  const rsi14 = latest.rsi14 ?? calculateRsi(bars.slice(-14));
  const volatility20 =
    latest.volatility20 === null
      ? calculateAnnualizedVolatility(bars.slice(-20))
      : latest.volatility20 * 100;

  return {
    market: {
      symbol: latest.symbol,
      displayName: source.name || latest.name,
      assetClass: 'company',
      lastPrice: latest.close,
      referencePrice: latest.preClose,
      changePct: percentChange(latest.close, latest.preClose),
      volume: latest.volume,
      status: latest.tradable && latest.tradeStatus === 0 ? 'active' : 'paused',
      accent: MARKET_ACCENTS[source.symbol] ?? '#e15d57',
      quoteCurrency: source.quote_currency,
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
          value: `${volatility20.toFixed(2)}%`,
          tone: volatilityTone(volatility20),
        },
      ],
    },
    asOf: parsePandaDateSeconds(latest.date) * 1000,
    source: 'PandaAI',
    method: 'daily_bars',
    datasetId: source.dataset_id,
    schemaVersion: source.schema_version,
    instrumentType: source.instrument_type,
    startDate: bars[0].date,
    endDate: latest.date,
    barCount: bars.length,
  };
}

function normalizeBar(bar: PandaDatasetBar): NormalizedPandaBar | null {
  const open = finiteNumber(bar.open);
  const high = finiteNumber(bar.high);
  const low = finiteNumber(bar.low);
  const close = finiteNumber(bar.close);
  const preClose = finiteNumber(bar.pre_close);
  const volume = finiteNumber(bar.volume);

  if (
    !isPandaDate(bar.date) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    preClose === null ||
    volume === null ||
    high < Math.max(open, close) ||
    low > Math.min(open, close) ||
    high < low ||
    volume < 0
  ) {
    return null;
  }

  return {
    symbol: bar.symbol,
    date: bar.date,
    close,
    high,
    low,
    name: bar.name,
    open,
    preClose,
    tradeStatus: bar.trade_status,
    tradable: bar.tradable,
    volume,
    sma20: finiteNumber(bar.sma_20),
    rsi14: finiteNumber(bar.rsi_14),
    volatility20: finiteNumber(bar.volatility_20),
  };
}

function finiteNumber(value: PandaNumericValue) {
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPandaDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePandaDateSeconds(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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

function calculateRsi(bars: NormalizedPandaBar[]) {
  let gains = 0;
  let losses = 0;

  for (const bar of bars) {
    const dailyReturn = bar.preClose === 0 ? 0 : bar.close / bar.preClose - 1;
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

function calculateAnnualizedVolatility(bars: NormalizedPandaBar[]) {
  const returns = bars.map((bar) => (bar.preClose === 0 ? 0 : bar.close / bar.preClose - 1));
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
  if (value >= 3) return 'negative';
  if (value <= 1.5) return 'positive';
  return 'neutral';
}

export const pandaHistoricalMarkets = PANDA_MARKET_DATASETS.map(adaptPandaMarketDataset);

export const pandaHistoricalMarket = pandaHistoricalMarkets[0];
