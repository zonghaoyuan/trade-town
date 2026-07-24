/**
 * Trade Town: Financial Harbor.
 *
 * The layout combines compact European harbor blocks, a Paris-like civic
 * axis, Barcelona-inspired pedestrian interiors, and a Copenhagen-style
 * public waterfront. Buildings remain visual, collision-aware shells so later
 * interaction work can attach to stable IDs and entrances.
 */

export const mapVersion = 'kenney-urban-v5';
export const tilesetpath = `/assets/trade-town/kenney-urban-32.png?v=${mapVersion}`;
export const tiledim = 32;
export const screenxtiles = 64;
export const screenytiles = 48;
export const tilesetpxw = 864;
export const tilesetpxh = 800;

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type BuildingStyle = 'copper' | 'sandstone' | 'blue' | 'brick' | 'slate' | 'industrial';
type LabelProminence = 'landmark' | 'district' | 'quiet';
type Architecture = 'gable' | 'civic' | 'industrial';
type RoofForm = 'steep' | 'dutch' | 'cross' | 'industrial' | 'tower';

export type UrbanBuilding = {
  id: string;
  name: string;
  mapLabel: string;
  district: string;
  rect: Rect;
  footprint: Rect[];
  entrance: Point;
  labelPoint: Point;
  labelProminence: LabelProminence;
  style: BuildingStyle;
  architecture: Architecture;
  stories: 1 | 2 | 3;
  roofForm: RoofForm;
  decorative: boolean;
  currentFunctionality: 'visual_only';
  futureCapabilities: string[];
};

const buildingProfiles: Record<string, Pick<UrbanBuilding, 'stories' | 'roofForm'>> = {
  injective_exchange: { stories: 3, roofForm: 'dutch' },
  town_central_bank: { stories: 3, roofForm: 'dutch' },
  news_bureau: { stories: 3, roofForm: 'cross' },
  fund_house: { stories: 3, roofForm: 'dutch' },
  market_cafe: { stories: 2, roofForm: 'cross' },
  harbor_residences: { stories: 2, roofForm: 'steep' },
  acme_headquarters: { stories: 3, roofForm: 'dutch' },
  nova_laboratory: { stories: 2, roofForm: 'cross' },
  chain_gateway_station: { stories: 3, roofForm: 'dutch' },
  risk_surveillance: { stories: 2, roofForm: 'steep' },
  aurum_depot: { stories: 1, roofForm: 'industrial' },
  crude_depot: { stories: 1, roofForm: 'industrial' },
  blue_rowhouse: { stories: 3, roofForm: 'dutch' },
  teal_rowhouse: { stories: 2, roofForm: 'steep' },
  garden_shop: { stories: 1, roofForm: 'steep' },
  harbor_inn: { stories: 3, roofForm: 'cross' },
  clock_house: { stories: 3, roofForm: 'dutch' },
  market_archive: { stories: 2, roofForm: 'steep' },
  gateway_chapel: { stories: 2, roofForm: 'cross' },
  gate_lodge: { stories: 1, roofForm: 'steep' },
  customs_house: { stories: 2, roofForm: 'dutch' },
  east_watchtower: { stories: 3, roofForm: 'tower' },
};

const visualBuilding = (
  building: Omit<UrbanBuilding, 'currentFunctionality' | 'stories' | 'roofForm'>,
): UrbanBuilding => ({
  ...building,
  ...(buildingProfiles[building.id] ?? { stories: 2, roofForm: 'steep' }),
  currentFunctionality: 'visual_only',
});

