import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';
import { DayTranslator, containsCjk } from './translate';
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

describe('daily English translation cache', () => {
  test('uses English structured fallbacks without an external call', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    try {
      const result = await new DayTranslator({ cacheDir }).translate(bootstrap, day);
      expect(result.mode).toBe('fallback');
      expect(result.callCount).toBe(0);
      expect(Object.values(result.translations).some(containsCjk)).toBe(false);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  test('calls the LLM once, preserves immutable facts, and reuses the cache', async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'town-translation-'));
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const payload = JSON.parse(request.messages[1].content);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translations: payload.entries.map((entry: { id: string; text: string }) => ({
                    id: entry.id,
                    text: `English view ${entry.text.match(/__KEEP_\d+__/g)?.join(' ') ?? ''}`.trim(),
                  })),
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    global.fetch = fetchMock as typeof fetch;
    try {
      const translator = new DayTranslator({
        cacheDir,
        apiUrl: 'https://example.invalid/v1',
        apiKey: 'test-key',
        model: 'test-model',
      });
      const first = await translator.translate(bootstrap, day);
      const second = await translator.translate(bootstrap, day);
      expect(first.mode).toBe('llm');
      expect(first.callCount).toBe(1);
      expect(second.callCount).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.translations['belief_after:12345678901']).toContain('002594.SZ');
      expect(first.translations['belief_after:12345678901']).toContain('10%');
      expect(Object.values(first.translations).some(containsCjk)).toBe(false);
    } finally {
      global.fetch = originalFetch;
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});
