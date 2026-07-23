import { normalizeSpotFills } from './reconcile';

describe('Injective stream reconciliation', () => {
  test('normalizes a list envelope and preserves chain proof fields', () => {
    const fills = normalizeSpotFills(
      {
        trades: [
          {
            tradeId: 'trade-1',
            marketId: '0xmarket',
            subaccountId: '0xsubaccount',
            tradeDirection: 'sell',
            price: '42.7',
            quantity: '12',
            fee: '0.03',
            txHash: '0xtx',
            blockHeight: '1234',
            executedAt: '1700000000000',
          },
        ],
      },
      1000,
    );
    expect(fills).toEqual([
      {
        tradeId: 'trade-1',
        marketId: '0xmarket',
        subaccountId: '0xsubaccount',
        side: 'sell',
        price: 42.7,
        quantity: 12,
        fee: 0.03,
        txHash: '0xtx',
        blockHeight: 1234,
        executedAt: 1_700_000_000_000,
      },
    ]);
  });

  test('ignores incomplete stream heartbeats', () => {
    expect(normalizeSpotFills({ status: 'connected' }, 1234)).toEqual([]);
  });
});
