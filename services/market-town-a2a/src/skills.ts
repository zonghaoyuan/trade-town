import { createHash } from 'node:crypto';
import { Message } from '@a2a-js/sdk';
import { formFinancialIntention } from '../../../convex/finance/decision';
import { TOWN_MARKETS, TOWN_TRADERS } from '../../../shared/finance';
import { pandaHistoricalMarket, pandaHistoricalMarkets } from '../../../shared/pandaMarket';
import { buildPandaSimulationRun } from '../../../shared/pandaSimulation';
import { DataMode, EvidenceItem, SKILL_IDS, SkillId, SkillRequest, SkillResult } from './types';

const RISK_WARNING = '本报告用于黑客松金融仿真与研究演示，不构成现实投资建议、收益承诺或买卖指令。';

export function parseSkillRequest(message: Message, maxPromptChars: number): SkillRequest {
  const text = message.parts
    .filter((part) => part.content?.$case === 'text')
    .map((part) => (part.content?.$case === 'text' ? part.content.value : ''))
    .join('\n')
    .trim();
  const dataParts = message.parts
    .filter((part) => part.content?.$case === 'data')
    .map((part) => (part.content?.$case === 'data' ? part.content.value : undefined));
  const structured = dataParts.find(isRecord) ?? {};
  const prompt = text || readString(structured.prompt) || '';
  const serializedStructured = JSON.stringify(structured);

  if (!prompt && Object.keys(structured).length === 0) {
    throw new Error('任务不能为空，请提供自然语言问题或结构化 skillId/input。');
  }
  if (prompt.length > maxPromptChars || serializedStructured.length > maxPromptChars * 2) {
    throw new Error(`任务内容过长；自然语言最多 ${maxPromptChars} 个字符。`);
  }

  const explicitSkill = readString(structured.skillId);
  const skillId = explicitSkill ? assertSkillId(explicitSkill) : detectSkill(prompt);
  const input = isRecord(structured.input) ? structured.input : structured;
  const seed = normalizeSeed(readNumber(input.seed) ?? readSeedFromText(prompt) ?? 20260722);
  const dataMode = readDataMode(
    readString(input.dataMode) ?? readString(structured.dataMode),
    skillId === 'panda-market-replay' ? 'verified-replay' : 'simulated',
  );

  return { skillId, prompt, input, seed, dataMode };
}

export function runSkill(request: SkillRequest, executionMode: 'local-demo' | 'competition') {
  if (request.skillId === 'panda-market-replay') {
    if (request.dataMode !== 'verified-replay') {
      throw new Error(
        `panda-market-replay 只支持 verified-replay；当前数据是 PandaAI 真实历史行情，不是实时行情。`,
      );
    }
    return runPandaMarketReplay(request, executionMode);
  }
  if (request.dataMode !== 'simulated') {
    throw new Error(
      `${request.dataMode} 暂未接通可验证 Run；为避免把模拟数据伪装成真实结果，本版本拒绝执行。`,
    );
  }
  switch (request.skillId) {
    case 'rate-shock-experiment':
      return runRateShock(request, executionMode);
    case 'rumor-propagation-analysis':
      return runRumorAnalysis(request, executionMode);
    case 'user-behavior-review':
      return runBehaviorReview(request, executionMode);
  }
}

