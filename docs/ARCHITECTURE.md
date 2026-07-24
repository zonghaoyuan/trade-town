# Trade Town architecture

## Design invariants

1. **AI Town is the main process.** Its single-threaded world engine owns movement, proximity,
   conversation state, and agent operations.
2. **Injective Testnet is the only matcher.** No browser, Convex function, or TwinMarket component
   computes an authoritative fill.
3. **Convex is a projection, not a shadow exchange.** It stores proposed intent and reconciled chain
   state so the UI can stay reactive.
4. **The signer is isolated.** A private key may exist only in the Node Gateway process.
5. **Portfolio changes require a confirmed fill.** A submitted transaction or booked order is not a
   position.
6. **Every financial action is explainable.** Belief evidence, rationale, risk result, CID, tx hash,
   and causal parent are persisted.

## Runtime boundaries

### AI Town and Convex

The AI Town engine runs frequent in-memory ticks and saves a compact `worlds` document once per
step. Financial data is deliberately stored in separate tables so order history and chain events do
not inflate or contend with the world document.

The existing operation seam remains the extension point:

```text
Agent.tick → startOperation → financial decision → proposeTrade mutation
           → Gateway queue → Injective transaction → Indexer stream → Convex projection
```

The agent can continue walking and talking while a financial intent progresses through its
asynchronous states.

### Financial decision layer

`convex/finance/decision.ts` ports the reusable TwinMarket semantics:

- belief state with fair value, sentiment, confidence, evidence, and time;
- behavioral parameters for anchoring, herding, loss aversion, and overconfidence;
- portfolio-aware desire sizing;
- an explicit intention containing side, quantity, price, and rationale;
- deterministic cash, order-size, and concentration checks.

It does not port TwinMarket's local order matcher, hidden liquidity, daily batch clearing, or
off-chain balances.

### Injective Gateway

The Gateway has two modes:

- `read-only`: health checks and Indexer streams; no key required when the operator address is
  configured.
- `signing`: reads queued intents, builds native spot-limit messages, simulates, signs, broadcasts,
  and writes the result to Convex.

The signing loop is serialized to avoid Cosmos account-sequence races. Each intent has a stable CID
of at most 36 characters, and every fill is deduplicated by the Indexer trade ID.

Indexer streams provide low-latency updates. The cache stores a cursor so a periodic query-based
reconciler can be added to replay missed data after disconnects. Chain state and transaction
inclusion remain the authoritative verification layer; the Indexer is never treated as consensus.

## Data model

| Table                | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `financeConfig`      | network, Gateway status, operator, counts, last chain height |
| `marketCatalog`      | local TOWNUSD pairs plus live denoms, market IDs, and ticks  |
| `traderProfiles`     | AI/MM role, risk, focus, nonce, subaccount                   |
| `agentBeliefs`       | symbol thesis, sentiment, confidence, evidence links         |
| `marketEvents`       | policy → news → conversation → intent → fill causal graph    |
| `tradeIntents`       | explainable pre-trade workflow and stable CID                |
| `chainTransactions`  | broadcast/inclusion/failure proof                            |
| `chainOrders`        | reconciled native order state                                |
| `fills`              | idempotent confirmed trade records                           |
| `portfolioSnapshots` | chain-derived balances and positions                         |
| `chainCursors`       | restart-safe stream/query progress                           |

## Wallet and subaccounts

The operator uses one dedicated testnet wallet. Agent slot `n` maps to subaccount nonce `n`, so the
initial population uses nonces 1 through 10. The subaccount ID is:

```text
0x + 20-byte Ethereum address + 12-byte big-endian nonce
```

This provides accounting isolation, not cryptographic agent custody. The UI and documentation label
the wallet as operator-controlled.

## Market lifecycle

1. Create and mint the `acme` TokenFactory denom once.
2. Keep TOWNUSD as the local simulation quote; an existing on-chain TOWNUSD denom is not deleted.
3. Launch the `ACME/INJ` Testnet spot market with the exchange v2 message.
4. Deposit 10 INJ and 2,000 ACME into each town exchange subaccount.
5. Configure the returned market IDs in the Gateway.
6. Reconcile markets and balances before enabling signing.

Provisioning is split into explicit stages because TokenFactory creation and instant market listing
incur chain-configured fees.

## Extension points

- **Graphiti memory adapter:** project conversations, beliefs, and events into a temporal knowledge
  graph without replacing Convex memory in the critical trading loop.
- **A2A agent adapter:** expose selected trader capabilities as remote agents after a stable public
  endpoint exists.
- **Scenario engine:** publish policy, earnings, supply, or regulatory shocks into `marketEvents`.
- **Query reconciler:** backfill fills, orders, transactions, and balances from a stored cursor.
