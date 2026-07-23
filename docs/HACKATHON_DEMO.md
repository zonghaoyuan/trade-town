# Hackathon demo runbook

## Story

The town starts in equilibrium. The central bank unexpectedly raises rates by 75 basis points:

1. Publish the policy event.
2. Sora summarizes it at the newsroom.
3. Mira lowers ACME fair value and explains the refinancing channel.
4. A conversation carries the thesis to Imani.
5. Imani's momentum signal and updated belief produce a sell intent.
6. The deterministic risk layer checks cash, order size, and concentration.
7. The Gateway submits a native Injective spot order.
8. Delta-7 adjusts its deterministic two-sided quotes.
9. The K-line and causal replay update after confirmed fills.

## What to show

- Click each market in the top ticker and explain that TOWNUSD is the shared quote currency.
- Click AI and MM agents in the right rail; point out the explicit `AI` and `MM` labels.
- Select Imani and show her subaccount nonce, focus markets, risk tolerance, and activity.
- Scroll the causal replay from policy event to chain proof.
- Open the Injective explorer using the real transaction hash in live mode.
- Explain that Convex makes the town reactive, while Injective alone matches and settles.

## Failure-safe demo mode

If the testnet or Gateway is unavailable, stop signing and use the clearly labeled illustrative
scenario preview. Do not present preview transaction IDs, prices, or balances as live chain data.
