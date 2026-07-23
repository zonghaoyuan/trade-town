import { assessTradeRisk, TradeSide } from '../../shared/finance';

export type FinancialBelief = {
  symbol: string;
  fairValue: number;
  sentiment: number;
  confidence: number;
  evidence: string[];
};

export type BehavioralBiases = {
  lossAversion: number;
  herding: number;
  anchoring: number;
  overconfidence: number;
};

export type MarketSignal = {
  symbol: string;
  lastPrice: number;
  referencePrice: number;
  eventImpact: number;
  crowdSentiment: number;
  evidence: string;
};

export type PortfolioState = {
  cash: number;
  netAssetValue: number;
  quantity: number;
  averagePrice: number;
};

export type FinancialIntention =
  | {
      action: 'hold';
      reason: string;
      updatedBelief: FinancialBelief;
    }
  | {
      action: 'trade';
      side: TradeSide;
      quantity: number;
      limitPrice: number;
      reason: string;
      updatedBelief: FinancialBelief;
    };

/**
 * TwinMarket-inspired BDI semantics without its local matching engine.
 *
 * The function updates a belief from market/news/social signals, converts the
 * belief into a portfolio desire, and emits a risk-checked intent. The caller
 * may persist the intent, but only an Injective fill may update holdings.
 */
export function formFinancialIntention(args: {
  belief: FinancialBelief;
  biases: BehavioralBiases;
  signal: MarketSignal;
  portfolio: PortfolioState;
  riskTolerance: number;
}): FinancialIntention {
  const { belief, biases, signal, portfolio } = args;
  const anchor =
    belief.fairValue * biases.anchoring + signal.referencePrice * (1 - biases.anchoring);
  const socialImpact = signal.crowdSentiment * biases.herding;
  const evidenceImpact = signal.eventImpact * (1 - biases.herding);
  const rawSentiment = clamp(belief.sentiment * 0.35 + socialImpact + evidenceImpact, -1, 1);
  const confidence = clamp(
    belief.confidence * 0.55 + Math.abs(signal.eventImpact) * 0.3 + biases.overconfidence * 0.2,
    0.05,
    0.98,
  );
  const fairValue = Math.max(0.000001, anchor * (1 + rawSentiment * 0.12 * confidence));
  const updatedBelief: FinancialBelief = {
    symbol: signal.symbol,
    fairValue,
    sentiment: rawSentiment,
    confidence,
    evidence: [...belief.evidence.slice(-3), signal.evidence],
  };

  const mispricing = (fairValue - signal.lastPrice) / signal.lastPrice;
  const conviction = Math.abs(mispricing) * confidence;
  const threshold = 0.015 + (1 - args.riskTolerance) * 0.035;
  if (conviction < threshold) {
    return {
      action: 'hold',
      reason: `Conviction ${(conviction * 100).toFixed(1)}% is below the decision threshold.`,
      updatedBelief,
    };
  }

  const side: TradeSide = mispricing > 0 ? 'buy' : 'sell';
  const lossAversionPenalty =
    side === 'sell' && signal.lastPrice < portfolio.averagePrice
      ? clamp(1 - biases.lossAversion * 0.25, 0.35, 1)
      : 1;
  const targetNotional =
    portfolio.netAssetValue *
    clamp(conviction * (0.35 + args.riskTolerance * 0.65), 0.01, 0.1) *
    lossAversionPenalty;
  const limitPrice =
    side === 'buy' ? signal.lastPrice * (1 - 0.0015) : signal.lastPrice * (1 + 0.0015);
  const quantity = Math.max(0.01, roundTo(targetNotional / limitPrice, 2));
  const risk = assessTradeRisk({
    side,
    quantity,
    limitPrice,
    cash: portfolio.cash,
    currentPosition: portfolio.quantity,
    netAssetValue: portfolio.netAssetValue,
    maxOrderNavRatio: 0.04 + args.riskTolerance * 0.08,
    maxPositionNavRatio: 0.16 + args.riskTolerance * 0.2,
  });
  if (!risk.accepted) {
    return {
      action: 'hold',
      reason: `Risk layer blocked the desired trade: ${risk.reason}`,
      updatedBelief,
    };
  }
  return {
    action: 'trade',
    side,
    quantity,
    limitPrice: roundTo(limitPrice, 4),
    reason: `${signal.evidence} Fair value is ${((mispricing || 0) * 100).toFixed(
      1,
    )}% from the confirmed market price.`,
    updatedBelief,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
