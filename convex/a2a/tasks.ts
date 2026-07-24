import { ConvexError, v } from 'convex/values';
import { mutation, query } from '../_generated/server';

const MAX_TASK_JSON_BYTES = 512_000;
const MAX_ARTIFACT_JSON_BYTES = 256_000;

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function assertA2ASecret(secret: string) {
  const expected = process.env.A2A_CONVEX_SHARED_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError('Invalid A2A persistence credentials.');
  }
}

export const saveTask = mutation({
  args: {
    secret: v.string(),
    taskId: v.string(),
    contextId: v.string(),
    state: v.number(),
    statusTimestamp: v.optional(v.string()),
    taskJson: v.string(),
    artifacts: v.array(
      v.object({
        artifactId: v.string(),
        name: v.string(),
        artifactJson: v.string(),
      }),
    ),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertA2ASecret(args.secret);
    if (byteLength(args.taskJson) > MAX_TASK_JSON_BYTES) {
      throw new ConvexError('A2A task payload is too large.');
    }
    const existing = await ctx.db
      .query('a2aTasks')
      .withIndex('by_task_id', (q) => q.eq('taskId', args.taskId))
      .unique();
    const taskRecord = {
      contextId: args.contextId,
      state: args.state,
      statusTimestamp: args.statusTimestamp,
      artifactCount: args.artifacts.length,
      taskJson: args.taskJson,
      updatedAt: args.updatedAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, taskRecord);
    } else {
      await ctx.db.insert('a2aTasks', {
        taskId: args.taskId,
        ...taskRecord,
        createdAt: args.updatedAt,
      });
    }

    for (const artifact of args.artifacts) {
      if (byteLength(artifact.artifactJson) > MAX_ARTIFACT_JSON_BYTES) {
        throw new ConvexError('A2A artifact payload is too large.');
      }
      const stored = await ctx.db
        .query('a2aArtifacts')
        .withIndex('by_task_artifact', (q) =>
          q.eq('taskId', args.taskId).eq('artifactId', artifact.artifactId),
        )
        .unique();
      if (stored) {
        await ctx.db.patch(stored._id, {
          name: artifact.name,
          artifactJson: artifact.artifactJson,
          updatedAt: args.updatedAt,
        });
      } else {
        await ctx.db.insert('a2aArtifacts', {
          taskId: args.taskId,
          artifactId: artifact.artifactId,
          name: artifact.name,
          artifactJson: artifact.artifactJson,
          createdAt: args.updatedAt,
          updatedAt: args.updatedAt,
        });
      }
    }
  },
});

export const loadTask = query({
  args: {
    secret: v.string(),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    assertA2ASecret(args.secret);
    const task = await ctx.db
      .query('a2aTasks')
      .withIndex('by_task_id', (q) => q.eq('taskId', args.taskId))
      .unique();
    return task?.taskJson;
  },
});

export const listTaskRecords = query({
  args: {
    secret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertA2ASecret(args.secret);
    const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
    return await ctx.db.query('a2aTasks').withIndex('by_updated').order('desc').take(limit);
  },
});
