import type { Locale } from './locale';

type LocalizedText = Record<Locale, string>;

function localized(locale: Locale, text: LocalizedText | undefined, fallback: string) {
  return text?.[locale] ?? fallback;
}

const marketNames: Record<string, LocalizedText> = {
  ACME: { en: 'Acme Industries', 'zh-CN': 'ACME 工业' },
  NOVA: { en: 'Nova Compute', 'zh-CN': 'NOVA 算力' },
  AURUM: { en: 'Aurum Reserve', 'zh-CN': 'AURUM 黄金储备' },
  CRUDE: { en: 'Frontier Crude', 'zh-CN': 'CRUDE 前沿原油' },
};

const marketDescriptions: Record<string, LocalizedText> = {
  ACME: {
    en: 'Industrial bellwether exposed to rates, freight, and public infrastructure.',
    'zh-CN': '受利率、运费和公共基础设施影响的工业风向标。',
  },
  NOVA: {
    en: 'High-growth compute company sensitive to liquidity and risk appetite.',
    'zh-CN': '对流动性与风险偏好敏感的高增长算力公司。',
  },
  AURUM: {
    en: 'Tokenized town gold proxy used as a flight-to-safety instrument.',
    'zh-CN': '代币化的小镇黄金代理资产，用作避险工具。',
  },
  CRUDE: {
    en: 'Energy proxy reacting to supply, shipping, and macro-demand news.',
    'zh-CN': '对供应、航运和宏观需求消息作出反应的能源代理资产。',
  },
};

const traderRoles: Record<string, LocalizedText> = {
  'Mira Chen': { en: 'Macro strategist', 'zh-CN': '宏观策略师' },
  'Theo Grant': { en: 'Value investor', 'zh-CN': '价值投资者' },
  'Imani Brooks': { en: 'Momentum trader', 'zh-CN': '动量交易员' },
  'Sora Vale': { en: 'News analyst', 'zh-CN': '新闻分析师' },
  'Omar Reyes': { en: 'Commodity specialist', 'zh-CN': '大宗商品专家' },
  'Lin Park': { en: 'Behavioral trader', 'zh-CN': '行为交易员' },
  'Jules Hart': { en: 'Fund manager', 'zh-CN': '基金经理' },
  'Neha Rao': { en: 'Market supervisor', 'zh-CN': '市场监督员' },
  'Delta-7': { en: 'Company market maker', 'zh-CN': '公司资产做市商' },
  'Sigma-2': { en: 'Commodity market maker', 'zh-CN': '大宗商品做市商' },
};

const traderStyles: Record<string, LocalizedText> = {
  'Mira Chen': {
    en: 'Evidence-first, patient, and highly sensitive to monetary policy.',
    'zh-CN': '证据优先、耐心，并对货币政策高度敏感。',
  },
  'Theo Grant': {
    en: 'Contrarian and valuation-driven; buys panic only when balance sheets survive.',
    'zh-CN': '逆向且由估值驱动；只在资产负债表经得住考验时买入恐慌。',
  },
  'Imani Brooks': {
    en: 'Fast, social, and prone to amplify price trends after confirmation.',
    'zh-CN': '反应迅速、重视社交信号，并会在趋势确认后放大价格走势。',
  },
  'Sora Vale': {
    en: 'Connects headlines to sectors and shares concise, source-aware interpretations.',
    'zh-CN': '把新闻标题关联到行业，并分享简洁、重视来源的解读。',
  },
  'Omar Reyes': {
    en: 'Tracks inventories and geopolitics; distrusts company-market narratives.',
    'zh-CN': '跟踪库存与地缘政治，不轻信公司和市场叙事。',
  },
  'Lin Park': {
    en: 'Models crowd fear, anchoring, and information cascades before taking the other side.',
    'zh-CN': '先建模群体恐惧、锚定效应和信息级联，再考虑反向交易。',
  },
  'Jules Hart': {
    en: 'Portfolio-aware, disciplined, and constrained by drawdown and concentration limits.',
    'zh-CN': '重视组合、纪律严明，并受回撤和集中度限制约束。',
  },
  'Neha Rao': {
    en: 'Monitors manipulation and liquidity stress; trades only to test market resilience.',
    'zh-CN': '监控操纵和流动性压力，只为测试市场韧性而交易。',
  },
  'Delta-7': {
    en: 'Deterministic two-sided quoting with inventory-skew and a hard loss limit.',
    'zh-CN': '采用确定性双边报价、库存偏斜与严格亏损上限。',
  },
  'Sigma-2': {
    en: 'Deterministic two-sided quoting with wider spreads during event shocks.',
    'zh-CN': '采用确定性双边报价，并在事件冲击时扩大价差。',
  },
};

