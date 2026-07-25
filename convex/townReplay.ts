import { ConvexError, v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';

const replayState = v.union(
  v.literal('proposed'),
  v.literal('risk_rejected'),
  v.literal('queued'),
  v.literal('confirmed'),
  v.literal('cancelled'),
  v.literal('failed'),
);

const eventKind = v.union(
  v.literal('policy'),
  v.literal('news'),
  v.literal('conversation'),
  v.literal('belief'),
  v.literal('intent'),
  v.literal('order'),
  v.literal('fill'),
  v.literal('risk'),
);

export const status = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query('townReplaySessions')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .unique(),
});

export const currentDashboardBundle = query({
  handler: async (ctx) => {
    const session = await ctx.db
      .query('townReplaySessions')
      .withIndex('by_active', (q) => q.eq('active', true))
      .order('desc')
      .first();
    if (!session || session.dayIndex < 1) return null;
    const day = await ctx.db
      .query('townReplayDays')
      .withIndex('by_session_day', (q) =>
        q.eq('sessionId', session.sessionId).eq('dayIndex', session.dayIndex),
      )
      .unique();
    if (!day || !hasV2TranslationProof(day)) return null;
    const snapshot = parseSnapshot(day.snapshotJson);
    return {
      ...snapshot,
      sessionId: session.sessionId,
      runId: session.runId,
      tradeDate: day.tradeDate,
      dayIndex: session.dayIndex,
      totalDays: session.totalDays,
      status: session.status,
      publishedAt: session.publishedAt,
    };
  },
});

export const isReplayMode = internalQuery({
  handler: async (ctx) =>
    Boolean(
      await ctx.db
        .query('townReplaySessions')
        .withIndex('by_active', (q) => q.eq('active', true))
        .order('desc')
        .first(),
    ),
});