export const buildings: UrbanBuilding[] = [
  visualBuilding({
    id: 'injective_exchange',
    name: 'Injective Exchange',
    mapLabel: 'INJ交易所',
    district: 'Exchange Square',
    rect: { x: 25, y: 7, width: 11, height: 7 },
    footprint: [
      { x: 25, y: 7, width: 11, height: 6 },
      { x: 25, y: 13, width: 3, height: 1 },
      { x: 33, y: 13, width: 3, height: 1 },
    ],
    entrance: { x: 30, y: 12 },
    labelPoint: { x: 30.5, y: 9.5 },
    labelProminence: 'landmark',
    style: 'copper',
    architecture: 'civic',
    decorative: false,
    futureCapabilities: ['order entry', 'fill verification', 'market selection'],
  }),
  visualBuilding({
    id: 'town_central_bank',
    name: 'Town Central Bank',
    mapLabel: '中央银行',
    district: 'Exchange Square',
    rect: { x: 27, y: 29, width: 8, height: 5 },
    footprint: [{ x: 27, y: 29, width: 8, height: 5 }],
    entrance: { x: 31, y: 33 },
    labelPoint: { x: 31, y: 31 },
    labelProminence: 'district',
    style: 'sandstone',
    architecture: 'civic',
    decorative: false,
    futureCapabilities: ['balances', 'treasury', 'settlement status'],
  }),
  visualBuilding({
    id: 'news_bureau',
    name: 'News Bureau',
    mapLabel: '报社',
    district: 'Knowledge Quarter',
    rect: { x: 11, y: 11, width: 5, height: 6 },
    footprint: [{ x: 11, y: 11, width: 5, height: 6 }],
    entrance: { x: 13, y: 16 },
    labelPoint: { x: 13.5, y: 13.5 },
    labelProminence: 'district',
    style: 'sandstone',
    architecture: 'gable',
    decorative: false,
    futureCapabilities: ['news feed', 'source inspection', 'belief catalysts'],
  }),
  visualBuilding({
    id: 'fund_house',
    name: 'Fund House',
    mapLabel: '星港基金',
    district: 'Knowledge Quarter',
    rect: { x: 3, y: 11, width: 7, height: 6 },
    footprint: [{ x: 3, y: 11, width: 7, height: 6 }],
    entrance: { x: 6, y: 16 },
    labelPoint: { x: 6.5, y: 13.5 },
    labelProminence: 'district',
    style: 'brick',
    architecture: 'gable',
    decorative: false,
    futureCapabilities: ['portfolio view', 'fund mandates', 'allocation review'],
  }),
  visualBuilding({
    id: 'market_cafe',
    name: 'Market Café',
    mapLabel: '咖啡馆',
    district: 'Garden Promenade',
    rect: { x: 9, y: 24, width: 6, height: 5 },
    footprint: [{ x: 9, y: 24, width: 6, height: 5 }],
    entrance: { x: 12, y: 28 },
    labelPoint: { x: 12, y: 26 },
    labelProminence: 'quiet',
    style: 'brick',
    architecture: 'gable',
    decorative: false,
    futureCapabilities: ['conversation prompts', 'social summaries'],
  }),
  visualBuilding({
    id: 'harbor_residences',
    name: 'Harbor Residences',
    mapLabel: '港湾住宅',
    district: 'Garden Promenade',
    rect: { x: 2, y: 36, width: 5, height: 7 },
    footprint: [{ x: 2, y: 36, width: 5, height: 7 }],
    entrance: { x: 4, y: 42 },
    labelPoint: { x: 4.5, y: 39 },
    labelProminence: 'quiet',
    style: 'brick',
    architecture: 'gable',
    decorative: false,
    futureCapabilities: ['resident homes', 'agent routines'],
  }),
  visualBuilding({
    id: 'acme_headquarters',
    name: 'ACME Headquarters',
    mapLabel: 'ACME 总部',
    district: 'Enterprise Gardens',
    rect: { x: 22, y: 37, width: 7, height: 6 },
    footprint: [{ x: 22, y: 37, width: 7, height: 6 }],
    entrance: { x: 25, y: 42 },
    labelPoint: { x: 25.5, y: 39.5 },
    labelProminence: 'district',
    style: 'sandstone',
    architecture: 'civic',
    decorative: false,
    futureCapabilities: ['company profile', 'equity news', 'issuer events'],
  }),
  visualBuilding({
    id: 'nova_laboratory',
    name: 'NOVA Laboratory',
    mapLabel: 'NOVA 实验室',
    district: 'Enterprise Gardens',
    rect: { x: 33, y: 38, width: 7, height: 5 },
    footprint: [{ x: 33, y: 38, width: 7, height: 5 }],
    entrance: { x: 36, y: 42 },
    labelPoint: { x: 36.5, y: 40 },
    labelProminence: 'district',
    style: 'slate',
    architecture: 'civic',
    decorative: false,
    futureCapabilities: ['company profile', 'research notes', 'issuer events'],
  }),
  visualBuilding({
    id: 'chain_gateway_station',
    name: 'Chain Gateway Station',
    mapLabel: '',
    district: 'Gateway Quarter',
    rect: { x: 48, y: 3, width: 8, height: 6 },
    footprint: [{ x: 48, y: 3, width: 8, height: 6 }],
    entrance: { x: 52, y: 8 },
    labelPoint: { x: 52, y: 5.5 },
    labelProminence: 'landmark',
    style: 'blue',
    architecture: 'gable',
    decorative: false,
    futureCapabilities: ['gateway health', 'block height', 'transaction proofs'],
  }),
  visualBuilding({
    id: 'risk_surveillance',
    name: 'Risk & Surveillance',
    mapLabel: '金融监管局',
    district: 'Gateway Quarter',
    rect: { x: 51, y: 13, width: 7, height: 5 },
    footprint: [{ x: 51, y: 13, width: 7, height: 5 }],
    entrance: { x: 54, y: 17 },
    labelPoint: { x: 54.5, y: 15 },
    labelProminence: 'district',
    style: 'slate',
    architecture: 'civic',
    decorative: false,
    futureCapabilities: ['risk limits', 'alerts', 'agent surveillance'],
  }),
  visualBuilding({
    id: 'aurum_depot',
    name: 'AURUM Commodity Depot',
    mapLabel: '黄金仓库',
    district: 'Merchant Quay',
    rect: { x: 49, y: 26, width: 8, height: 5 },
    footprint: [{ x: 49, y: 26, width: 8, height: 5 }],
    entrance: { x: 53, y: 30 },
    labelPoint: { x: 53, y: 28 },
    labelProminence: 'district',
    style: 'industrial',
    architecture: 'industrial',
    decorative: false,
    futureCapabilities: ['commodity inventory', 'spot reference', 'supply news'],
  }),
  visualBuilding({
    id: 'crude_depot',
    name: 'CRUDE Commodity Depot',
    mapLabel: '原油仓库',
    district: 'Merchant Quay',
    rect: { x: 49, y: 36, width: 8, height: 5 },
    footprint: [{ x: 49, y: 36, width: 8, height: 5 }],
    entrance: { x: 53, y: 40 },
    labelPoint: { x: 53, y: 38 },
    labelProminence: 'district',
    style: 'industrial',
    architecture: 'industrial',
    decorative: false,
    futureCapabilities: ['commodity inventory', 'spot reference', 'supply news'],
  }),
  ...[
    {
      id: 'north_blue_house',
      name: 'North Blue House',
      district: 'Knowledge Quarter',
      rect: { x: 2, y: 3, width: 6, height: 5 },
      entrance: { x: 5, y: 7 },
      style: 'blue' as const,
    },
    {
      id: 'blue_rowhouse',
      name: 'Blue Rowhouse',
      district: 'Knowledge Quarter',
      rect: { x: 9, y: 3, width: 4, height: 6 },
      entrance: { x: 11, y: 8 },
      style: 'blue' as const,
    },
    {
      id: 'teal_rowhouse',
      name: 'Teal Rowhouse',
      district: 'Knowledge Quarter',
      rect: { x: 13, y: 4, width: 4, height: 5 },
      entrance: { x: 15, y: 8 },
      style: 'slate' as const,
    },
    {
      id: 'garden_shop',
      name: 'Garden Shop',
      district: 'Garden Promenade',
      rect: { x: 2, y: 24, width: 5, height: 5 },
      entrance: { x: 4, y: 28 },
      style: 'copper' as const,
    },
    {
      id: 'harbor_inn',
      name: 'Harbor Inn',
      district: 'Garden Promenade',
      rect: { x: 8, y: 36, width: 6, height: 7 },
      entrance: { x: 11, y: 42 },
      style: 'blue' as const,
    },
    {
      id: 'clock_house',
      name: 'Clock House',
      district: 'Exchange Square',
      rect: { x: 21, y: 29, width: 5, height: 5 },
      entrance: { x: 23, y: 33 },
      style: 'blue' as const,
    },
    {
      id: 'market_archive',
      name: 'Market Archive',
      district: 'Exchange Square',
      rect: { x: 36, y: 29, width: 4, height: 5 },
      entrance: { x: 38, y: 33 },
      style: 'brick' as const,
    },
    {
      id: 'gateway_chapel',
      name: 'Gateway Chapel',
      district: 'Gateway Quarter',
      rect: { x: 45, y: 13, width: 4, height: 5 },
      entrance: { x: 47, y: 17 },
      style: 'sandstone' as const,
    },
    {
      id: 'gate_lodge',
      name: 'Gate Lodge',
      district: 'Gateway Quarter',
      rect: { x: 56, y: 4, width: 4, height: 5 },
      entrance: { x: 58, y: 8 },
      style: 'copper' as const,
    },
    {
      id: 'customs_house',
      name: 'Customs House',
      district: 'Merchant Quay',
      rect: { x: 45, y: 26, width: 4, height: 5 },
      entrance: { x: 47, y: 30 },
      style: 'brick' as const,
    },
    {
      id: 'east_watchtower',
      name: 'East Watchtower',
      district: 'Merchant Quay',
      rect: { x: 58, y: 36, width: 3, height: 7 },
      entrance: { x: 59, y: 42 },
      style: 'sandstone' as const,
    },
  ].map(
    (building): UrbanBuilding =>
      visualBuilding({
        ...building,
        mapLabel: '',
        footprint: [building.rect],
        labelPoint: {
          x: building.rect.x + building.rect.width / 2,
          y: building.rect.y + building.rect.height / 2,
        },
        labelProminence: 'quiet',
        architecture: building.id === 'east_watchtower' ? 'civic' : 'gable',
        decorative: true,
        futureCapabilities: [],
      }),
  ),
];