function runPandaMarketReplay(
  request: SkillRequest,
  executionMode: 'local-demo' | 'competition',
): SkillResult {
  const defaultMarket = pandaHistoricalMarket.market;
  const symbolInput = readString(request.input.symbol);
  const requestedSymbol =
    readPandaSymbol(symbolInput ?? request.prompt) ?? symbolInput ?? defaultMarket.symbol;
  const pandaDataset = pandaHistoricalMarkets.find(
    ({ market }) => market.symbol === requestedSymbol.toUpperCase(),
  );
  if (!pandaDataset) {
    throw new Error(
      `当前 PandaAI 历史数据不包含 ${requestedSymbol}；可用标的是 ${pandaHistoricalMarkets
        .map(({ market }) => market.symbol)
        .join('、')}。`,
    );
  }
  const { market } = pandaDataset;

  const replay = buildPandaSimulationRun(market);
  const firstCandle = market.candles[0];
  const lastCandle = market.candles[market.candles.length - 1];
  const annualHigh = Math.max(...market.candles.map((candle) => candle.high));
  const annualLow = Math.min(...market.candles.map((candle) => candle.low));
  const indicators = Object.fromEntries(
    market.indicators.map((indicator) => [indicator.label, indicator.value]),
  );
  const evidence: EvidenceItem[] = [
    evidenceItem(
      'panda-market-input',
      'market-event',
      `${market.displayName}（${market.symbol}）${pandaDataset.startDate}—${pandaDataset.endDate} 共 ${pandaDataset.barCount} 条日线，最近收盘 ${market.lastPrice} CNY。`,
      `PANDA:${pandaDataset.datasetId}:${market.symbol}:${pandaDataset.endDate}`,
      false,
    ),
    evidenceItem(
      'panda-derived-indicators',
      'input',
      `由真实日线复算 MA20=${indicators.MA20}、RSI14=${indicators.RSI14}、VOL20=${indicators.VOL20}。`,
      `PANDA:${pandaDataset.datasetId}:${market.symbol}:derived`,
      false,
    ),
    ...replay.traders.map((trader, index) =>
      evidenceItem(
        `panda-agent-decision-${index + 1}`,
        'agent-decision',
        `${trader.name} 形成模拟 ${trader.action} 意图，置信度 ${trader.confidence}；${trader.thesis}`,
        `run:${replay.runId}:decision:${index + 1}`,
        true,
      ),
    ),
  ];

  const result = baseResult(
    request,
    executionMode,
    {
      title: `${market.displayName} PandaAI 历史行情回放`,
      taskSummary:
        '读取 PandaAI 授权的真实历史日线，复算技术指标，并让 8 个金融居民生成可解释的模拟观点与风控结果。',
      marketData: {
        source: pandaDataset.source,
        method: pandaDataset.method,
        datasetId: pandaDataset.datasetId,
        schemaVersion: pandaDataset.schemaVersion,
        instrumentType: pandaDataset.instrumentType,
        symbol: market.symbol,
        startDate: pandaDataset.startDate,
        endDate: pandaDataset.endDate,
        asOf: new Date(pandaDataset.asOf).toISOString(),
        barCount: pandaDataset.barCount,
        isReal: true,
      },
      evidence,
      findings: {
        market: {
          symbol: market.symbol,
          displayName: market.displayName,
          currency: market.quoteCurrency,
          firstClose: firstCandle.close,
          latestClose: lastCandle.close,
          previousClose: market.referencePrice,
          latestChangePct: round(market.changePct, 4),
          annualHigh,
          annualLow,
          latestVolume: market.volume,
          indicators,
        },
        sentiment: replay.sentiment,
        decisions: replay.traders.map((trader) => ({
          agentName: trader.name,
          action: trader.action,
          confidence: trader.confidence,
          pnl: trader.pnl,
          riskRejections: trader.riskRejections,
          thesis: trader.thesis,
        })),
        executions: replay.executions,
        summary: replay.summary,
      },
      counterfactuals: [],
      riskConclusion:
        '行情数据来自 PandaAI 真实历史日线；居民观点、订单、成交和组合收益均为确定性回放，不代表真实交易或投资建议。',
    },
    [
      '读取并校验 PandaAI 授权历史日线',
      '复算 MA20、RSI14 与 VOL20',
      '运行 8 个居民的确定性决策规则',
      '执行现金、订单规模和集中度风控',
      '生成真实数据溯源与模拟执行披露',
    ],
  );
  return {
    ...result,
    runId: replay.runId,
  };
}

