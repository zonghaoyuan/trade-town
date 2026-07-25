# Market Town A2A Remote Agent

This service exposes selected Injective Trade Town capabilities through the official A2A TypeScript
SDK. It can run as a standalone Node process for development or inside the same Cloudflare Worker
that serves the frontend. It never imports the Injective signer.

## Implemented surface

- `GET /.well-known/agent-card.json`
- `POST /a2a/v1` using JSON-RPC
- A2A 1.0 with the official SDK's v0.3 compatibility layer
- blocking, polling, and streaming task flows
- DeepSeek V4 Pro task planning, parameter extraction, and final report synthesis for all five
  declared Skills in competition mode
- `Task` persistence in Convex when configured, with an in-memory local fallback
- five whitelisted skills:
  - `town-agent-history`
  - `panda-market-replay`
  - `rate-shock-experiment`
  - `rumor-propagation-analysis`
  - `user-behavior-review`

`town-agent-history` is the read-only interface for the active 30-trading-day replay. A structured
request supplies `agentId` and may supply `symbol`; the returned JSON artifact contains that one
Agent's daily beliefs, five-symbol views, account, positions, posts, intents, risk results,
simulated fills and backend errors. It reads only validated `translation-cache/v2` English text and
fails the task when any day or translation proof is missing.

`panda-market-replay` reads the authorized PandaAI daily-bar datasets for `002594.SZ`, `300750.SZ`,
`600519.SH`, `601318.SH`, and `688981.SH` (`2024-10-08`–`2025-12-31`) through the shared market
adapter. Its market-data disclosure sets `isReal: true`, while resident decisions, orders, fills,
PnL, and counterfactuals remain deterministic simulation. The report therefore keeps
`execution.isSimulated: true`, returns no chain proof, and includes a risk warning. `live` is
rejected because these are historical datasets, not a real-time feed.

## Run locally

```bash
npm run a2a:dev
```

For the connected 30-day Agent data skill, configure:

```bash
TOWN_BACKEND_URL=http://127.0.0.1:8000
TOWN_RUN_ID=<completed-30-day-run-id>
TOWN_REPLAY_TOTAL_DAYS=30
TOWN_TRANSLATION_CACHE_DIR=<runtime-translation-cache-directory>
```

In another terminal:

```bash
npm run a2a:examples
```

The official SDK requires Node.js 20 or newer. A deployment image can be built from the repository
root:

```bash
docker build -f services/market-town-a2a/Dockerfile -t trade-town-a2a .
```

The local endpoints are:

- Agent Card: `http://127.0.0.1:41241/.well-known/agent-card.json`
- JSON-RPC: `http://127.0.0.1:41241/a2a/v1`
- health: `http://127.0.0.1:41241/healthz`
- examples and configuration disclosure: `http://127.0.0.1:41241/docs`

Structured messages may use:

```json
{
  "skillId": "panda-market-replay",
  "input": {
    "symbol": "002594.SZ",
    "dataMode": "verified-replay"
  }
}
```

To retrieve one Agent:

```json
{
  "skillId": "town-agent-history",
  "input": {
    "agentId": "<agent-id>",
    "symbol": "002594.SZ",
    "dataMode": "verified-replay"
  }
}
```

Each successful task contains a text summary and an `application/json` `MarketTownReport` artifact.

## Competition configuration

Set the following in the A2A process:

```bash
A2A_EXECUTION_MODE=competition
A2A_PUBLIC_BASE_URL=https://agent.example.com
A2A_CONVEX_URL=<convex-url>
A2A_CONVEX_SHARED_SECRET=<random-secret>
LLM_API_URL=<deepseek-openai-compatible-endpoint>
LLM_API_KEY=<deepseek-api-key>
LLM_MODEL=<deepseek-v4-pro-model-id>
```

Set the same persistence secret in Convex:

```bash
npx convex env set A2A_CONVEX_SHARED_SECRET '<random-secret>'
```

If the town's Convex-hosted conversations should also use PandaAI DeepSeek V4 Pro, configure the
same values in Convex separately:

```bash
npx convex env set LLM_API_URL '<deepseek-openai-compatible-endpoint>'
npx convex env set LLM_API_KEY '<deepseek-api-key>'
npx convex env set LLM_MODEL '<deepseek-v4-pro-model-id>'
```

These Convex `LLM_*` values are optional for A2A. The A2A Worker itself reads `LLM_*` from
Cloudflare, while Convex only needs `A2A_CONVEX_SHARED_SECRET` to persist A2A tasks and artifacts.

Competition mode refuses to start without HTTPS, Convex persistence, and all three `LLM_*` settings
for PandaAI DeepSeek V4 Pro. The A2A endpoint is public and rate-limited. DeepSeek plans every
competition task before deterministic financial tools run, then synthesizes the evidence-backed
report. Do not add `INJECTIVE_PRIVATE_KEY` or `INJECTIVE_CONTROL_SECRET` to this process.

## Verification

```bash
npm run a2a:test
npm run build
```

Before submission, deploy the public HTTPS process, run the example tasks against that URL, and
verify it with PandaAI's test environment. If a real-time PandaAI feed is added later, implement it
as a separate `live` data provider rather than relabeling this historical replay.

For the combined Cloudflare Worker and frontend deployment, follow
[`docs/CLOUDFLARE_WORKER_DEPLOYMENT.md`](../../docs/CLOUDFLARE_WORKER_DEPLOYMENT.md).
