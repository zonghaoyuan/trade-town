import { Message, Role } from '@a2a-js/sdk';
import { jest } from '@jest/globals';
import { A2AConfig } from './config';
import { MarketTownReasoner } from './reasoner';
import { runSkill } from './skills';
import { SkillResult } from './types';

describe('LLM-backed A2A reasoning', () => {
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
      convexUrl: 'https://example.convex.cloud',
      convexSecret: 'persistence-secret',
      llmBaseUrl: 'https://deepseek.example.com/v1',
      llmApiKey: 'deepseek-token',
      llmModel: 'deepseek-v4-pro',
      replayTotalDays: 30,
      maxTaskMs: 5_000,
      maxPromptChars: 8_000,
      rateLimitPerMinute: 60,
    };
    const reasoner = new MarketTownReasoner(config);
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
      requiredModel: 'OpenAI-compatible LLM',
      provider: 'DeepSeek',
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

    const synthesisBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(JSON.parse(synthesisBody.messages[1].content)).toMatchObject({
      question: '请研究新能源汽车龙头并给出可审计的风险结论。',
      selectedSkill: 'panda-market-replay',
      toolResult: {
        marketData: { symbol: '300750.SZ' },
      },
    });
  });

  test('uses the LLM for town-agent-history while keeping the model input bounded', async () => {
    const responses = [
      jsonCompletion({
        skillId: 'town-agent-history',
        input: { agentId: 'agent-01', symbol: '002594.SZ' },
        seed: 20260725,
        dataMode: 'verified-replay',
        rationale: '读取指定 Agent 的 30 个交易日记录，再基于可审计摘要生成结论。',
      }),
      jsonCompletion('该 Agent 的 30 日记录已完成读取与风险复盘，所有成交均为模拟。'),
    ];
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        const response = responses.shift();
        if (!response) throw new Error('Unexpected DeepSeek request.');
        return response;
      },
    );
    globalThis.fetch = fetchMock;

    const reasoner = new MarketTownReasoner(llmConfig());
    const plan = await reasoner.planRequest(
      textMessage('调取 agentId=agent-01 的 30 个交易日数据，并总结风险变化。'),
    );
    const report = await reasoner.completeReport(historyResult(), Date.now(), plan);

    expect(plan).toMatchObject({
      usedModel: true,
      request: {
        skillId: 'town-agent-history',
        input: { agentId: 'agent-01', symbol: '002594.SZ' },
        dataMode: 'verified-replay',
      },
    });
    expect(report.model).toMatchObject({
      used: true,
      stages: {
        taskPlanning: true,
        reportSynthesis: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const synthesisBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    const synthesisInput = JSON.parse(synthesisBody.messages[1].content) as {
      question: string;
      toolResult: { findings: { dailySummary: unknown[] } };
    };
    expect(synthesisInput.question).toContain('总结风险变化');
    expect(synthesisInput.toolResult.findings.dailySummary).toHaveLength(30);
    expect(synthesisBody.messages[1].content).toContain('降低了风险敞口');
    expect(synthesisBody.messages[1].content).toContain('基本面走弱');
    expect(synthesisBody.messages[1].content).not.toContain('raw unverified post');
  });
});

function jsonCompletion(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        { message: { content: typeof content === 'string' ? content : JSON.stringify(content) } },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function llmConfig(): A2AConfig {
  return {
    port: 41241,
    publicBaseUrl: 'https://agent.example.com',
    executionMode: 'competition',
    convexUrl: 'https://example.convex.cloud',
    convexSecret: 'persistence-secret',
    llmBaseUrl: 'https://deepseek.example.com/v1',
    llmApiKey: 'deepseek-token',
    llmModel: 'deepseek-v4-pro',
    replayTotalDays: 30,
    maxTaskMs: 5_000,
    maxPromptChars: 8_000,
    rateLimitPerMinute: 60,
  };
}

function historyResult(): SkillResult {
  return {
    schemaVersion: '1.0',
    reportId: 'agent-history-test',
    runId: 'run-30',
    skillId: 'town-agent-history',
    title: 'Mira Chen · 30 Trading-Day Agent Data',
    taskSummary: 'Read-only retrieval of one Agent across 30 trading days.',
    execution: {
      mode: 'competition',
      dataMode: 'verified-replay',
      isSimulated: true,
      seed: 20260725,
      durationMs: 0,
      steps: ['Read and verify 30 daily records'],
    },
    marketData: null,
    evidence: [
      {
        id: 'agent-daily-state',
        kind: 'agent-decision',
        summary: 'agent-01 has 30 verified daily records.',
        source: 'Town API run run-30',
        isSimulated: true,
      },
    ],
    findings: {
      provenance: { agentDecisionsAndFills: 'formal-simulation' },
      range: { tradingDays: 30, startTradeDate: '2025-01-02', endTradeDate: '2025-02-12' },
      agent: { agentId: 'agent-01', displayName: 'Mira Chen' },
      days: Array.from({ length: 30 }, (_, index) => ({
        tradeDate: `day-${index + 1}`,
        agent: {
          beliefScoreBefore: 0.4,
          beliefScoreAfter: 0.5,
          beliefBefore: '继续保持原有仓位。',
          beliefAfter: '基本面走弱，因此降低了风险敞口。',
          memory: '近期波动上升。',
          account: { equity: 1_000_000 + index },
          positions: [],
          riskRejections: 0,
          orderCount: 1,
          fillCount: 1,
        },
        views: [{ symbol: '002594.SZ', rationale: '基本面走弱，需要控制回撤。' }],
        posts: [{ content: 'raw unverified post' }],
        transactions: [{}],
        errors: [],
      })),
    },
    counterfactuals: [],
    riskConclusion: 'All decisions and fills are simulated.',
    chainProofs: [],
    warnings: ['This report is not investment advice.'],
  };
}

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