export const districts = [
  { id: 'knowledge', name: 'Knowledge Quarter', rect: { x: 0, y: 0, width: 17, height: 22 } },
  { id: 'exchange', name: 'Exchange Square', rect: { x: 21, y: 4, width: 18, height: 31 } },
  { id: 'garden', name: 'Garden Promenade', rect: { x: 0, y: 22, width: 17, height: 26 } },
  { id: 'enterprise', name: 'Enterprise Gardens', rect: { x: 20, y: 34, width: 21, height: 14 } },
  { id: 'gateway', name: 'Gateway Quarter', rect: { x: 44, y: 0, width: 20, height: 23 } },
  { id: 'merchant_quay', name: 'Merchant Quay', rect: { x: 43, y: 23, width: 21, height: 25 } },
];

export const safeSpawnPoints: Point[] = [
  { x: 23, y: 19 },
  { x: 26, y: 22 },
  { x: 30, y: 18 },
  { x: 34, y: 23 },
  { x: 38, y: 19 },
  { x: 19, y: 24 },
  { x: 22, y: 28 },
  { x: 38, y: 28 },
  { x: 12, y: 31 },
  { x: 45, y: 23 },
];

const EMPTY = -1;
const BLOCKED_TILE = 486;

const TILE = {
  grass: 513,
  grassLight: 514,
  paver: 515,
  plaza: 516,
  stoneStreet: 517,
  curb: 524,
  boardwalk: 525,
  plazaBorder: 527,
  crossingHorizontal: 528,
  crossingVertical: 529,
  plazaMedallion: 531,
  industrialGround: 532,
  timberPromenade: 533,
  diagonalRoad: 537,
  pocketGarden: 538,
  parkPath: 539,
  exchangeSkylight: 600,
  bankDome: 601,
  antenna: 602,
  solarPanels: 603,
  roofGarden: 604,
  awningTeal: 605,
  awningAmber: 606,
  loadingDoor: 607,
  crane: 608,
  bollards: 609,
  roofHvac: 610,
  roofVents: 611,
  skylightTeal: 612,
  skylightAmber: 613,
  roofPipes: 614,
  roofPergola: 615,
  solarArray: 616,
  roofGardenStrip: 617,
  waterTank: 618,
  satelliteDish: 619,
  roofRed: 638,
  roofBlue: 641,
  roofTeal: 644,
  roofSlate: 647,
  dutchGableRed: 650,
  dutchGableBlue: 651,
  dutchGableTeal: 652,
  dutchGableSlate: 653,
  crossGableRed: 654,
  crossGableBlue: 655,
  crossGableTeal: 656,
  crossGableSlate: 657,
  chimney: 658,
  flowerBox: 659,
  treeTeal: 238,
  treeOrange: 346,
  lamp: 166,
  postBox: 167,
  hydrant: 162,
  crate: 274,
  barrel: 279,
} as const;

