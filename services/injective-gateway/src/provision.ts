import {
  MsgBroadcasterWithPk,
  MsgCreateDenom,
  MsgDeposit,
  MsgInstantSpotMarketLaunch,
  MsgMint,
  PrivateKey,
} from '@injectivelabs/sdk-ts';
import { Network } from '@injectivelabs/networks';
import { deriveSubaccountId, TOWN_MARKETS, TOWN_TRADERS } from '../../../shared/finance';
import { getEthereumAddress } from '@injectivelabs/sdk-ts';

type ProvisionStage = 'tokens' | 'markets' | 'funding';

const args = process.argv.slice(2);
const shouldBroadcast = args.includes('--broadcast');
const stage = readStage(args);
const privateKeyHex = process.env.INJECTIVE_PRIVATE_KEY?.trim();
const privateKey = privateKeyHex ? PrivateKey.fromHex(privateKeyHex) : undefined;
const operatorAddress = privateKey?.toBech32() ?? '<operator-address>';
const tokens = [
  {
    symbol: 'TOWNUSD',
    name: 'Trade Town Dollar',
    subdenom: 'townusd',
    decimals: 6,
    initialSupply: '100000000000000',
  },
  ...TOWN_MARKETS.map((market) => ({
    symbol: market.symbol,
    name: market.displayName,
    subdenom: market.baseToken.toLowerCase(),
    decimals: market.baseDecimals,
    initialSupply: '10000000000000',
  })),
];

if (!shouldBroadcast) {
  console.log(
    JSON.stringify(
      {
        network: 'injective-888',
        mode: 'plan-only',
        operatorAddress,
        tokens: tokens.map((token) => ({
          ...token,
          denom: `factory/${operatorAddress}/${token.subdenom}`,
        })),
        markets: TOWN_MARKETS.map((market) => ({
          ticker: `${market.symbol}/TOWNUSD`,
          baseDenom: `factory/${operatorAddress}/${market.baseToken.toLowerCase()}`,
          quoteDenom: `factory/${operatorAddress}/townusd`,
          minPriceTickSize: market.minPriceTick,
          minQuantityTickSize: market.minQuantityTick,
          minNotional: '1',
        })),
        funding: {
          subaccounts: TOWN_TRADERS.length,
          townUsdPerSubaccount: '100000',
          baseUnitsPerFocusedMarket: '2000',
        },
        next: 'Fund a dedicated testnet wallet, then run one explicit stage with --broadcast and the confirmation environment variable.',
      },
      null,
      2,
    ),
  );
} else {
  void broadcastStage().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

async function broadcastStage() {
  if (!privateKey || !privateKeyHex) {
    throw new Error('--broadcast requires INJECTIVE_PRIVATE_KEY.');
  }
  if (process.env.GATEWAY_MODE !== 'signing') {
    throw new Error('--broadcast requires GATEWAY_MODE=signing.');
  }
  if (process.env.TESTNET_PROVISION_CONFIRM !== 'trade-town-testnet') {
    throw new Error(
      '--broadcast requires TESTNET_PROVISION_CONFIRM=trade-town-testnet to acknowledge fees.',
    );
  }
  if (!stage) {
    throw new Error('--broadcast requires --stage=tokens, --stage=markets, or --stage=funding.');
  }
  const broadcaster = new MsgBroadcasterWithPk({
    privateKey,
    network: Network.Testnet,
    simulateTx: true,
  });
  const messages = (() => {
    if (stage === 'tokens') {
      return tokens.flatMap((token) => {
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
      return TOWN_MARKETS.map((market) =>
        MsgInstantSpotMarketLaunch.fromJSON({
          proposer: operatorAddress,
          market: {
            sender: operatorAddress,
            ticker: `${market.symbol}/TOWNUSD`,
            baseDenom: `factory/${operatorAddress}/${market.baseToken.toLowerCase()}`,
            quoteDenom: `factory/${operatorAddress}/townusd`,
            minPriceTickSize: market.minPriceTick,
            minQuantityTickSize: market.minQuantityTick,
            minNotional: '1',
            baseDecimals: market.baseDecimals,
            quoteDecimals: market.quoteDecimals,
          },
        }),
      );
    }
    const ethereumAddress = getEthereumAddress(operatorAddress);
    return TOWN_TRADERS.flatMap((trader) => {
      const subaccountId = deriveSubaccountId(ethereumAddress, trader.subaccountNonce);
      const townUsd = MsgDeposit.fromJSON({
        injectiveAddress: operatorAddress,
        subaccountId,
        amount: {
          denom: `factory/${operatorAddress}/townusd`,
          amount: '100000000000',
        },
      });
      const bases = trader.focusSymbols.map((symbol) =>
        MsgDeposit.fromJSON({
          injectiveAddress: operatorAddress,
          subaccountId,
          amount: {
            denom: `factory/${operatorAddress}/${symbol.toLowerCase()}`,
            amount: '2000000000',
          },
        }),
      );
      return [townUsd, ...bases];
    });
  })();
  const txHashes: string[] = [];
  for (let index = 0; index < messages.length; index += 10) {
    const response = await broadcaster.broadcast({
      msgs: messages.slice(index, index + 10),
      memo: `Trade Town provision ${stage} ${Math.floor(index / 10) + 1}`,
    });
    txHashes.push(response.txHash);
  }
  console.log(`[provisioned:${stage}] ${txHashes.join(',')}`);
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
