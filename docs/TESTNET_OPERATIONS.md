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

The health check must report `injective-888` and a current height. Review the planned denoms,
supply, ticks, and subaccount allocations before signing.

## 3. Provision assets

Export the dedicated testnet private key only in the Gateway process environment. Then acknowledge
the testnet fees and run the token stage:

```bash
GATEWAY_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=tokens
```

Do not blindly retry a failed stage. Check the transaction first: TokenFactory denom creation is not
idempotent when the denom already exists.

## 4. Launch spot markets

Instant spot launch pays the chain's configured listing fee for every market:

```bash
GATEWAY_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=markets
```

Query the Indexer for the resulting market IDs, then set:

```bash
INJECTIVE_MARKET_ACME=0x...
INJECTIVE_MARKET_NOVA=0x...
INJECTIVE_MARKET_AURUM=0x...
INJECTIVE_MARKET_CRUDE=0x...
```

## 5. Fund exchange subaccounts

The funding stage deposits 100,000 TOWNUSD into every agent subaccount and 2,000 units of each focus
asset. It batches messages through the one signer queue:

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
