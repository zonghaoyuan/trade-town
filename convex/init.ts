import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { DatabaseReader, MutationCtx, mutation } from './_generated/server';
import { Descriptions } from '../data/characters';
import * as map from '../data/urban';
import { insertInput } from './aiTown/insertInput';
import { Id } from './_generated/dataModel';
import { createEngine } from './aiTown/main';
import { ENGINE_ACTION_DURATION } from './constants';
import { detectMismatchedLLMProvider } from './util/llm';
import {
  DEFAULT_VISIBLE_AI_AGENTS,
  MAX_AGENT_COUNT,
} from '../shared/finance';

const RETIRED_TRADER_NAMES = new Set(['Delta-7', 'Sigma-2']);

const init = mutation({
  args: {
    numAgents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    detectMismatchedLLMProvider();
    const { worldStatus, engine } = await getOrCreateDefaultWorld(ctx);
    await removeRetiredTradersFromSpatialWorld(ctx, worldStatus.worldId);
    if (worldStatus.status !== 'running') {
      console.warn(
        `Engine ${engine._id} is not active! Run "npx convex run testing:resume" to restart it.`,
      );
      return;
    }
    const shouldCreate = await shouldCreateAgents(
      ctx.db,
      worldStatus.worldId,
      worldStatus.engineId,
    );
    if (shouldCreate) {
      const requested =
        args.numAgents !== undefined ? args.numAgents : DEFAULT_VISIBLE_AI_AGENTS;
      const toCreate = Math.max(
        1,
        Math.min(Math.floor(requested), MAX_AGENT_COUNT, Descriptions.length),
      );
      for (let i = 0; i < toCreate; i++) {
        await insertInput(ctx, worldStatus.worldId, 'createAgent', {
          descriptionIndex: i % Descriptions.length,
          instance: Math.floor(i / Descriptions.length),
        });
      }
    }
    await ctx.scheduler.runAfter(0, (api as any).finance.bootstrapTown, {});
  },
});
export default init;

async function getOrCreateDefaultWorld(ctx: MutationCtx) {
  const now = Date.now();

  let worldStatus = await ctx.db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .unique();
  if (worldStatus) {
    const engine = (await ctx.db.get(worldStatus.engineId))!;
    const existingMap = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', worldStatus!.worldId))
      .unique();
    const mapChanged =
      existingMap &&
      (existingMap.tileSetUrl !== map.tilesetpath ||
        existingMap.width !== map.mapwidth ||
        existingMap.height !== map.mapheight);
    if (existingMap && mapChanged) {
      await ctx.db.patch(existingMap._id, {
        width: map.mapwidth,
        height: map.mapheight,
        tileSetUrl: map.tilesetpath,
        tileSetDimX: map.tilesetpxw,
        tileSetDimY: map.tilesetpxh,
        tileDim: map.tiledim,
        bgTiles: map.bgtiles,
        objectTiles: map.objmap,
        animatedSprites: map.animatedsprites,
      });
      await moveExistingPlayersToUrbanSpawnPoints(ctx, worldStatus.worldId);
    }
    await synchronizeTraderCharacters(ctx, worldStatus.worldId);
    return { worldStatus, engine };
  }

  const engineId = await createEngine(ctx);
  const engine = (await ctx.db.get(engineId))!;
  const worldId = await ctx.db.insert('worlds', {
    nextId: 0,
    agents: [],
    conversations: [],
    players: [],
  });
  const worldStatusId = await ctx.db.insert('worldStatus', {
    engineId: engineId,
    isDefault: true,
    lastViewed: now,
    status: 'running',
    worldId: worldId,
  });
  worldStatus = (await ctx.db.get(worldStatusId))!;
  await ctx.db.insert('maps', {
    worldId,
    width: map.mapwidth,
    height: map.mapheight,
    tileSetUrl: map.tilesetpath,
    tileSetDimX: map.tilesetpxw,
    tileSetDimY: map.tilesetpxh,
    tileDim: map.tiledim,
    bgTiles: map.bgtiles,
    objectTiles: map.objmap,
    animatedSprites: map.animatedsprites,
  });
  await ctx.scheduler.runAfter(0, internal.aiTown.main.runStep, {
    worldId,
    generationNumber: engine.generationNumber,
    maxDuration: ENGINE_ACTION_DURATION,
  });
  return { worldStatus, engine };
}

