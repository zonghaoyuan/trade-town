import { formFinancialIntention } from './decision';

describe('TwinMarket-inspired BDI decision semantics', () => {
  test('turns a strong negative event into a risk-checked sell intention', () => {
    const intention = formFinancialIntention({
      belief: {
        symbol: 'ACME',
        fairValue: 44,
        sentiment: 0.05,
        confidence: 0.55,
        evidence: ['Stable infrastructure backlog'],
      },
      biases: {
        lossAversion: 0.6,
        herding: 0.45,
        anchoring: 0.45,
        overconfidence: 0.2,
      },
      signal: {
        symbol: 'ACME',
        lastPrice: 42.7,
        referencePrice: 42.7,
        eventImpact: -1,
        crowdSentiment: -1,
        evidence: 'The central bank raised rates by 75 bps.',
      },
      portfolio: {
        cash: 70_000,
        netAssetValue: 100_000,
        quantity: 100,
        averagePrice: 40,
      },
      riskTolerance: 0.6,
    });
    expect(intention.action).toBe('trade');
    if (intention.action === 'trade') {
      expect(intention.side).toBe('sell');
      expect(intention.quantity).toBeGreaterThan(0);
    }
  });
});