const buildingTileStart: Record<BuildingStyle, number> = {
  copper: 540,
  sandstone: 550,
  blue: 560,
  brick: 570,
  slate: 580,
  industrial: 590,
};

const roofSurfaceStart: Record<BuildingStyle, number> = {
  copper: 620,
  sandstone: 623,
  blue: 626,
  brick: 629,
  slate: 632,
  industrial: 635,
};

type RoofPalette = 'red' | 'blue' | 'teal' | 'slate';

const roofPaletteByStyle: Record<BuildingStyle, RoofPalette> = {
  copper: 'red',
  sandstone: 'teal',
  blue: 'blue',
  brick: 'red',
  slate: 'slate',
  industrial: 'slate',
};

const pitchedRoofStart: Record<RoofPalette, number> = {
  red: TILE.roofRed,
  blue: TILE.roofBlue,
  teal: TILE.roofTeal,
  slate: TILE.roofSlate,
};

const dutchGableTile: Record<RoofPalette, number> = {
  red: TILE.dutchGableRed,
  blue: TILE.dutchGableBlue,
  teal: TILE.dutchGableTeal,
  slate: TILE.dutchGableSlate,
};

const crossGableTile: Record<RoofPalette, number> = {
  red: TILE.crossGableRed,
  blue: TILE.crossGableBlue,
  teal: TILE.crossGableTeal,
  slate: TILE.crossGableSlate,
};

