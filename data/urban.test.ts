import {
  bgtiles,
  buildings,
  mapheight,
  mapwidth,
  objmap,
  safeSpawnPoints,
  screenxtiles,
  screenytiles,
} from './urban';

function isBlocked(x: number, y: number) {
  return objmap.some((layer) => layer[Math.floor(x)][Math.floor(y)] !== -1);
}

describe('urban Trade Town map', () => {
  test('all tile layers match the exported dimensions', () => {
    expect(mapwidth).toBe(64);
    expect(mapheight).toBe(48);
    expect(screenxtiles).toBe(mapwidth);
    expect(screenytiles).toBe(mapheight);

    for (const layer of [...bgtiles, ...objmap]) {
      expect(layer).toHaveLength(mapwidth);
      for (const column of layer) expect(column).toHaveLength(mapheight);
    }
  });

  test('reserved entrances and migration spawn points remain walkable', () => {
    for (const building of buildings) {
      expect(isBlocked(building.entrance.x, building.entrance.y)).toBe(false);
    }
    for (const point of safeSpawnPoints) {
      expect(isBlocked(point.x, point.y)).toBe(false);
    }
  });

  test('building footprints collide everywhere except their entrance', () => {
    for (const building of buildings) {
      for (const { x, y, width, height } of building.footprint) {
        for (let px = x; px < x + width; px++) {
          for (let py = y; py < y + height; py++) {
            if (px === building.entrance.x && py === building.entrance.y) continue;
            expect(isBlocked(px, py)).toBe(true);
          }
        }
      }
    }
  });

  test('decorative infill stays visual-only and unlabeled', () => {
    const decorativeBuildings = buildings.filter((building) => building.decorative);
    expect(decorativeBuildings.length).toBeGreaterThanOrEqual(10);
    expect(
      decorativeBuildings.every(
        (building) => building.mapLabel === '' && building.futureCapabilities.length === 0,
      ),
    ).toBe(true);
  });

  test('uses varied one, two and three-storey building profiles', () => {
    expect(new Set(buildings.map((building) => building.stories))).toEqual(
      new Set([1, 2, 3]),
    );
  });

  test('keeps the café-side north-south street continuous', () => {
    const terrain = bgtiles[1];
    for (let x = 17; x <= 20; x++) {
      for (let y = 22; y <= 32; y++) {
        expect(terrain[x][y]).toBe(517);
      }
    }
  });

  test('makes Exchange Square centered and bilaterally symmetric', () => {
    const terrain = bgtiles[1];
    for (let dx = 0; dx <= 7; dx++) {
      for (let dy = 0; dy <= 7; dy++) {
        expect(terrain[30 - dx][21 - dy]).toBe(terrain[30 + dx][21 + dy]);
        expect(terrain[30 - dx][21 + dy]).toBe(terrain[30 + dx][21 - dy]);
      }
    }
  });

  test('contains no canal or water tiles', () => {
    const terrain = bgtiles[1];
    for (const column of terrain) {
      expect(column).not.toContain(520);
      expect(column).not.toContain(521);
    }
  });
});
