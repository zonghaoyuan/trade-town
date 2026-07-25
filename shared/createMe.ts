export const CREATE_ME_DRAFT_KEY = 'trade-town:create-me-draft:v1';
export const CREATE_ME_OWNER_KEY = 'trade-town:anonymous-owner:v1';

export const CREATE_ME_PRESETS = [
  {
    id: 'mira',
    character: 'f1',
    label: 'Mira',
    textureUrl: '/assets/trade-town/characters/mira.png',
    description: '沉稳的城市研究员',
  },
  {
    id: 'theo',
    character: 'f2',
    label: 'Theo',
    textureUrl: '/assets/trade-town/characters/theo.png',
    description: '敏捷的趋势观察者',
  },
  {
    id: 'imani',
    character: 'f3',
    label: 'Imani',
    textureUrl: '/assets/trade-town/characters/imani.png',
    description: '冷静的组合管理者',
  },
  {
    id: 'sora',
    character: 'f4',
    label: 'Sora',
    textureUrl: '/assets/trade-town/characters/sora.png',
    description: '好奇的事件猎手',
  },
  {
    id: 'omar',
    character: 'f5',
    label: 'Omar',
    textureUrl: '/assets/trade-town/characters/omar.png',
    description: '谨慎的风险守门人',
  },
  {
    id: 'lin',
    character: 'f6',
    label: 'Lin',
    textureUrl: '/assets/trade-town/characters/lin.png',
    description: '耐心的价值研究者',
  },
  {
    id: 'jules',
    character: 'f7',
    label: 'Jules',
    textureUrl: '/assets/trade-town/characters/jules.png',
    description: '独立的逆向思考者',
  },
  {
    id: 'neha',
    character: 'f8',
    label: 'Neha',
    textureUrl: '/assets/trade-town/characters/neha.png',
    description: '果断的机会捕手',
  },
] as const;

export type CreateMePresetId = (typeof CREATE_ME_PRESETS)[number]['id'];
export type CreateMeAppearanceMode = 'preset' | 'custom';
export type InvestmentGoal = 'growth' | 'income' | 'preservation' | 'learning';
export type InvestmentHorizon = 'short' | 'medium' | 'long';
export type ScenarioId =
  | 'market_crash'
  | 'missed_rally'
  | 'crowd_fomo'
  | 'thesis_challenged'
  | 'unexpected_cash';
export type ScenarioChoice = 'cautious' | 'measured' | 'aggressive';

export type CreateMeDraft = {
  displayName: string;
  presetId: CreateMePresetId;
  appearanceMode: CreateMeAppearanceMode;
  skinTone: LpcSkinToneId;
  hairStyle: LpcHairStyleId;
  hairColor: LpcHairColorId;
  topStyle: LpcTopStyleId;
  topColor: LpcClothingColorId;
  bottomStyle: LpcBottomStyleId;
  bottomColor: LpcClothingColorId;
  shoesStyle: LpcShoesStyleId;
  investmentGoal: InvestmentGoal;
  horizon: InvestmentHorizon;
  maxDrawdownPct: number;
  conviction: number;
  socialInfluence: number;
  lossAversion: number;
  scenarios: ScenarioId[];
  scenarioAnswers: Partial<Record<ScenarioId, ScenarioChoice>>;
};

export type CompiledMeProfile = {
  riskTolerance: number;
  holdingPeriodDays: number;
  cashBufferPct: number;
  maxPositionPct: number;
  tradeFrequency: 'low' | 'medium' | 'high';
  socialSignalWeight: number;
  stopLossDiscipline: number;
  decisionStyle: string;
  riskFlags: string[];
};

export type MeAgentNarrative = {
  description: string;
  identity: string;
  plan: string;
};

export const LPC_GENERATOR_COMMIT = 'ea7aa428afe2c8f4c6230377bd99473c146005b0';
const LPC_RAW_ROOT =
  `https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/${LPC_GENERATOR_COMMIT}/spritesheets`;

export const LPC_SKIN_TONES = [
  { id: 'light', label: '浅肤色', tint: '#ffffff' },
  { id: 'warm', label: '暖肤色', tint: '#d7aa94' },
  { id: 'deep', label: '深肤色', tint: '#8f6b5d' },
] as const;
export type LpcSkinToneId = (typeof LPC_SKIN_TONES)[number]['id'];

