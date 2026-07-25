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
  townBackendUrl?: string;
  townRunId?: string;
  translationCacheDir?: string;
  replayTotalDays: number;
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
  const sharedDeepseek = {
    baseUrl: optional(env.LLM_API_URL),
    apiKey: optional(env.LLM_API_KEY),
    model: optional(env.LLM_MODEL),
  };
  const pandaDeepseek = {
    baseUrl: optional(env.PANDA_DEEPSEEK_BASE_URL),
    apiKey: optional(env.PANDA_DEEPSEEK_API_KEY),
    model: optional(env.PANDA_DEEPSEEK_MODEL),
  };
  validateOptionalGroup(sharedDeepseek, 'LLM_API_URL, LLM_API_KEY and LLM_MODEL');
  validateOptionalGroup(
    pandaDeepseek,
    'PANDA_DEEPSEEK_BASE_URL, PANDA_DEEPSEEK_API_KEY and PANDA_DEEPSEEK_MODEL',
  );
  const deepseekBaseUrl = sharedDeepseek.baseUrl ?? pandaDeepseek.baseUrl;
  const deepseekApiKey = sharedDeepseek.apiKey ?? pandaDeepseek.apiKey;
  const deepseekModel = sharedDeepseek.model ?? pandaDeepseek.model;
  const townBackendUrl = optional(env.TOWN_BACKEND_URL)?.replace(/\/+$/, '');
  const townRunId = optional(env.TOWN_RUN_ID);
  const translationCacheDir = optional(env.TOWN_TRANSLATION_CACHE_DIR);
  const replayTotalDays = readInteger(
    env.TOWN_REPLAY_TOTAL_DAYS,
    30,
    30,
    30,
    'TOWN_REPLAY_TOTAL_DAYS',
  );
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
  if (executionMode === 'competition') {
    if (!apiKey) {
      throw new Error('A2A_EXECUTION_MODE=competition requires A2A_API_KEY.');
    }
    if (!convexUrl || !convexSecret) {
      throw new Error('A2A_EXECUTION_MODE=competition requires Convex-backed task persistence.');
    }
    if (!deepseekBaseUrl || !deepseekApiKey || !deepseekModel) {
      throw new Error(
        'A2A_EXECUTION_MODE=competition requires a complete LLM_* or PANDA_DEEPSEEK_* configuration for DeepSeek V4 Pro.',
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
    townBackendUrl,
    townRunId,
    translationCacheDir,
    replayTotalDays,
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

function validateOptionalGroup(
  values: { baseUrl?: string; apiKey?: string; model?: string },
  names: string,
) {
  const configured = [values.baseUrl, values.apiKey, values.model];
  if (configured.some(Boolean) && !configured.every(Boolean)) {
    throw new Error(`${names} must be configured together.`);
  }
}

function normalizeBaseUrl(value: string) {
  const normalized = value.replace(/\/+$/, '');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('A2A_PUBLIC_BASE_URL must use HTTP or HTTPS.');
  }
  return normalized;
}
