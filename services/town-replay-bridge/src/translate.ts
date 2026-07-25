import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TownBootstrap, TownGameDay, TranslationMap } from './types';

export const TRANSLATION_CACHE_VERSION = 2 as const;
const MAX_BATCH_ITEMS = 12;
const MAX_BATCH_CHARS = 8_000;
const MAX_CONCURRENCY = 2;
const MAX_ATTEMPTS = 3;

type TranslationCategory = 'agent_talk' | 'belief' | 'memory' | 'view' | 'risk' | 'error';

type TranslationEntry = {
  id: string;
  text: string;
  category: TranslationCategory;
};

type ProtectedEntry = TranslationEntry & {
  protectedText: string;
  placeholders: Record<string, string>;
};

type TranslationBatchProof = {
  id: string;
  category: TranslationCategory;
  itemCount: number;
  inputHash: string;
  attempts: number;
};

export type TranslationProof = {
  cacheVersion: typeof TRANSLATION_CACHE_VERSION;
  sourceHash: string;
  contentHash: string;
  translatedCount: number;
  batchCount: number;
};

export type TranslationResult = {
  cacheVersion: typeof TRANSLATION_CACHE_VERSION;
  translations: TranslationMap;
  sourceHash: string;
  contentHash: string;
  mode: 'already_english' | 'llm';
  callCount: number;
  generatedAt: string;
  batches: TranslationBatchProof[];
  proof: TranslationProof;
};

export class TranslationPreparationError extends Error {
  constructor(
    readonly errorType: string,
    message: string,
    readonly batchId?: string,
  ) {
    super(message);
    this.name = 'TranslationPreparationError';
  }
}

export class DayTranslator {
  constructor(
    private readonly config: {
      cacheDir: string;
      apiUrl?: string;
      apiKey?: string;
      model?: string;
      timeoutMs?: number;
    },
  ) {}

  async translate(bootstrap: TownBootstrap, day: TownGameDay): Promise<TranslationResult> {
    const entries = collectEntries(day);
    const sourceHash = hashJson(entries.map(({ id, text, category }) => ({ id, text, category })));
    const cachePath = path.join(
      this.config.cacheDir,
      'v2',
      safeSegment(day.run_id),
      `${day.trade_date}.json`,
    );
    const cached = await loadCache(cachePath, sourceHash, entries);
    if (cached) return cached;

    const needsTranslation = entries.filter((entry) => containsCjk(entry.text));
    if (needsTranslation.length === 0) {
      const translations = Object.fromEntries(entries.map((entry) => [entry.id, entry.text]));
      const result = buildResult({ translations, sourceHash, mode: 'already_english', batches: [] });
      await saveCache(cachePath, result);
      return result;
    }
    if (!this.config.apiUrl || !this.config.apiKey || !this.config.model) {
      throw new TranslationPreparationError(
        'CONFIG_MISSING',
        `Real LLM translation is required for ${day.trade_date}; credentials are not configured.`,
      );
    }

    const translated: TranslationMap = Object.fromEntries(
      entries.filter((entry) => !containsCjk(entry.text)).map((entry) => [entry.id, entry.text]),
    );
    const batches = makeBatches(needsTranslation);
    let callCount = 0;
    const proofs = await mapWithConcurrency(batches, MAX_CONCURRENCY, async (batch, index) => {
      const batchId = `${day.trade_date}:${batch[0].category}:${index + 1}`;
      try {
        const result = await this.translateBatch(batch, batchId);
        callCount += result.attempts;
        Object.assign(translated, result.translations);
        return {
          id: batchId,
          category: batch[0].category,
          itemCount: batch.length,
          inputHash: hashJson(batch.map(({ id, text }) => ({ id, text }))),
          attempts: result.attempts,
        } satisfies TranslationBatchProof;
      } catch (error) {
        const typed = asTranslationError(error, batchId);
        console.error(
          JSON.stringify({
            scope: 'translation',
            tradeDate: day.trade_date,
            batchId,
            errorType: typed.errorType,
          }),
        );
        throw typed;
      }
    });

    for (const entry of entries) {
      if (!translated[entry.id]?.trim()) {
        throw new TranslationPreparationError('MISSING_OUTPUT', `Missing ${entry.id}.`);
      }
    }
    validateNoCollapsedOutputs(entries, translated);
    const result = buildResult({ translations: translated, sourceHash, mode: 'llm', batches: proofs });
    result.callCount = callCount;
    await saveCache(cachePath, result);
    return result;
  }

