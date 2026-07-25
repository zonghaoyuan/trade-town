import { DEFAULT_INITIAL_AGENT_NAV } from '../../shared/finance';
import { buildPandaMarketsAtDay, pandaHistoricalMarket } from './pandaMarket';
import { buildPandaSimulationRun } from './pandaSimulation';

describe('Panda agent replay', () => {
  const run = buildPandaSimulationRun(pandaHistoricalMarket.market);

  it('is deterministic for the same historical market snapshot', () => {
    expect(buildPandaSimulationRun(pandaHistoricalMarket.market)).toEqual(run);
    expect(run.runId).toContain('002594-SZ-20251231');
  });

  it('generates all eight agent views and portfolios from 002594.SZ', () => {
    expect(run.traders).toHaveLength(8);
    expect(run.traders.every((trader) => trader.currency === 'CNY')).toBe(true);
    expect(
      run.traders.every(
        (trader) =>
          trader.focusSymbols.length === 1 &&
          trader.focusSymbols[0] === '002594.SZ' &&
          trader.positions.every((position) => position.symbol === '002594.SZ'),
      ),
    ).toBe(true);

    const buyCount = run.traders.filter((trader) => trader.action === 'BUY').length;
    const sellCount = run.traders.filter((trader) => trader.action === 'SELL').length;
    const holdCount = run.traders.filter((trader) => trader.action === 'HOLD').length;

    expect(run.sentiment).toMatchObject({
      bulls: buyCount,
      bears: sellCount,
      holds: holdCount,
    });
  });

  it('keeps every order simulated and reconciles executions with portfolios', () => {
    expect(run.executions.length).toBeGreaterThan(0);
    expect(
      run.executions.every(
        (execution) =>
          execution.symbol === '002594.SZ' &&
          execution.priceUnit === 'CNY' &&
          execution.isSimulated,
      ),
    ).toBe(true);

    for (const trader of run.traders) {
      expect(
        run.executions.filter(
          (execution) => execution.agentName === trader.name && execution.type === 'fill',
        ),
      ).toHaveLength(trader.tradeCount);
      expect(
        run.executions.filter(
          (execution) => execution.agentName === trader.name && execution.type === 'risk_rejected',
        ),
      ).toHaveLength(trader.riskRejections);
    }
  });

  it('derives the town summary from generated portfolio and fill records', () => {
    const fills = run.executions.filter((execution) => execution.type === 'fill');

    expect(run.summary.aum).toBeCloseTo(
      run.traders.reduce((sum, trader) => sum + trader.navEnd, 0),
      2,
    );
    expect(run.summary.volume).toBeCloseTo(
      fills.reduce((sum, fill) => sum + fill.quantity * fill.price, 0),
      2,
    );
    expect(JSON.stringify(run)).not.toContain('ACME');
  });

  it('starts every agent with the same one-million CNY NAV', () => {
    const firstDayRun = buildPandaSimulationRun(buildPandaMarketsAtDay(0)[0].market);

    expect(firstDayRun.traders).toHaveLength(8);
    expect(
      firstDayRun.traders.every(
        (trader) =>
          trader.navStart === DEFAULT_INITIAL_AGENT_NAV &&
          trader.navEnd === DEFAULT_INITIAL_AGENT_NAV,
      ),
    ).toBe(true);
  });

  it('changes the NAV ranking as historical prices and paper trades advance', () => {
    const early = buildPandaSimulationRun(buildPandaMarketsAtDay(20)[0].market);
    const later = buildPandaSimulationRun(buildPandaMarketsAtDay(120)[0].market);
    const ranking = (value: typeof early) =>
      [...value.traders]
        .sort((left, right) => right.navEnd - left.navEnd)
        .map((trader) => trader.name);

    expect(ranking(later)).not.toEqual(ranking(early));
    expect(later.executions.every((execution) => execution.occurredAt !== undefined)).toBe(true);
  });
});
