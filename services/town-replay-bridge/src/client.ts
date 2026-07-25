import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import type { ReplayDayPayload, TownBootstrap, TownGameDay, TownProgress } from './types';

export class TownBackendClient {
  constructor(private readonly baseUrl: string) {}

  bootstrap(runId: string) {
    return this.get<TownBootstrap>(`/api/v1/game/runs/${encodeURIComponent(runId)}/bootstrap`);
  }

  progress(runId: string) {
    return this.get<TownProgress>(`/api/v1/runs/${encodeURIComponent(runId)}/progress`);
  }

  day(runId: string, tradeDate: string) {
    return this.get<TownGameDay>(
      `/api/v1/game/runs/${encodeURIComponent(runId)}/days/${encodeURIComponent(tradeDate)}`,
    );
  }

  private async get<T>(requestPath: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Town backend ${response.status} for ${requestPath}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}

export class TownReplayConvexClient {
  private readonly client: ConvexHttpClient;

  constructor(
    convexUrl: string,
    private readonly sharedSecret: string,
  ) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async status(sessionId: string): Promise<{ runId: string; dayIndex: number; totalDays: number } | null> {
    return (await this.client.query((api as any).townReplay.status, { sessionId })) as {
      runId: string;
      dayIndex: number;
      totalDays: number;
    } | null;
  }

  publishDay(payload: ReplayDayPayload) {
    return this.client.mutation((api as any).townReplay.publishDay, {
      sharedSecret: this.sharedSecret,
      ...payload,
    });
  }

  markWaiting(
    sessionId: string,
    runId: string,
    dayIndex: number,
    totalDays: number,
    detail: string,
  ) {
    return this.client.mutation((api as any).townReplay.markWaiting, {
      sharedSecret: this.sharedSecret,
      sessionId,
      runId,
      dayIndex,
      totalDays,
      detail,
    });
  }
}
