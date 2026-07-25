import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TownBootstrap, TownGameDay, TranslationMap } from './types';

type TranslationEntry = {
  id: string;
  text: string;
  fallback: string;
};

type ProtectedEntry = TranslationEntry & {
  protectedText: string;
  placeholders: Record<string, string>;
};

export type TranslationResult = {
  translations: TranslationMap;
  sourceHash: string;
  mode: 'already_english' | 'llm' | 'fallback';
  callCount: 0 | 1;
};

export class DayTranslator {
  constructor(
    private readonly config: {
      cacheDir: string;
      apiUrl?: string;
      apiKey?: string;
      model?: string;
    },
  ) {}

  async translate(
    bootstrap: TownBootstrap,
    day: TownGameDay,
  ): Promise<TranslationResult> {
    const entries = collectEntries(bootstrap, day);
    const sourceHash = createHash('sha256')
      .update(JSON.stringify(entries.map(({ id, text }) => ({ id, text }))))
      .digest('hex');
    const cachePath = path.join(
      this.config.cacheDir,
      safeSegment(day.run_id),
      `${day.trade_date}.json`,
    );
    const cached = await loadCache(cachePath, sourceHash);
    if (cached) return cached;

    const needsTranslation = entries.filter((entry) => containsCjk(entry.text));
    let result: TranslationResult;
    if (needsTranslation.length === 0) {
      result = {
        translations: Object.fromEntries(entries.map((entry) => [entry.id, entry.text])),
        sourceHash,
        mode: 'already_english',
        callCount: 0,
      };
    } else if (!this.config.apiUrl || !this.config.apiKey || !this.config.model) {
      result = fallbackResult(entries, sourceHash, 0);
    } else {
      result = await this.translateOnce(entries, needsTranslation, sourceHash);
    }

    await saveCache(cachePath, result);
    return result;
  }

  private async translateOnce(
    entries: TranslationEntry[],
    needsTranslation: TranslationEntry[],
    sourceHash: string,
  ): Promise<TranslationResult> {
    const protectedEntries = needsTranslation.map(protectEntry);
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
          max_tokens: 12_000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Translate every supplied financial-town text into concise natural English. Preserve tone without adding facts or advice. Return strict JSON as {"translations":[{"id":"...","text":"..."}]}. Every id must appear exactly once. Tokens like __KEEP_0__ are immutable and must be copied exactly.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                tradeDate: entries[0]?.id.split(':')[0] ?? '',
                entries: protectedEntries.map(({ id, protectedText }) => ({
                  id,
                  text: protectedText,
                })),
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`translation HTTP ${response.status}`);
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content ?? '';
      const parsed = parseTranslationJson(content);
      const translated = validateTranslations(protectedEntries, parsed);
      const complete = Object.fromEntries(
        entries.map((entry) => [entry.id, translated[entry.id] ?? entry.text]),
      );
      if (Object.values(complete).some(containsCjk)) throw new Error('translation contains CJK');
      return { translations: complete, sourceHash, mode: 'llm', callCount: 1 };
    } catch {
      return fallbackResult(entries, sourceHash, 1);
    }
  }
}