function makeLayer(fill = EMPTY) {
  return Array.from({ length: screenxtiles }, () => Array(screenytiles).fill(fill));
}

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < screenxtiles && y < screenytiles;
}

function fillRect(layer: number[][], rect: Rect, tile: number) {
  for (let x = rect.x; x < rect.x + rect.width; x++) {
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      if (inBounds(x, y)) layer[x][y] = tile;
    }
  }
}

function setTile(layer: number[][], x: number, y: number, tile: number) {
  if (inBounds(x, y)) layer[x][y] = tile;
}

function tileKey(x: number, y: number) {
  return `${x}:${y}`;
}

const ground = makeLayer(TILE.grass);
const terrain = makeLayer();
const structures = makeLayer();
const details = makeLayer();
const collision = makeLayer();

// Subtle land variations keep open space from reading as a single green slab.
for (let x = 0; x < screenxtiles; x++) {
  for (let y = 0; y < screenytiles; y++) {
    if ((x * 13 + y * 7) % 19 === 0) ground[x][y] = TILE.grassLight;
  }
}

function stoneStreet(rect: Rect) {
  fillRect(terrain, rect, TILE.stoneStreet);
}

// Exchange Square is a true 15×15 square with an 11×11 inset. Keeping both
// rectangles odd-sized gives the medallion an exact visual center.
fillRect(terrain, { x: 23, y: 14, width: 15, height: 15 }, TILE.plaza);
fillRect(terrain, { x: 25, y: 16, width: 11, height: 11 }, TILE.paver);

// Grass buffers separate the two side buildings from the civic square while
// preserving a horizontally balanced southern edge.
for (const x of [23, 24, 36, 37]) setTile(terrain, x, 28, EMPTY);

fillRect(terrain, { x: 19, y: 43, width: 22, height: 2 }, TILE.paver);
fillRect(terrain, { x: 43, y: 46, width: 21, height: 2 }, TILE.industrialGround);

