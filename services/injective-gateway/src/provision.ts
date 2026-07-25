import dotenv from 'dotenv';
import {
  ChainGrpcExchangeApi,
  IndexerGrpcSpotApi,
  MsgBroadcasterWithPk,
  MsgCreateDenom,
  MsgDeposit,
  MsgInstantSpotMarketLaunchV2,
  MsgMint,
  PrivateKey,
} from '@injectivelabs/sdk-ts';
import { getNetworkEndpoints, Network } from '@injectivelabs/networks';
import { deriveSubaccountId, TOWN_TRADERS } from '../../../shared/finance';
import { getEthereumAddress } from '@injectivelabs/sdk-ts';
import {
  PROVISION_ALLOCATION,
  PROVISION_MARKETS,
  PROVISION_QUOTE_ASSET,
  PROVISION_TOKENS,
} from './provisionConfig';

dotenv.config({ path: process.env.GATEWAY_ENV_FILE ?? '.env.local' });

type ProvisionStage = 'tokens' | 'markets' | 'funding';

const args = process.argv.slice(2);
const shouldBroadcast = args.includes('--broadcast');
const shouldSimulate = args.includes('--simulate');
const stage = readStage(args);
const privateKeyHex = process.env.INJECTIVE_PRIVATE_KEY?.trim();
const privateKey = privateKeyHex ? PrivateKey.fromHex(privateKeyHex) : undefined;
const operatorAddress = privateKey?.toBech32() ?? '<operator-address>';

if (shouldBroadcast && shouldSimulate) {
  throw new Error('Choose either --broadcast or --simulate, not both.');
}

