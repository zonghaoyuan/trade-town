import { EMBEDDING_DIMENSION, localHashEmbedding, normalizeApiBaseUrl } from './llm';

function cosineSimilarity(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

describe('local LLM compatibility helpers', () => {
  test('normalizes OpenAI-compatible URLs with or without /v1', () => {
    expect(normalizeApiBaseUrl('https://model.example/v1')).toBe('https://model.example');
    expect(normalizeApiBaseUrl('https://model.example/')).toBe('https://model.example');
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
