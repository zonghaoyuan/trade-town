# Injective Testnet operations

These steps intentionally require an operator. The repository never generates, stores, or commits a
wallet. The runtime worker runs inside Convex; there is no standalone Gateway service to deploy.

## 0. Production deployment prerequisite

Pushing Git commits does not deploy uncommitted files or copy local Convex environment variables.
Before deployment:

1. Commit and push the intended working-tree changes.
2. Make sure the repository is linked to a cloud Convex project. An `anonymous:` `CONVEX_DEPLOYMENT`
   is local-only and cannot be used as production.
3. For local manual deployment, sign in and link the existing project:

   ```bash
   npx convex login
   npx convex dev --configure=existing
   ```

4. For CI or Cloudflare Git builds, configure the production `CONVEX_DEPLOY_KEY` as an encrypted
   build secret. Never expose this key as a `VITE_*` variable.

The repository's deployment command performs the complete sequence:

```bash
npm run cf:deploy
```

It runs `convex deploy`, builds the frontend with that production deployment's `VITE_CONVEX_URL`,
and then uploads the same `dist` directory to the existing Cloudflare Worker. Running
`npx wrangler deploy` by itself does **not** deploy Convex functions or schema.

## 1. Create and fund a dedicated wallet

Create a wallet used only for this testnet demo. Record its `inj1…` address as
`INJECTIVE_OPERATOR_ADDRESS` and obtain testnet INJ from the current official faucet. Never reuse a
mainnet key.

An ignored `.env.local` may hold values for the one-off diagnostic and provisioning commands:

```bash
INJECTIVE_OPERATOR_ADDRESS=inj1...
INJECTIVE_PRIVATE_KEY=0x...
INJECTIVE_MARKET_ACME=0x...
CONVEX_URL=https://...
INJECTIVE_CONTROL_SECRET=...
```

Store the runtime values in the target production Convex deployment. Omit secret values from the
command so the CLI reads them interactively instead of saving them in shell history:

```bash
npx convex env set INJECTIVE_OPERATOR_ADDRESS --prod
npx convex env set INJECTIVE_PRIVATE_KEY --prod
npx convex env set INJECTIVE_MARKET_ACME --prod
npx convex env set INJECTIVE_CONTROL_SECRET --prod
npx convex env set INJECTIVE_EXECUTION_MODE 'read-only' --prod
```

Keep `INJECTIVE_EXECUTION_MODE=read-only` until every later verification step succeeds. These values
belong in Convex, not Cloudflare Worker variables and not the browser bundle.

## 2. Verify the read-only path

```bash
npm run injective:check
npm run provision:plan
npx convex run injectiveNode:runWorker '{}' --prod
```

The health check must report `injective-888` and a current height. The plan must contain only the
`ACME` TokenFactory denom and one `ACME/INJ` market. The Convex sync must report one market, ten
accounts, and `submitted: 0`. `TOWNUSD` remains the local simulation currency and is not the live
Testnet quote asset.

## 3. Provision assets

For a new operator wallet, acknowledge the testnet fees and run the token stage once:

```bash
INJECTIVE_PROVISION_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=tokens
```

Do not run this stage for the current project wallet again: its ACME denom already exists.
TokenFactory denom creation is not idempotent. The previously created TOWNUSD denom may remain on
chain but is not used by the Testnet MVP market.

## 4. Launch the spot market

The Testnet MVP uses native INJ as quote. First simulate the v2 market-launch transaction:

```bash
INJECTIVE_PROVISION_MODE=signing \
npm run provision:testnet -- --simulate --stage=markets
```

Only after simulation succeeds, broadcast the instant spot launch:

```bash
INJECTIVE_PROVISION_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=markets
```

Query the Indexer for the resulting market ID, then update both `.env.local` and the Convex
`INJECTIVE_MARKET_ACME` deployment variable.

## 5. Fund exchange subaccounts

The funding stage deposits 10 INJ and 2,000 ACME into each of the ten town subaccounts. It therefore
uses 100 INJ plus gas, independently of the market listing fee:

```bash
INJECTIVE_PROVISION_MODE=signing \
TESTNET_PROVISION_CONFIRM=trade-town-testnet \
npm run provision:testnet -- --broadcast --stage=funding
```

Run the production worker again and verify all ten balances before enabling autonomous orders:

```bash
npx convex run injectiveNode:runWorker '{}' --prod
```

## 6. Enable Convex signing

Signing is a deployment setting, not another process:

```bash
npx convex env set INJECTIVE_EXECUTION_MODE 'signing' --prod
```

Convex Cron invokes the Node Action every 30 seconds. The worker reconciles chain state, atomically
claims queued intents, and submits at most ten orders serially per run. The UI changes from preview
data to chain data while the reconciled snapshots are fresh.

To stop signing without stopping the application:

```bash
npx convex env set INJECTIVE_EXECUTION_MODE 'read-only' --prod
```

## 7. Production verification

Verify the worker before and after the Cloudflare deployment:

```bash
npx convex run injectiveNode:runWorker '{}' --prod
npx convex run finance:dashboard '{}' --prod
curl -fsS https://<public-domain>/healthz
```

The worker result should contain:

```json
{
  "ok": true,
  "mode": "read-only",
  "markets": 1,
  "accounts": 10,
  "orders": 0,
  "fills": 0,
  "submitted": 0
}
```

The dashboard source should become `injective` while snapshots are fresh. A production deploy is not
complete if the website is online but this worker still reports missing environment variables.

## Operational rules

- Return to read-only mode if the chain height stops advancing or the worker becomes `degraded`.
- Use a stable `intentId` and CID; never resubmit merely because the UI timed out.
- Reconcile by CID before changing an uncertain submission back to queued.
- Treat Indexer data as an efficient projection, not consensus.
- Rotate the dedicated testnet wallet if its key is ever exposed.
