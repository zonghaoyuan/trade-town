import { A2AConfig } from './config';
import { MarketTownReport, SkillResult } from './types';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class DeepSeekReasoner {
  constructor(private readonly config: A2AConfig) {}

  async completeReport(result: SkillResult, startedAt: number): Promise<MarketTownReport> {
    const analysis = await this.explain(result);
    return {
      ...result,
      createdAt: new Date().toISOString(),
      execution: {
        ...result.execution,
        durationMs: Date.now() - startedAt,
      },
      model: {
        requiredModel: 'DeepSeek V4 Pro',
        configuredModel: this.config.deepseekModel ?? null,
        used: analysis.used,
        analysis: analysis.text,
      },
    };
  }

  private async explain(result: SkillResult): Promise<{ used: boolean; text: string }> {
    if (!this.config.deepseekBaseUrl || !this.config.deepseekApiKey || !this.config.deepseekModel) {
      return {
        used: false,
        text: '本地演示模式未调用模型；结论由确定性金融规则生成。竞赛部署必须配置 PandaAI 提供的 DeepSeek V4 Pro。',
      };
    }

    const response = await fetch(chatCompletionsUrl(this.config.deepseekBaseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.deepseekModel,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              '你是 AI 金融小镇的研究解释器。根据结构化证据生成简洁、可审计的中文摘要；不得编造价格、成交或链上凭证，不得提供现实投资承诺。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: result.title,
              taskSummary: result.taskSummary,
              findings: result.findings,
              riskConclusion: result.riskConclusion,
              evidence: result.evidence,
              warnings: result.warnings,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(Math.min(this.config.maxTaskMs, 120_000)),
    });
    if (!response.ok) {
      throw new Error(`DeepSeek request failed (${response.status}): ${await response.text()}`);
    }
    const body = (await response.json()) as ChatCompletionResponse;
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('DeepSeek response did not contain an analysis.');
    }
    return { used: true, text };
  }
}

function chatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized.replace(/\/v1$/, '')}/v1/chat/completions`;
}