export function collectEntries(bootstrap: TownBootstrap, day: TownGameDay): TranslationEntry[] {
  const agentName = new Map(
    bootstrap.agents.map((agent, index) => [agent.agent_id, FRONTEND_NAMES[index] ?? `Agent ${index + 1}`]),
  );
  const entries: TranslationEntry[] = [];
  for (const citizen of day.citizens.slice(0, 8)) {
    const name = agentName.get(citizen.agent_id) ?? 'Town Agent';
    add(
      entries,
      `belief_before:${citizen.agent_id}`,
      citizen.belief_before?.belief_text,
      `${name} had no prior simulated market view.`,
    );
    add(
      entries,
      `belief_after:${citizen.agent_id}`,
      citizen.belief_after?.belief_text,
      `${name} updated the simulated market view for ${day.trade_date}.`,
    );
    add(
      entries,
      `memory:${citizen.agent_id}`,
      citizen.belief_after?.memory_summary,
      `${name}'s simulated memory was updated after the daily checkpoint.`,
    );
    for (const view of citizen.views ?? []) {
      const direction = Number(view.direction ?? 0);
      const label = direction > 0 ? 'bullish' : direction < 0 ? 'bearish' : 'neutral';
      const confidence = Math.round(Number(view.confidence ?? 0) * 100);
      add(
        entries,
        `view:${citizen.agent_id}:${view.symbol}`,
        view.rationale,
        `${name} assigned a ${label} simulated view to ${view.symbol} with ${confidence}% confidence.`,
      );
    }
  }
  for (const post of day.social.posts.slice(0, 20)) {
    const name = agentName.get(post.agent_id) ?? 'Town Agent';
    add(
      entries,
      `post:${post.post_id}`,
      post.content,
      `${name} shared an LLM-generated simulated market view for ${day.trade_date}.`,
    );
  }
  for (const transaction of day.transactions.slice(0, 80)) {
    const accepted = transaction.risk?.status?.toUpperCase() !== 'REJECTED';
    add(
      entries,
      `risk:${transaction.intent_id}`,
      transaction.risk?.reason,
      accepted
        ? 'The simulated account risk check accepted this intent.'
        : 'The simulated account risk check rejected this intent.',
    );
  }
  for (const [index, error] of (day.errors ?? []).entries()) {
    add(
      entries,
      `error:${index}`,
      error.error,
      `The backend Agent returned ${error.status ?? 'an error'} for this checkpoint.`,
    );
  }
  return entries;
}

const FRONTEND_NAMES = [
  'Mira Chen',
  'Theo Grant',
  'Imani Brooks',
  'Sora Vale',
  'Omar Reyes',
  'Lin Park',
  'Jules Hart',
  'Neha Rao',
];

function add(entries: TranslationEntry[], id: string, text: string | undefined, fallback: string) {
  const value = text?.trim();
  if (value) entries.push({ id, text: value, fallback });
}

function protectEntry(entry: TranslationEntry): ProtectedEntry {
  const placeholders: Record<string, string> = {};
  let index = 0;
  const protectedText = entry.text.replace(
    /\b\d{6}\.(?:SZ|SH)\b|\b\d{8,}\b|[-+]?\d+(?:\.\d+)?%?/gi,
    (token) => {
      const placeholder = `__KEEP_${index++}__`;
      placeholders[placeholder] = token;
      return placeholder;
    },
  );
  return { ...entry, protectedText, placeholders };
}

function parseTranslationJson(content: string) {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(stripped) as { translations?: Array<{ id?: string; text?: string }> };
}

function validateTranslations(entries: ProtectedEntry[], parsed: ReturnType<typeof parseTranslationJson>) {
  const rows = parsed.translations;
  if (!Array.isArray(rows)) throw new Error('missing translations array');
  const byId = new Map(rows.map((row) => [row.id, row.text]));
  const result: TranslationMap = {};
  for (const entry of entries) {
    let text = byId.get(entry.id)?.trim();
    if (!text) throw new Error(`missing translation ${entry.id}`);
    for (const [placeholder, value] of Object.entries(entry.placeholders)) {
      if (text.split(placeholder).length !== 2) throw new Error(`changed placeholder ${placeholder}`);
      text = text.replace(placeholder, value);
    }
    if (/__KEEP_\d+__/.test(text) || containsCjk(text)) {
      throw new Error(`invalid English translation ${entry.id}`);
    }
    result[entry.id] = text;
  }
  return result;
}

function fallbackResult(entries: TranslationEntry[], sourceHash: string, callCount: 0 | 1) {
  return {
    translations: Object.fromEntries(entries.map((entry) => [entry.id, entry.fallback])),
    sourceHash,
    mode: 'fallback' as const,
    callCount,
  };
}

async function loadCache(cachePath: string, sourceHash: string): Promise<TranslationResult | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as TranslationResult;
    if (
      parsed.sourceHash === sourceHash &&
      parsed.translations &&
      !Object.values(parsed.translations).some(containsCjk)
    ) {
      return { ...parsed, callCount: 0 };
    }
  } catch {
    // A missing or invalid cache consumes no external call and is regenerated below.
  }
  return null;
}

async function saveCache(cachePath: string, result: TranslationResult) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const temporary = `${cachePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(result, null, 2), 'utf8');
  try {
    await rename(temporary, cachePath);
  } catch {
    // Another process may have populated the immutable cache first.
  }
}

function safeSegment(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_');
}

export function containsCjk(value: string) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(value);
}
