# Injective Testnet operations

These steps intentionally require an operator. The repository never generates, stores, or commits a
wallet.

## 1. Create and fund a dedicated wallet

Create a new wallet used only for this testnet demo. Record its `inj1…` address as
`INJECTIVE_OPERATOR_ADDRESS` and obtain testnet INJ from the current official faucet. Never reuse a
mainnet key.

Copy `.env.example` to an ignored local environment file and configure:

```bash
GATEWAY_MODE=read-only
INJECTIVE_OPERATOR_ADDRESS=inj1...
CONVEX_URL=https://...
GATEWAY_SHARED_SECRET=...
```

Set the same Gateway secret in Convex:

```bash
npx convex env set GATEWAY_SHARED_SECRET 'a-long-random-value'
```

## 2. Verify the read-only path

```bash
npm run gateway:check
npm run provision:plan
```

The health check must report `injective-888` and a current height. The plan must contain only the
`ACME` TokenFactory denom and one `ACME/INJ` market. Review its supply, ticks, minimum notional, and
subaccount allocations before signing. `TOWNUSD` remains the local simulation currency and is not
the live Testnet quote asset.

## 3. Provision assets

Export the dedicated testnet private key only in the Gateway process environment. For a new operator
wallet, acknowledge the testnet fees and run the token stage once:

```bash
GATEWAY_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=tokens
```

Do not run this stage for the current project wallet again: its ACME denom already exists.
TokenFactory denom creation is not idempotent. The previously created TOWNUSD denom may remain on
chain but is not used by the Testnet MVP market.

## 4. Launch spot markets

The current Testnet MVP uses native INJ as quote because a custom TOWNUSD quote denom requires extra
chain minimum-notional registration. First run the v2 market-launch simulation; it checks INJ's
minimum notional and refuses to create a duplicate market:

```bash
GATEWAY_MODE=signing \
npm run provision:testnet -- --simulate --stage=markets
```

Only after simulation succeeds, broadcast the instant spot launch. It pays the chain's configured
listing fee:

```bash
GATEWAY_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=markets
```

Query the Indexer for the resulting market ID, then set:

```bash
INJECTIVE_MARKET_ACME=0x...
```

## 5. Fund exchange subaccounts

The funding stage deposits 10 INJ and 2,000 ACME into each of the ten town subaccounts. It therefore
uses 100 INJ plus gas, independently of the market listing fee. It batches messages through the one
signer queue:

```bash
GATEWAY_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=funding
```

Verify every balance from the chain/indexer before starting autonomous orders.

## 6. Enable the Gateway

```bash
GATEWAY_MODE=signing npm run gateway:dev
```

The Gateway reports its chain height and configured market count. In Convex, the status changes to
`signing`; the UI should change from `SCENARIO PREVIEW` to `CHAIN DATA` after live cache data
exists.

## Operational rules

- Stop signing if the chain height stops advancing or the Gateway becomes `degraded`.
- Use a stable `intentId` and CID; never resubmit merely because the UI timed out.
- Reconcile a transaction hash before changing an intent from submitted to failed.
- Treat Indexer data as an efficient projection, not consensus.
- Rotate the dedicated testnet wallet if its key is ever exposed.
