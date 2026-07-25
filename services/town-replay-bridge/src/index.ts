import { TownBackendClient, TownReplayConvexClient } from './client';
import { loadConfig } from './config';
import { buildReplayDayPayload } from './map';
import { DayTranslator } from './translate';
import type { TownGameDay } from './types';

async function main() {
  const config = loadConfig();
  const backend = new TownBackendClient(config.townBackendUrl);
  const allowTranslationCall = config.prepareTranslations || !config.dryRun;
  const translator = new DayTranslator({
    cacheDir: config.translationCacheDir,
    apiUrl: allowTranslationCall ? config.llmApiUrl : undefined,
    apiKey: allowTranslationCall ? config.llmApiKey : undefined,
    model: allowTranslationCall ? config.llmModel : undefined,
  });
  const convex = config.dryRun || config.prepareTranslations
    ? undefined
    : new TownReplayConvexClient(config.convexUrl!, config.sharedSecret!);

  if (config.prepareTranslations) {
    await prepareTranslations(backend, translator, config.runId, config.totalDays, config.pollMs);
    return;
  }

  const previous = await convex?.status(config.sessionId);
  let publishedDays = previous?.runId === config.runId ? previous.dayIndex : 0;
  if (publishedDays >= config.totalDays) {
    console.log(JSON.stringify({ status: 'completed', runId: config.runId, publishedDays }));
    return;
  }

  let history = await loadHistory(backend, config.runId, publishedDays, config.totalDays);
  for (;;) {
    const [bootstrap, progress] = await Promise.all([
      backend.bootstrap(config.runId),
      backend.progress(config.runId),
    ]);
    const availableDays = bootstrap.trading_days.slice(0, config.totalDays);
    if (publishedDays < availableDays.length) {
      const tradeDate = availableDays[publishedDays];
      const day = await backend.day(config.runId, tradeDate);
      history = [...history.filter((item) => item.trade_date !== tradeDate), day].sort((left, right) =>
        left.trade_date.localeCompare(right.trade_date),
      );
      const translation = await translator.translate(bootstrap, day);
      const payload = buildReplayDayPayload({
        bootstrap,
        history,
        dayIndex: publishedDays + 1,
        totalDays: config.totalDays,
        publishedAt: Date.now(),
        sessionId: config.sessionId,
        translations: translation.translations,
        sourceHash: translation.sourceHash,
        translationMode: translation.mode,
        translationContentHash: translation.contentHash,
        translationCacheVersion: translation.cacheVersion,
        translationBatchCount: translation.proof.batchCount,
        translationItemCount: translation.proof.translatedCount,
      });
      if (convex) {
        const result = await convex.publishDay(payload);
        console.log(
          JSON.stringify({
            status: 'published',
            translationMode: translation.mode,
            translationCalls: translation.callCount,
            ...result,
          }),
        );
      } else {
        console.log(
          JSON.stringify({
            status: 'dry-run',
            runId: payload.runId,
            tradeDate: payload.tradeDate,
            dayIndex: payload.dayIndex,
            totalDays: payload.totalDays,
            markets: day.market_board.length,
            agents: day.citizens.length,
            transactions: payload.transactions.length,
            events: payload.events.length,
            messages: payload.messages.length,
            translationMode: translation.mode,
            translationCalls: translation.callCount,
          }),
        );
      }
      publishedDays += 1;
      if (publishedDays >= config.totalDays || config.dryRun) return;
      await delay(config.intervalMs);
      continue;
    }

    if (config.dryRun) return;
    const terminal = ['COMPLETED', 'COMPLETED_WITH_AGENT_ERRORS', 'FAILED', 'CANCELLED'].includes(
      progress.status,
    );
    if (terminal) {
      throw new Error(
        `Town run ended as ${progress.status} with ${publishedDays}/${config.totalDays} replay days.`,
      );
    }
    await convex!.markWaiting(
      config.sessionId,
      config.runId,
      publishedDays,
      config.totalDays,
      `Waiting for LLM checkpoint ${publishedDays + 1}/${config.totalDays}.`,
    );
    console.log(
      JSON.stringify({
        status: 'waiting',
        runId: config.runId,
        publishedDays,
        availableDays: availableDays.length,
        backendStatus: progress.status,
      }),
    );
    await delay(config.pollMs);
  }
}

async function prepareTranslations(
  backend: TownBackendClient,
  translator: DayTranslator,
  runId: string,
  totalDays: number,
  pollMs: number,
) {
  for (;;) {
    const [bootstrap, progress] = await Promise.all([backend.bootstrap(runId), backend.progress(runId)]);
    const availableDays = bootstrap.trading_days.slice(0, totalDays);
    if (availableDays.length < totalDays) {
      if (['FAILED', 'CANCELLED'].includes(progress.status)) {
        throw new Error(`Town run ended as ${progress.status} before ${totalDays} checkpoints.`);
      }
      console.log(JSON.stringify({ status: 'waiting-for-source', availableDays: availableDays.length, totalDays }));
      await delay(pollMs);
      continue;
    }
    const days: TownGameDay[] = [];
    for (const tradeDate of availableDays) days.push(await backend.day(runId, tradeDate));
    const translatedDays = await mapWithConcurrency(days, 2, async (day) => ({
      tradeDate: day.trade_date,
      result: await translator.translate(bootstrap, day),
    }));
    let externalCalls = 0;
    const modes: Record<string, number> = {};
    for (const { tradeDate, result } of translatedDays) {
      externalCalls += result.callCount;
      modes[result.mode] = (modes[result.mode] ?? 0) + 1;
      console.log(JSON.stringify({ status: 'translated', tradeDate, mode: result.mode }));
    }
    console.log(JSON.stringify({ status: 'translation-cache-ready', days: totalDays, externalCalls, modes }));
    return;
  }
}

async function loadHistory(
  backend: TownBackendClient,
  runId: string,
  publishedDays: number,
  totalDays: number,
) {
  if (publishedDays === 0) return [];
  const bootstrap = await backend.bootstrap(runId);
  const dates = bootstrap.trading_days.slice(0, Math.min(publishedDays, totalDays));
  const history: TownGameDay[] = [];
  for (const tradeDate of dates) history.push(await backend.day(runId, tradeDate));
  return history;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  fn: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= values.length) return;
        results[index] = await fn(values[index]);
      }
    }),
  );
  return results;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
