import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TownBackendClient } from '../../town-replay-bridge/src/client';
import type {
  TownBootstrap,
  TownCitizen,
  TownGameDay,
  TranslationMap,
} from '../../town-replay-bridge/src/types';
import { A2AConfig } from './config';
import { MarketTownReport, SkillRequest } from './types';

type V2TranslationCache = {
  cacheVersion: number;
  mode: 'llm' | 'already_english';
  sourceHash: string;
  contentHash: string;
  translations: TranslationMap;
  proof?: {
    cacheVersion?: number;
    sourceHash?: string;
    contentHash?: string;
  };
};

export async function loadTownAgentHistory(
  request: SkillRequest,
  config: A2AConfig,
): Promise<MarketTownReport> {
  if (!config.townBackendUrl || !config.townRunId || !config.translationCacheDir) {
    throw new Error(
      'town-agent-history requires TOWN_BACKEND_URL, TOWN_RUN_ID and TOWN_TRANSLATION_CACHE_DIR.',
    );
  }
  if (request.dataMode !== 'verified-replay') {
    throw new Error('town-agent-history only supports verified-replay data mode.');
  }
  const client = new TownBackendClient(config.townBackendUrl);
  const bootstrap = await client.bootstrap(config.townRunId);
  const dates = bootstrap.trading_days.slice(0, config.replayTotalDays);
  if (dates.length !== 30) {
    throw new Error(`The connected Town run exposes ${dates.length}/30 trading days.`);
  }
  const agent = resolveAgent(bootstrap, request.input, request.prompt);
  const symbolFilter = readOptionalString(request.input.symbol)?.toUpperCase();
  if (symbolFilter && !bootstrap.symbols.some((item) => item.symbol === symbolFilter)) {
    throw new Error(`Unknown symbol ${symbolFilter}.`);
  }
  const days = await mapWithConcurrency(dates, 4, async (tradeDate) => {
    const [day, translations] = await Promise.all([
      client.day(config.townRunId!, tradeDate),
      loadV2Translations(config.translationCacheDir!, config.townRunId!, tradeDate),
    ]);
    return mapAgentDay(day, agent.agent_id, translations, symbolFilter);
  });
  const firstCitizen = days.find((day) => day.agent)?.agent;
  const stableId = createHash('sha256')
    .update(`${config.townRunId}:${agent.agent_id}:${symbolFilter ?? '*'}:${dates.join(',')}`)
    .digest('hex')
    .slice(0, 16);
  const postCount = days.reduce((sum, day) => sum + day.posts.length, 0);
  const transactionCount = days.reduce((sum, day) => sum + day.transactions.length, 0);

  return {
    schemaVersion: '1.0',
    reportId: `agent-history-${stableId}`,
    runId: config.townRunId,
    skillId: 'town-agent-history',
    title: `${agent.display_name || agent.agent_id} · 30 Trading-Day Agent Data`,
    taskSummary: 'Read-only A2A retrieval of one Agent from the connected 30-trading-day Town run.',
    createdAt: new Date().toISOString(),
    execution: {
      mode: config.executionMode,
      dataMode: 'verified-replay',
      isSimulated: true,
      seed: request.seed,
      durationMs: 0,
      steps: [
        'Resolve the requested Agent against the Town bootstrap',
        'Read all 30 trading-day source snapshots from Town API',
        'Verify and apply v2 English translation caches',
        'Filter beliefs, views, posts, positions, intents and simulated fills by Agent',
        'Return one structured A2A artifact with provenance fields',
      ],
    },
    model: {
      requiredModel: 'DeepSeek V4 Pro',
      configuredModel: config.deepseekModel ?? null,
      used: false,
      stages: {
        taskPlanning: false,
        reportSynthesis: false,
      },
      planningRationale:
        'Agent history uses deterministic routing and source retrieval without generating a new interpretation.',
      analysis: 'This skill performs source retrieval and deterministic filtering; it does not generate a new model interpretation.',
    },
    marketData: null,
    evidence: [
      {
        id: 'town-bootstrap',
        kind: 'input',
        summary: `Run ${config.townRunId} exposes exactly 30 trading days and ${bootstrap.symbols.length} symbols.`,
        source: `${config.townBackendUrl}/api/v1/game/runs/${config.townRunId}/bootstrap`,
        isSimulated: false,
      },
      {
        id: 'agent-daily-state',
        kind: 'agent-decision',
        summary: `${agent.agent_id} has ${days.length} daily state records, ${transactionCount} transaction intents and ${postCount} posts.`,
        source: `Town API run ${config.townRunId}`,
        isSimulated: true,
      },
    ],
    findings: {
      provenance: {
        pandaDailyBars: 'external-market',
        agentDecisionsAndFills: 'formal-simulation',
        translatedAgentText: 'model-inference',
        unverifiedPostClaims: 'unverified-social',
      },
      range: {
        tradingDays: 30,
        startTradeDate: dates[0],
        endTradeDate: dates[29],
        symbolFilter: symbolFilter ?? null,
      },
      agent: {
        agentId: agent.agent_id,
        displayName: agent.display_name,
        role: firstCitizen?.role ?? null,
        strategy: firstCitizen?.strategy ?? null,
      },
      days,
    },
    counterfactuals: [],
    riskConclusion:
      'The endpoint is read-only. PandaAI daily bars are external historical market data; Agent decisions, orders, fills, accounts and PnL are simulation records.',
    chainProofs: [],
    warnings: [
      'Agent posts are unverified social claims and must not be treated as market facts.',
      'No transaction hash, block height, order hash or other chain credential is returned.',
      'This dataset is for simulation research and does not constitute investment advice.',
    ],
  };
}

