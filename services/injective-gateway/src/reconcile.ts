import { TradeSide } from '../../../shared/finance';

export type NormalizedFill = {
  fillKey: string;
  tradeId: string;
  orderHash?: string;
  cid?: string;
  executionSide?: string;
  marketId: string;
  subaccountId: string;
  side: TradeSide;
  price: number;
  quantity: number;
  fee: number;
  txHash?: string;
  blockHeight?: number;
  executedAt: number;
};

/**
 * Indexer SDK versions have used both single-item and list stream envelopes.
 * Normalize the stable trade fields and ignore incomplete messages; the periodic
 * indexer reconciliation can safely replay them because Convex keys on tradeId.
 */
export function normalizeSpotFills(payload: unknown, fallbackHeight: number): NormalizedFill[] {
  const records = unwrapRecords(payload);
  return records.flatMap((value) => {
    const marketId = readString(value, ['marketId', 'market_id']);
    const subaccountId = readString(value, [
      'subaccountId',
      'subaccount_id',
      'executionSideSubaccountId',
    ]);
    const tradeId = readString(value, ['tradeId', 'trade_id', 'executionId']);
    const txHash = readString(value, ['txHash', 'tx_hash', 'executionTxHash']);
    const price = readNumber(value, ['price', 'executionPrice']);
    const quantity = readNumber(value, ['quantity', 'executionQuantity']);
    if (!marketId || !subaccountId || !tradeId || !price || !quantity) {
      return [];
    }
    const executionSide = readString(value, ['executionSide', 'execution_side']);
    const direction = readString(value, [
      'tradeDirection',
      'direction',
      'orderSide',
    ])?.toLowerCase();
    const side: TradeSide = direction?.includes('sell') || direction === '2' ? 'sell' : 'buy';
    const timestamp = readNumber(value, ['executedAt', 'executed_at', 'timestamp']);
    const executedAt = normalizeTimestamp(timestamp);
    return [
      {
        fillKey: `${tradeId}:${subaccountId.toLowerCase()}:${executionSide ?? ''}`,
        tradeId,
        orderHash: readString(value, ['orderHash', 'order_hash']),
        cid: readString(value, ['cid']),
        executionSide,
        marketId,
        subaccountId,
        side,
        price,
        quantity,
        fee: readNumber(value, ['fee', 'executionFee']) ?? 0,
        txHash,
        blockHeight:
          readNumber(value, ['blockHeight', 'block_height']) ??
          (fallbackHeight > 0 ? fallbackHeight : undefined),
        executedAt,
      },
    ];
  });
}

function unwrapRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (!isRecord(payload)) {
    return [];
  }
  if (isRecord(payload.trade)) {
    return [payload.trade];
  }
  for (const key of ['trades', 'spotTrades', 'data']) {
    const nested = payload[key];
    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }
  }
  return [payload];
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTimestamp(value: number | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value > 1e15) {
    return Math.floor(value / 1e6);
  }
  if (value < 1e12) {
    return Math.floor(value * 1000);
  }
  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