export const publishDay = mutation({
  args: {
    sharedSecret: v.string(),
    sessionId: v.string(),
    runId: v.string(),
    tradeDate: v.string(),
    dayIndex: v.number(),
    totalDays: v.number(),
    sourceHash: v.string(),
    translationMode: v.union(v.literal('llm'), v.literal('already_english')),
    translationSourceHash: v.string(),
    translationContentHash: v.string(),
    translationCacheVersion: v.number(),
    translationBatchCount: v.number(),
    translationItemCount: v.number(),
    snapshotJson: v.string(),
    publishedAt: v.number(),
    transactions: v.array(
      v.object({
        intentId: v.string(),
        agentName: v.string(),
        subaccountNonce: v.number(),
        symbol: v.string(),
        side: v.union(v.literal('buy'), v.literal('sell')),
        quantity: v.number(),
        limitPrice: v.optional(v.number()),
        rationale: v.string(),
        state: replayState,
        riskCode: v.optional(v.string()),
      }),
    ),
    events: v.array(
      v.object({
        eventId: v.string(),
        kind: eventKind,
        source: v.string(),
        headline: v.string(),
        summary: v.string(),
        severity: v.number(),
        symbols: v.array(v.string()),
        occurredAt: v.number(),
      }),
    ),
    messages: v.array(
      v.object({
        conversationId: v.string(),
        messageUuid: v.string(),
        authorName: v.string(),
        recipientName: v.string(),
        text: v.string(),
        occurredAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertReplaySecret(args.sharedSecret);
    validateDay(args);
    validateTranslationProof(args);
    parseSnapshot(args.snapshotJson);
    if (args.snapshotJson.length > 900_000) throw new ConvexError('Replay snapshot is too large.');
    if (args.transactions.length > 80 || args.events.length > 120 || args.messages.length > 40) {
      throw new ConvexError('Replay day payload exceeds the bounded write limit.');
    }
    for (const transaction of args.transactions) assertEnglish(transaction.rationale);
    for (const event of args.events) {
      assertEnglish(event.headline);
      assertEnglish(event.summary);
    }
    for (const message of args.messages) assertEnglish(message.text);

    let session = await ctx.db
      .query('townReplaySessions')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .unique();
    if (session) {
      if (session.runId !== args.runId || session.totalDays !== args.totalDays) {
        throw new ConvexError('Replay session identity does not match its existing run.');
      }
      if (args.dayIndex > session.dayIndex + 1) {
        throw new ConvexError('Replay days must be published in order.');
      }
    } else {
      if (args.dayIndex !== 1) throw new ConvexError('A new replay session must start at day 1.');
      const activeSessions = await ctx.db
        .query('townReplaySessions')
        .withIndex('by_active', (q) => q.eq('active', true))
        .collect();
      for (const active of activeSessions) await ctx.db.patch(active._id, { active: false });
      const id = await ctx.db.insert('townReplaySessions', {
        sessionId: args.sessionId,
        runId: args.runId,
        status: 'replaying',
        active: true,
        dayIndex: 0,
        totalDays: args.totalDays,
        detail: 'Replay session initialized.',
        updatedAt: Date.now(),
      });
      session = (await ctx.db.get(id))!;
    }

    const existingDay = await ctx.db
      .query('townReplayDays')
      .withIndex('by_session_day', (q) =>
        q.eq('sessionId', args.sessionId).eq('dayIndex', args.dayIndex),
      )
      .unique();
    const dayValue = {
      runId: args.runId,
      tradeDate: args.tradeDate,
      totalDays: args.totalDays,
      sourceHash: args.sourceHash,
      translationMode: args.translationMode,
      translationSourceHash: args.translationSourceHash,
      translationContentHash: args.translationContentHash,
      translationCacheVersion: args.translationCacheVersion,
      translationBatchCount: args.translationBatchCount,
      translationItemCount: args.translationItemCount,
      snapshotJson: args.snapshotJson,
      publishedAt: args.publishedAt,
      updatedAt: Date.now(),
    };
    if (existingDay) {
      await ctx.db.patch(existingDay._id, dayValue);
    } else {
      await ctx.db.insert('townReplayDays', {
        sessionId: args.sessionId,
        dayIndex: args.dayIndex,
        ...dayValue,
      });
    }

    const writtenTransactions = await writeTransactions(ctx, args);
    const writtenEvents = await writeEvents(ctx, args);
    const writtenMessages = await writeMessages(ctx, args);

    if (args.dayIndex >= session.dayIndex) {
      await ctx.db.patch(session._id, {
        active: true,
        status: args.dayIndex >= args.totalDays ? 'completed' : 'replaying',
        currentTradeDate: args.tradeDate,
        dayIndex: args.dayIndex,
        publishedAt: args.publishedAt,
        detail: `LLM replay ${args.dayIndex}/${args.totalDays}; simulated, no chain proof`,
        updatedAt: Date.now(),
      });
    }

    return {
      sessionId: args.sessionId,
      runId: args.runId,
      tradeDate: args.tradeDate,
      dayIndex: args.dayIndex,
      totalDays: args.totalDays,
      writtenTransactions,
      writtenEvents,
      writtenMessages,
    };
  },
});

export const markWaiting = mutation({
  args: {
    sharedSecret: v.string(),
    sessionId: v.string(),
    runId: v.string(),
    dayIndex: v.number(),
    totalDays: v.number(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    assertReplaySecret(args.sharedSecret);
    const existing = await ctx.db
      .query('townReplaySessions')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .unique();
    const value = {
      runId: args.runId,
      status: 'waiting' as const,
      active: true,
      dayIndex: args.dayIndex,
      totalDays: args.totalDays,
      detail: bounded(args.detail, 500),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
      return existing._id;
    }
    if (args.dayIndex !== 0) throw new ConvexError('Unknown replay session cannot wait after day 0.');
    const activeSessions = await ctx.db
      .query('townReplaySessions')
      .withIndex('by_active', (q) => q.eq('active', true))
      .collect();
    for (const active of activeSessions) await ctx.db.patch(active._id, { active: false });
    return await ctx.db.insert('townReplaySessions', { sessionId: args.sessionId, ...value });
  },
});

async function writeTransactions(ctx: any, args: any) {
  let written = 0;
  for (const [index, transaction] of args.transactions.entries()) {
    const previous = await ctx.db
      .query('tradeIntents')
      .withIndex('by_intent_id', (q: any) => q.eq('intentId', transaction.intentId))
      .unique();
    const value = {
      agentName: bounded(transaction.agentName, 80),
      subaccountNonce: transaction.subaccountNonce,
      symbol: bounded(transaction.symbol, 32),
      side: transaction.side,
      orderType: 'limit' as const,
      quantity: transaction.quantity,
      limitPrice: transaction.limitPrice,
      rationale: bounded(transaction.rationale, 800),
      state: transaction.state,
      riskCode: transaction.riskCode ? bounded(transaction.riskCode, 100) : undefined,
      cid: makeReplayCid(transaction.intentId, transaction.subaccountNonce),
      updatedAt: args.publishedAt + index,
    };
    if (previous) await ctx.db.patch(previous._id, value);
    else {
      await ctx.db.insert('tradeIntents', {
        intentId: transaction.intentId,
        ...value,
        createdAt: args.publishedAt + index,
      });
    }
    written += 1;
  }
  return written;
}

async function writeEvents(ctx: any, args: any) {
  let written = 0;
  for (const event of args.events) {
    const previous = await ctx.db
      .query('marketEvents')
      .withIndex('by_event_id', (q: any) => q.eq('eventId', event.eventId))
      .unique();
    const value = {
      kind: event.kind,
      source: bounded(event.source, 80),
      headline: bounded(event.headline, 160),
      summary: bounded(event.summary, 1200),
      severity: Math.max(0, Math.min(1, event.severity)),
      symbols: event.symbols.slice(0, 8).map((symbol: string) => bounded(symbol, 32)),
      occurredAt: event.occurredAt,
    };
    if (previous) await ctx.db.patch(previous._id, value);
    else await ctx.db.insert('marketEvents', { eventId: event.eventId, ...value });
    written += 1;
  }
  return written;
}

async function writeMessages(ctx: any, args: any) {
  const worldStatus = await ctx.db
    .query('worldStatus')
    .filter((q: any) => q.eq(q.field('isDefault'), true))
    .first();
  if (!worldStatus) return 0;
  const descriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q: any) => q.eq('worldId', worldStatus.worldId))
    .collect();
  const playersByName = new Map(descriptions.map((item: any) => [item.name, item.playerId]));
  let written = 0;
  for (const message of args.messages) {
    const author = playersByName.get(message.authorName);
    const recipient = playersByName.get(message.recipientName);
    if (!author || !recipient || author === recipient) continue;
    const conversation = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q: any) =>
        q.eq('worldId', worldStatus.worldId).eq('id', message.conversationId),
      )
      .unique();
    if (!conversation) {
      await ctx.db.insert('archivedConversations', {
        worldId: worldStatus.worldId,
        id: message.conversationId,
        creator: author,
        created: message.occurredAt,
        ended: message.occurredAt + 1,
        lastMessage: { author, timestamp: message.occurredAt },
        numMessages: 1,
        participants: [author, recipient],
      });
    }
    const previous = await ctx.db
      .query('messages')
      .withIndex('messageUuid', (q: any) =>
        q.eq('conversationId', message.conversationId).eq('messageUuid', message.messageUuid),
      )
      .first();
    if (!previous) {
      await ctx.db.insert('messages', {
        conversationId: message.conversationId,
        messageUuid: message.messageUuid,
        author,
        text: bounded(message.text, 1200),
        worldId: worldStatus.worldId,
        replaySessionId: args.sessionId,
      });
      written += 1;
    }
  }
  return written;
}

