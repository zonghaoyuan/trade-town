import { Message } from '@a2a-js/sdk';
import { A2AConfig } from './config';
import { parseSkillRequest } from './skills';
import {
  DataMode,
  MarketTownReport,
  SKILL_IDS,
  SkillId,
  SkillPlan,
  SkillResult,
} from './types';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class DeepSeekReasoner {
  constructor(private readonly config: A2AConfig) {}

  async planRequest(message: Message): Promise<SkillPlan> {
    if (!this.isConfigured()) {
      return {
        request: parseSkillRequest(message, this.config.maxPromptChars),
        usedModel: false,
        rationale: '本地演示模式使用确定性路由；竞赛模式必须由 DeepSeek V4 Pro 规划任务。',
      };
    }

    const plannerInput = readPlannerInput(message, this.config.maxPromptChars);
    const content = await this.callModel(
      [
        {
          role: 'system',
          content: [
            '你是 AI Financial Town 的 DeepSeek V4 Pro 任务规划器。',
            '你的职责是理解用户目标、选择一个已声明的金融 Skill，并提取结构化参数。',
            '确定性计算、历史数据读取和风险检查由后续工具执行；你不能编造行情、成交或链上凭证。',
            '只能选择以下 Skill：',
            '- panda-market-replay：分析 PandaAI 授权历史日线；dataMode 必须为 verified-replay。',
            '- rate-shock-experiment：模拟利率冲击；dataMode 必须为 simulated。',
            '- rumor-propagation-analysis：模拟谣言传播与更正；dataMode 必须为 simulated。',
            '- user-behavior-review：复盘仓位与行为偏差；dataMode 必须为 simulated。',
            '如果请求包含明确 skillId，除非该值不在白名单中，否则保持不变。',
            '只输出一个 JSON 对象，不要 Markdown。格式：',
            '{"skillId":"...","input":{},"seed":20260722,"dataMode":"...","rationale":"一句简短规划理由"}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify(plannerInput),
        },
      ],
      0,
    );
    const plan = parsePlannerResponse(content);
    const plannedMessage = buildPlannedMessage(message, plannerInput.prompt, plan);
    return {
      request: parseSkillRequest(plannedMessage, this.config.maxPromptChars),
      usedModel: true,
      rationale: plan.rationale,
    };
  }

  async completeReport(
    result: SkillResult,
    startedAt: number,
    plan: SkillPlan,
  ): Promise<MarketTownReport> {
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
        used: plan.usedModel && analysis.used,
        stages: {
          taskPlanning: plan.usedModel,
          reportSynthesis: analysis.used,
        },
        planningRationale: plan.rationale,
        analysis: analysis.text,
      },
    };
  }

  private async explain(result: SkillResult): Promise<{ used: boolean; text: string }> {
    if (!this.isConfigured()) {
      return {
        used: false,
        text: '本地演示模式未调用模型；结论由确定性金融规则生成。竞赛部署必须配置 PandaAI 提供的 DeepSeek V4 Pro。',
      };
    }

    const text = await this.callModel(
      [
        {
          role: 'system',
          content:
            '你是 AI 金融小镇的 DeepSeek V4 Pro 研究报告智能体。根据结构化证据生成简洁、可审计的中文摘要；必须解释结论形成过程，不得编造价格、成交或链上凭证，不得提供现实投资承诺。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: result.title,
            taskSummary: result.taskSummary,
            marketData: result.marketData,
            findings: result.findings,
            riskConclusion: result.riskConclusion,
            evidence: result.evidence,
            warnings: result.warnings,
          }),
        },
      ],
      0.2,
    );
    return { used: true, text };
  }

  private isConfigured() {
    return Boolean(
      this.config.deepseekBaseUrl &&
        this.config.deepseekApiKey &&
        this.config.deepseekModel,
    );
  }

  private async callModel(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    temperature: number,
  ) {
    const { deepseekBaseUrl, deepseekApiKey, deepseekModel } = this.config;
    if (!deepseekBaseUrl || !deepseekApiKey || !deepseekModel) {
      throw new Error('DeepSeek V4 Pro is not configured.');
    }
    const response = await fetch(chatCompletionsUrl(deepseekBaseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: deepseekModel,
        temperature,
        messages,
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
    return text;
  }
}

type PlannerInput = {
  prompt: string;
  structuredParts: unknown[];
};

type PlannerResponse = {
  skillId: SkillId;
  input: Record<string, unknown>;
  seed: number;
  dataMode: DataMode;
  rationale: string;
};

function readPlannerInput(message: Message, maxPromptChars: number): PlannerInput {
  const prompt = message.parts
    .filter((part) => part.content?.$case === 'text')
    .map((part) => (part.content?.$case === 'text' ? part.content.value : ''))
    .join('\n')
    .trim();
  const structuredParts = message.parts
    .filter((part) => part.content?.$case === 'data')
    .map((part) => (part.content?.$case === 'data' ? part.content.value : undefined));
  const structuredLength = JSON.stringify(structuredParts).length;

  if (!prompt && structuredParts.length === 0) {
    throw new Error('任务不能为空，请提供自然语言问题或结构化 skillId/input。');
  }
  if (prompt.length > maxPromptChars || structuredLength > maxPromptChars * 2) {
    throw new Error(`任务内容过长；自然语言最多 ${maxPromptChars} 个字符。`);
  }
  return { prompt, structuredParts };
}

function parsePlannerResponse(content: string): PlannerResponse {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('DeepSeek planner did not return a JSON object.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new Error('DeepSeek planner returned invalid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new Error('DeepSeek planner returned an invalid plan.');
  }
  const skillId = parsed.skillId;
  if (typeof skillId !== 'string' || !(SKILL_IDS as readonly string[]).includes(skillId)) {
    throw new Error('DeepSeek planner selected an undeclared Skill.');
  }
  const dataMode = parsed.dataMode;
  if (dataMode !== 'simulated' && dataMode !== 'verified-replay' && dataMode !== 'live') {
    throw new Error('DeepSeek planner returned an invalid dataMode.');
  }
  const seed = typeof parsed.seed === 'number' && Number.isFinite(parsed.seed)
    ? parsed.seed
    : 20260722;
  const rationale =
    typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim().slice(0, 500)
      : 'DeepSeek V4 Pro 已选择金融工具并提取参数。';
  return {
    skillId: skillId as SkillId,
    input: isRecord(parsed.input) ? parsed.input : {},
    seed,
    dataMode,
    rationale,
  };
}

function buildPlannedMessage(
  original: Message,
  prompt: string,
  plan: PlannerResponse,
): Message {
  return {
    ...original,
    parts: [
      {
        content: {
          $case: 'data',
          value: {
            skillId: plan.skillId,
            prompt,
            input: {
              ...plan.input,
              seed: plan.seed,
              dataMode: plan.dataMode,
            },
          },
        },
        metadata: { plannedBy: 'DeepSeek V4 Pro' },
        filename: '',
        mediaType: 'application/json',
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function chatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized.replace(/\/v1$/, '')}/v1/chat/completions`;
}
