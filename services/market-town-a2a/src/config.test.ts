import { loadA2AConfig } from './config';

describe('A2A configuration', () => {
  test('reuses the shared OpenAI-compatible LLM variables', () => {
    const config = loadA2AConfig({
      A2A_EXECUTION_MODE: 'competition',
      A2A_PUBLIC_BASE_URL: 'https://agent.example.com',
      A2A_CONVEX_URL: 'https://example.convex.cloud',
      A2A_CONVEX_SHARED_SECRET: 'persistence-secret',
      LLM_API_URL: 'https://deepseek.example.com/v1',
      LLM_API_KEY: 'deepseek-token',
      LLM_MODEL: 'deepseek-v4-pro',
    });

    expect(config).toMatchObject({
      executionMode: 'competition',
      llmBaseUrl: 'https://deepseek.example.com/v1',
      llmApiKey: 'deepseek-token',
      llmModel: 'deepseek-v4-pro',
    });
  });

  test('rejects a partial shared LLM configuration', () => {
    expect(() =>
      loadA2AConfig({
        LLM_API_URL: 'https://deepseek.example.com/v1',
        LLM_API_KEY: 'deepseek-token',
      }),
    ).toThrow(
      'LLM_API_URL, LLM_MODEL and either LLM_API_KEY or ARK_API_KEY must be configured together',
    );
  });

  test('accepts ARK_API_KEY as the A2A model credential', () => {
    const config = loadA2AConfig({
      LLM_API_URL: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      ARK_API_KEY: 'ark-token',
      LLM_MODEL: 'ep-seed',
    });

    expect(config).toMatchObject({
      llmBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      llmApiKey: 'ark-token',
      llmModel: 'ep-seed',
    });
  });

  test('also supports the Panda-prefixed DeepSeek variables', () => {
    const config = loadA2AConfig({
      PANDA_DEEPSEEK_BASE_URL: 'https://panda-deepseek.example.com/v1',
      PANDA_DEEPSEEK_API_KEY: 'panda-token',
      PANDA_DEEPSEEK_MODEL: 'deepseek-v4-pro',
    });

    expect(config).toMatchObject({
      llmBaseUrl: 'https://panda-deepseek.example.com/v1',
      llmApiKey: 'panda-token',
      llmModel: 'deepseek-v4-pro',
    });
  });

  test('rejects a partial Panda-prefixed DeepSeek configuration', () => {
    expect(() =>
      loadA2AConfig({
        PANDA_DEEPSEEK_BASE_URL: 'https://panda-deepseek.example.com/v1',
        PANDA_DEEPSEEK_API_KEY: 'panda-token',
      }),
    ).toThrow(
      'PANDA_DEEPSEEK_BASE_URL, PANDA_DEEPSEEK_API_KEY and PANDA_DEEPSEEK_MODEL must be configured together',
    );
  });
});
