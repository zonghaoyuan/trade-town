export const SKILL_IDS = [
  'panda-market-replay',
  'rate-shock-experiment',
  'rumor-propagation-analysis',
  'user-behavior-review',
  'town-agent-history',
] as const;

export type SkillId = (typeof SKILL_IDS)[number];
export type ExecutionMode = 'local-demo' | 'competition';
export type DataMode = 'simulated' | 'verified-replay' | 'live';

export type SkillRequest = {
  skillId: SkillId;
  prompt: string;
  input: Record<string, unknown>;
  seed: number;
  dataMode: DataMode;
};

export type EvidenceItem = {
  id: string;
  kind: 'input' | 'market-event' | 'agent-decision' | 'risk-check' | 'correction';
  summary: string;
  source: string;
  isSimulated: boolean;
};

export type Counterfactual = {
  change: string;
  outcome: string;
  calculation: string;
};

export type ModelDisclosure = {
  requiredModel: 'OpenAI-compatible LLM';
  provider: string;
  configuredModel: string | null;
  used: boolean;
  stages: {
    taskPlanning: boolean;
    reportSynthesis: boolean;
  };
  planningRationale: string;
  analysis: string;
};

export type SkillPlan = {
  request: SkillRequest;
  usedModel: boolean;
  rationale: string;
};

export type MarketDataDisclosure = {
  source: 'PandaAI';
  method: 'daily_bars';
  datasetId: string;
  schemaVersion: string;
  instrumentType: string;
  symbol: string;
  startDate: string;
  endDate: string;
  asOf: string;
  barCount: number;
  isReal: true;
};

export type MarketTownReport = {
  schemaVersion: '1.0';
  reportId: string;
  runId: string;
  skillId: SkillId;
  title: string;
  taskSummary: string;
  createdAt: string;
  execution: {
    mode: ExecutionMode;
    dataMode: DataMode;
    isSimulated: boolean;
    seed: number;
    durationMs: number;
    steps: string[];
  };
  model: ModelDisclosure;
  marketData: MarketDataDisclosure | null;
  evidence: EvidenceItem[];
  findings: Record<string, unknown>;
  counterfactuals: Counterfactual[];
  riskConclusion: string;
  chainProofs: Array<{
    kind: 'transaction' | 'order' | 'fill';
    txHash: string;
    explorerUrl: string;
  }>;
  warnings: string[];
};

export type SkillResult = Omit<MarketTownReport, 'model' | 'createdAt'>;
