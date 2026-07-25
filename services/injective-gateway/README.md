# Injective operations tools

The directory name is retained for compatibility, but it is no longer a deployable Gateway service.
The runtime integration lives in `convex/injectiveNode.ts` and is scheduled by Convex Cron.
Injective Testnet remains the only matching and settlement authority.

Run a local read-only diagnostic:

```bash
npm run injective:check
```

Run the Convex worker immediately instead of waiting for the next cron tick:

```bash
npm run injective:sync
```

Preview a single Agent order without changing Convex or broadcasting:

```bash
npm run injective:queue -- \
  --agent "Delta-7" --side sell --quantity 100 --price 0.001 \
  --rationale "Provide initial ACME liquidity"
```

Add `--submit` only after the Convex deployment is in signing mode. The authenticated mutation
requires fresh chain balances and market metadata, checks tick sizes, minimum notional, available
funds, and position limits, then queues the order. The Convex worker claims and signs queued orders
serially.

Preview the ACME TokenFactory denom and the single ACME/INJ market without signing:

```bash
npm run provision:plan
```

Provisioning is split into explicit `tokens`, `markets`, and `funding` stages. Broadcasting requires
`INJECTIVE_PROVISION_MODE=signing`, `INJECTIVE_PRIVATE_KEY`, and
`TESTNET_PROVISION_CONFIRM=trade-town-testnet`. Use `--simulate` before `--broadcast`:

```bash
INJECTIVE_PROVISION_MODE=signing \
npm run provision:testnet -- --simulate --stage=markets
```

See `docs/TESTNET_OPERATIONS.md` for deployment variables and the signing runbook. Never use a
mainnet wallet.
