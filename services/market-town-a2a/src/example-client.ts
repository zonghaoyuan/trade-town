import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Role, Task, TaskState } from '@a2a-js/sdk';
import { ClientFactory, ClientFactoryOptions, JsonRpcTransportFactory } from '@a2a-js/sdk/client';

const prompts = [
  '运行加息 100bp 实验，seed=20260722，并总结 8 个居民的分歧。',
  '分析 ACME 谣言的传播路径，并比较权威更正前后的居民决策。',
  '复盘一个保守型用户单笔使用 18% NAV 的行为，并给出两个反事实。',
];

async function main() {
  const baseUrl = (process.env.A2A_EXAMPLE_BASE_URL ?? 'http://127.0.0.1:41241').replace(
    /\/+$/,
    '',
  );
  const apiKey = process.env.A2A_API_KEY;
  const authenticatedFetch: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }
    return await fetch(input, { ...init, headers });
  };
  const options = ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
    transports: [new JsonRpcTransportFactory({ fetchImpl: authenticatedFetch })],
    preferredTransports: ['JSONRPC'],
  });
  const client = await new ClientFactory(options).createFromUrl(baseUrl);

  for (const prompt of prompts) {
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
    if (!isTask(response)) {
      throw new Error('Expected an A2A Task response.');
    }
    const report = response.artifacts
      .flatMap((artifact) => artifact.parts)
      .find((part) => part.content?.$case === 'data');
    const skillId =
      report?.content?.$case === 'data'
        ? (report.content.value as { skillId?: string } | undefined)?.skillId
        : undefined;
    console.log({
      prompt,
      taskId: response.id,
      state: TaskState[response.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED],
      skillId,
    });
  }
}

function isTask(value: unknown): value is Task {
  return value !== null && typeof value === 'object' && 'id' in value && 'status' in value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
