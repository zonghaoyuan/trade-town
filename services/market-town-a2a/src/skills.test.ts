import { Message, Role } from '@a2a-js/sdk';
import { parseSkillRequest, runSkill } from './skills';

describe('Market Town A2A skills', () => {
  test.each([
    ['分析 PandaAI 真实历史数据中比亚迪的行情', 'panda-market-replay'],
    ['运行加息 100bp 实验，seed=42', 'rate-shock-experiment'],
    ['分析 ACME 谣言传播和权威更正', 'rumor-propagation-analysis'],
    ['复盘保守型用户的从众行为并给出反事实', 'user-behavior-review'],
  ] as const)('routes natural language: %s', (prompt, expectedSkill) => {
    expect(parseSkillRequest(textMessage(prompt), 8_000).skillId).toBe(expectedSkill);
  });

  test('returns deterministic rate-shock reports for the same seed', () => {
    const request = parseSkillRequest(textMessage('运行加息 100bp 实验，seed=42'), 8_000);
    const first = runSkill(request, 'local-demo');
    const second = runSkill(request, 'local-demo');

    expect(first.reportId).toBe(second.reportId);
    expect(first.findings).toEqual(second.findings);
    expect(first.execution.isSimulated).toBe(true);
    expect(first.chainProofs).toEqual([]);
  });

  test('replays real PandaAI historical bars while keeping decisions simulated', () => {
    const request = parseSkillRequest(
      textMessage('分析 PandaAI 数据中 002594.SZ 的历史走势和 8 个居民分歧'),
      8_000,
    );
    const result = runSkill(request, 'local-demo');

    expect(request.dataMode).toBe('verified-replay');
    expect(result).toMatchObject({
      skillId: 'panda-market-replay',
      execution: {
        dataMode: 'verified-replay',
        isSimulated: true,
      },
      marketData: {
        source: 'PandaAI',
        method: 'daily_bars',
        datasetId: 'panda-cn-a-2025-v1',
        schemaVersion: '1.1',
        instrumentType: 'SIMULATED_PERPETUAL_REFERENCE',
        symbol: '002594.SZ',
        startDate: '2024-10-08',
        endDate: '2025-12-31',
        barCount: 304,
        isReal: true,
      },
    });
    expect(result.evidence.some((item) => !item.isSimulated)).toBe(true);
    expect(result.evidence.some((item) => item.isSimulated)).toBe(true);
    expect(result.chainProofs).toEqual([]);
    expect(result.warnings.join(' ')).toContain('真实历史数据');
  });

  test.each([
    ['分析 002594.SZ', '002594.SZ'],
    ['分析 300750', '300750.SZ'],
    ['分析贵州茅台', '600519.SH'],
    ['分析 601318.SH', '601318.SH'],
    ['分析中芯国际', '688981.SH'],
  ])('selects an imported PandaAI market from natural language: %s', (prompt, symbol) => {
    const request = parseSkillRequest(textMessage(prompt), 8_000);
    const result = runSkill(request, 'local-demo');

    expect(result.marketData).toMatchObject({
      symbol,
      datasetId: 'panda-cn-a-2025-v1',
      barCount: 304,
    });
  });

  test('accepts a Chinese market name in structured input', () => {
    const request = parseSkillRequest(
      structuredMessage({
        skillId: 'panda-market-replay',
        input: { symbol: '宁德时代' },
      }),
      8_000,
    );

    expect(runSkill(request, 'local-demo').marketData?.symbol).toBe('300750.SZ');
  });

  test('rejects live mode for a historical PandaAI export', () => {
    const request = parseSkillRequest(
      structuredMessage({
        skillId: 'panda-market-replay',
        input: {
          symbol: '002594.SZ',
          dataMode: 'live',
        },
      }),
      8_000,
    );

    expect(() => runSkill(request, 'local-demo')).toThrow('不是实时行情');
  });

  test('behavior review includes exactly two reproducible counterfactuals', () => {
    const request = parseSkillRequest(
      structuredMessage({
        skillId: 'user-behavior-review',
        input: {
          riskTolerance: 0.25,
          orderNavRatio: 0.18,
          herding: 0.64,
          seed: 7,
        },
      }),
      8_000,
    );
    const result = runSkill(request, 'local-demo');

    expect(result.counterfactuals).toHaveLength(2);
    expect(result.riskConclusion).toContain('拒绝或缩量');
  });

  test('rejects live mode until a verifiable Run is connected', () => {
    const request = parseSkillRequest(
      structuredMessage({
        skillId: 'rate-shock-experiment',
        input: { dataMode: 'live' },
      }),
      8_000,
    );

    expect(() => runSkill(request, 'local-demo')).toThrow('避免把模拟数据伪装成真实结果');
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

function structuredMessage(data: Record<string, unknown>): Message {
  return {
    ...textMessage(''),
    parts: [
      {
        content: { $case: 'data', value: data },
        metadata: undefined,
        filename: '',
        mediaType: 'application/json',
      },
    ],
  };
}
