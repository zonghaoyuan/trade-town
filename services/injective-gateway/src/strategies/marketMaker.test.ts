import { quoteTwoSidedMarket } from './marketMaker';

describe('deterministic market maker', () => {
  test('widens the spread during a shock and skews away from inventory', () => {
    const calm = quoteTwoSidedMarket({
      fairValue: 100,
      volatility: 0.1,
      inventory: 0,
      inventoryLimit: 100,
    });
    const shocked = quoteTwoSidedMarket({
      fairValue: 100,
      volatility: 0.8,
      inventory: 70,
      inventoryLimit: 100,
      shockSeverity: 0.9,
    });
    expect(shocked.spreadBps).toBeGreaterThan(calm.spreadBps);
    expect(shocked.inventorySkewBps).toBeLessThan(0);
    expect(shocked.bid).toBeLessThan(shocked.ask);
  });
});
