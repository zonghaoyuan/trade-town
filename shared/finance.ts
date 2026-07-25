export const INJECTIVE_TESTNET = {
  chainId: 'injective-888',
  displayName: 'Injective Testnet',
  rpc: 'https://testnet.sentry.tm.injective.network',
  lcd: 'https://testnet.sentry.lcd.injective.network',
  indexer: 'https://testnet.sentry.exchange.grpc-web.injective.network',
  explorer: 'https://testnet.explorer.injective.network',
} as const;

export type AssetClass = 'company' | 'commodity';
export type MarketStatus = 'planned' | 'launching' | 'active' | 'paused';
export type TradeSide = 'buy' | 'sell';
export type TraderKind = 'ai';

export type TownMarket = {
  symbol: string;
  displayName: string;
  assetClass: AssetClass;
  description: string;
  baseToken: string;
  quoteToken: 'TOWNUSD';
  baseDecimals: number;
  quoteDecimals: number;
  minPriceTick: string;
  minQuantityTick: string;
  referencePrice: number;
  accent: string;
};

export const TOWN_MARKETS: readonly TownMarket[] = [
  {
    symbol: 'ACME',
    displayName: 'Acme Industries',
    assetClass: 'company',
    description: 'Industrial bellwether exposed to rates, freight, and public infrastructure.',
    baseToken: 'ACME',
    quoteToken: 'TOWNUSD',
    baseDecimals: 6,
    quoteDecimals: 6,
    minPriceTick: '0.01',
    minQuantityTick: '0.01',
    referencePrice: 42.7,
    accent: '#ffb84d',
  },
  {
    symbol: 'NOVA',
    displayName: 'Nova Compute',
    assetClass: 'company',
    description: 'High-growth compute company sensitive to liquidity and risk appetite.',
    baseToken: 'NOVA',
    quoteToken: 'TOWNUSD',
    baseDecimals: 6,
    quoteDecimals: 6,
    minPriceTick: '0.01',
    minQuantityTick: '0.01',
    referencePrice: 86.4,
    accent: '#4fd1c5',
  },
  {
    symbol: 'AURUM',
    displayName: 'Aurum Reserve',
    assetClass: 'commodity',
    description: 'Tokenized town gold proxy used as a flight-to-safety instrument.',
    baseToken: 'AURUM',
    quoteToken: 'TOWNUSD',
    baseDecimals: 6,
    quoteDecimals: 6,
    minPriceTick: '0.1',
    minQuantityTick: '0.001',
    referencePrice: 2380.2,
    accent: '#f4d35e',
  },
  {
    symbol: 'CRUDE',
    displayName: 'Frontier Crude',
    assetClass: 'commodity',
    description: 'Energy proxy reacting to supply, shipping, and macro-demand news.',
    baseToken: 'CRUDE',
    quoteToken: 'TOWNUSD',
    baseDecimals: 6,
    quoteDecimals: 6,
    minPriceTick: '0.01',
    minQuantityTick: '0.01',
    referencePrice: 73.18,
    accent: '#ff6b5f',
  },
] as const;

export type TraderProfileSeed = {
  name: string;
  kind: TraderKind;
  role: string;
  style: string;
  riskTolerance: number;
  subaccountNonce: number;
  focusSymbols: readonly string[];
};

