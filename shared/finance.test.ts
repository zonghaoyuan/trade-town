import {
  assessTradeRisk,
  DEFAULT_AGENT_COUNT,
  deriveSubaccountId,
  makeOrderCid,
  TOWN_TRADERS,
} from './finance';

describe('Injective finance primitives', () => {
  test('keeps exactly eight AI traders and no liquidity-only profiles', () => {
    expect(DEFAULT_AGENT_COUNT).toBe(8);
    expect(TOWN_TRADERS).toHaveLength(8);
    expect(TOWN_TRADERS.every((trader) => trader.kind === 'ai')).toBe(true);
    expect(TOWN_TRADERS.map((trader) => trader.subaccountNonce)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('derives a 32-byte subaccount id from one operator wallet', () => {
    expect(deriveSubaccountId('0x1111111111111111111111111111111111111111', 10)).toBe(
      '0x111111111111111111111111111111111111111100000000000000000000000a',
    );
  });

  test('creates an Injective-compatible CID no longer than 36 characters', () => {
    const cid = makeOrderCid(10, 'EVENT_2026_POLICY_RATE_SHOCK_LONG_IDENTIFIER');
    expect(cid.length).toBeLessThanOrEqual(36);
    expect(cid).toMatch(/^town-10-[a-z0-9-]+$/);
  });

  test('rejects orders that exceed the NAV limit', () => {
    const result = assessTradeRisk({
      side: 'buy',
      quantity: 100,
      limitPrice: 200,
      cash: 100_000,
      currentPosition: 0,
      netAssetValue: 100_000,
      maxOrderNavRatio: 0.1,
    });
    expect(result.accepted).toBe(false);
    expect(result.code).toBe('order_too_large');
  });
});