function runRateShock(
  request: SkillRequest,
  executionMode: 'local-demo' | 'competition',
): SkillResult {
  const shockBps = clamp(
    readNumber(request.input.shockBps) ?? readBpsFromText(request.prompt) ?? 100,
    -500,
    1000,
  );
  const normalizedShock = shockBps / 100;
  const rng = seededRandom(request.seed);
  const evidence: EvidenceItem[] = [
    evidenceItem(
      'event-rate-shock',
      'market-event',
      `央行利率变动 ${shockBps}bp，作为统一外生冲击输入。`,
    ),
  ];

  const marketImpact = Object.fromEntries(
    TOWN_MARKETS.map((market) => {
      const sensitivity =
        market.symbol === 'AURUM'
          ? 0.38
          : market.symbol === 'NOVA'
            ? -0.82
            : market.symbol === 'ACME'
              ? -0.61
              : -0.27;
      return [market.symbol, round(sensitivity * normalizedShock, 3)];
    }),
  );

  const decisions = TOWN_TRADERS.filter((trader) => trader.kind === 'ai').map((trader, index) => {
    const symbol = trader.focusSymbols[index % trader.focusSymbols.length];
    const market = TOWN_MARKETS.find((candidate) => candidate.symbol === symbol)!;
    const impact = clamp((marketImpact[symbol] as number) + (rng() - 0.5) * 0.12, -1, 1);
    const crowdSentiment = clamp(-normalizedShock * 0.55 + (rng() - 0.5) * 0.2, -1, 1);
    const intention = formFinancialIntention({
      belief: {
        symbol,
        fairValue: market.referencePrice * (0.97 + rng() * 0.08),
        sentiment: (rng() - 0.5) * 0.25,
        confidence: 0.45 + rng() * 0.25,
        evidence: ['情景开始前的基准估值'],
      },
      biases: {
        lossAversion: 0.35 + (index % 4) * 0.13,
        herding: 0.2 + (index % 5) * 0.12,
        anchoring: 0.25 + (index % 3) * 0.16,
        overconfidence: 0.15 + (index % 4) * 0.12,
      },
      signal: {
        symbol,
        lastPrice: market.referencePrice,
        referencePrice: market.referencePrice,
        eventImpact: impact,
        crowdSentiment,
        evidence: `利率冲击 ${shockBps}bp 对 ${symbol} 的情景敏感度为 ${impact.toFixed(2)}`,
      },
      portfolio: {
        cash: 65_000 + index * 2_500,
        netAssetValue: 100_000,
        quantity: 300 + index * 25,
        averagePrice: market.referencePrice * (0.94 + rng() * 0.12),
      },
      riskTolerance: trader.riskTolerance,
    });
    const action = intention.action === 'hold' ? 'HOLD' : intention.side === 'buy' ? 'BUY' : 'SELL';
    const confidence = round(intention.updatedBelief.confidence, 3);
    const decisionId = `decision-${index + 1}`;
    evidence.push(
      evidenceItem(
        decisionId,
        'agent-decision',
        `${trader.name} 对 ${symbol} 形成 ${action} 意图，置信度 ${confidence}。`,
      ),
    );
    evidence.push(
      evidenceItem(
        `risk-${index + 1}`,
        'risk-check',
        intention.action === 'hold'
          ? intention.reason
          : `确定性风控通过；模拟限价 ${intention.limitPrice}，数量 ${intention.quantity}。`,
      ),
    );
    return {
      agentName: trader.name,
      symbol,
      action,
      confidence,
      thesis: intention.reason,
      desiredExposureChangePct:
        intention.action === 'trade'
          ? round(
              ((intention.side === 'buy' ? 1 : -1) * intention.quantity * intention.limitPrice) /
                100_000,
              4,
            )
          : 0,
      simulatedOrder:
        intention.action === 'trade'
          ? {
              side: intention.side,
              quantity: intention.quantity,
              limitPrice: intention.limitPrice,
            }
          : null,
    };
  });

  const sellCount = decisions.filter((decision) => decision.action === 'SELL').length;
  const holdCount = decisions.filter((decision) => decision.action === 'HOLD').length;
  const buyCount = decisions.length - sellCount - holdCount;
  return baseResult(request, executionMode, {
    title: `利率冲击 ${shockBps}bp 实验`,
    taskSummary: `让 8 个金融居民在同一利率冲击下更新观点并通过确定性风控。`,
    evidence,
    findings: {
      shockBps,
      marketImpact,
      consensus: { buy: buyCount, sell: sellCount, hold: holdCount },
      decisions,
    },
    counterfactuals: [
      {
        change: `将冲击从 ${shockBps}bp 缩小为 ${round(shockBps / 2, 0)}bp`,
        outcome: '成长资产和高杠杆公司的负面信号强度约减半。',
        calculation: '资产敏感度保持不变，eventImpact 按利率冲击线性缩放。',
      },
    ],
    riskConclusion:
      sellCount > buyCount
        ? '居民整体偏防御，但订单仅为模拟意图，未提交 Injective。'
        : '居民尚未形成一致方向，应优先观察分歧和风险拒绝，而不是追随单一结论。',
  });
}

