import { getNetworkEndpoints, Network } from '@injectivelabs/networks';
import {
  IndexerGrpcAccountApi,
  IndexerGrpcSpotApi,
  MsgBroadcasterWithPk,
  MsgCreateSpotLimitOrder,
  PrivateKey,
  getEthereumAddress,
  getSpotMarketTensMultiplier,
  spotPriceFromChainPriceToFixed,
  spotPriceToChainPriceToFixed,
  spotQuantityFromChainQuantityToFixed,
  spotQuantityToChainQuantityToFixed,
} from '@injectivelabs/sdk-ts';
import { deriveSubaccountId, TradeSide } from '../../../shared/finance';

export type InjectiveClientConfig = {
  mode: 'read-only' | 'signing';
  privateKey?: string;
  operatorAddress?: string;
  marketIds: Record<string, string>;
};

export type ChainHealth = {
  ok: boolean;
  blockHeight?: number;
  checkedAt: number;
  error?: string;
};

export type LimitOrderIntent = {
  intentId: string;
  cid: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  limitPrice: number;
  subaccountNonce: number;
};

export type ChainMarketSnapshot = {
  marketSymbol: string;
  marketId: string;
  ticker: string;
  status: string;
  baseDenom: string;
  quoteDenom: string;
  baseDecimals: number;
  quoteDecimals: number;
  minPriceTick: number;
  minQuantityTick: number;
  minNotional: number;
  bestBid?: number;
  bestAsk?: number;
  lastPrice?: number;
  recentVolume: number;
  orderbookSequence?: number;
  observedAt: number;
};

export type ChainAccountSnapshot = {
  agentName: string;
  subaccountNonce: number;
  subaccountId: string;
  marketSymbol: string;
  quoteDenom: string;
  quoteAvailable: number;
  quoteTotal: number;
  baseDenom: string;
  baseAvailable: number;
  baseTotal: number;
  blockHeight?: number;
  observedAt: number;
};

export type ChainOrder = {
  cid: string;
  orderHash?: string;
  agentName?: string;
  marketSymbol: string;
  marketId: string;
  subaccountId: string;
  side: TradeSide;
  price: number;
  quantity: number;
  filledQuantity?: number;
  state: 'booked' | 'partial' | 'filled' | 'cancelled' | 'failed';
  createdAt?: number;
  updatedAt: number;
};

export type ChainFill = {
  fillKey: string;
  tradeId: string;
  orderHash?: string;
  cid?: string;
  executionSide?: string;
  marketSymbol: string;
  marketId: string;
  agentName: string;
  subaccountId: string;
  side: TradeSide;
  price: number;
  quantity: number;
  fee: number;
  executedAt: number;
};

export type ChainProjection = {
  markets: ChainMarketSnapshot[];
  accounts: ChainAccountSnapshot[];
  orders: ChainOrder[];
  fills: ChainFill[];
};

export class InjectiveClient {
  readonly endpoints = getNetworkEndpoints(Network.Testnet);
  readonly spot = new IndexerGrpcSpotApi(this.endpoints.indexer);
  readonly accounts = new IndexerGrpcAccountApi(this.endpoints.indexer);
  readonly operatorAddress?: string;
  private readonly broadcaster?: MsgBroadcasterWithPk;

  constructor(private readonly config: InjectiveClientConfig) {
    if (config.privateKey) {
      const privateKey = PrivateKey.fromHex(config.privateKey);
      const signerAddress = privateKey.toBech32();
      if (config.operatorAddress && config.operatorAddress !== signerAddress) {
        throw new Error('INJECTIVE_OPERATOR_ADDRESS does not match INJECTIVE_PRIVATE_KEY.');
      }
      this.operatorAddress = signerAddress;
      this.broadcaster = new MsgBroadcasterWithPk({
        privateKey,
        network: Network.Testnet,
        simulateTx: true,
      });
    } else {
      this.operatorAddress = config.operatorAddress;
    }
  }