function mapAgentDay(
  day: TownGameDay,
  agentId: string,
  translations: TranslationMap,
  symbolFilter?: string,
) {
  const citizen = day.citizens.find((item) => item.agent_id === agentId);
  if (!citizen) throw new Error(`Agent ${agentId} is missing on ${day.trade_date}.`);
  const views = (citizen.views ?? [])
    .filter((view) => !symbolFilter || view.symbol === symbolFilter)
    .map((view) => ({
      ...view,
      rationale: requiredTranslation(translations, `view:${agentId}:${view.symbol}`),
      provenance: 'model-inference',
    }));
  const posts = day.social.posts
    .filter((post) => post.agent_id === agentId)
    .map((post) => ({
      postId: post.post_id,
      postType: post.post_type ?? null,
      content: requiredTranslation(translations, `post:${post.post_id}`),
      sourceId: `post:${post.post_id}`,
      provenance: 'unverified-social',
    }));
  const transactions = day.transactions
    .filter((transaction) => transaction.account_id === agentId)
    .filter((transaction) => !symbolFilter || transaction.symbol === symbolFilter)
    .map((transaction) => ({
      intentId: transaction.intent_id,
      symbol: transaction.symbol,
      side: transaction.side,
      quantity: transaction.quantity,
      state: transaction.state ?? null,
      risk: {
        status: transaction.risk?.status ?? null,
        reason: transaction.risk?.reason
          ? requiredTranslation(translations, `risk:${transaction.intent_id}`)
          : null,
      },
      fill: transaction.fill
        ? {
            price: transaction.fill.price ?? null,
            quantity: transaction.fill.quantity ?? null,
            isSimulated: true,
          }
        : null,
      provenance: 'formal-simulation',
    }));
  return {
    tradeDate: day.trade_date,
    externalMarket: day.market_board
      .filter((bar) => !symbolFilter || bar.symbol === symbolFilter)
      .map((bar) => ({ ...bar, provenance: 'external-market' })),
    agent: mapCitizen(citizen, translations),
    views,
    posts,
    transactions,
    errors: (day.errors ?? [])
      .filter((error) => error.agent_id === agentId)
      .map((error) => ({ status: error.status ?? null, error: error.error ?? null })),
  };
}

function mapCitizen(citizen: TownCitizen, translations: TranslationMap) {
  return {
    agentId: citizen.agent_id,
    role: citizen.role ?? null,
    strategy: citizen.strategy ?? null,
    beliefBefore: citizen.belief_before?.belief_text
      ? requiredTranslation(translations, `belief_before:${citizen.agent_id}`)
      : null,
    beliefAfter: citizen.belief_after?.belief_text
      ? requiredTranslation(translations, `belief_after:${citizen.agent_id}`)
      : null,
    beliefScoreBefore: citizen.belief_before?.belief_score ?? null,
    beliefScoreAfter: citizen.belief_after?.belief_score ?? null,
    memory: citizen.belief_after?.memory_summary
      ? requiredTranslation(translations, `memory:${citizen.agent_id}`)
      : null,
    account: citizen.account ?? null,
    positions: citizen.positions ?? [],
    riskRejections: citizen.risk_rejections ?? 0,
    orderCount: citizen.order_count ?? 0,
    fillCount: citizen.fill_count ?? 0,
    provenance: 'formal-simulation',
  };
}

async function loadV2Translations(cacheRoot: string, runId: string, tradeDate: string) {
  const cachePath = path.join(cacheRoot, 'v2', safeSegment(runId), `${tradeDate}.json`);
  let parsed: V2TranslationCache;
  try {
    parsed = JSON.parse(await readFile(cachePath, 'utf8')) as V2TranslationCache;
  } catch {
    throw new Error(`Validated v2 translation cache is unavailable for ${tradeDate}.`);
  }
  if (
    parsed.cacheVersion !== 2 ||
    (parsed.mode !== 'llm' && parsed.mode !== 'already_english') ||
    parsed.proof?.cacheVersion !== 2 ||
    parsed.proof.sourceHash !== parsed.sourceHash ||
    parsed.proof.contentHash !== parsed.contentHash ||
    parsed.contentHash !== hashTranslations(parsed.translations ?? {}) ||
    !parsed.translations
  ) {
    throw new Error(`Translation proof is invalid for ${tradeDate}.`);
  }
  return parsed.translations;
}

function resolveAgent(
  bootstrap: TownBootstrap,
  input: Record<string, unknown>,
  prompt: string,
) {
  const requested =
    readAgentIdentifier(input.agentId) ??
    readOptionalString(input.agentName) ??
    prompt.match(/agent\s*id\s*[:=：]?\s*([a-z0-9._-]+)/i)?.[1] ??
    prompt.match(/\b\d{11}\b/)?.[0];
  if (!requested) {
    throw new Error(`agentId is required. Available Agent IDs: ${bootstrap.agents.map((item) => item.agent_id).join(', ')}.`);
  }
  const normalized = requested.toLowerCase();
  const agent = bootstrap.agents.find(
    (item) => item.agent_id.toLowerCase() === normalized || item.display_name.toLowerCase() === normalized,
  );
  if (!agent) {
    throw new Error(`Unknown agentId ${requested}. Available Agent IDs: ${bootstrap.agents.map((item) => item.agent_id).join(', ')}.`);
  }
  return agent;
}

function requiredTranslation(translations: TranslationMap, id: string) {
  const value = translations[id]?.trim();
  if (!value) throw new Error(`Required English translation ${id} is missing.`);
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readAgentIdentifier(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return readOptionalString(value);
}

function safeSegment(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_');
}

function hashTranslations(value: TranslationMap) {
  return createHash('sha256')
    .update(JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
    .digest('hex');
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, fn: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= values.length) return;
        results[index] = await fn(values[index]);
      }
    }),
  );
  return results;
}
