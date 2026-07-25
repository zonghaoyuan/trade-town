import { v } from 'convex/values';
import { internal } from './_generated/api';
import {
  internalMutation,
  MutationCtx,
  mutation,
  query,
} from './_generated/server';

const REPLAY_KEY = 'panda-daily-v1';
const FINAL_DAY_INDEX = 303;
const DEFAULT_SPEED_MS = 1_000;
const ALLOWED_SPEEDS = new Set([400, 1_000, 2_000]);

export const state = query({
  handler: async (ctx) => {
    const replay = await ctx.db
      .query('pandaReplayState')
      .withIndex('by_key', (q) => q.eq('key', REPLAY_KEY))
      .unique();
    return replay ?? defaultState(0);
  },
});

export const bootstrap = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('pandaReplayState')
      .withIndex('by_key', (q) => q.eq('key', REPLAY_KEY))
      .unique();
    if (existing) return existing._id;
    const replay = defaultState();
    const id = await ctx.db.insert('pandaReplayState', replay);
    await scheduleAdvance(ctx, replay.generation, replay.speedMs);
    return id;
  },
});

export const setPlaying = mutation({
  args: { isPlaying: v.boolean() },
  handler: async (ctx, args) => {
    const replay = await ensureReplayState(ctx);
    const generation = replay.generation + 1;
    const currentDayIndex =
      args.isPlaying && replay.currentDayIndex >= FINAL_DAY_INDEX
        ? 0
        : replay.currentDayIndex;
    await ctx.db.patch(replay._id, {
      currentDayIndex,
      isPlaying: args.isPlaying,
      generation,
      updatedAt: Date.now(),
    });
    if (args.isPlaying) await scheduleAdvance(ctx, generation, replay.speedMs);
  },
});

export const step = mutation({
  args: { delta: v.number() },
  handler: async (ctx, args) => {
    const replay = await ensureReplayState(ctx);
    await ctx.db.patch(replay._id, {
      currentDayIndex: clampDay(replay.currentDayIndex + Math.trunc(args.delta)),
      isPlaying: false,
      generation: replay.generation + 1,
      updatedAt: Date.now(),
    });
  },
});

export const reset = mutation({
  handler: async (ctx) => {
    const replay = await ensureReplayState(ctx);
    await ctx.db.patch(replay._id, {
      currentDayIndex: 0,
      isPlaying: false,
      generation: replay.generation + 1,
      updatedAt: Date.now(),
    });
  },
});

export const setSpeed = mutation({
  args: { speedMs: v.number() },
  handler: async (ctx, args) => {
    const replay = await ensureReplayState(ctx);
    const speedMs = ALLOWED_SPEEDS.has(args.speedMs) ? args.speedMs : DEFAULT_SPEED_MS;
    const generation = replay.generation + 1;
    await ctx.db.patch(replay._id, {
      speedMs,
      generation,
      updatedAt: Date.now(),
    });
    if (replay.isPlaying) await scheduleAdvance(ctx, generation, speedMs);
  },
});

export const advance = internalMutation({
  args: { generation: v.number() },
  handler: async (ctx, args) => {
    const replay = await ctx.db
      .query('pandaReplayState')
      .withIndex('by_key', (q) => q.eq('key', REPLAY_KEY))
      .unique();
    if (!replay || !replay.isPlaying || replay.generation !== args.generation) return;

    if (replay.currentDayIndex >= FINAL_DAY_INDEX) {
      await ctx.db.patch(replay._id, {
        isPlaying: false,
        updatedAt: Date.now(),
      });
      return;
    }

    await ctx.db.patch(replay._id, {
      currentDayIndex: replay.currentDayIndex + 1,
      updatedAt: Date.now(),
    });
    await scheduleAdvance(ctx, replay.generation, replay.speedMs);
  },
});

async function ensureReplayState(ctx: MutationCtx) {
  const existing = await ctx.db
    .query('pandaReplayState')
    .withIndex('by_key', (q) => q.eq('key', REPLAY_KEY))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert('pandaReplayState', defaultState());
  return (await ctx.db.get(id))!;
}

async function scheduleAdvance(ctx: MutationCtx, generation: number, speedMs: number) {
  await ctx.scheduler.runAfter(speedMs, (internal as any).pandaReplay.advance, {
    generation,
  });
}

function defaultState(updatedAt = Date.now()) {
  return {
    key: REPLAY_KEY,
    currentDayIndex: 0,
    isPlaying: true,
    speedMs: DEFAULT_SPEED_MS,
    generation: 1,
    updatedAt,
  };
}

function clampDay(value: number) {
  return Math.min(FINAL_DAY_INDEX, Math.max(0, value));
}
