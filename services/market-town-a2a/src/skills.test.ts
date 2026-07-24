import { Message, Role } from '@a2a-js/sdk';
import { parseSkillRequest, runSkill } from './skills';

describe('Market Town A2A skills', () => {
  test.each([
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
