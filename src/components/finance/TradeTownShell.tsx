import { ReactNode, useEffect, useRef, useState } from 'react';
import type {
  DashboardExecution,
  DashboardTrader,
  TradeTownDashboard,
} from '../../finance/demoData';
import type { TownActivityFeed } from '../../../shared/activity';
import PixelCandles from './PixelCandles';
import PixelAvatar from './PixelAvatar';
import PixelMarketIcon from './PixelMarketIcon';
import TownActivityPanel from './TownActivityPanel';

type ViewMode = 'overview' | 'immersive';
type Drawer = 'markets' | 'agents' | 'activity';
type AgentTab = 'belief' | 'portfolio' | 'risk' | 'trades';

export type FocusedTownCitizen = {
  requestId: number;
  name: string;
  role: string;
  pnl: number;
  avatarIndex: number;
  pnlSource: 'simulated' | 'verified';
};

type TownRenderState = {
  focusedCitizen: FocusedTownCitizen | null;
};

export default function TradeTownShell({
  dashboard,
  dayViewDashboard,
  activityFeed,
  town,
  townControls,
}: {
  dashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  activityFeed: TownActivityFeed;
  town: ReactNode | ((state: TownRenderState) => ReactNode);
  townControls?: ReactNode;
  townMode?: 'live' | 'preview';
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(
    dayViewDashboard.markets[0]?.symbol ?? 'ACME',
  );
  const [selectedAgent, setSelectedAgent] = useState(dayViewDashboard.traders[0]?.name ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [agentDetailOpen, setAgentDetailOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ name: string; requestId: number } | null>(
    null,
  );
  const focusRequestId = useRef(0);

  const activeDashboard = dayViewDashboard;
  const market =
    dayViewDashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    dayViewDashboard.markets[0];
  const trader =
    activeDashboard.traders.find((candidate) => candidate.name === selectedAgent) ??
    activeDashboard.traders[0];
  const immersive = viewMode === 'immersive';

  useEffect(() => {
    const symbolExists = activeDashboard.markets.some(
      (candidate) => candidate.symbol === selectedSymbol,
    );
    if (!symbolExists) {
      setSelectedSymbol(dayViewDashboard.markets[0]?.symbol ?? '');
    }
    if (!activeDashboard.traders.some((candidate) => candidate.name === selectedAgent)) {
      setSelectedAgent(activeDashboard.traders[0]?.name ?? '');
    }
    setFocusRequest(null);
    setAgentDetailOpen(false);
  }, [activeDashboard, dayViewDashboard, selectedAgent, selectedSymbol]);

  useEffect(() => {
    document.body.classList.toggle('town-immersive-open', immersive);
    return () => document.body.classList.remove('town-immersive-open');
  }, [immersive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (agentDetailOpen) {
        setAgentDetailOpen(false);
      } else if (helpOpen) {
        setHelpOpen(false);
      } else if (drawer) {
        setDrawer(null);
      } else if (focusRequest) {
        setFocusRequest(null);
      } else if (immersive) {
        setViewMode('overview');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agentDetailOpen, drawer, focusRequest, helpOpen, immersive]);

  const toggleView = () => {
    setDrawer(null);
    setViewMode((current) => (current === 'overview' ? 'immersive' : 'overview'));
  };

  const focusCitizen = (name: string) => {
    focusRequestId.current += 1;
    setSelectedAgent(name);
    setFocusRequest({ name, requestId: focusRequestId.current });
    if (drawer === 'agents') setDrawer(null);
  };

  const focusedTrader = focusRequest
    ? activeDashboard.traders.find((candidate) => candidate.name === focusRequest.name)
    : undefined;
  const focusedTraderIndex = focusedTrader
    ? Math.max(
        0,
        activeDashboard.traders.findIndex((candidate) => candidate.name === focusedTrader.name),
      )
    : 0;
  const focusedFinancialRecord = focusedTrader
    ? resolveAgentFinancialRecord(
        focusedTrader,
        dashboard.traders.find((candidate) => candidate.name === focusedTrader.name),
        dashboard,
        focusedTraderIndex,
      )
    : undefined;
  const focusedCitizen: FocusedTownCitizen | null = focusedTrader
    ? {
        requestId: focusRequest!.requestId,
        name: focusedTrader.name,
        role: focusedTrader.role,
        pnl: focusedFinancialRecord!.trader.pnl,
        pnlSource: focusedFinancialRecord!.kind,
        avatarIndex: focusedTraderIndex,
      }
    : null;
  const townContent = typeof town === 'function' ? town({ focusedCitizen }) : town;
  const stageTitle = 'PandaAI market data → agent reasoning → Injective records';

  return (
    <main
      className={`pixel-town-shell ${immersive ? 'is-immersive' : 'is-overview'}`}
      onPointerDownCapture={(event) => {
        if (!focusRequest) return;
        const target = event.target;
        if (target instanceof Element && target.closest('[data-town-citizen-focus]')) return;
        setFocusRequest(null);
      }}
    >
      <div className="pixel-town-backdrop" aria-hidden="true" />

      <header className="pixel-town-header">
        <div className="pixel-brand">
          <img
            className="pixel-brand-seal"
            src="/assets/brand/inj-logo.png"
            alt=""
            aria-hidden="true"
          />
          <div className="pixel-brand-copy">
            <h1>INJ Trade Town</h1>
            <a
              className="pixel-brand-credit"
              href="https://www.pandaaiquant.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Market data by PandaAI — open the official PandaAI website"
            >
              <span className="pixel-panda-mark" aria-hidden="true">
                <img src="/assets/brand/pandaai-mark.svg" alt="" />
              </span>
              <span className="pixel-brand-credit-full">Market data by PandaAI</span>
              <span className="pixel-brand-credit-compact">PandaAI data</span>
            </a>
          </div>
        </div>

        <div className="pixel-header-actions">
          <button
            type="button"
            className="pixel-button pixel-button-small"
            onClick={() => setHelpOpen(true)}
          >
            <span>?</span> Help
          </button>
          <button
            type="button"
            className="pixel-button pixel-view-toggle"
            aria-pressed={immersive}
            onClick={toggleView}
          >
            <span aria-hidden="true">{immersive ? '↙' : '↗'}</span>
            {immersive ? 'Market view' : 'Full town'}
          </button>
        </div>
      </header>

      <div className="pixel-town-layout">
        <aside className="pixel-side-panel pixel-market-panel">
          <MarketBoard
            dashboard={dayViewDashboard}
            selectedSymbol={market?.symbol ?? ''}
            onSelect={setSelectedSymbol}
          />
        </aside>

        <section className="pixel-world-column">
          <div className="pixel-town-stage-wrap">
            <div className="pixel-stage-ribbon">
              <span>
                <i className="pixel-unified-dot" />
                {stageTitle}
              </span>
              <div className="pixel-stage-meta">
                {activeDashboard.errors.length > 0 && (
                  <span className="pixel-warning-count">
                    {activeDashboard.errors.length} data warnings
                  </span>
                )}
                <strong>{activeDashboard.traders.length} agents online</strong>
              </div>
            </div>
            <div className="pixel-town-stage">{townContent}</div>
            {townControls && (
              <div className="pixel-stage-controls" aria-label="Town controls">
                {townControls}
              </div>
            )}
          </div>

          <TownActivityPanel activity={activityFeed} contextEvents={dayViewDashboard.events} />
        </section>

        <aside className="pixel-side-panel pixel-agent-panel" aria-label="Town citizens">
          <AgentBoard
            testnetDashboard={dashboard}
            dayViewDashboard={dayViewDashboard}
            selectedAgent={trader?.name ?? ''}
            onSelect={focusCitizen}
            onOpenDetails={() => setAgentDetailOpen(true)}
          />
        </aside>
      </div>

      <nav className="pixel-hud-dock" aria-label="Town information">
        <button type="button" onClick={() => setDrawer(drawer === 'markets' ? null : 'markets')}>
          <span aria-hidden="true">▥</span> Markets
        </button>
        <button type="button" onClick={() => setDrawer(drawer === 'agents' ? null : 'agents')}>
          <span aria-hidden="true">♟</span> Citizens
        </button>
        <button type="button" onClick={() => setDrawer(drawer === 'activity' ? null : 'activity')}>
          <span aria-hidden="true">!</span> Activity
        </button>
      </nav>

      {drawer && (
        <section className={`pixel-hud-drawer drawer-${drawer}`} aria-label={`${drawer} panel`}>
          <button
            type="button"
            className="pixel-drawer-close"
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
          >
            ×
          </button>
          {drawer === 'markets' && (
            <MarketBoard
              dashboard={dayViewDashboard}
              selectedSymbol={market?.symbol ?? ''}
              onSelect={setSelectedSymbol}
            />
          )}
          {drawer === 'agents' && (
            <AgentBoard
              testnetDashboard={dashboard}
              dayViewDashboard={dayViewDashboard}
              selectedAgent={trader?.name ?? ''}
              onSelect={focusCitizen}
              onOpenDetails={() => {
                setDrawer(null);
                setAgentDetailOpen(true);
              }}
            />
          )}
          {drawer === 'activity' && (
            <TownActivityPanel
              activity={activityFeed}
              contextEvents={dayViewDashboard.events}
              drawer
            />
          )}
        </section>
      )}

      {agentDetailOpen &&
        trader &&
        (() => {
          const traderIndex = Math.max(
            0,
            activeDashboard.traders.findIndex((candidate) => candidate.name === trader.name),
          );
          const financialRecord = resolveAgentFinancialRecord(
            trader,
            dashboard.traders.find((candidate) => candidate.name === trader.name),
            dashboard,
            traderIndex,
          );
          const recordedExecutions = dashboard.executions.filter(
            (execution) => execution.agentName === trader.name,
          );
          return (
            <AgentDetailDrawer
              reasoningTrader={
                trader.financialState === 'verified' ? trader : financialRecord.trader
              }
              financialTrader={financialRecord.trader}
              recordKind={financialRecord.kind}
              avatarIndex={traderIndex}
              executions={
                recordedExecutions.length > 0
                  ? recordedExecutions
                  : createSimulatedExecutions(financialRecord.trader, traderIndex)
              }
              onClose={() => setAgentDetailOpen(false)}
            />
          );
        })()}

      {helpOpen && (
        <div
          className="pixel-modal-backdrop"
          role="presentation"
          onMouseDown={() => setHelpOpen(false)}
        >
          <section
            className="pixel-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="town-help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="pixel-drawer-close"
              aria-label="Close help"
              onClick={() => setHelpOpen(false)}
            >
              ×
            </button>
            <span className="pixel-modal-kicker">Town guide</span>
            <h2 id="town-help-title">Read the market as a town</h2>
            <p>
              PandaAI is the town&apos;s only market-data source. Agent reasoning, opinions, and
              conversations are produced by INJ Trade Town rather than supplied by PandaAI.
              Injective records orders, fills, positions, assets, and transaction proofs.
            </p>
            <div className="pixel-help-grid">
              <div>
                <strong>PandaAI market data</strong>
                <span>
                  Inspect sourced market bars, volume, and indicators without switching feeds.
                </span>
              </div>
              <div>
                <strong>Agent &amp; Injective records</strong>
                <span>
                  Agent outputs are generated by the town. Financial values use recorded data when
                  available and clearly labeled simulation values otherwise.
                </span>
              </div>
            </div>
            <div className="pixel-platform-credits" aria-label="Data and infrastructure sources">
              <span>Sources</span>
              <a href="https://www.pandaaiquant.com/data-service" target="_blank" rel="noreferrer">
                PandaAI Data
              </a>
              <a href="https://injective.com/" target="_blank" rel="noreferrer">
                Injective
              </a>
              <a
                href="https://testnet.explorer.injective.network/"
                target="_blank"
                rel="noreferrer"
              >
                Testnet Explorer
              </a>
            </div>
            <p className="pixel-asset-credits">
              Town visuals:{' '}
              <a href="https://kenney.nl/assets/rpg-urban-pack" target="_blank" rel="noreferrer">
                Kenney RPG Urban Pack
              </a>{' '}
              (CC0) · characters composed from the{' '}
              <a
                href="https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator"
                target="_blank"
                rel="noreferrer"
              >
                Universal LPC Generator
              </a>
              .{' '}
              <a
                href="/assets/trade-town/licenses/LPC-Selected-Assets-Credits.csv"
                target="_blank"
                rel="noreferrer"
              >
                Detailed art credits
              </a>
            </p>
            <p className="pixel-help-shortcuts">ESC closes panels · M toggles music</p>
          </section>
        </div>
      )}
    </main>
  );
}

function MarketBoard({
  dashboard,
  selectedSymbol,
  onSelect,
}: {
  dashboard: TradeTownDashboard;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const market =
    dashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    dashboard.markets[0];
  if (!market) return null;

  const latestCandle = market.candles[market.candles.length - 1];
  const hasSentiment = Boolean(market.sentiment);
  const quoteCurrency = market.quoteCurrency ?? 'CNY';

  return (
    <div className="pixel-board pixel-market-board">
      <div className="pixel-board-title">
        <h2>Markets</h2>
      </div>
      <div className="pixel-market-hero">
        <h3>{market.symbol}</h3>
        <div>
          <strong>{formatPrice(market.lastPrice)}</strong>
          {market.changePct === undefined ? (
            <small>—</small>
          ) : (
            <small className={market.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
              {market.changePct >= 0 ? '+' : ''}
              {market.changePct.toFixed(2)}%
            </small>
          )}
        </div>
        <small className="pixel-price-unit">{quoteCurrency} · DAY CLOSE</small>
      </div>
      <PixelCandles
        values={market.candles}
        symbol={market.symbol}
        periodLabel="DAY"
        sourceLabel="PANDAAI DATA"
      />
      <div className="pixel-indicator-row" aria-label={`${market.symbol} indicators`}>
        {market.indicators.map((indicator) => (
          <span key={indicator.label} className={`tone-${indicator.tone}`}>
            <small>{indicator.label}</small>
            <strong>{indicator.value}</strong>
          </span>
        ))}
      </div>
      <dl className="pixel-quote-grid pixel-quote-grid-four">
        <div>
          <dt>Day volume</dt>
          <dd>{formatOptionalCompact(market.volume)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{formatOptionalPrice(market.referencePrice)}</dd>
        </div>
        <div>
          <dt>Day high</dt>
          <dd>{formatPrice(latestCandle?.high ?? market.lastPrice)}</dd>
        </div>
        <div>
          <dt>Day low</dt>
          <dd>{formatPrice(latestCandle?.low ?? market.lastPrice)}</dd>
        </div>
      </dl>
      {hasSentiment ? (
        <div className="pixel-sentiment">
          <small className="pixel-sentiment-label">SIMULATED AGENT CONSENSUS</small>
          <div>
            <span className="pixel-up">▲ {market.sentiment!.bulls} BUY</span>
            <strong>
              {market.sentiment!.holds ? `${market.sentiment!.holds} HOLD · ` : ''}
              {market.sentiment!.camp}
            </strong>
            <span className="pixel-down">{market.sentiment!.bears} SELL ▼</span>
          </div>
          <i>
            <b
              className="pixel-sentiment-bulls"
              style={{
                width: `${(market.sentiment!.bulls / Math.max(1, market.sentiment!.bulls + market.sentiment!.bears)) * 100}%`,
              }}
            />
          </i>
        </div>
      ) : (
        <div className="pixel-sentiment pixel-sentiment-empty">Agent consensus unavailable</div>
      )}
      <div className="pixel-market-list pixel-market-list-single" aria-label="PandaAI markets">
        {dashboard.markets.map((item) => (
          <button
            type="button"
            key={item.symbol}
            onClick={() => onSelect(item.symbol)}
            className={item.symbol === selectedSymbol ? 'is-selected' : ''}
          >
            <PixelMarketIcon symbol={item.symbol} accent={item.accent} />
            <span className="pixel-market-copy">
              <strong>{item.symbol}</strong>
              <small>
                {formatPrice(item.lastPrice)} {item.quoteCurrency ?? 'CNY'} · {item.displayName}
              </small>
            </span>
            {item.changePct === undefined ? (
              <span>—</span>
            ) : (
              <span className={item.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
                {item.changePct >= 0 ? '+' : ''}
                {item.changePct.toFixed(2)}%
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentBoard({
  testnetDashboard,
  dayViewDashboard,
  selectedAgent,
  onSelect,
  onOpenDetails,
}: {
  testnetDashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  selectedAgent: string;
  onSelect: (name: string) => void;
  onOpenDetails: () => void;
}) {
  const pandaTrader =
    dayViewDashboard.traders.find((candidate) => candidate.name === selectedAgent) ??
    dayViewDashboard.traders[0];
  if (!pandaTrader) return null;
  const testnetTrader =
    testnetDashboard.traders.find((candidate) => candidate.name === pandaTrader.name) ??
    testnetDashboard.traders[0];
  const selectedFinancialRecord = resolveAgentFinancialRecord(
    pandaTrader,
    testnetTrader,
    testnetDashboard,
    Math.max(
      0,
      dayViewDashboard.traders.findIndex((candidate) => candidate.name === pandaTrader.name),
    ),
  );

  const traderIndex = Math.max(
    0,
    dayViewDashboard.traders.findIndex((candidate) => candidate.name === pandaTrader.name),
  );

  return (
    <div className="pixel-board pixel-agent-board">
      <div className="pixel-board-title">
        <span>{dayViewDashboard.traders.length} active agents</span>
        <h2>Citizens</h2>
      </div>
      <div className="pixel-agent-list">
        {dayViewDashboard.traders.map((agent, index) => {
          const financialRecord = resolveAgentFinancialRecord(
            agent,
            testnetDashboard.traders.find((candidate) => candidate.name === agent.name),
            testnetDashboard,
            index,
          );
          return (
            <button
              type="button"
              key={agent.name}
              className={agent.name === pandaTrader.name ? 'is-selected' : ''}
              data-town-citizen-focus
              onClick={() => onSelect(agent.name)}
            >
              <PixelAvatar index={index} />
              <span className="pixel-agent-identity">
                <strong>{agent.name}</strong>
                <small>{agent.role}</small>
              </span>
              <span className={`pixel-agent-state state-${financialRecord.kind}`}>
                <strong>
                  {financialRecord.trader.action} ·{' '}
                  {formatSignedCompact(financialRecord.trader.pnl)}{' '}
                  {financialRecord.trader.currency ?? 'CNY'}
                </strong>
                <small>
                  <i aria-hidden="true" />
                  {financialRecord.kind === 'verified' ? 'RECORDED' : 'SIMULATED'}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      <article className="pixel-agent-card pixel-agent-summary-card">
        <div className="pixel-agent-card-top">
          <span>Selected agent</span>
          <strong className={`state-${selectedFinancialRecord.kind}`}>
            {selectedFinancialRecord.kind === 'verified' ? 'RECORDED' : 'SIMULATED'}
          </strong>
        </div>
        <div className="pixel-agent-card-identity">
          <PixelAvatar index={traderIndex} />
          <div>
            <h3>{pandaTrader.name}</h3>
            <span>{pandaTrader.role}</span>
          </div>
          <em
            className={`pixel-action action-${selectedFinancialRecord.trader.action.toLowerCase()}`}
          >
            {selectedFinancialRecord.trader.action}
          </em>
        </div>
        <div className={`pixel-selected-agent-state state-${selectedFinancialRecord.kind}`}>
          <strong>Agent reasoning</strong>
          <p>{selectedFinancialRecord.trader.beliefAfter}</p>
        </div>
        <div className="pixel-agent-summary-metrics">
          <div>
            <span>Confidence</span>
            <strong>{Math.round(selectedFinancialRecord.trader.confidence * 100)}%</strong>
          </div>
          <div>
            <span>P&amp;L</span>
            <strong className={selectedFinancialRecord.trader.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
              {formatSignedCompact(selectedFinancialRecord.trader.pnl)}
            </strong>
          </div>
          <div>
            <span>Position</span>
            <strong>
              {selectedFinancialRecord.trader.positions.length > 0
                ? `${selectedFinancialRecord.trader.positions.length} OPEN`
                : 'FLAT'}
            </strong>
          </div>
        </div>
        <button type="button" className="pixel-detail-button" onClick={onOpenDetails}>
          View details
        </button>
      </article>
    </div>
  );
}

function resolveAgentFinancialRecord(
  profileTrader: DashboardTrader,
  recordedTrader: DashboardTrader | undefined,
  dashboard: TradeTownDashboard,
  index: number,
) {
  const hasRecordedFinancialState =
    dashboard.source === 'injective' &&
    Boolean(recordedTrader) &&
    (recordedTrader!.financialState === 'verified' ||
      recordedTrader!.tradeCount > 0 ||
      recordedTrader!.positions.length > 0 ||
      recordedTrader!.orderCount > 0);

  return hasRecordedFinancialState
    ? { trader: recordedTrader!, kind: 'verified' as const }
    : { trader: createSimulatedFinancialTrader(profileTrader, index), kind: 'simulated' as const };
}

function createSimulatedFinancialTrader(
  profileTrader: DashboardTrader,
  index: number,
): DashboardTrader {
  const actions: DashboardTrader['action'][] = ['BUY', 'SELL', 'BUY', 'HOLD'];
  const pnlValues = [1240, -680, 920, 340, -410, 760, -290, 510];
  const action = actions[index % actions.length];
  const pnl = pnlValues[index % pnlValues.length];
  const navStart = 100_000;
  const symbol = profileTrader.focusSymbols[0] ?? 'MARKET';

  return {
    ...profileTrader,
    currency: 'CNY',
    action,
    confidence: 0.62 + (index % 4) * 0.07,
    pnl,
    activity: `${action} signal under review`,
    beliefBefore: `${symbol} opened with mixed momentum and incomplete confirmation.`,
    beliefAfter:
      action === 'BUY'
        ? `Momentum and volume support a measured ${symbol} accumulation.`
        : action === 'SELL'
          ? `Risk has increased, so ${symbol} exposure should be reduced.`
          : `${symbol} remains inside the current risk band; maintain exposure.`,
    thesis: `Agent-generated ${action.toLowerCase()} view based on the current market context and risk profile.`,
    evidence: [`MARKET:${symbol}`, `AGENT:${profileTrader.name}:SIMULATED_DECISION`],
    navStart,
    navEnd: navStart + pnl,
    cash: 72_000 - index * 1_500,
    positions: [
      {
        symbol,
        quantity: 100 + index * 20,
        weightPct: 18 + index,
        pnl,
      },
    ],
    riskRejections: index % 3 === 0 ? 1 : 0,
    orderCount: action === 'HOLD' ? 0 : 1,
    tradeCount: action === 'HOLD' ? 0 : 1,
  };
}

function createSimulatedExecutions(trader: DashboardTrader, index: number): DashboardExecution[] {
  if (trader.action === 'HOLD') return [];
  return [
    {
      id: `simulated-${trader.name}-${index}`,
      time: 'LATEST',
      agentName: trader.name,
      symbol: trader.focusSymbols[0] ?? 'MARKET',
      type: 'fill',
      side: trader.action,
      quantity: trader.positions[0]?.quantity ?? 0,
      price: 0,
      priceUnit: trader.currency ?? 'CNY',
      state: 'SIMULATED',
      reason: 'Simulated fallback shown until a recorded Injective fill is available.',
    },
  ];
}

function AgentDetailDrawer({
  reasoningTrader,
  financialTrader,
  recordKind,
  avatarIndex,
  executions,
  onClose,
}: {
  reasoningTrader: DashboardTrader;
  financialTrader: DashboardTrader;
  recordKind: 'simulated' | 'verified';
  avatarIndex: number;
  executions: DashboardExecution[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<AgentTab>('belief');

  return (
    <div className="pixel-agent-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="pixel-agent-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${reasoningTrader.name} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="pixel-drawer-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <header>
          <PixelAvatar index={avatarIndex} />
          <div>
            <span>Agent intelligence</span>
            <h2>{reasoningTrader.name}</h2>
            <p>{reasoningTrader.role}</p>
          </div>
          <em className={`pixel-action action-${financialTrader.action.toLowerCase()}`}>
            {financialTrader.action}
          </em>
        </header>
        <div className={`pixel-agent-record-strip state-${recordKind}`}>
          <strong>Agent-generated reasoning</strong>
          <span>
            {recordKind === 'verified'
              ? 'Recorded orders, positions, and assets'
              : 'Simulated financial values · awaiting recorded data'}
          </span>
        </div>
        <nav className="pixel-agent-tabs" role="tablist" aria-label="Agent details">
          {(['belief', 'portfolio', 'risk', 'trades'] as AgentTab[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'is-active' : ''}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="pixel-agent-drawer-content">
          {tab === 'belief' && (
            <>
              <div className="pixel-belief-compare">
                <article>
                  <span>Before</span>
                  <p>{reasoningTrader.beliefBefore}</p>
                </article>
                <b aria-hidden="true">→</b>
                <article>
                  <span>After</span>
                  <p>{reasoningTrader.beliefAfter}</p>
                </article>
              </div>
              <section className="pixel-detail-section">
                <span>Decision thesis</span>
                <p>{reasoningTrader.thesis}</p>
              </section>
              <section className="pixel-detail-section">
                <span>Evidence</span>
                <div className="pixel-evidence-list">
                  {reasoningTrader.evidence.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              </section>
              <div className="pixel-detail-metrics">
                <Metric label="Action" value={reasoningTrader.action} />
                <Metric
                  label="Confidence"
                  value={`${Math.round(reasoningTrader.confidence * 100)}%`}
                />
                <Metric
                  label="Risk tolerance"
                  value={`${Math.round(reasoningTrader.riskTolerance * 100)}`}
                />
              </div>
            </>
          )}

          {tab === 'portfolio' && (
            <>
              <div className="pixel-detail-metrics">
                <Metric
                  label="Start NAV"
                  value={formatMoney(financialTrader.navStart, financialTrader.currency)}
                />
                <Metric
                  label="End NAV"
                  value={formatMoney(financialTrader.navEnd, financialTrader.currency)}
                />
                <Metric
                  label="PnL"
                  value={formatSignedCompact(financialTrader.pnl)}
                  tone={financialTrader.pnl >= 0 ? 'positive' : 'negative'}
                />
                <Metric
                  label="Cash"
                  value={formatMoney(financialTrader.cash, financialTrader.currency)}
                />
              </div>
              <section className="pixel-position-list">
                <div className="pixel-position-head">
                  <span>Symbol</span>
                  <span>Quantity</span>
                  <span>Weight</span>
                  <span>PnL</span>
                </div>
                {financialTrader.positions.length === 0 && (
                  <p className="pixel-no-positions">No open positions.</p>
                )}
                {financialTrader.positions.map((position) => (
                  <div key={position.symbol}>
                    <strong>{position.symbol}</strong>
                    <span>{position.quantity}</span>
                    <span>{position.weightPct}%</span>
                    <span className={position.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                      {formatSignedCompact(position.pnl)}
                    </span>
                  </div>
                ))}
              </section>
            </>
          )}

          {tab === 'risk' && (
            <>
              <div className="pixel-detail-metrics">
                <Metric
                  label="Risk tolerance"
                  value={`${Math.round(reasoningTrader.riskTolerance * 100)}`}
                />
                <Metric label="Risk rejections" value={String(financialTrader.riskRejections)} />
                <Metric label="Orders" value={String(financialTrader.orderCount)} />
                <Metric label="Fills" value={String(financialTrader.tradeCount)} />
              </div>
              <section className="pixel-detail-section">
                <span>Current risk reading</span>
                <p>
                  {financialTrader.riskRejections > 0
                    ? `${financialTrader.riskRejections} proposed order(s) were blocked or resized by deterministic portfolio rules.`
                    : 'All proposed orders remained inside cash, size, and concentration limits.'}
                </p>
              </section>
              <section className="pixel-detail-section">
                <span>Rule boundary</span>
                <p>
                  The model chooses an exposure change. Code calculates quantity, limit price, and
                  validates available cash and position concentration.
                </p>
              </section>
            </>
          )}

          {tab === 'trades' && (
            <section className="pixel-agent-executions">
              {executions.length === 0 && (
                <div className="pixel-empty-state">
                  <strong>No executions for this agent</strong>
                  <span>The current decision is HOLD or has not passed the risk gateway.</span>
                </div>
              )}
              {executions.map((execution) => (
                <article key={execution.id}>
                  <div>
                    <span>{execution.time}</span>
                    <em>{recordKind === 'verified' ? 'RECORDED' : 'SIMULATED'}</em>
                  </div>
                  <strong>
                    {execution.side} {execution.quantity} {execution.symbol}
                  </strong>
                  <p>
                    {execution.reason ??
                      `${formatPrice(execution.price)} ${
                        execution.priceUnit ?? financialTrader.currency ?? 'CNY'
                      } · ${execution.state}`}
                  </p>
                  {execution.reference && <code>{execution.reference}</code>}
                </article>
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div className={`pixel-detail-metric tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPrice(price: number) {
  return price >= 1000
    ? price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : price >= 1
      ? price.toFixed(2)
      : price >= 0.01
        ? price.toFixed(4)
        : price.toFixed(6);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatOptionalCompact(value: number | undefined) {
  return value === undefined ? '—' : formatCompact(value);
}

function formatOptionalPrice(value: number | undefined) {
  return value === undefined ? '—' : formatPrice(value);
}

function formatSignedCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
}

function formatMoney(value: number, currency = 'TOWNUSD') {
  return `${formatCompact(value)} ${currency}`;
}