  async health(): Promise<ChainHealth> {
    const checkedAt = Date.now();
    try {
      const response = await fetch(
        `${this.endpoints.rest}/cosmos/base/tendermint/v1beta1/blocks/latest`,
        { signal: AbortSignal.timeout(12_000) },
      );
      if (!response.ok) {
        throw new Error(`LCD returned HTTP ${response.status}.`);
      }
      const body = (await response.json()) as {
        block?: { header?: { height?: string } };
      };
      const blockHeight = Number(body.block?.header?.height);
      return {
        ok: Number.isSafeInteger(blockHeight),
        blockHeight: Number.isSafeInteger(blockHeight) ? blockHeight : undefined,
        checkedAt,
      };
    } catch (error) {
      return {
        ok: false,
        checkedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async submitLimitOrder(intent: LimitOrderIntent) {
    if (this.config.mode !== 'signing' || !this.broadcaster || !this.operatorAddress) {
      throw new Error('The Injective worker is not in signing mode.');
    }
    const marketId = this.config.marketIds[intent.symbol];
    if (!marketId) {
      throw new Error(`No Injective market id is configured for ${intent.symbol}.`);
    }
    const market = await this.spot.fetchMarket(marketId);
    if (!market.baseToken || !market.quoteToken) {
      throw new Error(`Market ${intent.symbol} is missing token metadata from the indexer.`);
    }
    const { priceTensMultiplier, quantityTensMultiplier } = getSpotMarketTensMultiplier({
      baseDecimals: market.baseToken.decimals,
      quoteDecimals: market.quoteToken.decimals,
      minPriceTickSize: market.minPriceTickSize,
      minQuantityTickSize: market.minQuantityTickSize,
    });
    const ethereumAddress = getEthereumAddress(this.operatorAddress);
    const subaccountId = deriveSubaccountId(ethereumAddress, intent.subaccountNonce);
    const price = spotPriceToChainPriceToFixed({
      value: intent.limitPrice,
      tensMultiplier: priceTensMultiplier,
      baseDecimals: market.baseToken.decimals,
      quoteDecimals: market.quoteToken.decimals,
    });
    const quantity = spotQuantityToChainQuantityToFixed({
      value: intent.quantity,
      tensMultiplier: quantityTensMultiplier,
      baseDecimals: market.baseToken.decimals,
    });
    const message = MsgCreateSpotLimitOrder.fromJSON({
      marketId,
      subaccountId,
      injectiveAddress: this.operatorAddress,
      feeRecipient: this.operatorAddress,
      orderType: intent.side === 'buy' ? 1 : 2,
      price,
      quantity,
      cid: intent.cid,
    });
    const response = await this.broadcaster.broadcast({
      msgs: message,
      memo: `Injective Trade Town ${intent.intentId}`.slice(0, 128),
    });
    return {
      txHash: response.txHash,
      blockHeight: response.height,
      rawLog: response.rawLog,
    };
  }

  async fetchProjection(
    marketIds: Record<string, string>,
    traders: readonly { name: string; subaccountNonce: number }[],
    blockHeight?: number,
  ): Promise<ChainProjection> {
    const projection: ChainProjection = { markets: [], accounts: [], orders: [], fills: [] };
    for (const [marketSymbol, marketId] of Object.entries(marketIds)) {
      const market = await this.spot.fetchMarket(marketId);
      if (!market.baseToken || !market.quoteToken) {
        throw new Error(`Market ${marketSymbol} is missing token metadata from the indexer.`);
      }
      const observedAt = Date.now();
      const baseDecimals = market.baseToken.decimals;
      const quoteDecimals = market.quoteToken.decimals;
      const context = { baseDecimals, quoteDecimals };
      const ethereumAddress = this.operatorAddress
        ? getEthereumAddress(this.operatorAddress)
        : undefined;
      const subaccounts = ethereumAddress
        ? traders.map((trader) => ({
            ...trader,
            subaccountId: deriveSubaccountId(ethereumAddress, trader.subaccountNonce),
          }))
        : [];
      const agentBySubaccount = new Map(
        subaccounts.map((trader) => [trader.subaccountId.toLowerCase(), trader.name]),
      );
      const subaccountIds = new Set(agentBySubaccount.keys());

      const [orderbook, marketTrades, activeOrders, orderHistory, accountTrades, balances] =
        await Promise.all([
          this.spot.fetchOrderbookV2(marketId),
          this.spot.fetchTrades({ marketId, pagination: { limit: 100 } }),
          subaccounts.length > 0
            ? this.spot.fetchOrders({ marketId, pagination: { limit: 100 } })
            : Promise.resolve({ orders: [], pagination: undefined }),
          subaccounts.length > 0
            ? this.spot.fetchOrderHistory({ marketId, pagination: { limit: 100 } })
            : Promise.resolve({ orderHistory: [], pagination: undefined }),
          this.operatorAddress
            ? this.spot.fetchTrades({
                marketId,
                accountAddress: this.operatorAddress,
                pagination: { limit: 100 },
              })
            : Promise.resolve({ trades: [], pagination: undefined }),
          fetchAccountBalances(this.accounts, subaccounts),
        ]);

      const marketTradeRows = marketTrades.trades.map((trade) => ({
        price: humanPrice(trade.price, context),
        quantity: humanQuantity(trade.quantity, context.baseDecimals),
        executedAt: normalizeTimestamp(trade.executedAt),
      }));
      const newestTrade = [...marketTradeRows].sort((a, b) => b.executedAt - a.executedAt)[0];
      const bidPrices = orderbook.buys.map((level) => humanPrice(level.price, context));
      const askPrices = orderbook.sells.map((level) => humanPrice(level.price, context));
      projection.markets.push({
        marketSymbol,
        marketId,
        ticker: market.ticker,
        status: market.marketStatus,
        baseDenom: market.baseDenom,
        quoteDenom: market.quoteDenom,
        baseDecimals,
        quoteDecimals,
        minPriceTick: humanPrice(market.minPriceTickSize, context),
        minQuantityTick: humanQuantity(market.minQuantityTickSize, baseDecimals),
        minNotional: humanDenomAmount(market.minNotional, quoteDecimals),
        bestBid: bidPrices.length > 0 ? Math.max(...bidPrices) : undefined,
        bestAsk: askPrices.length > 0 ? Math.min(...askPrices) : undefined,
        lastPrice: newestTrade?.price,
        recentVolume: marketTradeRows.reduce(
          (total, trade) => total + trade.price * trade.quantity,
          0,
        ),
        orderbookSequence: orderbook.sequence,
        observedAt,
      });

      for (const { trader, balances: rows } of balances) {
        const quote = rows.find((balance) => balance.denom === market.quoteDenom)?.deposit;
        const base = rows.find((balance) => balance.denom === market.baseDenom)?.deposit;
        projection.accounts.push({
          agentName: trader.name,
          subaccountNonce: trader.subaccountNonce,
          subaccountId: trader.subaccountId,
          marketSymbol,
          quoteDenom: market.quoteDenom,
          quoteAvailable: humanDenomAmount(quote?.availableBalance ?? 0, quoteDecimals),
          quoteTotal: humanDenomAmount(quote?.totalBalance ?? 0, quoteDecimals),
          baseDenom: market.baseDenom,
          baseAvailable: humanDenomAmount(base?.availableBalance ?? 0, baseDecimals),
          baseTotal: humanDenomAmount(base?.totalBalance ?? 0, baseDecimals),
          blockHeight,
          observedAt,
        });
      }

      const normalizedOrders = [
        ...activeOrders.orders.map((order) =>
          normalizeOrder(
            {
              ...order,
              filledQuantity: subtractChainAmounts(order.quantity, order.unfilledQuantity),
              direction: order.orderSide,
            },
            marketSymbol,
            context,
            agentBySubaccount,
          ),
        ),
        ...orderHistory.orderHistory.map((order) =>
          normalizeOrder(order, marketSymbol, context, agentBySubaccount),
        ),
      ].filter((order): order is ChainOrder => Boolean(order));
      const orderByIdentity = new Map<string, ChainOrder>();
      for (const order of normalizedOrders) {
        const identity = order.orderHash || `${order.subaccountId}:${order.cid}`;
        const previous = orderByIdentity.get(identity);
        if (!previous || previous.updatedAt <= order.updatedAt) {
          orderByIdentity.set(identity, order);
        }
      }
      projection.orders.push(...orderByIdentity.values());
      projection.fills.push(
        ...accountTrades.trades
          .map((trade) => normalizeTrade(trade, marketSymbol, context, agentBySubaccount))
          .filter((trade): trade is ChainFill => Boolean(trade)),
      );

      // Keep only records owned by the configured town subaccounts.
      projection.orders = projection.orders.filter((order) =>
        subaccountIds.has(order.subaccountId.toLowerCase()),
      );
    }
    return projection;
  }
}

function normalizeTrade(
  trade: {
    tradeId: string;
    orderHash: string;
    cid: string;
    executionSide: unknown;
    tradeDirection: unknown;
    marketId: string;
    subaccountId: string;
    price: string;
    quantity: string;
    fee: string;
    executedAt: number;
  },
  marketSymbol: string,
  context: { baseDecimals: number; quoteDecimals: number },
  agentBySubaccount: Map<string, string>,
): ChainFill | undefined {
  const agentName = agentBySubaccount.get(trade.subaccountId.toLowerCase());
  if (!agentName) return undefined;
  const executionSide = String(trade.executionSide ?? '');
  return {
    fillKey: `${trade.tradeId}:${trade.subaccountId.toLowerCase()}:${executionSide}`,
    tradeId: trade.tradeId,
    orderHash: trade.orderHash || undefined,
    cid: trade.cid || undefined,
    executionSide: executionSide || undefined,
    marketSymbol,
    marketId: trade.marketId,
    agentName,
    subaccountId: trade.subaccountId,
    side: normalizeSide(trade.tradeDirection),
    price: humanPrice(trade.price, context),
    quantity: humanQuantity(trade.quantity, context.baseDecimals),
    fee: humanDenomAmount(trade.fee, context.quoteDecimals),
    executedAt: normalizeTimestamp(trade.executedAt),
  };
}

function normalizeOrder(
  order: {
    cid: string;
    orderHash: string;
    marketId: string;
    subaccountId: string;
    price: string;
    quantity: string;
    filledQuantity?: string;
    state: unknown;
    direction: unknown;
    createdAt: number;
    updatedAt: number;
  },
  marketSymbol: string,
  context: { baseDecimals: number; quoteDecimals: number },
  agentBySubaccount: Map<string, string>,
): ChainOrder | undefined {
  const agentName = agentBySubaccount.get(order.subaccountId.toLowerCase());
  if (!agentName) return undefined;
  const quantity = humanQuantity(order.quantity, context.baseDecimals);
  const filledQuantity = order.filledQuantity
    ? humanQuantity(order.filledQuantity, context.baseDecimals)
    : undefined;
  return {
    cid: order.cid || `order-${order.orderHash.slice(-24)}`,
    orderHash: order.orderHash || undefined,
    agentName,
    marketSymbol,
    marketId: order.marketId,
    subaccountId: order.subaccountId,
    side: normalizeSide(order.direction),
    price: humanPrice(order.price, context),
    quantity,
    filledQuantity,
    state: normalizeOrderState(order.state, filledQuantity, quantity),
    createdAt: normalizeTimestamp(order.createdAt),
    updatedAt: normalizeTimestamp(order.updatedAt),
  };
}

function normalizeSide(value: unknown): TradeSide {
  const normalized = String(value ?? '').toLowerCase();
  return normalized.includes('sell') || normalized === '2' ? 'sell' : 'buy';
}

function normalizeOrderState(
  value: unknown,
  filledQuantity: number | undefined,
  quantity: number,
): ChainOrder['state'] {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('fail') || normalized.includes('reject')) return 'failed';
  if (normalized.includes('fill') && !normalized.includes('partial')) return 'filled';
  if (
    normalized.includes('partial') ||
    (filledQuantity !== undefined && filledQuantity > 0 && filledQuantity < quantity)
  ) {
    return 'partial';
  }
  return 'booked';
}

function humanPrice(
  value: string | number,
  context: { baseDecimals: number; quoteDecimals: number },
) {
  return Number(
    spotPriceFromChainPriceToFixed({
      value,
      baseDecimals: context.baseDecimals,
      quoteDecimals: context.quoteDecimals,
      decimalPlaces: 12,
    }),
  );
}

function humanQuantity(value: string | number, baseDecimals: number) {
  return Number(
    spotQuantityFromChainQuantityToFixed({
      value,
      baseDecimals,
      decimalPlaces: 12,
    }),
  );
}

function humanDenomAmount(value: string | number, decimals: number) {
  return Number(value) / 10 ** decimals;
}

function subtractChainAmounts(total: string, remaining: string) {
  try {
    return (BigInt(total) - BigInt(remaining)).toString();
  } catch {
    return String(Math.max(0, Number(total) - Number(remaining)));
  }
}

function normalizeTimestamp(value: number) {
  if (!value) return Date.now();
  if (value > 1e15) return Math.floor(value / 1e6);
  if (value < 1e12) return Math.floor(value * 1000);
  return Math.floor(value);
}

async function fetchAccountBalances(
  accountApi: IndexerGrpcAccountApi,
  traders: Array<{
    name: string;
    subaccountNonce: number;
    subaccountId: string;
  }>,
) {
  const results: Array<{
    trader: (typeof traders)[number];
    balances: Awaited<ReturnType<IndexerGrpcAccountApi['fetchSubaccountBalancesList']>>;
  }> = [];
  for (let index = 0; index < traders.length; index += 2) {
    const batch = await Promise.all(
      traders.slice(index, index + 2).map(async (trader) => {
        try {
          return {
            trader,
            balances: await fetchBalancesWithRetry(accountApi, trader.subaccountId),
          };
        } catch (error) {
          console.warn(
            `[balances:${trader.name}] ${error instanceof Error ? error.message : String(error)}`,
          );
          return undefined;
        }
      }),
    );
    results.push(
      ...batch.filter((result): result is NonNullable<typeof result> => Boolean(result)),
    );
  }
  return results;
}

async function fetchBalancesWithRetry(accountApi: IndexerGrpcAccountApi, subaccountId: string) {
  try {
    return await accountApi.fetchSubaccountBalancesList(subaccountId);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await accountApi.fetchSubaccountBalancesList(subaccountId);
  }
}