function validateDay(args: { dayIndex: number; totalDays: number; tradeDate: string }) {
  if (!Number.isInteger(args.dayIndex) || args.dayIndex < 1) {
    throw new ConvexError('dayIndex must be a positive integer.');
  }
  if (!Number.isInteger(args.totalDays) || args.totalDays < args.dayIndex) {
    throw new ConvexError('totalDays must be an integer greater than or equal to dayIndex.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.tradeDate)) throw new ConvexError('Invalid tradeDate.');
}

function validateTranslationProof(args: {
  sourceHash: string;
  translationMode: 'llm' | 'already_english';
  translationSourceHash: string;
  translationContentHash: string;
  translationCacheVersion: number;
  translationBatchCount: number;
  translationItemCount: number;
}) {
  if (args.translationCacheVersion !== 2) {
    throw new ConvexError('Replay translation cache version must be v2.');
  }
  if (args.translationSourceHash !== args.sourceHash) {
    throw new ConvexError('Replay translation source proof does not match the source payload.');
  }
  if (!/^[a-f0-9]{64}$/.test(args.translationSourceHash) || !/^[a-f0-9]{64}$/.test(args.translationContentHash)) {
    throw new ConvexError('Replay translation proof hashes are invalid.');
  }
  if (!Number.isInteger(args.translationBatchCount) || args.translationBatchCount < 0) {
    throw new ConvexError('Replay translation batch proof is invalid.');
  }
  if (!Number.isInteger(args.translationItemCount) || args.translationItemCount < 1) {
    throw new ConvexError('Replay translation item proof is missing.');
  }
  if (args.translationMode === 'llm' && args.translationBatchCount < 1) {
    throw new ConvexError('LLM translation must include at least one completed batch.');
  }
  if (args.translationMode === 'already_english' && args.translationBatchCount !== 0) {
    throw new ConvexError('Already-English replay data must not claim LLM batches.');
  }
}

function hasV2TranslationProof(day: any) {
  return (
    day.translationCacheVersion === 2 &&
    (day.translationMode === 'llm' || day.translationMode === 'already_english') &&
    typeof day.translationSourceHash === 'string' &&
    day.translationSourceHash === day.sourceHash &&
    typeof day.translationContentHash === 'string' &&
    Number.isInteger(day.translationBatchCount) &&
    Number.isInteger(day.translationItemCount) &&
    day.translationItemCount > 0
  );
}

function parseSnapshot(value: string): any {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || !Array.isArray(parsed.dashboards) || parsed.dashboards.length !== 5) {
      throw new Error('Expected five dashboards.');
    }
    for (const item of parsed.dashboards) {
      if (!item?.symbol || !item.dashboard || item.dashboard.markets?.length !== 5) {
        throw new Error('Invalid replay dashboard bundle.');
      }
    }
    return parsed;
  } catch (error) {
    throw new ConvexError(error instanceof Error ? error.message : 'Invalid replay snapshot JSON.');
  }
}

function assertReplaySecret(provided: string) {
  const expected = process.env.TOWN_REPLAY_SHARED_SECRET;
  if (!expected || provided !== expected) throw new ConvexError('Town replay authentication failed.');
}

function assertEnglish(value: string) {
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(value)) {
    throw new ConvexError('Replay dynamic text must be English.');
  }
}

function bounded(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function makeReplayCid(intentId: string, nonce: number) {
  const suffix = intentId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(-20);
  return `replay-${nonce}-${suffix}`.slice(0, 36);
}