export function localizeMarketName(locale: Locale, symbol: string, fallback: string) {
  return localized(locale, marketNames[symbol], fallback);
}

export function localizeMarketDescription(
  locale: Locale,
  symbol: string,
  fallback: string,
) {
  return localized(locale, marketDescriptions[symbol], fallback);
}

export function localizeTraderRole(locale: Locale, name: string, fallback: string) {
  return localized(locale, traderRoles[name], fallback);
}

export function localizeTraderStyle(locale: Locale, name: string, fallback: string) {
  return localized(locale, traderStyles[name], fallback);
}

export const mapLabels: Record<string, LocalizedText> = {
  injective_exchange: { en: 'Injective Exchange', 'zh-CN': 'Injective 交易所' },
  town_central_bank: { en: 'Central Bank', 'zh-CN': '中央银行' },
  news_bureau: { en: 'News Bureau', 'zh-CN': '报社' },
  fund_house: { en: 'Starport Fund', 'zh-CN': '星港基金' },
  market_cafe: { en: 'Market Café', 'zh-CN': '咖啡馆' },
  harbor_residences: { en: 'Harbor Homes', 'zh-CN': '港湾住宅' },
  acme_headquarters: { en: 'ACME HQ', 'zh-CN': 'ACME 总部' },
  nova_laboratory: { en: 'NOVA Lab', 'zh-CN': 'NOVA 实验室' },
  risk_surveillance: { en: 'Financial Authority', 'zh-CN': '金融监管局' },
  aurum_depot: { en: 'Gold Depot', 'zh-CN': '黄金仓库' },
  crude_depot: { en: 'Crude Depot', 'zh-CN': '原油仓库' },
};

export function localizeMapLabel(locale: Locale, buildingId: string, fallback = '') {
  return localized(locale, mapLabels[buildingId], fallback);
}

const createMeLabels: Record<string, LocalizedText> = {
  'skinTone.light': { en: 'Light skin', 'zh-CN': '浅肤色' },
  'skinTone.warm': { en: 'Warm skin', 'zh-CN': '暖肤色' },
  'skinTone.deep': { en: 'Deep skin', 'zh-CN': '深肤色' },
  'hairStyle.bob': { en: 'Short bob', 'zh-CN': '短波波' },
  'hairStyle.afro': { en: 'Afro curls', 'zh-CN': '蓬松卷发' },
  'hairStyle.buzzcut': { en: 'Buzz cut', 'zh-CN': '利落短发' },
  'hairStyle.pixie': { en: 'Pixie cut', 'zh-CN': '精灵短发' },
  'hairColor.copper': { en: 'Copper brown', 'zh-CN': '铜棕' },
  'hairColor.brown': { en: 'Dark brown', 'zh-CN': '深棕' },
  'hairColor.black': { en: 'Black', 'zh-CN': '墨黑' },
  'hairColor.wine': { en: 'Wine red', 'zh-CN': '酒红' },
  'topStyle.cardigan': { en: 'Knit cardigan', 'zh-CN': '针织开衫' },
  'topStyle.polo': { en: 'Collared top', 'zh-CN': '翻领上衣' },
  'topStyle.buttoned': { en: 'Short-sleeve shirt', 'zh-CN': '短袖衬衣' },
  'bottomStyle.pants': { en: 'Slim trousers', 'zh-CN': '修身长裤' },
  'bottomStyle.pants2': { en: 'Casual trousers', 'zh-CN': '休闲长裤' },
  'bottomStyle.formal': { en: 'Formal trousers', 'zh-CN': '正式长裤' },
  'shoesStyle.basic': { en: 'Basic shoes', 'zh-CN': '基础鞋' },
  'clothingColor.cream': { en: 'Cream', 'zh-CN': '米白' },
  'clothingColor.blue': { en: 'Town blue', 'zh-CN': '城镇蓝' },
  'clothingColor.plum': { en: 'Plum red', 'zh-CN': '梅子红' },
  'clothingColor.green': { en: 'Pine green', 'zh-CN': '松石绿' },
  'clothingColor.gold': { en: 'Wheat gold', 'zh-CN': '麦穗金' },
};

