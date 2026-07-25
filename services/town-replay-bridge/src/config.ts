import path from 'node:path';

export type ReplayBridgeConfig = {
  townBackendUrl: string;
  runId: string;
  sessionId: string;
  convexUrl?: string;
  sharedSecret?: string;
  intervalMs: number;
  pollMs: number;
  totalDays: number;
  dryRun: boolean;
  prepareTranslations: boolean;
  translationCacheDir: string;
  llmApiUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
};

export function loadConfig(argv = process.argv.slice(2)): ReplayBridgeConfig {
  const dryRun = argv.includes('--dry-run');
  const prepareTranslations = argv.includes('--prepare-translations');
  const runId = required('TOWN_RUN_ID');
  const sessionId = process.env.TOWN_REPLAY_SESSION_ID?.trim() || `${runId}-english-v1`;
  const convexUrl = process.env.CONVEX_URL?.trim();
  const sharedSecret = process.env.TOWN_REPLAY_SHARED_SECRET?.trim();
  if (!dryRun && !prepareTranslations && (!convexUrl || !sharedSecret)) {
    throw new Error(
      'CONVEX_URL and TOWN_REPLAY_SHARED_SECRET are required unless a preparation mode is used.',
    );
  }
  return {
    townBackendUrl: (process.env.TOWN_BACKEND_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
    runId,
    sessionId,
    convexUrl,
    sharedSecret,
    intervalMs: boundedInteger('TOWN_REPLAY_INTERVAL_MS', 15_000, 1_000, 120_000),
    pollMs: boundedInteger('TOWN_REPLAY_POLL_MS', 5_000, 1_000, 60_000),
    totalDays: boundedInteger('TOWN_REPLAY_TOTAL_DAYS', 30, 1, 60),
    dryRun,
    prepareTranslations,
    translationCacheDir:
      process.env.TOWN_TRANSLATION_CACHE_DIR?.trim() ||
      path.resolve(process.cwd(), '..', 'runtime', 'translation-cache'),
    llmApiUrl: process.env.LLM_API_URL?.trim(),
    llmApiKey: process.env.LLM_API_KEY?.trim(),
    llmModel: process.env.LLM_MODEL?.trim(),
  };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