if (!shouldBroadcast && !shouldSimulate) {
  console.log(
    JSON.stringify(
      {
        network: 'injective-888',
        mode: 'plan-only',
        operatorAddress,
        tokens: PROVISION_TOKENS.map((token) => ({
          ...token,
          denom: `factory/${operatorAddress}/${token.subdenom}`,
        })),
        markets: PROVISION_MARKETS.map((market) => ({
          ticker: `${market.symbol}/${market.quoteToken}`,
          baseDenom: `factory/${operatorAddress}/${market.baseToken.toLowerCase()}`,
          quoteDenom: market.quoteDenom,
          minPriceTickSize: market.minPriceTick,
          minQuantityTickSize: market.minQuantityTick,
          minNotional: market.minNotional,
          baseDecimals: market.baseDecimals,
          quoteDecimals: market.quoteDecimals,
          messageVersion: 'v2',
        })),
        funding: {
          subaccounts: TOWN_TRADERS.length,
          injPerSubaccount: PROVISION_ALLOCATION.injPerSubaccount,
          acmePerSubaccount: PROVISION_ALLOCATION.baseUnitsPerSubaccount,
        },
        next: 'Do not rerun tokens for an existing denom. Simulate the ACME/INJ market stage before the explicit broadcast.',
      },
      null,
      2,
    ),
  );
} else {
  void executeStage().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

async function executeStage() {
  if (!privateKey || !privateKeyHex) {
    throw new Error('--broadcast and --simulate require INJECTIVE_PRIVATE_KEY.');
  }
  if (process.env.GATEWAY_MODE !== 'signing') {
    throw new Error('--broadcast and --simulate require GATEWAY_MODE=signing.');
  }
  if (shouldBroadcast && process.env.TESTNET_PROVISION_CONFIRM !== 'trade-town-testnet') {
    throw new Error(
      '--broadcast requires TESTNET_PROVISION_CONFIRM=trade-town-testnet to acknowledge fees.',
    );
  }
  if (!stage) {
    throw new Error(
      '--broadcast and --simulate require --stage=tokens, --stage=markets, or --stage=funding.',
    );
  }
  if (stage === 'markets') {
    await preflightMarkets(operatorAddress);
  }
  const broadcaster = new MsgBroadcasterWithPk({
    privateKey,
    network: Network.Testnet,
    simulateTx: true,
  });
  const messages = (() => {
    if (stage === 'tokens') {
      return PROVISION_TOKENS.flatMap((token) => {
        const denom = `factory/${operatorAddress}/${token.subdenom}`;
        return [
          MsgCreateDenom.fromJSON({
            sender: operatorAddress,
            subdenom: token.subdenom,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
          }),
          MsgMint.fromJSON({
            sender: operatorAddress,
            amount: { denom, amount: token.initialSupply },
          }),
        ];
      });
    }
    if (stage === 'markets') {
      return PROVISION_MARKETS.map((market) =>
        MsgInstantSpotMarketLaunchV2.fromJSON({
          proposer: operatorAddress,
          market: {
            ticker: `${market.symbol}/${market.quoteToken}`,
            baseDenom: `factory/${operatorAddress}/${market.baseToken.toLowerCase()}`,
            quoteDenom: market.quoteDenom,
            minPriceTickSize: market.minPriceTick,
            minQuantityTickSize: market.minQuantityTick,
            minNotional: market.minNotional,
            baseDecimals: market.baseDecimals,
            quoteDecimals: market.quoteDecimals,
          },
        }),
      );
    }
    const ethereumAddress = getEthereumAddress(operatorAddress);
    return TOWN_TRADERS.flatMap((trader) => {
      const subaccountId = deriveSubaccountId(ethereumAddress, trader.subaccountNonce);
      const inj = MsgDeposit.fromJSON({
        injectiveAddress: operatorAddress,
        subaccountId,
        amount: {
          denom: PROVISION_QUOTE_ASSET.denom,
          amount: PROVISION_ALLOCATION.injChainAmount,
        },
      });
      const bases = PROVISION_MARKETS.map((market) =>
        MsgDeposit.fromJSON({
          injectiveAddress: operatorAddress,
          subaccountId,
          amount: {
            denom: `factory/${operatorAddress}/${market.baseToken.toLowerCase()}`,
            amount: PROVISION_ALLOCATION.baseChainAmount,
          },
        }),
      );
      return [inj, ...bases];
    });
  })();
  const txHashes: string[] = [];
  for (let index = 0; index < messages.length; index += 10) {
    const transaction = {
      // sdk-ts 1.20.26 can encode v2 messages at runtime, but its
      // MsgBroadcasterTxOptions union has not yet added the v2 launch class.
      msgs: messages.slice(index, index + 10) as Parameters<
        MsgBroadcasterWithPk['broadcast']
      >[0]['msgs'],
      memo: `Injective Trade Town provision ${stage} ${Math.floor(index / 10) + 1}`,
    };
    if (shouldSimulate) {
      const response = await broadcaster.simulate(transaction);
      console.log(
        `[simulated:${stage}] batch ${Math.floor(index / 10) + 1} · gas ${response.gasInfo.gasUsed}`,
      );
    } else {
      const response = await broadcaster.broadcast(transaction);
      txHashes.push(response.txHash);
    }
  }
  if (shouldSimulate) {
    console.log(`[simulation-complete:${stage}] no transaction was broadcast`);
  } else {
    console.log(`[provisioned:${stage}] ${txHashes.join(',')}`);
  }
}

function readStage(values: string[]): ProvisionStage | undefined {
  const raw = values.find((value) => value.startsWith('--stage='))?.split('=')[1];
  if (!raw) {
    return undefined;
  }
  if (raw === 'tokens' || raw === 'markets' || raw === 'funding') {
    return raw;
  }
  throw new Error('--stage must be tokens, markets, or funding.');
}

async function preflightMarkets(address: string) {
  const endpoints = getNetworkEndpoints(Network.Testnet);
  const exchange = new ChainGrpcExchangeApi(endpoints.grpc);
  const spot = new IndexerGrpcSpotApi(endpoints.indexer);
  const quoteMinNotional = await exchange.fetchDenomMinNotional(PROVISION_QUOTE_ASSET.denom);

  if (!/^\d+$/.test(quoteMinNotional) || BigInt(quoteMinNotional) <= BigInt(0)) {
    throw new Error(
      `Quote denom ${PROVISION_QUOTE_ASSET.denom} has no Injective minimum notional configuration.`,
    );
  }

  const configuredMinNotional = decimalToChainAmount(
    PROVISION_QUOTE_ASSET.minNotional,
    PROVISION_QUOTE_ASSET.decimals,
  );
  if (BigInt(configuredMinNotional) < BigInt(quoteMinNotional)) {
    throw new Error(
      `Configured min notional ${PROVISION_QUOTE_ASSET.minNotional} ${PROVISION_QUOTE_ASSET.symbol} is below the chain minimum.`,
    );
  }

  for (const market of PROVISION_MARKETS) {
    const baseDenom = `factory/${address}/${market.baseToken.toLowerCase()}`;
    const existing = await spot.fetchMarkets({
      baseDenom,
      quoteDenom: market.quoteDenom,
    });
    if (existing.length > 0) {
      throw new Error(
        `${market.symbol}/${market.quoteToken} already exists as ${existing[0].marketId}. Configure INJECTIVE_MARKET_${market.symbol} instead of launching it again.`,
      );
    }
  }

  console.log(
    `[preflight:markets] ${PROVISION_QUOTE_ASSET.symbol} quote enabled · minimum ${PROVISION_QUOTE_ASSET.minNotional} ${PROVISION_QUOTE_ASSET.symbol} · no duplicate market`,
  );
}

export function decimalToChainAmount(value: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    throw new Error(`${value} has more than ${decimals} decimal places.`);
  }
  return `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
}