export const LPC_HAIR_STYLES = [
  { id: 'bob', label: '短波波', path: 'hair/bob/adult/walk.png' },
  { id: 'afro', label: '蓬松卷发', path: 'hair/afro/adult/walk.png' },
  { id: 'buzzcut', label: '利落短发', path: 'hair/buzzcut/adult/walk.png' },
  { id: 'pixie', label: '精灵短发', path: 'hair/pixie/adult/walk.png' },
] as const;
export type LpcHairStyleId = (typeof LPC_HAIR_STYLES)[number]['id'];

export const LPC_HAIR_COLORS = [
  { id: 'copper', label: '铜棕', tint: '#ffffff' },
  { id: 'brown', label: '深棕', tint: '#8b5b42' },
  { id: 'black', label: '墨黑', tint: '#413b45' },
  { id: 'wine', label: '酒红', tint: '#a45361' },
] as const;
export type LpcHairColorId = (typeof LPC_HAIR_COLORS)[number]['id'];

export const LPC_TOP_STYLES = [
  {
    id: 'cardigan',
    label: '针织开衫',
    path: 'torso/clothes/longsleeve/longsleeve2_cardigan/female/walk.png',
  },
  {
    id: 'polo',
    label: '翻领上衣',
    path: 'torso/clothes/longsleeve/longsleeve2_polo/female/walk.png',
  },
  {
    id: 'buttoned',
    label: '短袖衬衣',
    path: 'torso/clothes/shortsleeve/tshirt_buttoned/female/walk.png',
  },
] as const;
export type LpcTopStyleId = (typeof LPC_TOP_STYLES)[number]['id'];

export const LPC_BOTTOM_STYLES = [
  { id: 'pants', label: '修身长裤', path: 'legs/pants/thin/walk.png' },
  { id: 'pants2', label: '休闲长裤', path: 'legs/pants2/thin/walk.png' },
  { id: 'formal', label: '正式长裤', path: 'legs/formal/thin/walk.png' },
] as const;
export type LpcBottomStyleId = (typeof LPC_BOTTOM_STYLES)[number]['id'];

export const LPC_SHOES_STYLES = [
  { id: 'basic', label: '基础鞋', path: 'feet/shoes/basic/thin/walk.png' },
] as const;
export type LpcShoesStyleId = (typeof LPC_SHOES_STYLES)[number]['id'];

export const LPC_CLOTHING_COLORS = [
  { id: 'cream', label: '米白', tint: '#fff4d2' },
  { id: 'blue', label: '城镇蓝', tint: '#7f9cca' },
  { id: 'plum', label: '梅子红', tint: '#b47787' },
  { id: 'green', label: '松石绿', tint: '#79ad8f' },
  { id: 'gold', label: '麦穗金', tint: '#e4b965' },
] as const;
export type LpcClothingColorId = (typeof LPC_CLOTHING_COLORS)[number]['id'];

export type LpcWalkLayer = {
  category: 'body' | 'head' | 'top' | 'bottom' | 'shoes' | 'hair';
  url: string;
  tint: string;
  creditPath: string;
};

const LPC_WALK_LAYER_ORDER: readonly LpcWalkLayer['category'][] = [
  'body',
  'head',
  'top',
  'bottom',
  'shoes',
  'hair',
];

const LPC_WALK_LAYER_PATHS: Record<LpcWalkLayer['category'], ReadonlySet<string>> = {
  body: new Set(['body/bodies/female/walk.png']),
  head: new Set(['head/heads/human/female/walk.png']),
  top: new Set(LPC_TOP_STYLES.map((item) => item.path)),
  bottom: new Set(LPC_BOTTOM_STYLES.map((item) => item.path)),
  shoes: new Set(LPC_SHOES_STYLES.map((item) => item.path)),
  hair: new Set(LPC_HAIR_STYLES.map((item) => item.path)),
};

function catalogItem<Item extends { id: string }>(items: readonly Item[], id: string) {
  return items.find((item) => item.id === id) ?? items[0];
}

export function isApprovedLpcWalkLayerSet(layers: readonly LpcWalkLayer[]) {
  return (
    layers.length === LPC_WALK_LAYER_ORDER.length &&
    layers.every((layer, index) => {
      const category = LPC_WALK_LAYER_ORDER[index];
      return (
        layer.category === category &&
        LPC_WALK_LAYER_PATHS[category].has(layer.creditPath) &&
        layer.url === `${LPC_RAW_ROOT}/${layer.creditPath}`
      );
    })
  );
}

