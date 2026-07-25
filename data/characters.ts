import type { ISpritesheetData } from 'pixi.js';
import { TOWN_TRADERS } from '../shared/finance';

const roamingTraders = TOWN_TRADERS.filter((trader) => trader.kind === 'ai');
const characterByIndex = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
const characterAssetByIndex = [
  'mira',
  'theo',
  'imani',
  'sora',
  'omar',
  'lin',
  'jules',
  'neha',
];

/**
 * Standalone LPC walk sheets contain 9 frames in each 64px row:
 * up, left, down, right. Frame names include the character key so PIXI's
 * shared texture cache never aliases two citizens.
 */
function lpcWalkSheet(characterKey: string): ISpritesheetData {
  const frames: ISpritesheetData['frames'] = {};
  const animations: Record<string, string[]> = {};
  const rowByDirection = {
    up: 0,
    left: 1,
    down: 2,
    right: 3,
  };

  for (const [direction, row] of Object.entries(rowByDirection)) {
    animations[direction] = [];
    for (let frame = 0; frame < 9; frame++) {
      const frameName = `${characterKey}-${direction}-${frame}`;
      frames[frameName] = {
        frame: { x: frame * 64, y: row * 64, w: 64, h: 64 },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0 },
        sourceSize: { w: 64, h: 64 },
      };
      animations[direction].push(frameName);
    }
  }

  return {
    frames,
    animations,
    meta: {
      scale: '1',
    },
  };
}

export const Descriptions = roamingTraders.map((trader, index) => ({
  name: trader.name,
  character: characterByIndex[index],
  identity: `${trader.name} is the town's ${trader.role}. ${trader.style} Form beliefs from news, conversations, portfolio constraints, and confirmed market data. Distinguish facts from opinions.`,
  plan: `Protect portfolio solvency while monitoring ${trader.focusSymbols.join(
    ', ',
  )}. Only treat a position as changed after an Injective Testnet fill is confirmed.`,
  finance: trader,
}));

export const characters = characterByIndex.map((name, index) => {
  const asset = characterAssetByIndex[index];
  return {
    name,
    textureUrl: `/assets/trade-town/characters/${asset}.png`,
    spritesheetData: lpcWalkSheet(asset),
    speed: 0.12,
  };
});

// Characters move at 0.75 tiles per second.
export const movementSpeed = 0.75;