function runRumorAnalysis(
  request: SkillRequest,
  executionMode: 'local-demo' | 'competition',
): SkillResult {
  const symbol = normalizeSymbol(readString(request.input.symbol) ?? readSymbol(request.prompt));
  const rng = seededRandom(request.seed);
  const traders = TOWN_TRADERS.filter((trader) => trader.kind === 'ai');
  const source = 'Sora Vale';
  const initialCredibility = clamp(readNumber(request.input.credibility) ?? 0.68, 0, 1);
  const correctionStrength = clamp(readNumber(request.input.correctionStrength) ?? 0.75, 0, 1);
  const propagation = traders
    .filter((trader) => trader.name !== source)
    .map((trader, index) => {
      const susceptibility = clamp(
        0.18 + trader.riskTolerance * 0.42 + (index % 3) * 0.08 + rng() * 0.08,
        0,
        1,
      );
      const beforeCorrection = round(initialCredibility * susceptibility, 3);
      const afterCorrection = round(
        beforeCorrection * (1 - correctionStrength * (0.55 + rng() * 0.3)),
        3,
      );
      return {
        from: index < 3 ? source : traders[index % 3].name,
        to: trader.name,
        susceptibility: round(susceptibility, 3),
        beliefBeforeCorrection: beforeCorrection,
        beliefAfterCorrection: afterCorrection,
        changedDecision: beforeCorrection >= 0.35 && afterCorrection < 0.35,
      };
    });
  const corrected = propagation.filter((edge) => edge.changedDecision).length;
  const evidence: EvidenceItem[] = [
    evidenceItem(
      'rumor-origin',
      'market-event',
      `${source} 发布一条关于 ${symbol} 的未经证实消息，初始可信度 ${initialCredibility}。`,
    ),
    ...propagation.map((edge, index) =>
      evidenceItem(
        `propagation-${index + 1}`,
        'agent-decision',
        `${edge.from} → ${edge.to}：更正前信念 ${edge.beliefBeforeCorrection}，更正后 ${edge.beliefAfterCorrection}。`,
      ),
    ),
    evidenceItem(
      'authoritative-correction',
      'correction',
      `权威更正强度 ${correctionStrength}；${corrected} 个居民的阈值型决策被纠正。`,
    ),
  ];

  return baseResult(request, executionMode, {
    title: `${symbol} 谣言传播与更正分析`,
    taskSummary: '追踪未经证实消息在居民关系网络中的传播，并比较权威更正前后的信念。',
    evidence,
    findings: {
      symbol,
      rumor: {
        source,
        initialCredibility,
        correctionStrength,
      },
      propagation,
      summary: {
        reachedAgents: propagation.length,
        correctedDecisions: corrected,
        residualHighBelief: propagation.filter((edge) => edge.beliefAfterCorrection >= 0.35).length,
      },
      affectedOrders: [],
    },
    counterfactuals: [
      {
        change: '权威更正在第一跳传播前发布',
        outcome: '所有边的初始信念先乘以更正衰减系数，传播峰值明显降低。',
        calculation: `initialCredibility × (1 - ${correctionStrength})`,
      },
    ],
    riskConclusion:
      '更正降低了多数居民的信念，但传播记录未关联真实订单；affectedOrders 为空，不宣称链上影响。',
  });
}

