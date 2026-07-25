import { randomUUID } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import dotenv from 'dotenv';
import { api } from '../../../convex/_generated/api';
import { TOWN_TRADERS, type TradeSide } from '../../../shared/finance';
import { PROVISION_MARKETS } from './provisionConfig';

dotenv.config({ path: process.env.INJECTIVE_ENV_FILE ?? '.env.local' });

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const argv = process.argv.slice(2);
  const agentName = requiredArgument(argv, '--agent');
  const side = readSide(requiredArgument(argv, '--side'));
  const quantity = readPositiveNumber(requiredArgument(argv, '--quantity'), '--quantity');
  const limitPrice = readPositiveNumber(requiredArgument(argv, '--price'), '--price');
  const symbol = (readArgument(argv, '--symbol') ?? 'ACME').toUpperCase();
  const rationale =
    readArgument(argv, '--rationale') ?? 'Operator-approved Injective Testnet order.';
  const intentId =
    readArgument(argv, '--intent-id') ??
    `${slug(agentName)}-${side}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const submit = argv.includes('--submit');

  if (!TOWN_TRADERS.some((trader) => trader.name === agentName)) {
    throw new Error(
      `Unknown Agent "${agentName}". Choose one of: ${TOWN_TRADERS.map((trader) => trader.name).join(', ')}.`,
    );
  }
  if (!PROVISION_MARKETS.some((market) => market.symbol === symbol)) {
    throw new Error(
      `Market ${symbol} is not enabled. Enabled markets: ${PROVISION_MARKETS.map((market) => market.symbol).join(', ')}.`,
    );
  }

  const order = {
    intentId,
    agentName,
    symbol,
    side,
    quantity,
    limitPrice,
    rationale,
  };
  console.log('[order-plan]', JSON.stringify(order, null, 2));
  if (!submit) {
    console.log('Dry run only. Add --submit to queue this order for the Convex Injective worker.');
    return;
  }

  const convexUrl = optionalEnv('CONVEX_URL') ?? optionalEnv('VITE_CONVEX_URL');
  const gatewaySecret =
    optionalEnv('INJECTIVE_CONTROL_SECRET') ?? optionalEnv('GATEWAY_SHARED_SECRET');
  if (!convexUrl || !gatewaySecret) {
    throw new Error('CONVEX_URL (or VITE_CONVEX_URL) and INJECTIVE_CONTROL_SECRET are required.');
  }
  const client = new ConvexHttpClient(convexUrl);
  const result = await client.mutation((api as any).finance.proposeTrade, {
    gatewaySecret,
    ...order,
  });
  console.log('[queued]', JSON.stringify(result));
}

function readArgument(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function requiredArgument(argv: string[], name: string) {
  const value = readArgument(argv, name);
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readSide(value: string): TradeSide {
  if (value === 'buy' || value === 'sell') {
    return value;
  }
  throw new Error('--side must be buy or sell.');
}

function readPositiveNumber(value: string, name: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
