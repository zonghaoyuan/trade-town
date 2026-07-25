import dotenv from 'dotenv';
import { TOWN_TRADERS } from '../../../shared/finance';
import { InjectiveClient } from './injective';
import { PROVISION_MARKETS } from './provisionConfig';

dotenv.config({ path: process.env.INJECTIVE_ENV_FILE ?? '.env.local' });

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const operatorAddress = requiredEnv('INJECTIVE_OPERATOR_ADDRESS');
  const marketIds = Object.fromEntries(
    PROVISION_MARKETS.map((market) => [
      market.symbol,
      requiredEnv(`INJECTIVE_MARKET_${market.symbol}`),
    ]),
  );
  const chain = new InjectiveClient({
    mode: 'read-only',
    operatorAddress,
    marketIds,
  });
  const health = await chain.health();
  if (!health.ok) {
    throw new Error(health.error ?? 'Injective Testnet health check failed.');
  }
  const projection = await chain.fetchProjection(marketIds, TOWN_TRADERS, health.blockHeight);
  console.log(
    JSON.stringify(
      {
        network: 'injective-888',
        mode: 'read-only',
        blockHeight: health.blockHeight,
        markets: projection.markets.length,
        accounts: projection.accounts.length,
        orders: projection.orders.length,
        fills: projection.fills.length,
      },
      null,
      2,
    ),
  );
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
