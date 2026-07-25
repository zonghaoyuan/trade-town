import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Role, Task, TaskState } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';

const defaultPrompts = [
  '分析 PandaAI 数据中 002594.SZ 的历史走势，并总结 8 个居民的分歧。',
  '运行加息 100bp 实验，seed=20260722，并总结 8 个居民的分歧。',
  '分析 ACME 谣言的传播路径，并比较权威更正前后的居民决策。',
  '复盘一个保守型用户单笔使用 18% NAV 的行为，并给出两个反事实。',
];

async function main() {
  const baseUrl = (process.env.A2A_EXAMPLE_BASE_URL ?? 'http://127.0.0.1:41241').replace(
    /\/+$/,
    '',
  );
  const client = await new ClientFactory().createFromUrl(baseUrl);
  const onePrompt = process.env.A2A_EXAMPLE_PROMPT?.trim();
  const prompts = onePrompt ? [onePrompt] : [...defaultPrompts];

  const agentId = process.env.TOWN_EXAMPLE_AGENT_ID;
  if (agentId) {
    prompts.unshift(`调取 agentId=${agentId} 的 30 个交易日数据。`);
  }

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
    const answer = response.artifacts
      .flatMap((artifact) => artifact.parts)
      .find((part) => part.content?.$case === 'text');
    const reportValue =
      report?.content?.$case === 'data'
        ? (report.content.value as
            | {
                skillId?: string;
                execution?: { dataMode?: string };
                model?: {
                  configuredModel?: string | null;
                  used?: boolean;
                  stages?: {
                    taskPlanning?: boolean;
                    reportSynthesis?: boolean;
                  };
                };
              }
            | undefined)
        : undefined;
    console.log({
      prompt,
      taskId: response.id,
      state: TaskState[response.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED],
      skillId: reportValue?.skillId,
      dataMode: reportValue?.execution?.dataMode,
      model: reportValue?.model
        ? {
            configuredModel: reportValue.model.configuredModel,
            used: reportValue.model.used,
            stages: reportValue.model.stages,
          }
        : undefined,
      answer: answer?.content?.$case === 'text' ? answer.content.value : undefined,
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
