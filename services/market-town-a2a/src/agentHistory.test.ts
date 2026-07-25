import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import { loadTownAgentHistory } from './agentHistory';
import type { A2AConfig } from './config';
import type { SkillRequest } from './types';

describe('town-agent-history A2A skill', () => {
  test('returns exactly one Agent across 30 trading days with verified v2 translations', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-a2a-cache-'));
    const runId = 'run-30';
    const dates = Array.from({ length: 30 }, (_, index) => `2025-01-${String(index + 2).padStart(2, '0')}`);
    const translations = {
      'belief_after:agent-01': 'Bullish but cautious.',
      'view:agent-01:002594.SZ': 'Momentum remains positive.',
      'post:post-agent-01': 'I will hold the position.',
      'risk:intent-agent-01': 'The simulated risk check accepted the intent.',
    };
    const contentHash = hashTranslations(translations);
    await mkdir(path.join(cacheDir, 'v2', runId), { recursive: true });
    for (const tradeDate of dates) {
      await writeFile(
        path.join(cacheDir, 'v2', runId, `${tradeDate}.json`),
        JSON.stringify({
          cacheVersion: 2,
          mode: 'llm',
          sourceHash: 'a'.repeat(64),
          contentHash,
          translations,
          proof: {
            cacheVersion: 2,
            sourceHash: 'a'.repeat(64),
            contentHash,
          },
        }),
      );
    }
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('/bootstrap')) {
        return jsonResponse({
          run_id: runId,
          trading_days: dates,
          symbols: [
            { symbol: '002594.SZ' },
            { symbol: '300750.SZ' },
            { symbol: '600519.SH' },
            { symbol: '601318.SH' },
            { symbol: '688981.SH' },
          ],
          agents: [{ agent_id: 'agent-01', display_name: 'Mira Chen' }],
        });
      }
      const tradeDate = decodeURIComponent(value.split('/days/')[1]);
      return jsonResponse(gameDay(runId, tradeDate));
    }) as typeof fetch;
    try {
      const result = await loadTownAgentHistory(request(), config(cacheDir, runId));
      const findings = result.findings as { range: { tradingDays: number }; days: unknown[] };
      expect(result.skillId).toBe('town-agent-history');
      expect(findings.range.tradingDays).toBe(30);
      expect(findings.days).toHaveLength(30);
      expect(result.chainProofs).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(['SIMULATED', 'NO', 'CHAIN'].join('_'));
    } finally {
      global.fetch = originalFetch;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});

function request(): SkillRequest {
  return {
    skillId: 'town-agent-history',
    prompt: '调取 agentId=agent-01 的 30 个交易日数据。',
    input: {},
    seed: 2025,
    dataMode: 'verified-replay',
  };
}

function config(cacheDir: string, runId: string): A2AConfig {
  return {
    port: 41241,
    publicBaseUrl: 'http://127.0.0.1:41241',
    executionMode: 'local-demo',
    townBackendUrl: 'http://town.invalid',
    townRunId: runId,
    translationCacheDir: cacheDir,
    replayTotalDays: 30,
    maxTaskMs: 5_000,
    maxPromptChars: 8_000,
    rateLimitPerMinute: 60,
  };
}

function gameDay(runId: string, tradeDate: string) {
  return {
    run_id: runId,
    trade_date: tradeDate,
    market_board: [
      {
        symbol: '002594.SZ',
        date: tradeDate,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        pre_close: 100,
        volume: 1_000,
      },
    ],
    citizens: [
      {
        agent_id: 'agent-01',
        role: 'Value Investor',
        strategy: 'fundamental',
        belief_after: { belief_text: '看多。', belief_score: 0.5 },
        views: [{ symbol: '002594.SZ', direction: 1, confidence: 0.8, rationale: '动量向上。' }],
        account: { balance: 90_000, equity: 101_000 },
        positions: [],
      },
    ],
    transactions: [
      {
        intent_id: 'intent-agent-01',
        account_id: 'agent-01',
        symbol: '002594.SZ',
        side: 'BUY',
        quantity: 10,
        risk: { status: 'ACCEPTED', reason: '风控通过。' },
        fill: { price: 101, quantity: 10 },
      },
    ],
    social: {
      posts: [{ post_id: 'post-agent-01', agent_id: 'agent-01', content: '继续持有。' }],
    },
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function hashTranslations(value: Record<string, string>) {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
