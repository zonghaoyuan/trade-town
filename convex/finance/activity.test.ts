import { buildEventFeed, buildTransactionFeed } from './activity';

describe('town activity feed', () => {
  test('orders intentions and confirmed fills by their latest observable time', () => {
    const transactions = buildTransactionFeed(
      [
        {
          intentId: 'intent-1',
          updatedAt: 100,
          agentName: 'Mira Chen',
          symbol: 'ACME',
          side: 'buy',
          quantity: 5,
          limitPrice: 0.09,
          state: 'risk_rejected',
          riskCode: 'position_limit',
          rationale: 'Test risk boundary.',
        },
        {
          intentId: 'intent-2',
          updatedAt: 300,
          agentName: 'Lin Park',
          symbol: 'ACME',
          side: 'sell',
          quantity: 2,
          limitPrice: 0.1,
          state: 'submitted',
          txHash: '0xsubmitted',
          rationale: 'Reduce exposure.',
        },
      ],
      [
        {
          fillKey: 'fill-1:sora:maker',
          tradeId: 'fill-1',
          executedAt: 200,
          agentName: 'Sora Vale',
          marketSymbol: 'ACME',
          side: 'buy',
          quantity: 1,
          price: 0.095,
          txHash: '0xfill',
          blockHeight: 123,
          fee: 0.001,
        },
      ],
      3,
    );

    expect(transactions.map((record) => record.id)).toEqual([
      'intent:intent-2',
      'fill:fill-1:sora:maker',
      'intent:intent-1',
    ]);
    expect(transactions[0]).toMatchObject({
      state: 'submitted',
      source: 'injective',
      txHash: '0xsubmitted',
    });
    expect(transactions[1]).toMatchObject({
      state: 'filled',
      source: 'injective',
      blockHeight: 123,
    });
    expect(transactions[2]).toMatchObject({
      state: 'risk_rejected',
      source: 'town',
      detail: 'position_limit',
    });
  });

  test('preserves factual event proof and market symbols', () => {
    const events = buildEventFeed([
      {
        eventId: 'fill-event',
        occurredAt: 123,
        kind: 'fill',
        source: 'Sora Vale',
        headline: 'Filled BUY 1 ACME',
        summary: 'Confirmed on Injective Testnet.',
        symbols: ['ACME'],
        txHash: '0xproof',
        blockHeight: 99,
      },
    ]);

    expect(events).toEqual([
      {
        id: 'fill-event',
        occurredAt: 123,
        kind: 'fill',
        actor: 'Sora Vale',
        title: 'Filled BUY 1 ACME',
        detail: 'Confirmed on Injective Testnet.',
        symbols: ['ACME'],
        txHash: '0xproof',
        blockHeight: 99,
      },
    ]);
  });

  test('labels LLM replay intents as paper trades', () => {
    const transactions = buildTransactionFeed(
      [
        {
          intentId: 'replay:day-1:intent-1',
          updatedAt: 100,
          agentName: 'Mira Chen',
          symbol: '002594.SZ',
          side: 'buy',
          quantity: 20,
          limitPrice: 101,
          state: 'proposed',
          rationale: 'Day 1/30 · simulated fill',
        },
      ],
      [],
      10,
    );

    expect(transactions[0]).toMatchObject({
      source: 'paper',
      state: 'proposed',
    });
  });
});
