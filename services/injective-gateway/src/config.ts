import { INJECTIVE_TESTNET, TOWN_MARKETS } from '../../../shared/finance';

export type GatewayMode = 'read-only' | 'signing';

export type GatewayConfig = {
  mode: GatewayMode;
  network: typeof INJECTIVE_TESTNET;
  privateKey?: string;
  operatorAddress?: string;
  convexUrl?: string;
  gatewaySecret?: string;
  marketIds: Record<string, string>;
  pollIntervalMs: number;
  once: boolean;
};

export function loadGatewayConfig(argv = process.argv.slice(2)): GatewayConfig {
  const mode = readMode(process.env.GATEWAY_MODE);
  const privateKey = optionalEnv('INJECTIVE_PRIVATE_KEY');
  const operatorAddress = optionalEnv('INJECTIVE_OPERATOR_ADDRESS');
  const convexUrl = optionalEnv('CONVEX_URL');
  const gatewaySecret = optionalEnv('GATEWAY_SHARED_SECRET');
  const marketIds = Object.fromEntries(
    TOWN_MARKETS.flatMap((market) => {
      const marketId = optionalEnv(`INJECTIVE_MARKET_${market.symbol}`);
      return marketId ? [[market.symbol, marketId]] : [];
    }),
  );
  const pollIntervalMs = readPositiveNumber(process.env.GATEWAY_POLL_INTERVAL_MS, 5_000);

  if (mode === 'signing' && !privateKey) {
    throw new Error('GATEWAY_MODE=signing requires INJECTIVE_PRIVATE_KEY.');
  }
  if ((convexUrl && !gatewaySecret) || (!convexUrl && gatewaySecret)) {
    throw new Error('CONVEX_URL and GATEWAY_SHARED_SECRET must be configured together.');
  }
  if (privateKey && !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('INJECTIVE_PRIVATE_KEY must be a 0x-prefixed 32-byte key.');
  }
  if (operatorAddress && !/^inj1[0-9a-z]{38}$/.test(operatorAddress)) {
    throw new Error('INJECTIVE_OPERATOR_ADDRESS must be a valid Injective bech32 address.');
  }

  return {
    mode,
    network: INJECTIVE_TESTNET,
    privateKey,
    operatorAddress,
    convexUrl,
    gatewaySecret,
    marketIds,
    pollIntervalMs,
    once: argv.includes('--once'),
  };
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readMode(value: string | undefined): GatewayMode {
  if (!value || value === 'read-only') {
    return 'read-only';
  }
  if (value === 'signing') {
    return 'signing';
  }
  throw new Error('GATEWAY_MODE must be read-only or signing.');
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('GATEWAY_POLL_INTERVAL_MS must be a positive integer.');
  }
  return parsed;
}
