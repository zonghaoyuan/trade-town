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

Preview the exact TokenFactory denoms and spot markets without signing:

```bash
npm run provision:plan
```

Provisioning is split into explicit `tokens`, `markets`, and `funding` stages. Broadcasting
additionally requires `GATEWAY_MODE=signing`, `INJECTIVE_PRIVATE_KEY`, and
`TESTNET_PROVISION_CONFIRM=trade-town-testnet`. This guard exists because each instant spot market
launch pays the chain's configured testnet listing fee.
