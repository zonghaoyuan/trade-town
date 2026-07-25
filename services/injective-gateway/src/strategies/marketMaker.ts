export type MarketMakerQuoteInput = {
  fairValue: number;
  volatility: number;
  inventory: number;
  inventoryLimit: number;
  baseSpreadBps?: number;
  shockSeverity?: number;
};

export type MarketMakerQuotes = {
  bid: number;
  ask: number;
  size: number;
  spreadBps: number;
  inventorySkewBps: number;
};

/**
 * Deterministic quoting used by Delta-7 and Sigma-2.
 * This never calls an LLM and never bypasses the Convex Injective risk controls.
 */
export function quoteTwoSidedMarket(input: MarketMakerQuoteInput): MarketMakerQuotes {
  if (input.fairValue <= 0 || input.inventoryLimit <= 0) {
    throw new Error('Fair value and inventory limit must be positive.');
  }
  const baseSpreadBps = input.baseSpreadBps ?? 18;
  const shockMultiplier = 1 + clamp(input.shockSeverity ?? 0, 0, 1) * 2.5;
  const volatilityMultiplier = 1 + clamp(input.volatility, 0, 2) * 1.5;
  const spreadBps = baseSpreadBps * shockMultiplier * volatilityMultiplier;
  const inventoryRatio = clamp(input.inventory / input.inventoryLimit, -1, 1);
  const inventorySkewBps = -inventoryRatio * spreadBps * 0.65;
  const halfSpread = spreadBps / 20_000;
  const center = input.fairValue * (1 + inventorySkewBps / 10_000);
  const bid = round(center * (1 - halfSpread), 4);
  const ask = round(center * (1 + halfSpread), 4);
  const size = round(Math.max(0.01, (1 - Math.abs(inventoryRatio)) * 25), 2);
  return { bid, ask, size, spreadBps, inventorySkewBps };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
