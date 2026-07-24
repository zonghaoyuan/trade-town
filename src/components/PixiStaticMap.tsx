import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { AnimatedSprite, WorldMap } from '../../convex/aiTown/worldMap';
import * as campfire from '../../data/animations/campfire.json';
import * as gentlesparkle from '../../data/animations/gentlesparkle.json';
import * as gentlewaterfall from '../../data/animations/gentlewaterfall.json';
import * as gentlesplash from '../../data/animations/gentlesplash.json';
import * as windmill from '../../data/animations/windmill.json';
import { buildings as urbanBuildings, tilesetpath as urbanTilesetPath } from '../../data/urban';

const animations = {
  'campfire.json': { spritesheet: campfire, url: '/assets/spritesheets/campfire.png' },
  'gentlesparkle.json': {
    spritesheet: gentlesparkle,
    url: '/assets/spritesheets/gentlesparkle32.png',
  },
  'gentlewaterfall.json': {
    spritesheet: gentlewaterfall,
    url: '/assets/spritesheets/gentlewaterfall32.png',
  },
  'windmill.json': { spritesheet: windmill, url: '/assets/spritesheets/windmill.png' },
  'gentlesplash.json': {
    spritesheet: gentlesplash,
    url: '/assets/spritesheets/gentlewaterfall32.png',
  },
};

export const PixiStaticMap = PixiComponent('StaticMap', {
  create: (props: { map: WorldMap; [k: string]: any }) => {
    const map = props.map;
    const numxtiles = Math.floor(map.tileSetDimX / map.tileDim);
    const numytiles = Math.floor(map.tileSetDimY / map.tileDim);
    const bt = PIXI.BaseTexture.from(map.tileSetUrl, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
    });

    const tiles = [];
    for (let x = 0; x < numxtiles; x++) {
      for (let y = 0; y < numytiles; y++) {
        tiles[x + y * numxtiles] = new PIXI.Texture(
          bt,
          new PIXI.Rectangle(x * map.tileDim, y * map.tileDim, map.tileDim, map.tileDim),
        );
      }
    }
    const screenxtiles = map.bgTiles[0].length;
    const screenytiles = map.bgTiles[0][0].length;

    const container = new PIXI.Container();
    const allLayers = [...map.bgTiles, ...map.objectTiles];

    // blit bg & object layers of map onto canvas
    for (let i = 0; i < screenxtiles * screenytiles; i++) {
      const x = i % screenxtiles;
      const y = Math.floor(i / screenxtiles);
      const xPx = x * map.tileDim;
      const yPx = y * map.tileDim;

      // Add all layers of backgrounds.
      for (const layer of allLayers) {
        const tileIndex = layer[x][y];
        // Some layers may not have tiles at this location.
        if (tileIndex === -1) continue;
        const ctile = new PIXI.Sprite(tiles[tileIndex]);
        ctile.x = xPx;
        ctile.y = yPx;
        container.addChild(ctile);
      }
    }

    if (map.tileSetUrl === urbanTilesetPath) {
      for (const building of urbanBuildings) {
        if (!building.mapLabel) continue;
        const labelContainer = new PIXI.Container();
        labelContainer.eventMode = 'none';
        const isLandmark = building.labelProminence === 'landmark';
        const isQuiet = building.labelProminence === 'quiet';

        const label = new PIXI.Text(building.mapLabel, {
          align: 'center',
          fill: isLandmark ? 0xffe8a6 : isQuiet ? 0xd9e0cf : 0xf4e2b7,
          fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: isLandmark ? 30 : isQuiet ? 22 : 26,
          fontWeight: 'bold',
          letterSpacing: isLandmark ? 1.6 : 1.2,
          lineHeight: isLandmark ? 32 : 28,
          stroke: 0x201d29,
          strokeThickness: isLandmark ? 6 : 5,
        });
        label.anchor.set(0.5);
        label.resolution = 2;
        label.roundPixels = true;

        const plate = new PIXI.Graphics();
        plate.lineStyle(isLandmark ? 2 : 1, 0x201d29, isQuiet ? 0.72 : 0.9);
        plate.beginFill(isLandmark ? 0x5b343a : 0x34404a, isQuiet ? 0.72 : 0.9);
        plate.drawRect(
          Math.round(-label.width / 2) - (isLandmark ? 8 : 6),
          Math.round(-label.height / 2) - (isLandmark ? 6 : 5),
          Math.round(label.width) + (isLandmark ? 16 : 12),
          Math.round(label.height) + (isLandmark ? 12 : 10),
        );
        plate.endFill();

        labelContainer.x = building.labelPoint.x * map.tileDim;
        labelContainer.y = building.labelPoint.y * map.tileDim;
        labelContainer.addChild(plate, label);
        container.addChild(labelContainer);
      }
    }

    // TODO: Add layers.
    const spritesBySheet = new Map<string, AnimatedSprite[]>();
    for (const sprite of map.animatedSprites) {
      const sheet = sprite.sheet;
      if (!spritesBySheet.has(sheet)) {
        spritesBySheet.set(sheet, []);
      }
      spritesBySheet.get(sheet)!.push(sprite);
    }
    for (const [sheet, sprites] of spritesBySheet.entries()) {
      const animation = (animations as any)[sheet];
      if (!animation) {
        console.error('Could not find animation', sheet);
        continue;
      }
      const { spritesheet, url } = animation;
      const texture = PIXI.BaseTexture.from(url, {
        scaleMode: PIXI.SCALE_MODES.NEAREST,
      });
      const spriteSheet = new PIXI.Spritesheet(texture, spritesheet);
      spriteSheet.parse().then(() => {
        for (const sprite of sprites) {
          const pixiAnimation = spriteSheet.animations[sprite.animation];
          if (!pixiAnimation) {
            console.error('Failed to load animation', sprite);
            continue;
          }
          const pixiSprite = new PIXI.AnimatedSprite(pixiAnimation);
          pixiSprite.animationSpeed = 0.1;
          pixiSprite.autoUpdate = true;
          pixiSprite.x = sprite.x;
          pixiSprite.y = sprite.y;
          pixiSprite.width = sprite.w;
          pixiSprite.height = sprite.h;
          container.addChild(pixiSprite);
          pixiSprite.play();
        }
      });
    }

    container.x = 0;
    container.y = 0;

    // Set the hit area manually to ensure `pointerdown` events are delivered to this container.
    container.interactive = true;
    container.hitArea = new PIXI.Rectangle(
      0,
      0,
      screenxtiles * map.tileDim,
      screenytiles * map.tileDim,
    );

    return container;
  },

  applyProps: (instance, oldProps, newProps) => {
    applyDefaultProps(instance, oldProps, newProps);
  },
});
