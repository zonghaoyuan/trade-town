# Market Town A2A Remote Agent

This service exposes selected Injective Trade Town capabilities through the official A2A TypeScript SDK. It
lives in this repository but runs as an independent public process and never imports the Injective
signer.

## Implemented surface

- `GET /.well-known/agent-card.json`
- `POST /a2a/v1` using JSON-RPC
- A2A 1.0 with the official SDK's v0.3 compatibility layer
- blocking, polling, and streaming task flows
- `Task` persistence in Convex when configured, with an in-memory local fallback
- three whitelisted skills:
  - `rate-shock-experiment`
  - `rumor-propagation-analysis`
  - `user-behavior-review`

The current skill engine is a deterministic simulation. Every report sets `isSimulated: true`,
returns no chain proof, and includes a risk warning. Requests for `live` or `verified-replay` are
rejected until a verifiable Convex Run is connected.

## Run locally

```bash
npm run a2a:dev
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
  "skillId": "rate-shock-experiment",
  "input": {
    "shockBps": 100,
    "seed": 20260722,
    "dataMode": "simulated"
  }
}
```

Each successful task contains a text summary and an `application/json` `MarketTownReport` artifact.

## Competition configuration

Set the following in the A2A process:

```bash
A2A_EXECUTION_MODE=competition
A2A_PUBLIC_BASE_URL=https://agent.example.com
A2A_API_KEY=<review-token>
A2A_CONVEX_URL=<convex-url>
A2A_CONVEX_SHARED_SECRET=<random-secret>
PANDA_DEEPSEEK_BASE_URL=<panda-provided-endpoint>
PANDA_DEEPSEEK_API_KEY=<panda-provided-token>
PANDA_DEEPSEEK_MODEL=<panda-provided-model-id>
```

Set the same persistence secret in Convex:

```bash
npx convex env set A2A_CONVEX_SHARED_SECRET '<random-secret>'
```

Competition mode refuses to start without HTTPS, Bearer authentication, Convex persistence, and all
three PandaAI DeepSeek settings. Do not add `INJECTIVE_PRIVATE_KEY` or `GATEWAY_SHARED_SECRET` to
this process.

## Verification

```bash
npm run a2a:test
npm run build
```

Before submission, deploy the public HTTPS process, run the three example tasks against that URL,
and verify it with PandaAI's test environment. Connecting `verified-replay` and `live` modes to real
Convex Runs remains the next integration step.
