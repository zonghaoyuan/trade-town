# Injective Gateway

The Gateway is the only component allowed to hold a testnet signer. Convex stores town state,
beliefs, proposed intents, and a reconciled cache; Injective Testnet remains the only matching and
settlement authority.

Start with a read-only health check:

```bash
npm run gateway:check
```

Signing stays disabled unless `GATEWAY_MODE=signing` and a dedicated testnet-only private key is
provided. See the root `.env.example` for the full configuration. Never use a mainnet wallet.

The Gateway continuously reconciles the configured market, all ten town subaccounts, active and
historical orders, and account fills into Convex. It never treats a local replay order as a chain
order; only authenticated `executionMode=injective` intents enter the signing queue.

Preview a single Agent order without changing Convex or broadcasting:

```bash
npm run gateway:queue -- \
  --agent "Delta-7" --side sell --quantity 100 --price 0.001 \
  --rationale "Provide initial ACME liquidity"
```

Add `--submit` only while a signing Gateway is online. The Convex mutation authenticates the call,
requires fresh chain balances and market metadata, checks tick sizes, minimum notional, available
funds, position limits, and queues the order. The Gateway then signs sequentially. A deterministic
two-Agent testnet match can be produced by submitting the sell above, then a crossing buy from
`Mira Chen` for the same quantity and price. Do not use this flow with a mainnet key.

Preview the ACME TokenFactory denom and the single ACME/INJ market without signing:

```bash
npm run provision:plan
```

Provisioning is split into explicit `tokens`, `markets`, and `funding` stages. The market stage uses
the Injective exchange v2 launch message and verifies INJ's chain minimum-notional configuration
before signing. Every town subaccount receives 2,000 ACME and 10 INJ so it can participate on either
side of the MVP orderbook. Broadcasting additionally requires `GATEWAY_MODE=signing`,
`INJECTIVE_PRIVATE_KEY`, and `TESTNET_PROVISION_CONFIRM=trade-town-testnet`. This guard exists
because each instant spot market launch pays the chain's configured testnet listing fee.

Use `--simulate` before `--broadcast`; simulation signs locally but does not submit a transaction:

```bash
npm run provision:testnet -- --simulate --stage=markets
```
