import { Message, Role } from '@a2a-js/sdk';
import { jest } from '@jest/globals';
import { A2AConfig } from './config';
import { DeepSeekReasoner } from './reasoner';
import { runSkill } from './skills';

describe('DeepSeek V4 Pro A2A reasoning', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('uses the configured model for both task planning and report synthesis', async () => {
    const responses = [
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  skillId: 'panda-market-replay',
                  input: { symbol: '300750.SZ' },
                  seed: 20260725,
                  dataMode: 'verified-replay',
                  rationale: '先读取宁德时代历史行情，再调用确定性回放与风控工具。',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '宁德时代历史行情已完成复算；居民观点存在分歧，所有订单均为模拟。',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ];
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        const response = responses.shift();
        if (!response) throw new Error('Unexpected DeepSeek request.');
        return response;
      },
    );
    globalThis.fetch = fetchMock;

    const config: A2AConfig = {
      port: 41241,
      publicBaseUrl: 'https://agent.example.com',
      executionMode: 'competition',
      apiKey: 'review-token',
      convexUrl: 'https://example.convex.cloud',
      convexSecret: 'persistence-secret',
      deepseekBaseUrl: 'https://deepseek.example.com/v1',
      deepseekApiKey: 'deepseek-token',
      deepseekModel: 'deepseek-v4-pro',
      maxTaskMs: 5_000,
      maxPromptChars: 8_000,
      rateLimitPerMinute: 60,
    };
    const reasoner = new DeepSeekReasoner(config);
    const plan = await reasoner.planRequest(
      textMessage('请研究新能源汽车龙头并给出可审计的风险结论。'),
    );

    expect(plan).toMatchObject({
      usedModel: true,
      request: {
        skillId: 'panda-market-replay',
        dataMode: 'verified-replay',
        seed: 20260725,
        input: { symbol: '300750.SZ' },
      },
    });

    const result = runSkill(plan.request, 'competition');
    const report = await reasoner.completeReport(result, Date.now(), plan);

    expect(report.model).toMatchObject({
      requiredModel: 'DeepSeek V4 Pro',
      configuredModel: 'deepseek-v4-pro',
      used: true,
      stages: {
        taskPlanning: true,
        reportSynthesis: true,
      },
      planningRationale: expect.stringContaining('确定性回放'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const [, init] of fetchMock.mock.calls) {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      expect(body.model).toBe('deepseek-v4-pro');
      expect(body.messages).toHaveLength(2);
    }
  });
});

function textMessage(text: string): Message {
  return {
    messageId: 'message-1',
    contextId: '',
    taskId: '',
    role: Role.ROLE_USER,
    parts: [
      {
        content: { $case: 'text', value: text },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
    metadata: {},
    extensions: [],
    referenceTaskIds: [],
  };
}
