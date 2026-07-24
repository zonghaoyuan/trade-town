import { getNetworkEndpoints, Network } from '@injectivelabs/networks';
import {
  IndexerGrpcSpotApi,
  MsgBroadcasterWithPk,
  MsgCreateSpotLimitOrder,
  PrivateKey,
  getEthereumAddress,
  getSpotMarketTensMultiplier,
  spotPriceToChainPriceToFixed,
  spotQuantityToChainQuantityToFixed,
} from '@injectivelabs/sdk-ts';
import { deriveSubaccountId, TradeSide } from '../../../shared/finance';
import { GatewayConfig } from './config';

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

export class InjectiveClient {
  readonly endpoints = getNetworkEndpoints(Network.Testnet);
  readonly spot = new IndexerGrpcSpotApi(this.endpoints.indexer);
  readonly operatorAddress?: string;
  private readonly broadcaster?: MsgBroadcasterWithPk;

  constructor(private readonly config: GatewayConfig) {
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

  async submitLimitOrder(intent: LimitOrderIntent): Promise<string> {
    if (this.config.mode !== 'signing' || !this.broadcaster || !this.operatorAddress) {
      throw new Error('The Gateway is not in signing mode.');
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
    return response.txHash;
  }
}
