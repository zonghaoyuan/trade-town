import type {
  TownEventRecord,
  TownTransactionRecord,
  TownTransactionState,
} from '../../shared/activity';

type ActivityIntent = {
  intentId: string;
  updatedAt: number;
  agentName: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  limitPrice?: number;
  state: Exclude<TownTransactionState, 'filled'>;
  txHash?: string;
  error?: string;
  riskCode?: string;
  rationale: string;
};

type ActivityFill = {
  tradeId: string;
  executedAt: number;
  agentName: string;
  marketSymbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  txHash: string;
  blockHeight: number;
  fee: number;
};

type ActivityEvent = {
  eventId: string;
  occurredAt: number;
  kind: TownEventRecord['kind'];
  source: string;
  headline: string;
  summary: string;
  symbols: string[];
  txHash?: string;
  blockHeight?: number;
};

export function buildTransactionFeed(
  intents: ActivityIntent[],
  fills: ActivityFill[],
  limit: number,
): TownTransactionRecord[] {
  const intentRecords: TownTransactionRecord[] = intents.map((intent) => ({
    id: `intent:${intent.intentId}`,
    occurredAt: intent.updatedAt,
    agentName: intent.agentName,
    symbol: intent.symbol,
    side: intent.side,
    quantity: intent.quantity,
    price: intent.limitPrice,
    state: intent.state,
    source: intent.txHash ? 'injective' : 'town',
    txHash: intent.txHash,
    detail: intent.error ?? intent.riskCode ?? intent.rationale,
  }));
  const fillRecords: TownTransactionRecord[] = fills.map((fill) => ({
    id: `fill:${fill.tradeId}`,
    occurredAt: fill.executedAt,
    agentName: fill.agentName,
    symbol: fill.marketSymbol,
    side: fill.side,
    quantity: fill.quantity,
    price: fill.price,
    state: 'filled',
    source: 'injective',
    txHash: fill.txHash,
    blockHeight: fill.blockHeight,
    fee: fill.fee,
    detail: `Confirmed on Injective Testnet · fee ${fill.fee}`,
  }));

  return [...intentRecords, ...fillRecords]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, limit);
}

export function buildEventFeed(events: ActivityEvent[]): TownEventRecord[] {
  return events.map((event) => ({
    id: event.eventId,
    occurredAt: event.occurredAt,
    kind: event.kind,
    actor: event.source,
    title: event.headline,
    detail: event.summary,
    symbols: event.symbols,
    txHash: event.txHash,
    blockHeight: event.blockHeight,
  }));
}
