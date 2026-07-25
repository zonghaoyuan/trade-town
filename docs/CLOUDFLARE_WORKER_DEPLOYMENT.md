# Cloudflare Worker 部署

本项目使用同一个 Cloudflare Worker 部署 Vite 前端和 A2A Remote Agent，不需要另外创建 A2A Worker：

- `/` 和前端路由从 `dist` 提供静态资源；
- `/.well-known/*`、`/a2a/*`、`/healthz`、`/docs` 进入 Worker 中的 A2A 服务；
- Worker 调用 DeepSeek V4 Pro；
- Convex 只持久化 A2A Task 和 Artifact。

Wrangler 需要 Node.js 22 或更高版本。比赛环境建议使用 Workers
Paid；Free 套餐的单次请求 CPU 时间不适合稳定运行 Express 与 A2A 推理请求。

## 1. 确认更新的是现有 Worker

`wrangler.jsonc` 当前使用：

```json
{
  "name": "tradetown"
}
```

先在 Cloudflare Dashboard 查看现有前端 Worker 的名称：

- 名称相同：`npm run cf:deploy` 会更新现有 Worker；
- 名称不同：先把 `wrangler.jsonc` 中的 `name` 改成现有名称；
- 不修改且名称不存在：Wrangler 会创建一个新的 Worker。

`keep_vars: true`
已启用，因此后续 Wrangler 发布会保留在 Dashboard 管理的普通变量；加密 Secret 也不会被普通发布删除。

## 2. 区分前端构建变量和 Worker 运行时变量

`.env.local` 只用于本地或 CI 构建。Vite 会把 `VITE_*`
写入浏览器端代码，因此这里只能放可以公开的前端配置，例如：

```dotenv
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

以下值禁止使用 `VITE_*` 前缀，也不要写入前端代码：

```text
LLM_API_KEY
A2A_CONVEX_SHARED_SECRET
INJECTIVE_PRIVATE_KEY
INJECTIVE_CONTROL_SECRET
```

如果使用 Cloudflare Git 构建，把 `VITE_CONVEX_URL` 配置成 Build
variable。A2A 与 DeepSeek 配置则放在 Worker 的 Settings → Variables and Secrets 中。

## 3. 配置 Cloudflare Worker

在 Worker 的 Variables and Secrets 中添加以下普通变量：

```text
A2A_EXECUTION_MODE=competition
A2A_PUBLIC_BASE_URL=https://<现有-worker域名或自定义域名>
A2A_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
A2A_MAX_TASK_MS=1080000
A2A_MAX_PROMPT_CHARS=8000
A2A_RATE_LIMIT_PER_MINUTE=60
LLM_API_URL=<deepseek-openai-compatible-endpoint>
LLM_MODEL=<deepseek-v4-pro-model-id>
```

添加以下加密 Secret：

```text
A2A_CONVEX_SHARED_SECRET=<随机生成的内部共享密钥>
LLM_API_KEY=<DeepSeek API Key>
```

也可以通过 Wrangler 上传 Secret：

```bash
npx wrangler secret put A2A_CONVEX_SHARED_SECRET
npx wrangler secret put LLM_API_KEY
```

这里不需要额外的 Panda Token。`LLM_API_KEY` 就是 DeepSeek API Key。`/a2a/v1`
作为公开接口提供，不需要调用方 Token；`A2A_RATE_LIMIT_PER_MINUTE` 继续限制单实例的请求频率。

## 4. 配置 Convex

首先确认仓库连接的是云端 Convex 项目。`.env.local` 中如果是
`CONVEX_DEPLOYMENT=anonymous:...`，表示当前只是本地部署，不能直接作为生产环境。手工发布前执行：

```bash
npx convex login
npx convex dev --configure=existing
```

Cloudflare Git 或其他 CI 构建需要把生产环境的 `CONVEX_DEPLOY_KEY` 配置为加密 Build
Secret。不要给它添加 `VITE_*` 前缀。

A2A 在 Convex 侧需要：

```bash
npx convex env set A2A_CONVEX_SHARED_SECRET --prod
```

Convex 中已有的 `LLM_*`
属于小镇 Agent 对话引擎，与 A2A 持久化无关。如果小镇对话也要调用相同的 DeepSeek，可以单独配置；A2A 本身不要求在 Convex 再配置一次
`LLM_*`。

Injective Worker 的私钥、市场和执行模式也全部属于 Convex 环境变量，而不是 Cloudflare
Worker 变量。完整列表及只读验证流程参见
[TESTNET_OPERATIONS.md](./TESTNET_OPERATIONS.md)。生产环境至少需要：

```bash
npx convex env set INJECTIVE_OPERATOR_ADDRESS --prod
npx convex env set INJECTIVE_PRIVATE_KEY --prod
npx convex env set INJECTIVE_MARKET_ACME --prod
npx convex env set INJECTIVE_CONTROL_SECRET --prod
npx convex env set INJECTIVE_EXECUTION_MODE 'read-only' --prod
```

前四条命令不在参数中写值，CLI 会交互式读取，避免私钥进入 Shell 历史。上线验收完成前不要把
`INJECTIVE_EXECUTION_MODE` 改为 `signing`。

## 5. 本地测试

复制本地 Worker 配置模板：

```bash
cp .dev.vars.example .dev.vars
```

填写 `.dev.vars` 后运行：

```bash
npm run cf:dev -- --port 8787
```

`cf:dev` 已禁止 Wrangler 自动加载根目录的 `.env` 和
`.env.local`，因此 Injective 私钥等无关变量不会被误传给 Worker。

另开终端验证：

```bash
curl -fsS http://127.0.0.1:8787/healthz
curl -fsS -H 'A2A-Version: 1.0' \
  http://127.0.0.1:8787/.well-known/agent-card.json

