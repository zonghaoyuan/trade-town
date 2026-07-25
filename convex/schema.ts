import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { a2aTables } from './a2a/schema';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';
import { financeTables } from './finance/schema';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
    replaySessionId: v.optional(v.string()),
  })
    .index('by_world', ['worldId'])
    .index('by_replay_session', ['worldId', 'replaySessionId'])
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  ...agentTables,
  ...a2aTables,
  ...aiTownTables,
  ...engineTables,
  ...financeTables,
});
