import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import {
  DayTranslator,
  TranslationPreparationError,
  containsCjk,
} from './translate';
import type { TownBootstrap, TownGameDay } from './types';

const bootstrap: TownBootstrap = {
  run_id: 'run-translation',
  trading_days: ['2025-01-02'],
  symbols: [{ symbol: '002594.SZ' }],
  agents: [{ agent_id: '12345678901', display_name: 'Backend Agent' }],
};

const day: TownGameDay = {
  run_id: 'run-translation',
  trade_date: '2025-01-02',
  market_board: [],
  citizens: [
    {
      agent_id: '12345678901',
      belief_after: { belief_text: '看好002594.SZ，目标上涨10%。' },
      views: [
        {
          symbol: '002594.SZ',
          direction: 1,
          confidence: 0.8,
          rationale: '价格为285.50，继续看多。',
        },
      ],
    },
  ],
  transactions: [
    {
      intent_id: 'intent-1',
      account_id: '12345678901',
      symbol: '002594.SZ',
      side: 'BUY',
      quantity: 1,
      risk: { status: 'ACCEPTED', reason: '风险检查通过。' },
    },
  ],
  social: {
    posts: [{ post_id: 'post-1', agent_id: '12345678901', content: '今天继续持有。' }],
  },
};

describe('strict v2 daily English translation cache', () => {
  test('blocks publishing when real LLM credentials are absent', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    try {
      await expect(new DayTranslator({ cacheDir }).translate(bootstrap, day)).rejects.toMatchObject({
        errorType: 'CONFIG_MISSING',
      });
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  test('uses bounded category batches, preserves immutable facts, and reuses v2 cache', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const payload = JSON.parse(request.messages[1].content);
      return llmResponse(
        payload.entries.map((entry: { id: string; text: string }) => ({
          id: entry.id,
          text: `English ${payload.category} ${(entry.text.match(/__KEEP_[A-Z0-9_]+__/g) ?? []).join(' ')}`,
        })),
      );
    });
    global.fetch = fetchMock as typeof fetch;
    try {
      const translator = configuredTranslator(cacheDir);
      const first = await translator.translate(bootstrap, day);
      const second = await translator.translate(bootstrap, day);
      expect(first.mode).toBe('llm');
      expect(first.cacheVersion).toBe(2);
      expect(first.proof.batchCount).toBe(4);
      expect(first.callCount).toBe(4);
      expect(second.callCount).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(first.translations['belief_after:12345678901']).toContain('002594.SZ');
      expect(first.translations['belief_after:12345678901']).toContain('10%');
      expect(Object.values(first.translations).some(containsCjk)).toBe(false);
    } finally {
      global.fetch = originalFetch;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  test('ignores legacy fallback cache files and retries a failed batch twice at most', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    await mkdir(path.join(cacheDir, bootstrap.run_id), { recursive: true });
    await writeFile(
      path.join(cacheDir, bootstrap.run_id, `${day.trade_date}.json`),
      JSON.stringify({ mode: 'fallback', translations: { 'post:post-1': 'Generic fallback.' } }),
    );
    const postOnly = { ...day, citizens: [], transactions: [] };
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      if (calls < 3) return new Response('temporary', { status: 503 });
      const request = JSON.parse(String(init?.body));
      const payload = JSON.parse(request.messages[1].content);
      return llmResponse(payload.entries.map((entry: { id: string }) => ({ id: entry.id, text: 'Hold today.' })));
    }) as typeof fetch;
    try {
      const result = await configuredTranslator(cacheDir).translate(bootstrap, postOnly);
      expect(result.mode).toBe('llm');
      expect(result.callCount).toBe(3);
      expect(result.translations['post:post-1']).toBe('Hold today.');
    } finally {
      global.fetch = originalFetch;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  test('rejects changed IDs, CJK output, and collapsed generic templates', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    const twoPosts: TownGameDay = {
      ...day,
      citizens: [],
      transactions: [],
      social: {
        posts: [
          { post_id: 'post-1', agent_id: '12345678901', content: '继续持有。' },
          { post_id: 'post-2', agent_id: '12345678901', content: '今天卖出。' },
        ],
      },
    };
    const originalFetch = global.fetch;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const payload = JSON.parse(request.messages[1].content);
      return llmResponse(payload.entries.map((entry: { id: string }) => ({ id: entry.id, text: 'Generic view.' })));
    }) as typeof fetch;
    try {
      await expect(configuredTranslator(cacheDir).translate(bootstrap, twoPosts)).rejects.toBeInstanceOf(
        TranslationPreparationError,
      );
    } finally {
      errorSpy.mockRestore();
      global.fetch = originalFetch;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});

function configuredTranslator(cacheDir: string) {
  return new DayTranslator({
    cacheDir,
    apiUrl: 'https://example.invalid/v1',
    apiKey: 'test-key',
    model: 'test-model',
  });
}

function llmResponse(translations: Array<{ id: string; text: string }>) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations }) } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
