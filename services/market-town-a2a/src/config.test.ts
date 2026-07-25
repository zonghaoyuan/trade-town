import { loadA2AConfig } from './config';

describe('A2A configuration', () => {
  test('reuses the shared LLM variables for DeepSeek V4 Pro', () => {
    const config = loadA2AConfig({
      A2A_EXECUTION_MODE: 'competition',
      A2A_PUBLIC_BASE_URL: 'https://agent.example.com',
      A2A_API_KEY: 'review-token',
      A2A_CONVEX_URL: 'https://example.convex.cloud',
      A2A_CONVEX_SHARED_SECRET: 'persistence-secret',
      LLM_API_URL: 'https://deepseek.example.com/v1',
      LLM_API_KEY: 'deepseek-token',
      LLM_MODEL: 'deepseek-v4-pro',
    });

    expect(config).toMatchObject({
      deepseekBaseUrl: 'https://deepseek.example.com/v1',
      deepseekApiKey: 'deepseek-token',
      deepseekModel: 'deepseek-v4-pro',
    });
  });

  test('rejects a partial shared LLM configuration', () => {
    expect(() =>
      loadA2AConfig({
        LLM_API_URL: 'https://deepseek.example.com/v1',
        LLM_API_KEY: 'deepseek-token',
      }),
    ).toThrow('LLM_API_URL, LLM_API_KEY and LLM_MODEL must be configured together');
  });

  test('also supports the Panda-prefixed DeepSeek variables', () => {
    const config = loadA2AConfig({
      PANDA_DEEPSEEK_BASE_URL: 'https://panda-deepseek.example.com/v1',
      PANDA_DEEPSEEK_API_KEY: 'panda-token',
      PANDA_DEEPSEEK_MODEL: 'deepseek-v4-pro',
    });

    expect(config).toMatchObject({
      deepseekBaseUrl: 'https://panda-deepseek.example.com/v1',
      deepseekApiKey: 'panda-token',
      deepseekModel: 'deepseek-v4-pro',
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