  private async translateBatch(entries: TranslationEntry[], batchId: string) {
    const protectedEntries = entries.map(protectEntry);
    let lastError: TranslationPreparationError | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(`${this.config.apiUrl!.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: 0,
            max_tokens: 8_000,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Translate every supplied financial-town text into natural, faithful English. Do not summarize, generalize, add facts, or reuse a generic template. Return strict JSON as {"translations":[{"id":"...","text":"..."}]}. Every id must appear exactly once. All __KEEP_*__ tokens are immutable.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  batchId,
                  category: entries[0].category,
                  entries: protectedEntries.map(({ id, protectedText }) => ({ id, text: protectedText })),
                }),
              },
            ],
          }),
          signal: AbortSignal.timeout(this.config.timeoutMs ?? 120_000),
        });
        if (!response.ok) {
          throw new TranslationPreparationError('HTTP_ERROR', `Translation HTTP ${response.status}.`, batchId);
        }
        const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content) throw new TranslationPreparationError('EMPTY_RESPONSE', 'Empty LLM response.', batchId);
        const parsed = parseTranslationJson(content);
        return {
          translations: validateTranslations(protectedEntries, parsed),
          attempts: attempt,
        };
      } catch (error) {
        lastError = asTranslationError(error, batchId);
        if (attempt < MAX_ATTEMPTS) await delay(250 * 2 ** (attempt - 1));
      }
    }
    throw lastError ?? new TranslationPreparationError('UNKNOWN', 'Translation failed.', batchId);
  }
}

export function collectEntries(day: TownGameDay): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  for (const post of day.social.posts) add(entries, `post:${post.post_id}`, post.content, 'agent_talk');
  for (const citizen of day.citizens.slice(0, 8)) {
    add(entries, `belief_before:${citizen.agent_id}`, citizen.belief_before?.belief_text, 'belief');
    add(entries, `belief_after:${citizen.agent_id}`, citizen.belief_after?.belief_text, 'belief');
    add(entries, `memory:${citizen.agent_id}`, citizen.belief_after?.memory_summary, 'memory');
    for (const view of citizen.views ?? []) {
      add(entries, `view:${citizen.agent_id}:${view.symbol}`, view.rationale, 'view');
    }
  }
  for (const transaction of day.transactions) {
    add(entries, `risk:${transaction.intent_id}`, transaction.risk?.reason, 'risk');
  }
  for (const [index, error] of (day.errors ?? []).entries()) {
    add(entries, `error:${index}`, error.error, 'error');
  }
  return entries;
}

function add(entries: TranslationEntry[], id: string, text: string | undefined, category: TranslationCategory) {
  const value = text?.trim();
  if (value) entries.push({ id, text: value, category });
}

function makeBatches(entries: TranslationEntry[]) {
  const grouped = new Map<TranslationCategory, TranslationEntry[]>();
  for (const entry of entries) grouped.set(entry.category, [...(grouped.get(entry.category) ?? []), entry]);
  const batches: TranslationEntry[][] = [];
  for (const category of ['agent_talk', 'belief', 'memory', 'view', 'risk', 'error'] as const) {
    let batch: TranslationEntry[] = [];
    let chars = 0;
    for (const entry of grouped.get(category) ?? []) {
      if (batch.length && (batch.length >= MAX_BATCH_ITEMS || chars + entry.text.length > MAX_BATCH_CHARS)) {
        batches.push(batch);
        batch = [];
        chars = 0;
      }
      batch.push(entry);
      chars += entry.text.length;
    }
    if (batch.length) batches.push(batch);
  }
  return batches;
}

function protectEntry(entry: TranslationEntry): ProtectedEntry {
  const placeholders: Record<string, string> = {};
  let index = 0;
  const prefix = createHash('sha256').update(entry.id).digest('hex').slice(0, 8).toUpperCase();
  const protectedText = entry.text.replace(
    /\b\d{6}\.(?:SZ|SH)\b|\b[A-Z][A-Z0-9_-]{1,15}\b|[-+]?\d+(?:\.\d+)?%?/g,
    (token) => {
      const placeholder = `__KEEP_${prefix}_${index++}__`;
      placeholders[placeholder] = token;
      return placeholder;
    },
  );
  return { ...entry, protectedText, placeholders };
}

function parseTranslationJson(content: string) {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped) as { translations?: Array<{ id?: string; text?: string }> };
  } catch {
    throw new TranslationPreparationError('INVALID_JSON', 'Translation response is not valid JSON.');
  }
}

function validateTranslations(entries: ProtectedEntry[], parsed: ReturnType<typeof parseTranslationJson>) {
  if (!Array.isArray(parsed.translations)) {
    throw new TranslationPreparationError('INVALID_SCHEMA', 'Missing translations array.');
  }
  const expectedIds = new Set(entries.map((entry) => entry.id));
  const rows = parsed.translations;
  const returnedIds = rows.map((row) => row.id);
  if (
    rows.length !== entries.length ||
    new Set(returnedIds).size !== returnedIds.length ||
    returnedIds.some((id) => !id || !expectedIds.has(id))
  ) {
    throw new TranslationPreparationError('ID_MISMATCH', 'Translation IDs are incomplete or unexpected.');
  }
  const byId = new Map(rows.map((row) => [row.id!, row.text]));
  const result: TranslationMap = {};
  for (const entry of entries) {
    let text = byId.get(entry.id)?.trim();
    if (!text) throw new TranslationPreparationError('EMPTY_OUTPUT', `Empty translation for ${entry.id}.`);
    for (const [placeholder, value] of Object.entries(entry.placeholders)) {
      if (text.split(placeholder).length !== 2) {
        throw new TranslationPreparationError('PROTECTED_TOKEN_CHANGED', `Changed token in ${entry.id}.`);
      }
      text = text.replace(placeholder, value);
    }
    if (/__KEEP_[A-Z0-9_]+__/.test(text)) {
      throw new TranslationPreparationError('PROTECTED_TOKEN_CHANGED', `Unknown token in ${entry.id}.`);
    }
    if (containsCjk(text)) throw new TranslationPreparationError('CJK_REMAINS', `CJK remains in ${entry.id}.`);
    if (factTokens(text).join('\u0000') !== factTokens(entry.text).join('\u0000')) {
      throw new TranslationPreparationError('FACT_TOKEN_CHANGED', `Numbers or codes changed in ${entry.id}.`);
    }
    result[entry.id] = text;
  }
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const normalized = normalizeOutput(result[entry.id]);
    const previousId = seen.get(normalized);
    if (previousId) {
      const previous = entries.find((candidate) => candidate.id === previousId)!;
      if (normalizeOutput(previous.text) !== normalizeOutput(entry.text)) {
        throw new TranslationPreparationError('GENERIC_COLLAPSE', 'Distinct inputs collapsed to one output.');
      }
    }
    seen.set(normalized, entry.id);
  }
  return result;
}

function validateNoCollapsedOutputs(entries: TranslationEntry[], translations: TranslationMap) {
  const seen = new Map<string, TranslationEntry>();
  for (const entry of entries) {
    const normalized = normalizeOutput(translations[entry.id]);
    const previous = seen.get(normalized);
    if (previous && normalizeOutput(previous.text) !== normalizeOutput(entry.text)) {
      throw new TranslationPreparationError(
        'GENERIC_COLLAPSE',
        `Distinct day inputs collapsed to one output (${previous.id}, ${entry.id}).`,
      );
    }
    seen.set(normalized, entry);
  }
}

function buildResult(args: {
  translations: TranslationMap;
  sourceHash: string;
  mode: 'already_english' | 'llm';
  batches: TranslationBatchProof[];
}): TranslationResult {
  const contentHash = hashJson(Object.entries(args.translations).sort(([left], [right]) => left.localeCompare(right)));
  const proof: TranslationProof = {
    cacheVersion: TRANSLATION_CACHE_VERSION,
    sourceHash: args.sourceHash,
    contentHash,
    translatedCount: Object.keys(args.translations).length,
    batchCount: args.batches.length,
  };
  return {
    cacheVersion: TRANSLATION_CACHE_VERSION,
    translations: args.translations,
    sourceHash: args.sourceHash,
    contentHash,
    mode: args.mode,
    callCount: 0,
    generatedAt: new Date().toISOString(),
    batches: args.batches,
    proof,
  };
}

async function loadCache(
  cachePath: string,
  sourceHash: string,
  entries: TranslationEntry[],
): Promise<TranslationResult | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as TranslationResult;
    if (
      parsed.cacheVersion !== TRANSLATION_CACHE_VERSION ||
      (parsed.mode !== 'llm' && parsed.mode !== 'already_english') ||
      parsed.sourceHash !== sourceHash ||
      parsed.proof?.cacheVersion !== TRANSLATION_CACHE_VERSION ||
      parsed.proof.sourceHash !== sourceHash ||
      parsed.proof.contentHash !== parsed.contentHash ||
      parsed.contentHash !== hashJson(Object.entries(parsed.translations ?? {}).sort(([left], [right]) => left.localeCompare(right))) ||
      entries.some((entry) => !parsed.translations?.[entry.id]?.trim()) ||
      Object.values(parsed.translations ?? {}).some(containsCjk)
    ) {
      return null;
    }
    return { ...parsed, callCount: 0 };
  } catch {
    return null;
  }
}

async function saveCache(cachePath: string, result: TranslationResult) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const temporary = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify({ ...result, callCount: 0 }, null, 2), 'utf8');
  try {
    await rename(temporary, cachePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM') throw error;
    await unlink(cachePath).catch(() => undefined);
    await rename(temporary, cachePath);
  }
}

function asTranslationError(error: unknown, batchId: string) {
  if (error instanceof TranslationPreparationError) {
    return new TranslationPreparationError(error.errorType, error.message, error.batchId ?? batchId);
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new TranslationPreparationError('TIMEOUT', 'Translation request timed out.', batchId);
  }
  if (error instanceof SyntaxError) {
    return new TranslationPreparationError('INVALID_JSON', 'Translation response is not valid JSON.', batchId);
  }
  return new TranslationPreparationError('NETWORK_OR_RUNTIME', 'Translation request failed.', batchId);
}

function normalizeOutput(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function factTokens(value: string) {
  return (value.match(/\b\d{6}\.(?:SZ|SH)\b|\b[A-Z][A-Z0-9_-]{1,15}\b|[-+]?\d+(?:\.\d+)?%?/g) ?? []).sort();
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeSegment(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_');
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, fn: (value: T, index: number) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= values.length) return;
        results[index] = await fn(values[index], index);
      }
    }),
  );
  return results;
}

export function containsCjk(value: string) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(value);
}