export const TOWN_TRADERS: readonly TraderProfileSeed[] = [
  {
    name: 'Mira Chen',
    kind: 'ai',
    role: 'Macro strategist',
    style: 'Evidence-first, patient, and highly sensitive to monetary policy.',
    riskTolerance: 0.38,
    subaccountNonce: 1,
    focusSymbols: ['ACME', 'AURUM'],
  },
  {
    name: 'Theo Grant',
    kind: 'ai',
    role: 'Value investor',
    style: 'Contrarian and valuation-driven; buys panic only when balance sheets survive.',
    riskTolerance: 0.46,
    subaccountNonce: 2,
    focusSymbols: ['ACME', 'NOVA'],
  },
  {
    name: 'Imani Brooks',
    kind: 'ai',
    role: 'Momentum trader',
    style: 'Fast, social, and prone to amplify price trends after confirmation.',
    riskTolerance: 0.74,
    subaccountNonce: 3,
    focusSymbols: ['NOVA', 'CRUDE'],
  },
  {
    name: 'Sora Vale',
    kind: 'ai',
    role: 'News analyst',
    style: 'Connects headlines to sectors and shares concise, source-aware interpretations.',
    riskTolerance: 0.34,
    subaccountNonce: 4,
    focusSymbols: ['ACME', 'NOVA', 'AURUM', 'CRUDE'],
  },
  {
    name: 'Omar Reyes',
    kind: 'ai',
    role: 'Commodity specialist',
    style: 'Tracks inventories and geopolitics; distrusts company-market narratives.',
    riskTolerance: 0.57,
    subaccountNonce: 5,
    focusSymbols: ['AURUM', 'CRUDE'],
  },
  {
    name: 'Lin Park',
    kind: 'ai',
    role: 'Behavioral trader',
    style: 'Models crowd fear, anchoring, and information cascades before taking the other side.',
    riskTolerance: 0.52,
    subaccountNonce: 6,
    focusSymbols: ['ACME', 'NOVA'],
  },
  {
    name: 'Jules Hart',
    kind: 'ai',
    role: 'Fund manager',
    style: 'Portfolio-aware, disciplined, and constrained by drawdown and concentration limits.',
    riskTolerance: 0.41,
    subaccountNonce: 7,
    focusSymbols: ['ACME', 'NOVA', 'AURUM'],
  },
  {
    name: 'Neha Rao',
    kind: 'ai',
    role: 'Market supervisor',
    style: 'Monitors manipulation and liquidity stress; trades only to test market resilience.',
    riskTolerance: 0.22,
    subaccountNonce: 8,
    focusSymbols: ['ACME', 'NOVA', 'AURUM', 'CRUDE'],
  },
] as const;

export const DEFAULT_VISIBLE_AI_AGENTS = 8;
export const DEFAULT_AGENT_COUNT = DEFAULT_VISIBLE_AI_AGENTS;
export const MAX_AGENT_COUNT = 32;

export function deriveSubaccountId(ethereumAddress: string, nonce: number): string {
  const address = ethereumAddress.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(address)) {
    throw new Error('Expected a 20-byte Ethereum address for Injective subaccount derivation.');
  }
  if (!Number.isSafeInteger(nonce) || nonce < 0 || nonce > 0xffff_ffff) {
    throw new Error('Subaccount nonce must be a non-negative 32-bit integer.');
  }
  return `0x${address}${nonce.toString(16).padStart(24, '0')}`;
}

export function makeOrderCid(agentSlot: number, intentId: string): string {
  const safeIntent = intentId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(-20);
  return `town-${agentSlot}-${safeIntent}`.slice(0, 36);
}

export type RiskCheckInput = {
  side: TradeSide;
  quantity: number;
  limitPrice: number;
  cash: number;
  currentPosition: number;
  netAssetValue: number;
  maxOrderNavRatio?: number;
  maxPositionNavRatio?: number;
};

export type RiskCheck = {
  accepted: boolean;
  code: 'ok' | 'invalid_order' | 'insufficient_cash' | 'order_too_large' | 'position_limit';
  reason: string;
  notional: number;
};

export function assessTradeRisk(input: RiskCheckInput): RiskCheck {
  const maxOrderNavRatio = input.maxOrderNavRatio ?? 0.12;
  const maxPositionNavRatio = input.maxPositionNavRatio ?? 0.28;
  const notional = input.quantity * input.limitPrice;
  if (
    !Number.isFinite(notional) ||
    input.quantity <= 0 ||
    input.limitPrice <= 0 ||
    input.netAssetValue <= 0
  ) {
    return {
      accepted: false,
      code: 'invalid_order',
      reason: 'Quantity, price, and NAV must be positive finite values.',
      notional,
    };
  }
  if (notional > input.netAssetValue * maxOrderNavRatio) {
    return {
      accepted: false,
      code: 'order_too_large',
      reason: 'Order exceeds the configured share of portfolio NAV.',
      notional,
    };
  }
  if (input.side === 'buy' && notional > input.cash) {
    return {
      accepted: false,
      code: 'insufficient_cash',
      reason: 'Confirmed TOWNUSD balance is insufficient.',
      notional,
    };
  }
  const signedQuantity = input.side === 'buy' ? input.quantity : -input.quantity;
  const resultingExposure = Math.abs((input.currentPosition + signedQuantity) * input.limitPrice);
  if (resultingExposure > input.netAssetValue * maxPositionNavRatio) {
    return {
      accepted: false,
      code: 'position_limit',
      reason: 'Resulting asset exposure would exceed the concentration limit.',
      notional,
    };
  }
  return {
    accepted: true,
    code: 'ok',
    reason: 'Order is within cash, size, and concentration limits.',
    notional,
  };
}
