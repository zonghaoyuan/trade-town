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

describe('online LLM compatibility helpers', () => {
  const originalOnlineConfig = {
    LLM_API_URL: process.env.LLM_API_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_EMBEDDING_MODEL: process.env.LLM_EMBEDDING_MODEL,
  };

  afterEach(() => {
    for (const [name, value] of Object.entries(originalOnlineConfig)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test('requires an explicitly configured online endpoint and model', () => {
    delete process.env.LLM_API_URL;
    delete process.env.LLM_MODEL;

    expect(() => getLLMConfig()).toThrow('LLM_API_URL is required');

    process.env.LLM_API_URL = 'https://model.example/v1';
    expect(() => getLLMConfig()).toThrow('LLM_MODEL is required');
  });

  test('uses the configured OpenAI-compatible API', () => {
    process.env.LLM_API_URL = 'https://model.example/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'online-chat-model';
    process.env.LLM_EMBEDDING_MODEL = 'local-hash';

    expect(getLLMConfig()).toEqual({
      url: 'https://model.example',
      apiKey: 'test-key',
      chatModel: 'online-chat-model',
      embeddingModel: 'local-hash',
      stopWords: [],
    });
  });

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
    expect(
      chatCompletionsUrl('https://ark.example/api/v3/chat/completions'),
    ).toBe('https://ark.example/api/v3/chat/completions');
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
