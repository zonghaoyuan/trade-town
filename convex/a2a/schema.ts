import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const a2aTables = {
  a2aTasks: defineTable({
    taskId: v.string(),
    contextId: v.string(),
    state: v.number(),
    statusTimestamp: v.optional(v.string()),
    artifactCount: v.number(),
    taskJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_task_id', ['taskId'])
    .index('by_context', ['contextId', 'updatedAt'])
    .index('by_updated', ['updatedAt']),

  a2aArtifacts: defineTable({
    taskId: v.string(),
    artifactId: v.string(),
    name: v.string(),
    artifactJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_task', ['taskId', 'updatedAt'])
    .index('by_task_artifact', ['taskId', 'artifactId']),
};
