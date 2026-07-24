import { randomUUID } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Role, Task, TaskState } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';
import { createA2AApp } from './app';
import { A2AConfig } from './config';

describe('Market Town A2A server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const config: A2AConfig = {
      port,
      publicBaseUrl: baseUrl,
      executionMode: 'local-demo',
      maxTaskMs: 5_000,
      maxPromptChars: 8_000,
      rateLimitPerMinute: 100,
    };
    server = createA2AApp(config).listen(port, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  test('publishes a discoverable v1 and legacy-compatible Agent Card', async () => {
    const v1 = await fetch(`${baseUrl}/.well-known/agent-card.json`, {
      headers: { 'A2A-Version': '1.0' },
    });
    expect(v1.status).toBe(200);
    const v1Card = (await v1.json()) as {
      supportedInterfaces: Array<{ protocolVersion: string }>;
      skills: Array<{ id: string }>;
    };
    expect(v1Card.supportedInterfaces.map((item) => item.protocolVersion)).toEqual(
      expect.arrayContaining(['1.0', '0.3']),
    );
    expect(v1Card.skills).toHaveLength(4);

    const legacy = await fetch(`${baseUrl}/.well-known/agent-card.json`);
    expect(legacy.status).toBe(200);
    const legacyCard = (await legacy.json()) as { protocolVersion?: string; url?: string };
    expect(legacyCard.protocolVersion).toBe('0.3');
    expect(legacyCard.url).toContain('/a2a/v1');
  });

  test.each([
    ['分析 PandaAI 数据中 002594.SZ 的历史走势和居民分歧', 'panda-market-replay'],
    ['运行加息 100bp 实验，seed=20260722', 'rate-shock-experiment'],
    ['分析 ACME 谣言传播以及权威更正效果', 'rumor-propagation-analysis'],
    ['复盘保守用户的仓位行为并给出两个反事实', 'user-behavior-review'],
  ] as const)('executes example task: %s', async (prompt, expectedSkill) => {
    const client = await new ClientFactory().createFromUrl(baseUrl);
    const response = await client.sendMessage({
      tenant: '',
      message: {
        messageId: randomUUID(),
        contextId: '',
        taskId: '',
        role: Role.ROLE_USER,
        parts: [
          {
            content: { $case: 'text', value: prompt },
            metadata: undefined,
            filename: '',
            mediaType: 'text/plain',
          },
        ],
        metadata: {},
        extensions: [],
        referenceTaskIds: [],
      },
      configuration: {
        acceptedOutputModes: ['text/plain', 'application/json'],
        taskPushNotificationConfig: undefined,
        historyLength: 10,
        returnImmediately: false,
      },
      metadata: {},
    });
    expect(isTask(response)).toBe(true);
    const task = response as Task;
    expect(task.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
    const dataPart = task.artifacts
      .flatMap((artifact) => artifact.parts)
      .find((part) => part.content?.$case === 'data');
    expect(dataPart?.content?.$case).toBe('data');
    if (dataPart?.content?.$case === 'data') {
      expect(dataPart.content.value).toMatchObject({
        skillId: expectedSkill,
        execution: { isSimulated: true },
        chainProofs: [],
      });
      if (expectedSkill === 'panda-market-replay') {
        expect(dataPart.content.value).toMatchObject({
          execution: { dataMode: 'verified-replay' },
          marketData: {
            source: 'PandaAI',
            method: 'daily_bars',
            datasetId: 'panda-cn-a-2025-v1',
            symbol: '002594.SZ',
            barCount: 304,
            isReal: true,
          },
        });
        expect(dataPart.metadata).toMatchObject({
          isSimulated: true,
          marketDataIsReal: true,
        });
      }
    }

    const stored = await client.getTask({ tenant: '', id: task.id, historyLength: 10 });
    expect(stored.id).toBe(task.id);
    expect(stored.status?.state).toBe(TaskState.TASK_STATE_COMPLETED);
  });
});

function isTask(value: unknown): value is Task {
  return value !== null && typeof value === 'object' && 'id' in value && 'status' in value;
}

async function availablePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    probe.once('listening', resolve);
    probe.once('error', reject);
  });
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}