// Draw streets last so pedestrian paving never overwrites a carriageway. The
// two halves of Market Street terminate cleanly at the civic square.
stoneStreet({ x: 17, y: 0, width: 4, height: 48 });
stoneStreet({ x: 0, y: 18, width: 23, height: 4 });
stoneStreet({ x: 38, y: 18, width: 26, height: 4 });
stoneStreet({ x: 41, y: 0, width: 4, height: 48 });
stoneStreet({ x: 41, y: 9, width: 23, height: 3 });
stoneStreet({ x: 39, y: 22, width: 25, height: 3 });
stoneStreet({ x: 0, y: 33, width: 64, height: 3 });
stoneStreet({ x: 0, y: 45, width: 64, height: 3 });

function buildingFootprint(building: UrbanBuilding) {
  const footprint = new Set<string>();
  for (const rect of building.footprint) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        footprint.add(tileKey(x, y));
      }
    }
  }
  return footprint;
}

function drawBuilding(building: UrbanBuilding) {
  const footprint = buildingFootprint(building);
  const base = buildingTileStart[building.style];
  const facadeRows = Math.min(building.stories, Math.max(1, building.rect.height - 2));
  const facadeTop = building.rect.y + building.rect.height - facadeRows;
  const roofPalette = roofPaletteByStyle[building.style];
  const roofModuleCount = building.rect.width >= 9 ? 2 : 1;
  const roofModules = Array.from({ length: roofModuleCount }, (_, moduleIndex) => {
    const start =
      building.rect.x + Math.floor((moduleIndex * building.rect.width) / roofModuleCount);
    const end =
      building.rect.x +
      Math.floor(((moduleIndex + 1) * building.rect.width) / roofModuleCount) -
      1;
    return { start, end, center: (start + end) / 2 };
  });

  for (const key of footprint) {
    const [x, y] = key.split(':').map(Number);
    const leftOpen = !footprint.has(tileKey(x - 1, y));
    const rightOpen = !footprint.has(tileKey(x + 1, y));
    const topOpen = !footprint.has(tileKey(x, y - 1));
    const horizontalVariant = leftOpen ? 0 : rightOpen ? 2 : 1;
    const isFacade = y >= facadeTop;
    const offset = isFacade
      ? 6 + horizontalVariant
      : topOpen
        ? horizontalVariant
        : 3 + horizontalVariant;

    structures[x][y] = base + offset;
    collision[x][y] = BLOCKED_TILE;

    if (!isFacade && building.roofForm !== 'industrial') {
      const module = roofModules.find(({ start, end }) => x >= start && x <= end)!;
      const roofVariant =
        Math.abs(x - module.center) < 0.6 ? 1 : x < module.center ? 0 : 2;
      details[x][y] = pitchedRoofStart[roofPalette] + roofVariant;
    } else if (!isFacade) {
      const surfacePattern =
        Math.abs(x * 37 + y * 61 + x * y * 7 + building.id.length * 11) % 13;
      if (surfacePattern < 3) {
        details[x][y] = roofSurfaceStart[building.style] + surfacePattern;
      }
    }
  }

  structures[building.entrance.x][building.entrance.y] = base + 9;
  collision[building.entrance.x][building.entrance.y] = EMPTY;

  const gableY = facadeTop - 1;
  if (building.roofForm === 'dutch' || building.roofForm === 'cross' || building.roofForm === 'tower') {
    for (const module of roofModules) {
      const x = Math.round(module.center);
      if (!footprint.has(tileKey(x, gableY))) continue;
      details[x][gableY] =
        building.roofForm === 'dutch'
          ? dutchGableTile[roofPalette]
          : crossGableTile[roofPalette];
    }
  }
}

for (const building of buildings) drawBuilding(building);

