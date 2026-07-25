import {
  chatCompletionsUrl,
  EMBEDDING_DIMENSION,
  getLLMConfig,
  localHashEmbedding,
  normalizeApiBaseUrl,
} from './llm';

function cosineSimilarity(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

describe('local LLM compatibility helpers', () => {
  test('normalizes OpenAI-compatible URLs with or without /v1', () => {
    expect(normalizeApiBaseUrl('https://model.example/v1')).toBe('https://model.example');
    expect(normalizeApiBaseUrl('https://model.example/')).toBe('https://model.example');
  });

  test('accepts base URLs and full chat completion endpoints', () => {
    expect(chatCompletionsUrl('https://model.example')).toBe(
      'https://model.example/v1/chat/completions',
    );
    expect(chatCompletionsUrl('https://model.example/v1')).toBe(
      'https://model.example/v1/chat/completions',
    );
    expect(chatCompletionsUrl('https://ark.example/api/v3/chat/completions')).toBe(
      'https://ark.example/api/v3/chat/completions',
    );
  });

  test('uses ARK_API_KEY for a custom OpenAI-compatible endpoint', () => {
    const previous = {
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_API_URL: process.env.LLM_API_URL,
      LLM_MODEL: process.env.LLM_MODEL,
      ARK_API_KEY: process.env.ARK_API_KEY,
    };
    process.env.LLM_API_URL = 'https://ark.example/api/v3/chat/completions';
    process.env.LLM_MODEL = 'ark-endpoint';
    delete process.env.LLM_API_KEY;
    process.env.ARK_API_KEY = 'test-ark-key';

    try {
      expect(getLLMConfig()).toMatchObject({
        provider: 'custom',
        chatModel: 'ark-endpoint',
        apiKey: 'test-ark-key',
      });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  test('creates deterministic normalized embeddings', () => {
    const first = localHashEmbedding('NOVA reports strong compute demand');
    const second = localHashEmbedding('NOVA reports strong compute demand');

    expect(first).toHaveLength(EMBEDDING_DIMENSION);
    expect(first).toEqual(second);
    expect(Math.sqrt(cosineSimilarity(first, first))).toBeCloseTo(1);
  });

  test('retains lexical overlap for local demo retrieval', () => {
    const related = cosineSimilarity(
      localHashEmbedding('NOVA compute demand is rising'),
      localHashEmbedding('NOVA demand rises'),
    );
    const unrelated = cosineSimilarity(
      localHashEmbedding('NOVA compute demand is rising'),
      localHashEmbedding('AURUM inventory is stable'),
    );

    expect(related).toBeGreaterThan(unrelated);
  });
});
