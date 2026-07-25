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
        fillKey: 'trade-1:0xsubaccount:',
        tradeId: 'trade-1',
        orderHash: undefined,
        cid: undefined,
        executionSide: undefined,
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

  test('accepts the actual Indexer V2 single-trade envelope without inventing a tx hash', () => {
    const fills = normalizeSpotFills(
      {
        trade: {
          tradeId: 'trade-v2',
          orderHash: '0xorder',
          cid: 'town-1-live',
          marketId: '0xmarket',
          subaccountId: '0xsubaccount',
          executionSide: 'taker',
          tradeDirection: 'buy',
          price: '0.1',
          quantity: '2',
          fee: '0.001',
          executedAt: 1_700_000_000_000,
        },
        operation: 'insert',
        timestamp: 1_700_000_000_000,
      },
      0,
    );

    expect(fills).toEqual([
      {
        fillKey: 'trade-v2:0xsubaccount:taker',
        tradeId: 'trade-v2',
        orderHash: '0xorder',
        cid: 'town-1-live',
        executionSide: 'taker',
        marketId: '0xmarket',
        subaccountId: '0xsubaccount',
        side: 'buy',
        price: 0.1,
        quantity: 2,
        fee: 0.001,
        txHash: undefined,
        blockHeight: undefined,
        executedAt: 1_700_000_000_000,
      },
    ]);
  });

  test('ignores incomplete stream heartbeats', () => {
    expect(normalizeSpotFills({ status: 'connected' }, 1234)).toEqual([]);
  });
});
