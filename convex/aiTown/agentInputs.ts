import { v } from 'convex/values';
import { agentId, conversationId, parseGameId } from './ids';
import { Player, activity } from './player';
import { Conversation, conversationInputs } from './conversation';
import { movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { point } from '../util/types';
import { Descriptions } from '../../data/characters';
import { AgentDescription } from './agentDescription';
import { Agent } from './agent';
import { PlayerDescription } from './playerDescription';
import { characters } from '../../data/characters';

export const agentInputs = {
  finishRememberConversation: inputHandler({
    args: {
      operationId: v.string(),
      agentId,
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} isn't remembering ${args.operationId}`);
      } else {
        delete agent.inProgressOperation;
        delete agent.toRemember;
      }
      return null;
    },
  }),
  finishDoSomething: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      destination: v.optional(point),
      invitee: v.optional(v.id('players')),
      activity: v.optional(activity),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} didn't have ${args.operationId} in progress`);
        return null;
      }
      delete agent.inProgressOperation;
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Couldn't find player: ${inviteeId}`);
        }
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
      }
      if (!args.destination && !args.activity) {
        // A pathfinding agent just completed its one social check for this
        // route. Record it even when no invitee was selected so we do not
        // schedule the same check again on every one-second engine tick.
        agent.lastInviteAttempt = now;
      }
      if (args.destination) {
        delete player.activity;
        movePlayer(game, now, player, args.destination);
      }
      if (args.activity) {
        player.activity = args.activity;
      }
      return null;
    },
  }),
  agentFinishSendingMessage: inputHandler({
    args: {
      agentId,
      conversationId,
      timestamp: v.number(),
      operationId: v.string(),
      leaveConversation: v.boolean(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Couldn't find player: ${agent.playerId}`);
      }
      const conversationId = parseGameId('conversations', args.conversationId);
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Couldn't find conversation: ${conversationId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} wasn't sending a message ${args.operationId}`);
        return null;
      }
      delete agent.inProgressOperation;
      conversationInputs.finishSendingMessage.handler(game, now, {
        playerId: agent.playerId,
        conversationId: args.conversationId,
        timestamp: args.timestamp,
      });
      if (args.leaveConversation) {
        conversation.leave(game, now, player);
      }
      return null;
    },
  }),
  createAgent: inputHandler({
    args: {
      descriptionIndex: v.number(),
      instance: v.optional(v.number()),
    },
    handler: (game, now, args) => {
      const description = Descriptions[args.descriptionIndex];
      const instance = args.instance ?? 0;
      const name = instance === 0 ? description.name : `${description.name} ${instance + 1}`;
      const playerId = Player.join(game, now, name, description.character, description.identity);
      const agentId = game.allocId('agents');
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: description.identity,
          plan: description.plan,
        }),
      );
      return { agentId };
    },
  }),
  upsertUserAgent: inputHandler({
    args: {
      tokenIdentifier: v.string(),
      name: v.string(),
      character: v.string(),
      description: v.string(),
      textureUrl: v.optional(v.string()),
      identity: v.string(),
      plan: v.string(),
    },
    handler: (game, now, args) => {
      if (!characters.find((character) => character.name === args.character)) {
        throw new Error(`Invalid character: ${args.character}`);
      }

      let player = [...game.world.players.values()].find(
        (candidate) => candidate.human === args.tokenIdentifier,
      );
      if (!player) {
        const playerId = Player.join(
          game,
          now,
          args.name,
          args.character,
          args.description,
          args.tokenIdentifier,
        );
        player = game.world.players.get(playerId)!;
      }

      game.playerDescriptions.set(
        player.id,
        new PlayerDescription({
          playerId: player.id,
          name: args.name,
          character: args.character,
          description: args.description,
          textureUrl: args.textureUrl,
        }),
      );
      player.lastInput = now;

      let agent = [...game.world.agents.values()].find(
        (candidate) => candidate.playerId === player!.id,
      );
      if (!agent) {
        const agentId = game.allocId('agents');
        agent = new Agent({
          id: agentId,
          playerId: player.id,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        });
        game.world.agents.set(agentId, agent);
      }

      game.agentDescriptions.set(
        agent.id,
        new AgentDescription({
          agentId: agent.id,
          identity: args.identity,
          plan: args.plan,
        }),
      );
      game.descriptionsModified = true;
      return { playerId: player.id, agentId: agent.id };
    },
  }),
};