export function getLpcWalkLayers(draft: CreateMeDraft): LpcWalkLayer[] {
  const skin = catalogItem(LPC_SKIN_TONES, draft.skinTone);
  const hair = catalogItem(LPC_HAIR_STYLES, draft.hairStyle);
  const hairColor = catalogItem(LPC_HAIR_COLORS, draft.hairColor);
  const top = catalogItem(LPC_TOP_STYLES, draft.topStyle);
  const topColor = catalogItem(LPC_CLOTHING_COLORS, draft.topColor);
  const bottom = catalogItem(LPC_BOTTOM_STYLES, draft.bottomStyle);
  const bottomColor = catalogItem(LPC_CLOTHING_COLORS, draft.bottomColor);
  const shoes = catalogItem(LPC_SHOES_STYLES, draft.shoesStyle);

  return [
    {
      category: 'body',
      url: `${LPC_RAW_ROOT}/body/bodies/female/walk.png`,
      tint: skin.tint,
      creditPath: 'body/bodies/female/walk.png',
    },
    {
      category: 'head',
      url: `${LPC_RAW_ROOT}/head/heads/human/female/walk.png`,
      tint: skin.tint,
      creditPath: 'head/heads/human/female/walk.png',
    },
    {
      category: 'top',
      url: `${LPC_RAW_ROOT}/${top.path}`,
      tint: topColor.tint,
      creditPath: top.path,
    },
    {
      category: 'bottom',
      url: `${LPC_RAW_ROOT}/${bottom.path}`,
      tint: bottomColor.tint,
      creditPath: bottom.path,
    },
    {
      category: 'shoes',
      url: `${LPC_RAW_ROOT}/${shoes.path}`,
      tint: '#ffffff',
      creditPath: shoes.path,
    },
    {
      category: 'hair',
      url: `${LPC_RAW_ROOT}/${hair.path}`,
      tint: hairColor.tint,
      creditPath: hair.path,
    },
  ];
}

export const CREATE_ME_DEFAULT_DRAFT: CreateMeDraft = {
  displayName: 'ME',
  presetId: 'mira',
  appearanceMode: 'preset',
  skinTone: 'light',
  hairStyle: 'bob',
  hairColor: 'brown',
  topStyle: 'cardigan',
  topColor: 'blue',
  bottomStyle: 'pants',
  bottomColor: 'plum',
  shoesStyle: 'basic',
  investmentGoal: 'growth',
  horizon: 'medium',
  maxDrawdownPct: 15,
  conviction: 62,
  socialInfluence: 38,
  lossAversion: 58,
  scenarios: [],
  scenarioAnswers: {},
};

