import { CREATE_ME_DEFAULT_DRAFT } from '../../shared/createMe';
import { pandaDayViewDashboard } from './demoData';
import {
  augmentDashboardWithMe,
  buildMeSimulation,
  getMeAgentName,
  type MeSimulationInput,
} from './meSimulation';

const me: MeSimulationInput = {
  draft: {
    ...CREATE_ME_DEFAULT_DRAFT,
    displayName: 'Veylor',
    scenarios: ['market_crash', 'crowd_fomo'],
    scenarioAnswers: {
      market_crash: 'measured' as const,
      crowd_fomo: 'measured' as const,
    },
  },
  textureUrl: '/assets/trade-town/characters/mira.png',
  version: 3,
};

describe('Create ME market simulation', () => {
  const symbol = pandaDayViewDashboard.markets[0].symbol;

  test('adds the user Agent as the ninth simulated citizen', () => {
    const dashboard = augmentDashboardWithMe(pandaDayViewDashboard, me, symbol);
    const user = dashboard.traders.find((trader) => trader.isUser);

    expect(dashboard.traders).toHaveLength(9);
    expect(user).toMatchObject({
      name: 'Veylor',
      kind: 'ai',
      role: 'User financial digital twin',
      avatarUrl: me.textureUrl,
      focusSymbols: [symbol],
    });
    expect(user?.evidence).toContain('profile:me:v3');
    expect(
      dashboard.events.some(
        (event) => event.actor === 'Veylor' && event.title.includes('ME'),
      ),
    ).toBe(true);
  });

  test('is deterministic and reconciles the user portfolio with its simulated executions', () => {
    const market = pandaDayViewDashboard.markets[0];
    const first = buildMeSimulation(market, me);
    const second = buildMeSimulation(market, me);
    const fills = first.executions.filter((execution) => execution.type === 'fill');

    expect(second).toEqual(first);
    expect(fills).toHaveLength(first.trader.tradeCount);
    expect(
      first.executions.filter((execution) => execution.type === 'risk_rejected'),
    ).toHaveLength(first.trader.riskRejections);
    expect(first.trader.navEnd - first.trader.navStart).toBeCloseTo(first.trader.pnl, 2);
    expect(first.executions.every((execution) => execution.isSimulated)).toBe(true);
  });

  test('recomputes town totals and avoids a name collision with a built-in Agent', () => {
    const colliding = {
      ...me,
      draft: { ...me.draft, displayName: pandaDayViewDashboard.traders[0].name },
    };
    const dashboard = augmentDashboardWithMe(pandaDayViewDashboard, colliding, symbol);
    const user = dashboard.traders.find((trader) => trader.isUser)!;

    expect(user.name).toBe(`${pandaDayViewDashboard.traders[0].name} · ME`);
    expect(dashboard.summary.aum).toBeCloseTo(
      dashboard.traders.reduce((sum, trader) => sum + trader.navEnd, 0),
      2,
    );
    expect(getMeAgentName('Mira Chen', ['Mira Chen'])).toBe('Mira Chen · ME');
  });
});
