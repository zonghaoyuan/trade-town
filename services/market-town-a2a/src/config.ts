import { ExecutionMode } from './types';

export type A2AConfig = {
  port: number;
  publicBaseUrl: string;
  executionMode: ExecutionMode;
  apiKey?: string;
  convexUrl?: string;
  convexSecret?: string;
  deepseekBaseUrl?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  maxTaskMs: number;
  maxPromptChars: number;
  rateLimitPerMinute: number;
};

export function loadA2AConfig(env: NodeJS.ProcessEnv = process.env): A2AConfig {
  const port = readInteger(env.A2A_PORT, 41241, 1, 65_535, 'A2A_PORT');
  const publicBaseUrl = normalizeBaseUrl(
    env.A2A_PUBLIC_BASE_URL?.trim() || `http://127.0.0.1:${port}`,
  );
  const executionMode = readExecutionMode(env.A2A_EXECUTION_MODE);
  const apiKey = optional(env.A2A_API_KEY);
  const convexUrl = optional(env.A2A_CONVEX_URL);
  const convexSecret = optional(env.A2A_CONVEX_SHARED_SECRET);
  const deepseekBaseUrl = optional(env.LLM_API_URL);
  const deepseekApiKey = optional(env.LLM_API_KEY);
  const deepseekModel = optional(env.LLM_MODEL);
  const maxTaskMs = readInteger(
    env.A2A_MAX_TASK_MS,
    18 * 60 * 1000,
    1_000,
    19 * 60 * 1000,
    'A2A_MAX_TASK_MS',
  );
  const maxPromptChars = readInteger(
    env.A2A_MAX_PROMPT_CHARS,
    8_000,
    100,
    32_000,
    'A2A_MAX_PROMPT_CHARS',
  );
  const rateLimitPerMinute = readInteger(
    env.A2A_RATE_LIMIT_PER_MINUTE,
    60,
    1,
    10_000,
    'A2A_RATE_LIMIT_PER_MINUTE',
  );

  if (Boolean(convexUrl) !== Boolean(convexSecret)) {
    throw new Error('A2A_CONVEX_URL and A2A_CONVEX_SHARED_SECRET must be configured together.');
  }
  if (
    [deepseekBaseUrl, deepseekApiKey, deepseekModel].some(Boolean) &&
    ![deepseekBaseUrl, deepseekApiKey, deepseekModel].every(Boolean)
  ) {
    throw new Error(
      'LLM_API_URL, LLM_API_KEY and LLM_MODEL must be configured together.',
    );
  }
  if (executionMode === 'competition') {
    if (!apiKey) {
      throw new Error('A2A_EXECUTION_MODE=competition requires A2A_API_KEY.');
    }
    if (!convexUrl || !convexSecret) {
      throw new Error('A2A_EXECUTION_MODE=competition requires Convex-backed task persistence.');
    }
    if (!deepseekBaseUrl || !deepseekApiKey || !deepseekModel) {
      throw new Error(
        'A2A_EXECUTION_MODE=competition requires LLM_API_URL, LLM_API_KEY and LLM_MODEL for DeepSeek V4 Pro.',
      );
    }
    if (!publicBaseUrl.startsWith('https://')) {
      throw new Error('A2A_EXECUTION_MODE=competition requires an HTTPS A2A_PUBLIC_BASE_URL.');
    }
  }

  return {
    port,
    publicBaseUrl,
    executionMode,
    apiKey,
    convexUrl,
    convexSecret,
    deepseekBaseUrl,
    deepseekApiKey,
    deepseekModel,
    maxTaskMs,
    maxPromptChars,
    rateLimitPerMinute,
  };
}

function readExecutionMode(value: string | undefined): ExecutionMode {
  if (!value || value === 'local-demo') {
    return 'local-demo';
  }
  if (value === 'competition') {
    return value;
  }
  throw new Error('A2A_EXECUTION_MODE must be local-demo or competition.');
}

function readInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function optional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeBaseUrl(value: string) {
  const normalized = value.replace(/\/+$/, '');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('A2A_PUBLIC_BASE_URL must use HTTP or HTTPS.');
  }
  return normalized;
}