export const CREATE_ME_SCENARIOS: ReadonlyArray<{
  id: ScenarioId;
  title: string;
  prompt: string;
  choices: ReadonlyArray<{ value: ScenarioChoice; label: string }>;
}> = [
  {
    id: 'market_crash',
    title: '市场单日暴跌 12%',
    prompt: '你会优先降低风险，而不是立即抄底。',
    choices: [
      { value: 'cautious', label: '先降低仓位' },
      { value: 'measured', label: '按计划再平衡' },
      { value: 'aggressive', label: '立即重仓抄底' },
    ],
  },
  {
    id: 'missed_rally',
    title: '错过一轮快速上涨',
    prompt: '你会等待新证据，而不是追逐价格。',
    choices: [
      { value: 'cautious', label: '继续等待' },
      { value: 'measured', label: '小仓位跟踪' },
      { value: 'aggressive', label: '立即追涨' },
    ],
  },
  {
    id: 'crowd_fomo',
    title: '多数 Agent 都在买入',
    prompt: '你会把群体共识作为有效但有限的信号。',
    choices: [
      { value: 'cautious', label: '忽略群体观点' },
      { value: 'measured', label: '核验后调整' },
      { value: 'aggressive', label: '跟随多数买入' },
    ],
  },
  {
    id: 'thesis_challenged',
    title: '核心投资逻辑被质疑',
    prompt: '你愿意在证据变化后修正原有判断。',
    choices: [
      { value: 'cautious', label: '先退出再研究' },
      { value: 'measured', label: '复核证据' },
      { value: 'aggressive', label: '坚持原判断' },
    ],
  },
  {
    id: 'unexpected_cash',
    title: '突然获得一笔可投资现金',
    prompt: '你倾向分批配置，而不是一次押注。',
    choices: [
      { value: 'cautious', label: '暂时保留现金' },
      { value: 'measured', label: '分批配置' },
      { value: 'aggressive', label: '一次性投入' },
    ],
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getCreateMePreset(presetId: CreateMePresetId) {
  return (
    CREATE_ME_PRESETS.find((preset) => preset.id === presetId) ?? CREATE_ME_PRESETS[0]
  );
}

export function compileMeProfile(draft: CreateMeDraft): CompiledMeProfile {
  const goalRisk = {
    growth: 14,
    income: -4,
    preservation: -18,
    learning: 4,
  }[draft.investmentGoal];
  const horizonRisk = { short: -8, medium: 0, long: 9 }[draft.horizon];
  const crashAdjustment = draft.scenarios.includes('market_crash') ? -6 : 0;
  const fomoAdjustment = draft.scenarios.includes('crowd_fomo') ? 4 : 0;
  const answerRiskAdjustment = Object.values(draft.scenarioAnswers).reduce(
    (total, answer) =>
      total + (answer === 'aggressive' ? 3 : answer === 'cautious' ? -3 : 0),
    0,
  );
  const riskTolerance = clamp(
    draft.maxDrawdownPct * 2.2 +
      goalRisk +
      horizonRisk +
      (draft.conviction - 50) * 0.18 -
      (draft.lossAversion - 50) * 0.22 +
      crashAdjustment +
      fomoAdjustment +
      answerRiskAdjustment,
  );

  const holdingPeriodDays = {
    short: 14,
    medium: 120,
    long: 540,
  }[draft.horizon];
  const preservationBuffer = draft.investmentGoal === 'preservation' ? 14 : 0;
  const unexpectedCashBuffer = draft.scenarios.includes('unexpected_cash') ? 5 : 0;
  const cashBufferPct = clamp(
    34 - riskTolerance * 0.24 + preservationBuffer + unexpectedCashBuffer,
    5,
    55,
  );
  const maxPositionPct = clamp(
    8 + riskTolerance * 0.18 + (draft.conviction - 50) * 0.08,
    8,
    30,
  );
  const socialSignalWeight = clamp(
    draft.socialInfluence +
      (draft.scenarioAnswers.crowd_fomo === 'aggressive'
        ? 14
        : draft.scenarioAnswers.crowd_fomo === 'cautious'
          ? -10
          : draft.scenarios.includes('crowd_fomo')
            ? 5
            : 0),
  );
  const stopLossDiscipline = clamp(
    42 + draft.lossAversion * 0.38 + (draft.scenarios.includes('market_crash') ? 10 : 0),
  );
  const tradeFrequency =
    draft.horizon === 'short' || riskTolerance >= 76
      ? 'high'
      : draft.horizon === 'long' && riskTolerance < 58
        ? 'low'
        : 'medium';

  const decisionStyle =
    draft.conviction >= 70
      ? '高确信、证据驱动'
      : socialSignalWeight >= 65
        ? '共识敏感、保留独立验证'
        : draft.lossAversion >= 70
          ? '防守优先、重视回撤'
          : '平衡型、渐进调整';

  const riskFlags: string[] = [];
  if (draft.conviction >= 78) riskFlags.push('可能过度坚持既有判断');
  if (socialSignalWeight >= 72) riskFlags.push('容易受群体情绪影响');
  if (draft.lossAversion >= 78) riskFlags.push('可能过早止盈或拒绝合理风险');
  if (riskTolerance >= 80) riskFlags.push('组合风险暴露偏高');
  if (riskFlags.length === 0) riskFlags.push('暂无突出行为偏差');

  return {
    riskTolerance,
    holdingPeriodDays,
    cashBufferPct,
    maxPositionPct,
    tradeFrequency,
    socialSignalWeight,
    stopLossDiscipline,
    decisionStyle,
    riskFlags,
  };
}

export function buildMeAgentNarrative(
  displayName: string,
  compiled: CompiledMeProfile,
): MeAgentNarrative {
  const name = displayName.trim().slice(0, 20) || CREATE_ME_DEFAULT_DRAFT.displayName;
  const frequency =
    compiled.tradeFrequency === 'high'
      ? 'frequent'
      : compiled.tradeFrequency === 'low'
        ? 'selective'
        : 'moderate-frequency';
  const riskNotes = compiled.riskFlags.filter((flag) => flag !== '暂无突出行为偏差');
  const biasReminder =
    riskNotes.length > 0
      ? `Watch for these behavioral risks: ${riskNotes.join('; ')}.`
      : 'No dominant behavioral bias was detected, but continue to challenge assumptions.';

  return {
    description: `${name} is the user's autonomous financial digital twin. ${compiled.decisionStyle}; risk tolerance ${compiled.riskTolerance}/100; cash buffer ${compiled.cashBufferPct}%.`,
    identity: `${name} is a user-created autonomous financial Agent. The Agent follows a ${compiled.decisionStyle} decision style, targets a ${compiled.holdingPeriodDays}-day holding period, and gives social signals ${compiled.socialSignalWeight}/100 weight. It must clearly distinguish sourced market facts, simulated decisions, and confirmed chain state.`,
    plan: `Observe market evidence and town conversations, then make ${frequency} simulated portfolio decisions. Keep about ${compiled.cashBufferPct}% cash, cap a single position near ${compiled.maxPositionPct}%, respect stop-loss discipline ${compiled.stopLossDiscipline}/100, and never describe a simulated order as a confirmed fill. ${biasReminder}`,
  };
}

export function sanitizeCreateMeDraft(value: unknown): CreateMeDraft {
  if (!value || typeof value !== 'object') return CREATE_ME_DEFAULT_DRAFT;
  const candidate = value as Partial<CreateMeDraft>;
  const presetIds = CREATE_ME_PRESETS.map((preset) => preset.id);
  const goals: InvestmentGoal[] = ['growth', 'income', 'preservation', 'learning'];
  const horizons: InvestmentHorizon[] = ['short', 'medium', 'long'];
  const scenarioIds = CREATE_ME_SCENARIOS.map((scenario) => scenario.id);
  const scenarioChoices: ScenarioChoice[] = ['cautious', 'measured', 'aggressive'];
  const appearanceModes: CreateMeAppearanceMode[] = ['preset', 'custom'];

  return {
    displayName:
      typeof candidate.displayName === 'string'
        ? candidate.displayName.trim().slice(0, 20) || CREATE_ME_DEFAULT_DRAFT.displayName
        : CREATE_ME_DEFAULT_DRAFT.displayName,
    presetId: presetIds.includes(candidate.presetId as CreateMePresetId)
      ? (candidate.presetId as CreateMePresetId)
      : CREATE_ME_DEFAULT_DRAFT.presetId,
    appearanceMode: appearanceModes.includes(candidate.appearanceMode as CreateMeAppearanceMode)
      ? (candidate.appearanceMode as CreateMeAppearanceMode)
      : CREATE_ME_DEFAULT_DRAFT.appearanceMode,
    skinTone: catalogItem(LPC_SKIN_TONES, String(candidate.skinTone)).id,
    hairStyle: catalogItem(LPC_HAIR_STYLES, String(candidate.hairStyle)).id,
    hairColor: catalogItem(LPC_HAIR_COLORS, String(candidate.hairColor)).id,
    topStyle: catalogItem(LPC_TOP_STYLES, String(candidate.topStyle)).id,
    topColor: catalogItem(LPC_CLOTHING_COLORS, String(candidate.topColor)).id,
    bottomStyle: catalogItem(LPC_BOTTOM_STYLES, String(candidate.bottomStyle)).id,
    bottomColor: catalogItem(LPC_CLOTHING_COLORS, String(candidate.bottomColor)).id,
    shoesStyle: catalogItem(LPC_SHOES_STYLES, String(candidate.shoesStyle)).id,
    investmentGoal: goals.includes(candidate.investmentGoal as InvestmentGoal)
      ? (candidate.investmentGoal as InvestmentGoal)
      : CREATE_ME_DEFAULT_DRAFT.investmentGoal,
    horizon: horizons.includes(candidate.horizon as InvestmentHorizon)
      ? (candidate.horizon as InvestmentHorizon)
      : CREATE_ME_DEFAULT_DRAFT.horizon,
    maxDrawdownPct: clamp(Number(candidate.maxDrawdownPct) || 15, 5, 40),
    conviction: clamp(Number(candidate.conviction) || 50),
    socialInfluence: clamp(Number(candidate.socialInfluence) || 50),
    lossAversion: clamp(Number(candidate.lossAversion) || 50),
    scenarios: Array.isArray(candidate.scenarios)
      ? candidate.scenarios
          .filter((scenario): scenario is ScenarioId =>
            scenarioIds.includes(scenario as ScenarioId),
          )
          .slice(0, CREATE_ME_SCENARIOS.length)
      : [],
    scenarioAnswers:
      candidate.scenarioAnswers && typeof candidate.scenarioAnswers === 'object'
        ? Object.fromEntries(
            Object.entries(candidate.scenarioAnswers).filter(
              ([id, choice]) =>
                scenarioIds.includes(id as ScenarioId) &&
                scenarioChoices.includes(choice as ScenarioChoice),
            ),
          )
        : {},
  };
}