function runBehaviorReview(
  request: SkillRequest,
  executionMode: 'local-demo' | 'competition',
): SkillResult {
  const riskTolerance = clamp(
    readNumber(request.input.riskTolerance) ?? inferRiskTolerance(request.prompt),
    0,
    1,
  );
  const lossAversion = clamp(readNumber(request.input.lossAversion) ?? 0.72, 0, 1);
  const herding = clamp(readNumber(request.input.herding) ?? 0.64, 0, 1);
  const orderNavRatio = clamp(readNumber(request.input.orderNavRatio) ?? 0.18, 0, 1);
  const maxOrderNavRatio = round(0.04 + riskTolerance * 0.08, 3);
  const blocked = orderNavRatio > maxOrderNavRatio;
  const reducedRatio = round(Math.min(orderNavRatio, maxOrderNavRatio), 3);
  const coolingRatio = round(reducedRatio * (1 - herding * 0.35), 3);
  const evidence: EvidenceItem[] = [
    evidenceItem(
      'profile-input',
      'input',
      `风险承受度 ${riskTolerance}、损失厌恶 ${lossAversion}、从众倾向 ${herding}。`,
    ),
    evidenceItem(
      'observed-intent',
      'agent-decision',
      `观察到单笔目标仓位变化 ${round(orderNavRatio * 100, 1)}%。`,
    ),
    evidenceItem(
      'deterministic-risk-check',
      'risk-check',
      blocked
        ? `超过该画像的单笔上限 ${round(maxOrderNavRatio * 100, 1)}%，应拒绝或缩量。`
        : `未超过单笔上限 ${round(maxOrderNavRatio * 100, 1)}%。`,
    ),
  ];

  return baseResult(request, executionMode, {
    title: '用户数字分身行为复盘',
    taskSummary: '识别用户数字分身的行为偏差，并用同一输入计算两个可复算反事实。',
    evidence,
    findings: {
      profile: {
        riskTolerance,
        lossAversion,
        herding,
      },
      observedBehavior: {
        orderNavRatio,
        riskAccepted: !blocked,
        biasFlags: [
          ...(herding >= 0.6 ? ['herding'] : []),
          ...(lossAversion >= 0.7 ? ['loss-aversion'] : []),
          ...(orderNavRatio > maxOrderNavRatio ? ['position-sizing'] : []),
        ],
      },
      recommendedRules: {
        maxOrderNavRatio,
        minimumCashRatio: round(0.3 - riskTolerance * 0.12, 3),
        requireDualSourceConfirmation: herding >= 0.6,
        coolingPeriodMinutes: herding >= 0.6 ? 30 : 10,
      },
    },
    counterfactuals: [
      {
        change: `将单笔仓位限制为 NAV 的 ${round(maxOrderNavRatio * 100, 1)}%`,
        outcome: `目标仓位变化从 ${round(orderNavRatio * 100, 1)}% 降为 ${round(reducedRatio * 100, 1)}%。`,
        calculation: `min(${orderNavRatio}, ${maxOrderNavRatio}) = ${reducedRatio}`,
      },
      {
        change: '增加冷静期，并按从众倾向降低冲动仓位',
        outcome: `冷静期后的目标仓位变化为 ${round(coolingRatio * 100, 1)}%。`,
        calculation: `${reducedRatio} × (1 - ${herding} × 0.35) = ${coolingRatio}`,
      },
    ],
    riskConclusion: blocked
      ? '当前意图应由确定性风控拒绝或缩量；复盘只给出决策框架，不给出现实买卖指令。'
      : '当前意图未超过单笔上限，但仍需保留现金约束和双来源确认。',
  });
}

