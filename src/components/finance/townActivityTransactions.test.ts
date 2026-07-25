import type { DashboardExecution } from '../../finance/demoData';
import { mergeTransactions } from './townActivityTransactions';

describe('Panda paper activity', () => {
  const execution = (
    id: string,
    type: DashboardExecution['type'],
    occurredAt: number,
  ): DashboardExecution => ({
    id,
    time: '15:00:20',
    occurredAt,
    agentName: 'Mira Chen',
    symbol: '002594.SZ',
    type,
    side: 'BUY',
    quantity: 100,
    price: 300,
    priceUnit: 'CNY',
    state: type === 'risk_rejected' ? 'REJECTED' : 'FILLED',
    isSimulated: true,
    reference: `paper:${id}`,
  });

  it('adds fills and risk results to Live Trades while omitting duplicate order intents', () => {
    const records = mergeTransactions(
      [],
      [
        execution('order', 'order', 1),
        execution('fill', 'fill', 2),
        execution('risk', 'risk_rejected', 3),
      ],
    );

    expect(records.map((record) => [record.id, record.state, record.source])).toEqual([
      ['risk', 'risk_rejected', 'paper'],
      ['fill', 'filled', 'paper'],
    ]);
  });

  it('keeps the active Panda day ahead of stale town intents while preserving chain fills', () => {
    const records = mergeTransactions(
      [
        {
          id: 'stale-town',
          occurredAt: 9_000,
          agentName: 'Theo Grant',
          symbol: 'ACME',
          side: 'buy',
          quantity: 1,
          state: 'proposed',
          source: 'town',
        },
        {
          id: 'chain-fill',
          occurredAt: 8_000,
          agentName: 'Sora Vale',
          symbol: 'ACME',
          side: 'sell',
          quantity: 1,
          price: 42,
          state: 'filled',
          source: 'injective',
          txHash: '0xproof',
        },
      ],
      [execution('current-paper-fill', 'fill', 10)],
    );

    expect(records.map((record) => record.id)).toEqual([
      'current-paper-fill',
      'chain-fill',
    ]);
  });
});