async function moveExistingPlayersToUrbanSpawnPoints(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const world = await ctx.db.get(worldId);
  if (!world || world.players.length === 0) return;

  const players = world.players.map((player, index) => {
    const stationaryPlayer = { ...player };
    delete stationaryPlayer.pathfinding;
    return {
      ...stationaryPlayer,
      position: map.safeSpawnPoints[index % map.safeSpawnPoints.length],
      facing: { dx: 0, dy: 1 },
      speed: 0,
    };
  });
  await ctx.db.patch(worldId, { players });
}

async function synchronizeTraderCharacters(ctx: MutationCtx, worldId: Id<'worlds'>) {
  const desiredByName = new Map(
    Descriptions.map((description) => [description.name, description.character]),
  );
  const existingDescriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();

  for (const description of existingDescriptions) {
    const desiredCharacter = desiredByName.get(description.name);
    if (desiredCharacter && description.character !== desiredCharacter) {
      await ctx.db.patch(description._id, { character: desiredCharacter });
    }
  }
}

/**
 * Older worlds may still contain the two retired liquidity profiles as spatial
 * residents. Remove those named players without touching the eight AI citizens.
 */
async function removeRetiredTradersFromSpatialWorld(
  ctx: MutationCtx,
  worldId: Id<'worlds'>,
) {
  const playerDescriptions = await ctx.db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  const staleDescriptions = playerDescriptions.filter((description) =>
    RETIRED_TRADER_NAMES.has(description.name),
  );
  if (staleDescriptions.length === 0) return;

  const removedPlayerIds = new Set(
    staleDescriptions.map((description) => description.playerId),
  );
  const world = await ctx.db.get(worldId);
  if (!world) return;

  const removedAgentIds = new Set(
    world.agents
      .filter((agent) => removedPlayerIds.has(agent.playerId))
      .map((agent) => agent.id),
  );
  const conversations = world.conversations.filter((conversation) =>
    conversation.participants.every(
      (participant) => !removedPlayerIds.has(participant.playerId),
    ),
  );
  const historicalLocations = world.historicalLocations?.filter(
    (location) => !removedPlayerIds.has(location.playerId),
  );

  await ctx.db.patch(worldId, {
    players: world.players.filter((player) => !removedPlayerIds.has(player.id)),
    agents: world.agents.filter((agent) => !removedAgentIds.has(agent.id)),
    conversations,
    ...(historicalLocations ? { historicalLocations } : {}),
  });

  for (const description of staleDescriptions) {
    await ctx.db.delete(description._id);
  }
  const agentDescriptions = await ctx.db
    .query('agentDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId))
    .collect();
  for (const description of agentDescriptions) {
    if (removedAgentIds.has(description.agentId)) {
      await ctx.db.delete(description._id);
    }
  }
}

async function shouldCreateAgents(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  engineId: Id<'engines'>,
) {
  const world = await db.get(worldId);
  if (!world) {
    throw new Error(`Invalid world ID: ${worldId}`);
  }
  if (world.agents.length > 0) {
    return false;
  }
  const unactionedJoinInputs = await db
    .query('inputs')
    .withIndex('byInputNumber', (q) => q.eq('engineId', engineId))
    .order('asc')
    .filter((q) => q.eq(q.field('name'), 'createAgent'))
    .filter((q) => q.eq(q.field('returnValue'), undefined))
    .first();
  if (unactionedJoinInputs) {
    return false;
  }
  return true;
}
