import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { insertInput } from './aiTown/insertInput';
import { conversationId, playerId } from './aiTown/ids';
import type { ActivityPerson, TownConversationFeed } from '../shared/activity';
import { buildTownSpeechMessages } from './messagesFeed';

export const listMessages = query({
  args: {
    worldId: v.id('worlds'),
    conversationId,
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query('messages')
      .withIndex('conversationId', (q) =>
        q.eq('worldId', args.worldId).eq('conversationId', args.conversationId),
      )
      .collect();
    const out = [];
    for (const message of messages) {
      const playerDescription = await ctx.db
        .query('playerDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', message.author))
        .first();
      if (!playerDescription) {
        throw new Error(`Invalid author ID: ${message.author}`);
      }
      out.push({ ...message, authorName: playerDescription.name });
    }
    return out;
  },
});

export const recentTownMessages = query({
  args: {
    worldId: v.id('worlds'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<TownConversationFeed> => {
    const limit = Math.max(1, Math.min(args.limit ?? 30, 80));
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }

    const descriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const names = new Map(
      descriptions.map((description) => [description.playerId, description.name]),
    );
    const agentPlayerIds = new Set(world.agents.map((agent) => agent.playerId));
    const activeConversations = new Map(
      world.conversations.map((conversation) => [conversation.id, conversation]),
    );

    // Human conversations are intentionally excluded from this public town feed.
    // Read a bounded multiple so the requested number of agent-to-agent messages
    // can still be returned when a human has recently been chatting.
    const candidates = await ctx.db
      .query('messages')
      .withIndex('by_world', (q) => q.eq('worldId', args.worldId))
      .order('desc')
      .take(limit * 4);
    const archivedConversations = new Map();
    const missingConversationIds = [
      ...new Set(
        candidates
          .map((message) => message.conversationId)
          .filter((id) => !activeConversations.has(id)),
      ),
    ];
    await Promise.all(
      missingConversationIds.map(async (id) => {
        const conversation = await ctx.db
          .query('archivedConversations')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', id))
          .unique();
        if (conversation) {
          archivedConversations.set(id, conversation);
        }
      }),
    );

    const person = (id: string): ActivityPerson => ({
      playerId: id,
      name: names.get(id) ?? 'Unknown citizen',
    });
    const participantsByConversation = new Map<string, string[]>();
    for (const [id, conversation] of activeConversations) {
      participantsByConversation.set(
        id,
        conversation.participants.map((participant) => participant.playerId),
      );
    }
    for (const [id, conversation] of archivedConversations) {
      participantsByConversation.set(id, conversation.participants);
    }
    const messages = buildTownSpeechMessages({
      candidates,
      participantsByConversation,
      activeConversationIds: new Set(activeConversations.keys()),
      agentPlayerIds,
      names,
      limit,
    });

    const liveConversations = world.conversations
      .filter(
        (conversation) =>
          conversation.participants.length === 2 &&
          conversation.participants.every(
            (participant) =>
              agentPlayerIds.has(participant.playerId) &&
              participant.status.kind === 'participating',
          ),
      )
      .map((conversation) => ({
        id: conversation.id,
        participants: conversation.participants.map((participant) => person(participant.playerId)),
        latestMessageAt: conversation.lastMessage?.timestamp,
        typing:
          conversation.isTyping && agentPlayerIds.has(conversation.isTyping.playerId)
            ? {
                ...person(conversation.isTyping.playerId),
                since: conversation.isTyping.since,
              }
            : undefined,
      }))
      .sort((left, right) => (right.latestMessageAt ?? 0) - (left.latestMessageAt ?? 0));

    return { messages, liveConversations };
  },
});

export const writeMessage = mutation({
  args: {
    worldId: v.id('worlds'),
    conversationId,
    messageUuid: v.string(),
    playerId,
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      conversationId: args.conversationId,
      author: args.playerId,
      messageUuid: args.messageUuid,
      text: args.text,
      worldId: args.worldId,
    });
    await insertInput(ctx, args.worldId, 'finishSendingMessage', {
      conversationId: args.conversationId,
      playerId: args.playerId,
      timestamp: Date.now(),
    });
  },
});
