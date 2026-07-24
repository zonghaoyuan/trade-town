import { TOWN_MARKETS } from '../../../shared/finance';

export const PROVISION_MARKET_SYMBOLS = [
  'ACME',
  // 'NOVA',
  // 'AURUM',
  // 'CRUDE',
] as const;

export const PROVISION_QUOTE_ASSET = {
  symbol: 'INJ',
  denom: 'inj',
  decimals: 18,
  minNotional: '0.1',
} as const;

export const PROVISION_MARKETS = PROVISION_MARKET_SYMBOLS.map((symbol) => {
  const market = TOWN_MARKETS.find((candidate) => candidate.symbol === symbol);
  if (!market) {
    throw new Error(`Missing ${symbol} from TOWN_MARKETS.`);
  }
  return {
    ...market,
    quoteToken: PROVISION_QUOTE_ASSET.symbol,
    quoteDenom: PROVISION_QUOTE_ASSET.denom,
    quoteDecimals: PROVISION_QUOTE_ASSET.decimals,
    minPriceTick: '0.0001',
    minNotional: PROVISION_QUOTE_ASSET.minNotional,
  };
});

if (PROVISION_MARKETS.length === 0) {
  throw new Error('At least one Injective provisioning market must be enabled.');
}

// TOWNUSD remains the local simulation quote currency. An already-created
// TokenFactory TOWNUSD denom may stay on chain, but new testnet provisioning
// only needs the ACME base asset because INJ is the live quote asset.
export const PROVISION_TOKENS = PROVISION_MARKETS.map((market) => ({
  symbol: market.symbol,
  name: market.displayName,
  subdenom: market.baseToken.toLowerCase(),
  decimals: market.baseDecimals,
  initialSupply: '10000000000000',
}));

export const PROVISION_ALLOCATION = {
  injPerSubaccount: '10',
  injChainAmount: '10000000000000000000',
  baseUnitsPerSubaccount: '2000',
  baseChainAmount: '2000000000',
} as const;