export function localizeCreateMeLabel(
  locale: Locale,
  category: string,
  id: string,
  fallback: string,
) {
  return localized(locale, createMeLabels[`${category}.${id}`], fallback);
}

type LocalizedScenario = {
  title: LocalizedText;
  choices: Record<string, LocalizedText>;
};

const createMeScenarios: Record<string, LocalizedScenario> = {
  market_crash: {
    title: { en: 'The market falls 12% in one day', 'zh-CN': '市场单日暴跌 12%' },
    choices: {
      cautious: { en: 'Reduce exposure first', 'zh-CN': '先降低仓位' },
      measured: { en: 'Rebalance as planned', 'zh-CN': '按计划再平衡' },
      aggressive: { en: 'Buy heavily at once', 'zh-CN': '立即重仓抄底' },
    },
  },
  missed_rally: {
    title: { en: 'You miss a rapid rally', 'zh-CN': '错过一轮快速上涨' },
    choices: {
      cautious: { en: 'Keep waiting', 'zh-CN': '继续等待' },
      measured: { en: 'Track with a small position', 'zh-CN': '小仓位跟踪' },
      aggressive: { en: 'Chase immediately', 'zh-CN': '立即追涨' },
    },
  },
  crowd_fomo: {
    title: { en: 'Most Agents are buying', 'zh-CN': '多数 Agent 都在买入' },
    choices: {
      cautious: { en: 'Ignore the crowd', 'zh-CN': '忽略群体观点' },
      measured: { en: 'Verify, then adjust', 'zh-CN': '核验后调整' },
      aggressive: { en: 'Follow the majority', 'zh-CN': '跟随多数买入' },
    },
  },
  thesis_challenged: {
    title: { en: 'Your core thesis is challenged', 'zh-CN': '核心投资逻辑被质疑' },
    choices: {
      cautious: { en: 'Exit, then investigate', 'zh-CN': '先退出再研究' },
      measured: { en: 'Review the evidence', 'zh-CN': '复核证据' },
      aggressive: { en: 'Hold to the original view', 'zh-CN': '坚持原判断' },
    },
  },
  unexpected_cash: {
    title: { en: 'You receive unexpected investable cash', 'zh-CN': '突然获得一笔可投资现金' },
    choices: {
      cautious: { en: 'Keep it in cash for now', 'zh-CN': '暂时保留现金' },
      measured: { en: 'Allocate in stages', 'zh-CN': '分批配置' },
      aggressive: { en: 'Invest it all at once', 'zh-CN': '一次性投入' },
    },
  },
};

export function localizeScenarioTitle(locale: Locale, id: string, fallback: string) {
  return localized(locale, createMeScenarios[id]?.title, fallback);
}

export function localizeScenarioChoice(
  locale: Locale,
  scenarioId: string,
  choice: string,
  fallback: string,
) {
  return localized(locale, createMeScenarios[scenarioId]?.choices[choice], fallback);
}

const compiledProfileText: Record<string, LocalizedText> = {
  '高确信、证据驱动': {
    en: 'High-conviction and evidence-driven',
    'zh-CN': '高确信、证据驱动',
  },
  '共识敏感、保留独立验证': {
    en: 'Consensus-aware with independent verification',
    'zh-CN': '共识敏感、保留独立验证',
  },
  '防守优先、重视回撤': {
    en: 'Defensive and drawdown-aware',
    'zh-CN': '防守优先、重视回撤',
  },
  '平衡型、渐进调整': {
    en: 'Balanced with gradual adjustments',
    'zh-CN': '平衡型、渐进调整',
  },
  '可能过度坚持既有判断': {
    en: 'May hold too firmly to an existing view',
    'zh-CN': '可能过度坚持既有判断',
  },
  '容易受群体情绪影响': {
    en: 'May be overly influenced by crowd sentiment',
    'zh-CN': '容易受群体情绪影响',
  },
  '可能过早止盈或拒绝合理风险': {
    en: 'May take profit too early or reject reasonable risk',
    'zh-CN': '可能过早止盈或拒绝合理风险',
  },
  '组合风险暴露偏高': {
    en: 'Portfolio risk exposure is elevated',
    'zh-CN': '组合风险暴露偏高',
  },
  '暂无突出行为偏差': {
    en: 'No prominent behavioral bias detected',
    'zh-CN': '暂无突出行为偏差',
  },
};

export function localizeCompiledProfileText(locale: Locale, text: string) {
  return localized(locale, compiledProfileText[text], text);
}
