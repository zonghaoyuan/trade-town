import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { insertInput } from './aiTown/insertInput';
import { DEFAULT_NAME } from './constants';
import {
  CREATE_ME_PRESETS,
  LPC_GENERATOR_COMMIT,
  CreateMeDraft,
  buildMeAgentNarrative,
  compileMeProfile,
  getCreateMePreset,
  getLpcWalkLayers,
  sanitizeCreateMeDraft,
} from '../shared/createMe';

const investmentGoal = v.union(
  v.literal('growth'),
  v.literal('income'),
  v.literal('preservation'),
  v.literal('learning'),
);
const horizon = v.union(v.literal('short'), v.literal('medium'), v.literal('long'));
const scenario = v.union(
  v.literal('market_crash'),
  v.literal('missed_rally'),
  v.literal('crowd_fomo'),
  v.literal('thesis_challenged'),
  v.literal('unexpected_cash'),
);
const appearanceMode = v.union(v.literal('preset'), v.literal('custom'));
const scenarioChoice = v.union(
  v.literal('cautious'),
  v.literal('measured'),
  v.literal('aggressive'),
);

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const discardUpload = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});

export const current = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', args.ownerId))
      .unique();
    if (!profile) return null;
    const [look, version] = await Promise.all([
      ctx.db
        .query('characterLooks')
        .withIndex('by_owner', (q) =>
          q.eq('ownerId', args.ownerId).eq('version', profile.activeVersion),
        )
        .unique(),
      ctx.db
        .query('userProfileVersions')
        .withIndex('by_owner', (q) =>
          q.eq('ownerId', args.ownerId).eq('version', profile.activeVersion),
        )
        .unique(),
    ]);
    return { profile, look, version };
  },
});

export const ensureAgent = mutation({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', args.ownerId))
      .unique();
    if (!profile) return null;
    const [version, look] = await Promise.all([
      ctx.db
        .query('userProfileVersions')
        .withIndex('by_owner', (q) =>
          q.eq('ownerId', profile.ownerId).eq('version', profile.activeVersion),
        )
        .unique(),
      ctx.db
        .query('characterLooks')
        .withIndex('by_owner', (q) =>
          q.eq('ownerId', profile.ownerId).eq('version', profile.activeVersion),
        )
        .unique(),
    ]);
    if (!version) return null;
    const narrative = buildMeAgentNarrative(profile.displayName, version.compiled);
    return await queueUserAgent(ctx, {
      name: profile.displayName,
      character: look?.character ?? profile.activeCharacter,
      description: narrative.description,
      textureUrl: look?.source === 'lpc_composed' ? look.textureUrl : undefined,
      identity: narrative.identity,
      plan: narrative.plan,
    });
  },
});

