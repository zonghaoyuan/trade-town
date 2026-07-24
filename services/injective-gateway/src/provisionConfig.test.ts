import {
  PROVISION_ALLOCATION,
  PROVISION_MARKET_SYMBOLS,
  PROVISION_MARKETS,
  PROVISION_QUOTE_ASSET,
  PROVISION_TOKENS,
} from './provisionConfig';

describe('Injective MVP provisioning scope', () => {
  test('provisions only ACME for one ACME/INJ spot market', () => {
    expect(PROVISION_MARKET_SYMBOLS).toEqual(['ACME']);
    expect(PROVISION_TOKENS.map((token) => token.symbol)).toEqual(['ACME']);
    expect(PROVISION_MARKETS.map((market) => `${market.symbol}/${market.quoteToken}`)).toEqual([
      'ACME/INJ',
    ]);
    expect(PROVISION_QUOTE_ASSET).toEqual({
      symbol: 'INJ',
      denom: 'inj',
      decimals: 18,
      minNotional: '0.1',
    });
    expect(PROVISION_MARKETS[0]).toMatchObject({
      quoteDenom: 'inj',
      quoteDecimals: 18,
      minPriceTick: '0.0001',
      minNotional: '0.1',
    });
  });

  test('allocates both sides of the ACME market to every subaccount', () => {
    expect(PROVISION_ALLOCATION.injPerSubaccount).toBe('10');
    expect(PROVISION_ALLOCATION.injChainAmount).toBe('10000000000000000000');
    expect(PROVISION_ALLOCATION.baseUnitsPerSubaccount).toBe('2000');
  });
});