// Chimneys and flower boxes are deliberately sparse: the roof form stays
// legible, while façades still feel inhabited. Only depots keep modern roof
// utilities.
for (const [x, y, tile] of [
  [26, 8, TILE.chimney],
  [34, 9, TILE.chimney],
  [28, 29, TILE.chimney],
  [33, 29, TILE.chimney],
  [6, 4, TILE.chimney],
  [3, 6, TILE.flowerBox],
  [8, 11, TILE.chimney],
  [7, 15, TILE.flowerBox],
  [10, 24, TILE.chimney],
  [10, 27, TILE.flowerBox],
  [5, 37, TILE.chimney],
  [3, 41, TILE.flowerBox],
  [27, 37, TILE.chimney],
  [34, 38, TILE.chimney],
  [54, 3, TILE.chimney],
  [50, 7, TILE.flowerBox],
  [56, 13, TILE.chimney],
  [50, 27, TILE.roofPipes],
  [54, 28, TILE.roofHvac],
  [55, 27, TILE.roofVents],
  [50, 37, TILE.roofPipes],
  [55, 38, TILE.roofHvac],
  [52, 37, TILE.loadingDoor],

  [9, 3, TILE.chimney],
  [10, 7, TILE.flowerBox],
  [16, 4, TILE.chimney],
  [14, 7, TILE.flowerBox],
  [15, 11, TILE.chimney],
  [14, 15, TILE.flowerBox],
  [5, 24, TILE.chimney],
  [5, 27, TILE.flowerBox],
  [9, 36, TILE.chimney],
  [9, 41, TILE.flowerBox],
  [21, 29, TILE.chimney],
  [39, 30, TILE.chimney],
  [48, 13, TILE.chimney],
  [59, 4, TILE.chimney],
  [48, 26, TILE.chimney],
  [59, 36, TILE.antenna],
  [3, 28, TILE.flowerBox],
] as const) {
  setTile(details, x, y, tile);
}
setTile(details, 10, 28, TILE.awningTeal);
setTile(details, 14, 28, TILE.awningAmber);
setTile(details, 5, 28, TILE.awningTeal);

// A single centered medallion preserves the square's bilateral symmetry.
setTile(details, 30, 21, TILE.plazaMedallion);
setTile(collision, 30, 21, BLOCKED_TILE);

const trees: Array<[number, number, number]> = [
  [1, 2, TILE.treeTeal],
  [15, 2, TILE.treeOrange],
  [1, 12, TILE.treeOrange],
  [2, 30, TILE.treeOrange],
  [8, 30, TILE.treeTeal],
  [14, 29, TILE.treeOrange],
  [21, 24, TILE.treeTeal],
  [21, 36, TILE.treeOrange],
  [40, 31, TILE.treeTeal],
  [21, 42, TILE.treeTeal],
  [40, 42, TILE.treeOrange],
  [40, 3, TILE.treeTeal],
  [46, 6, TILE.treeOrange],
  [40, 27, TILE.treeOrange],
  [46, 31, TILE.treeTeal],
  [45, 1, TILE.treeTeal],
  [58, 1, TILE.treeOrange],
  [58, 13, TILE.treeTeal],
  [58, 26, TILE.treeOrange],
  [62, 2, TILE.treeTeal],
  [62, 14, TILE.treeOrange],
  [62, 28, TILE.treeTeal],
  [62, 40, TILE.treeOrange],
];
for (const [x, y, tile] of trees) {
  setTile(details, x, y, tile);
  setTile(collision, x, y, BLOCKED_TILE);
}

const streetFurniture: Array<[number, number, number]> = [
  [23, 17, TILE.flowerBox],
  [24, 17, TILE.flowerBox],
  [36, 17, TILE.flowerBox],
  [37, 17, TILE.flowerBox],
  [23, 25, TILE.flowerBox],
  [24, 25, TILE.flowerBox],
  [36, 25, TILE.flowerBox],
  [37, 25, TILE.flowerBox],
  [22, 15, TILE.lamp],
  [38, 15, TILE.lamp],
  [22, 27, TILE.lamp],
  [38, 27, TILE.lamp],
  [2, 17, TILE.postBox],
  [58, 21, TILE.hydrant],
  [46, 38, TILE.crate],
];
for (const [x, y, tile] of streetFurniture) {
  setTile(details, x, y, tile);
  setTile(collision, x, y, BLOCKED_TILE);
}

export const bgtiles = [ground, terrain, structures, details];
export const objmap = [collision];
export const animatedsprites: Array<{
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
  sheet: string;
  animation: string;
}> = [];

export const mapwidth = screenxtiles;
export const mapheight = screenytiles;
