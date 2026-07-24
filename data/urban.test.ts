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

describe('urban Injective Trade Town map', () => {
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

  test('removes the three decorative buildings selected for open space', () => {
    const buildingIds = new Set(buildings.map((building) => building.id));
    expect(buildingIds).not.toContain('enterprise_townhouse');
    expect(buildingIds).not.toContain('artisan_house');
    expect(buildingIds).not.toContain('fishermans_house');
  });

  test('keeps the café block as open grass instead of irregular paving', () => {
    const terrain = bgtiles[1];
    const cafe = buildings.find((building) => building.id === 'market_cafe');

    expect(cafe?.rect).toEqual({ x: 9, y: 24, width: 6, height: 5 });
    expect(cafe?.entrance).toEqual({ x: 12, y: 28 });
    expect(terrain[12][22]).toBe(-1);
    expect(terrain[1][23]).toBe(-1);
    expect(terrain[8][27]).toBe(-1);
    expect(terrain[15][29]).toBe(-1);
    expect(terrain[12][30]).toBe(-1);
  });

  test('aligns the Knowledge Quarter and Enterprise Gardens façades', () => {
    const newsBureau = buildings.find((building) => building.id === 'news_bureau');
    const fundHouse = buildings.find((building) => building.id === 'fund_house');
    const acme = buildings.find((building) => building.id === 'acme_headquarters');
    const nova = buildings.find((building) => building.id === 'nova_laboratory');

    expect(newsBureau?.rect).toEqual({ x: 11, y: 11, width: 5, height: 6 });
    expect(newsBureau?.rect.y).toBe(fundHouse?.rect.y);
    expect(nova?.rect.y).toBe(38);
    expect(nova?.entrance.y).toBe(acme?.entrance.y);
  });

  test('moves the crude depot beside the road and clears its paved apron', () => {
    const terrain = bgtiles[1];
    const crudeDepot = buildings.find((building) => building.id === 'crude_depot');
    const watchtower = buildings.find((building) => building.id === 'east_watchtower');

    expect(crudeDepot?.rect).toEqual({ x: 49, y: 36, width: 8, height: 5 });
    expect(crudeDepot?.entrance).toEqual({ x: 53, y: 40 });
    expect(watchtower?.rect).toEqual({ x: 58, y: 36, width: 3, height: 7 });
    expect(watchtower?.entrance).toEqual({ x: 59, y: 42 });
    expect(watchtower!.rect.x - (crudeDepot!.rect.x + crudeDepot!.rect.width)).toBe(1);
    expect(terrain[48][37]).toBe(-1);
    expect(terrain[58][39]).toBe(-1);
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

  test('restores the street beside the crude depot after removing the infill house', () => {
    const terrain = bgtiles[1];
    for (let x = 43; x <= 44; x++) {
      for (let y = 41; y <= 44; y++) {
        expect(terrain[x][y]).toBe(517);
        expect(isBlocked(x, y)).toBe(false);
      }
    }
  });

  test('keeps Exchange Square horizontally symmetric with grass buffers', () => {
    const terrain = bgtiles[1];
    for (let dx = 0; dx <= 7; dx++) {
      for (let dy = 0; dy <= 7; dy++) {
        expect(terrain[30 - dx][21 - dy]).toBe(terrain[30 + dx][21 - dy]);
        expect(terrain[30 - dx][21 + dy]).toBe(terrain[30 + dx][21 + dy]);
      }
    }
    for (const x of [21, 22, 23, 24, 36, 37]) {
      expect(terrain[x][28]).toBe(-1);
    }
  });

  test('replaces the square barricades with flower beds', () => {
    const details = bgtiles[3];
    for (const [x, y] of [
      [23, 17],
      [24, 17],
      [36, 17],
      [37, 17],
      [23, 25],
      [24, 25],
      [36, 25],
      [37, 25],
    ]) {
      expect(details[x][y]).toBe(659);
      expect(isBlocked(x, y)).toBe(true);
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