A2A_EXAMPLE_BASE_URL=http://127.0.0.1:8787 \
npm run a2a:examples
```

四个示例任务都应返回 `TASK_STATE_COMPLETED`。

## 6. 部署

手工发布使用：

```bash
npm run cf:deploy
```

该命令会依次：

1. `convex deploy` 发布函数、Cron、索引和 Schema；
2. 使用生产 Convex URL 作为 `VITE_CONVEX_URL` 构建前端；
3. 把同一份 `dist` 上传到现有 Cloudflare Worker。

不要只运行 `npx wrangler deploy`：它只会发布 Cloudflare Worker，不会发布 Convex Injective
Worker，也不会迁移 Convex Schema。

如果使用 Cloudflare Git 集成，推荐配置：

```text
Node.js version: 22+
Build command: npm run cf:build
Deploy command: npx wrangler deploy
```

Cloudflare Build 环境必须具有生产 `CONVEX_DEPLOY_KEY`。`cf:build`
会把目标部署 URL 注入前端构建，不要复用本地 `http://127.0.0.1:3212`。

第一次发布后重新确认 Worker 仍使用原前端域名，并检查 `A2A_PUBLIC_BASE_URL` 与该 HTTPS 域名完全一致。

## 7. 线上验证

```bash
npx convex run injectiveNode:runWorker '{}' --prod
npx convex run finance:dashboard '{}' --prod

curl -fsS https://<public-domain>/healthz
curl -fsS -H 'A2A-Version: 1.0' \
  https://<public-domain>/.well-known/agent-card.json

A2A_EXAMPLE_BASE_URL=https://<public-domain> \
npm run a2a:examples
```

Injective Worker 应先保持 `read-only`，并返回 `1` 个市场、`10` 个账户和
`submitted: 0`。确认无配置错误、链高度正常递增后，才能按照
[TESTNET_OPERATIONS.md](./TESTNET_OPERATIONS.md) 显式启用 `signing`。

健康检查应显示：

```json
{
  "executionMode": "competition",
  "persistence": "convex",
  "modelConfigured": true,
  "modelRole": "task-planning-and-report-synthesis"
}
```

成功报告中的模型说明应包含：

```json
{
  "requiredModel": "DeepSeek V4 Pro",
  "used": true,
  "stages": {
    "taskPlanning": true,
    "reportSynthesis": true
  }
}
```

当前示例客户端使用阻塞请求。任务执行期间需要保持 HTTP 连接，不能依赖 Worker 在响应结束后继续执行后台任务。

## Cloudflare 官方参考

- [Wrangler 配置与 `keep_vars`](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Worker 环境变量与 Secret](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Express on Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)
- [Workers 运行限制](https://developers.cloudflare.com/workers/platform/limits/)