function baseResult(
  request: SkillRequest,
  executionMode: 'local-demo' | 'competition',
  fields: Pick<
    SkillResult,
    'title' | 'taskSummary' | 'evidence' | 'findings' | 'counterfactuals' | 'riskConclusion'
  > &
    Partial<Pick<SkillResult, 'marketData'>>,
  steps = [
    '解析并校验白名单 Skill 与输入',
    '建立固定 Seed 的金融情景',
    '运行居民决策或行为规则',
    '执行确定性风险检查',
    '生成结构化证据与风险披露',
  ],
): SkillResult {
  const stableId = createHash('sha256')
    .update(JSON.stringify([request.skillId, request.seed, request.input, request.prompt]))
    .digest('hex')
    .slice(0, 16);
  return {
    schemaVersion: '1.0',
    reportId: `report-${stableId}`,
    runId: `a2a-${request.skillId}-${request.seed}-${stableId.slice(0, 8)}`,
    skillId: request.skillId,
    ...fields,
    marketData: fields.marketData ?? null,
    execution: {
      mode: executionMode,
      dataMode: request.dataMode,
      isSimulated: true,
      seed: request.seed,
      durationMs: 0,
      steps,
    },
    chainProofs: [],
    warnings: [
      RISK_WARNING,
      request.dataMode === 'verified-replay'
        ? 'PandaAI 行情为真实历史数据；居民观点、订单和成交仍明确标记为 simulated。'
        : '当前输出明确标记为 simulated。',
      '没有真实 Tx Hash、Order Hash 或成交凭证，不提供 Explorer 链接。',
    ],
  };
}

function detectSkill(prompt: string): SkillId {
  const normalized = prompt.toLowerCase();
  if (
    readPandaSymbol(prompt) ||
    /panda|真实行情|历史行情|历史数据|行情回放|market replay|historical market/.test(normalized)
  ) {
    return 'panda-market-replay';
  }
  if (/谣言|传言|传播|更正|rumou?r|propagation|correction/.test(normalized)) {
    return 'rumor-propagation-analysis';
  }
  if (/复盘|数字分身|用户行为|反事实|偏差|behavior|counterfactual|review/.test(normalized)) {
    return 'user-behavior-review';
  }
  if (/加息|降息|利率|基点|bp|rate|央行|宏观冲击/.test(normalized)) {
    return 'rate-shock-experiment';
  }
  throw new Error(`无法识别任务类型。支持的 Skill：${SKILL_IDS.join('、')}。`);
}

function assertSkillId(value: string): SkillId {
  if ((SKILL_IDS as readonly string[]).includes(value)) {
    return value as SkillId;
  }
  throw new Error(`未声明的 Skill：${value}。`);
}

function readDataMode(value: string | undefined, fallback: DataMode): DataMode {
  if (!value) {
    return fallback;
  }
  if (value === 'simulated') {
    return value;
  }
  if (value === 'verified-replay' || value === 'live') {
    return value;
  }
  throw new Error('dataMode 必须是 simulated、verified-replay 或 live。');
}

function evidenceItem(
  id: string,
  kind: EvidenceItem['kind'],
  summary: string,
  source = 'market-town-deterministic-engine',
  isSimulated = true,
): EvidenceItem {
  return {
    id,
    kind,
    summary,
    source,
    isSimulated,
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function normalizeSeed(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error('seed 必须是有限数字。');
  }
  return Math.abs(Math.trunc(value)) % 2_147_483_647;
}

function normalizeSymbol(value: string | undefined) {
  const symbol = (value ?? 'ACME').toUpperCase();
  if (!TOWN_MARKETS.some((market) => market.symbol === symbol)) {
    throw new Error(`不支持的资产 ${symbol}。`);
  }
  return symbol;
}

function readBpsFromText(text: string) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:bp|基点)/i);
  return match ? Number(match[1]) : undefined;
}

function readSeedFromText(text: string) {
  const match = text.match(/seed\s*[:=：]?\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function readSymbol(text: string) {
  return TOWN_MARKETS.find((market) => new RegExp(`\\b${market.symbol}\\b`, 'i').test(text))
    ?.symbol;
}

function readPandaSymbol(text: string | undefined) {
  if (!text) return undefined;
  const normalized = text.toUpperCase();
  return pandaHistoricalMarkets.find(({ market }) => {
    const bareSymbol = market.symbol.slice(0, 6);
    return (
      normalized.includes(market.symbol) ||
      new RegExp(`\\b${bareSymbol}\\b`).test(normalized) ||
      text.includes(market.displayName)
    );
  })?.market.symbol;
}

function inferRiskTolerance(text: string) {
  if (/保守|低风险|conservative/i.test(text)) {
    return 0.25;
  }
  if (/激进|高风险|aggressive/i.test(text)) {
    return 0.8;
  }
  return 0.5;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals: number) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