export const create = mutation({
  args: {
    ownerId: v.string(),
    requestId: v.string(),
    displayName: v.string(),
    presetId: v.string(),
    appearanceMode,
    skinTone: v.string(),
    hairStyle: v.string(),
    hairColor: v.string(),
    topStyle: v.string(),
    topColor: v.string(),
    bottomStyle: v.string(),
    bottomColor: v.string(),
    shoesStyle: v.string(),
    storageId: v.optional(v.id('_storage')),
    investmentGoal,
    horizon,
    maxDrawdownPct: v.number(),
    conviction: v.number(),
    socialInfluence: v.number(),
    lossAversion: v.number(),
    scenarios: v.array(scenario),
    scenarioAnswers: v.object({
      market_crash: v.optional(scenarioChoice),
      missed_rally: v.optional(scenarioChoice),
      crowd_fomo: v.optional(scenarioChoice),
      thesis_challenged: v.optional(scenarioChoice),
      unexpected_cash: v.optional(scenarioChoice),
    }),
  },
  handler: async (ctx, args) => {
    const ownerId = args.ownerId.trim();
    const requestId = args.requestId.trim();
    const displayName = args.displayName.trim().slice(0, 20);
    if (!ownerId || ownerId.length > 120) {
      throw new ConvexError('Invalid anonymous owner ID');
    }
    if (!displayName) {
      throw new ConvexError('请输入角色名称');
    }
    if (!requestId || requestId.length > 120) {
      throw new ConvexError('Invalid Create ME request ID');
    }
    const existingRequest = await ctx.db
      .query('userProfileVersions')
      .withIndex('by_request', (q) =>
        q.eq('ownerId', ownerId).eq('requestId', requestId),
      )
      .unique();
    if (existingRequest) {
      const look = await ctx.db
        .query('characterLooks')
        .withIndex('by_owner', (q) =>
          q.eq('ownerId', ownerId).eq('version', existingRequest.version),
        )
        .unique();
      const previousPreset =
        CREATE_ME_PRESETS.find((preset) => preset.id === existingRequest.presetId) ??
        CREATE_ME_PRESETS[0];
      const textureUrl = look?.textureUrl ?? previousPreset.textureUrl;
      const narrative = buildMeAgentNarrative(
        existingRequest.displayName,
        existingRequest.compiled,
      );
      const inputId = await queueUserAgent(ctx, {
        name: existingRequest.displayName,
        character: look?.character ?? previousPreset.character,
        description: narrative.description,
        textureUrl: look?.source === 'lpc_composed' ? textureUrl : undefined,
        identity: narrative.identity,
        plan: narrative.plan,
      });
      return {
        version: existingRequest.version,
        inputId,
        compiled: existingRequest.compiled,
        textureUrl,
        duplicate: true,
      };
    }
    const boundedInputs = [
      ['最大回撤', args.maxDrawdownPct, 5, 40],
      ['观点确信度', args.conviction, 0, 100],
      ['群体影响度', args.socialInfluence, 0, 100],
      ['损失厌恶度', args.lossAversion, 0, 100],
    ] as const;
    for (const [label, value, min, max] of boundedInputs) {
      if (!Number.isFinite(value) || value < min || value > max) {
        throw new ConvexError(`${label}超出允许范围`);
      }
    }
    const allowedPreset = CREATE_ME_PRESETS.find((preset) => preset.id === args.presetId);
    if (!allowedPreset) {
      throw new ConvexError('请选择有效的 LPC 角色形象');
    }
    if (args.appearanceMode === 'custom' && !args.storageId) {
      throw new ConvexError('自定义角色缺少已合成的 LPC 行走图');
    }

    const previous = await ctx.db
      .query('userProfiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .unique();
    const version = (previous?.activeVersion ?? 0) + 1;
    const draft: CreateMeDraft = sanitizeCreateMeDraft({
      displayName,
      presetId: allowedPreset.id,
      appearanceMode: args.appearanceMode,
      skinTone: args.skinTone as CreateMeDraft['skinTone'],
      hairStyle: args.hairStyle as CreateMeDraft['hairStyle'],
      hairColor: args.hairColor as CreateMeDraft['hairColor'],
      topStyle: args.topStyle as CreateMeDraft['topStyle'],
      topColor: args.topColor as CreateMeDraft['topColor'],
      bottomStyle: args.bottomStyle as CreateMeDraft['bottomStyle'],
      bottomColor: args.bottomColor as CreateMeDraft['bottomColor'],
      shoesStyle: args.shoesStyle as CreateMeDraft['shoesStyle'],
      investmentGoal: args.investmentGoal,
      horizon: args.horizon,
      maxDrawdownPct: args.maxDrawdownPct,
      conviction: args.conviction,
      socialInfluence: args.socialInfluence,
      lossAversion: args.lossAversion,
      scenarios: args.scenarios,
      scenarioAnswers: args.scenarioAnswers,
    });
    const compiled = compileMeProfile(draft);
    const preset = getCreateMePreset(draft.presetId);
    const customLayers = getLpcWalkLayers(draft);
    if (args.appearanceMode === 'custom') {
      const validCustomDraft =
        customLayers.length === 5 &&
        customLayers.every((layer) => layer.url.includes(LPC_GENERATOR_COMMIT));
      if (!validCustomDraft) {
        throw new ConvexError('LPC 图层配置不在项目白名单中');
      }
    }
    const textureUrl =
      args.appearanceMode === 'custom'
        ? await ctx.storage.getUrl(args.storageId!)
        : preset.textureUrl;
    if (!textureUrl) {
      throw new ConvexError('无法读取已上传的 LPC 行走图');
    }
    const now = Date.now();

    await Promise.all([
      ctx.db.insert('characterLooks', {
        ownerId,
        version,
        requestId,
        presetId: preset.id,
        character: preset.character,
        textureUrl,
        source:
          args.appearanceMode === 'custom' ? 'lpc_composed' : 'lpc_curated_preset',
        storageId: args.appearanceMode === 'custom' ? args.storageId : undefined,
        schemaVersion: 1,
        generatorCommit: LPC_GENERATOR_COMMIT,
        appearance:
          args.appearanceMode === 'custom'
            ? {
                skinTone: draft.skinTone,
                hairStyle: draft.hairStyle,
                hairColor: draft.hairColor,
                topStyle: draft.topStyle,
                topColor: draft.topColor,
                bottomStyle: draft.bottomStyle,
                bottomColor: draft.bottomColor,
                shoesStyle: draft.shoesStyle,
              }
            : undefined,
        licenseManifest:
          args.appearanceMode === 'custom'
            ? customLayers.map((layer) => layer.creditPath)
            : undefined,
        createdAt: now,
      }),
      ctx.db.insert('userProfileVersions', {
        ownerId,
        version,
        requestId,
        displayName,
        presetId: preset.id,
        inputs: {
          investmentGoal: draft.investmentGoal,
          horizon: draft.horizon,
          maxDrawdownPct: draft.maxDrawdownPct,
          conviction: draft.conviction,
          socialInfluence: draft.socialInfluence,
          lossAversion: draft.lossAversion,
          scenarios: draft.scenarios,
          scenarioAnswers: draft.scenarioAnswers,
        },
        compiled,
        createdAt: now,
      }),
    ]);

    if (previous) {
      await ctx.db.patch(previous._id, {
        displayName,
        activeVersion: version,
        activePresetId: preset.id,
        activeCharacter: preset.character,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('userProfiles', {
        ownerId,
        displayName,
        activeVersion: version,
        activePresetId: preset.id,
        activeCharacter: preset.character,
        createdAt: now,
        updatedAt: now,
      });
    }

    const narrative = buildMeAgentNarrative(displayName, compiled);
    const inputId = await queueUserAgent(ctx, {
      name: displayName,
      character: preset.character,
      description: narrative.description,
      textureUrl: args.appearanceMode === 'custom' ? textureUrl : undefined,
      identity: narrative.identity,
      plan: narrative.plan,
    });

    return { version, inputId, compiled, textureUrl, duplicate: false };
  },
});

async function queueUserAgent(
  ctx: Parameters<typeof insertInput>[0],
  agent: {
    name: string;
    character: string;
    description: string;
    textureUrl?: string;
    identity: string;
    plan: string;
  },
) {
  const worldStatus = await ctx.db
    .query('worldStatus')
    .filter((q) => q.eq(q.field('isDefault'), true))
    .first();
  if (!worldStatus) return null;
  return await insertInput(ctx, worldStatus.worldId, 'upsertUserAgent', {
    tokenIdentifier: DEFAULT_NAME,
    ...agent,
  });
}
