import { ReactNode, useEffect, useRef, useState } from 'react';
import type {
  DashboardExecution,
  DashboardTrader,
  TradeTownDashboard,
} from '../../finance/demoData';
import PixelCandles from './PixelCandles';
import PixelAvatar from './PixelAvatar';

type ViewMode = 'overview' | 'immersive';
type DataMode = 'panda_dayview' | 'injective_testnet';
type Drawer = 'markets' | 'agents' | 'events';
type ActivityTab = 'timeline' | 'social' | 'trades';
type AgentTab = 'belief' | 'portfolio' | 'risk' | 'trades';

export type FocusedTownCitizen = {
  requestId: number;
  name: string;
  role: string;
  pnl: number;
  avatarIndex: number;
};

type TownRenderState = {
  focusedCitizen: FocusedTownCitizen | null;
};

export default function TradeTownShell({
  dashboard,
  dayViewDashboard,
  town,
  townControls,
  townMode = 'preview',
}: {
  dashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  town: ReactNode | ((state: TownRenderState) => ReactNode);
  townControls?: ReactNode;
  townMode?: 'live' | 'preview';
}) {
  const [dataMode, setDataMode] = useState<DataMode>('panda_dayview');
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

  const activeDashboard = dataMode === 'panda_dayview' ? dayViewDashboard : dashboard;
  const market =
    activeDashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    activeDashboard.markets[0];
  const trader =
    activeDashboard.traders.find((candidate) => candidate.name === selectedAgent) ??
    activeDashboard.traders[0];
  const immersive = viewMode === 'immersive';

  useEffect(() => {
    if (!activeDashboard.markets.some((candidate) => candidate.symbol === selectedSymbol)) {
      setSelectedSymbol(activeDashboard.markets[0]?.symbol ?? '');
    }
    if (!activeDashboard.traders.some((candidate) => candidate.name === selectedAgent)) {
      setSelectedAgent(activeDashboard.traders[0]?.name ?? '');
    }
    setFocusRequest(null);
    setAgentDetailOpen(false);
  }, [activeDashboard, selectedAgent, selectedSymbol]);

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
  const focusedCitizen = focusedTrader
    ? {
        requestId: focusRequest!.requestId,
        name: focusedTrader.name,
        role: focusedTrader.role,
        pnl: focusedTrader.pnl,
        avatarIndex: Math.max(
          0,
          activeDashboard.traders.findIndex((candidate) => candidate.name === focusedTrader.name),
        ),
      }
    : null;
  const townContent = typeof town === 'function' ? town({ focusedCitizen }) : town;
  const modeTitle = dataMode === 'panda_dayview' ? 'Panda DayView' : 'Injective Testnet';
  const stageTitle =
    dataMode === 'panda_dayview'
      ? 'Panda daily market replay'
      : townMode === 'live'
        ? 'Convex town live'
        : 'Town preview';

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
          <span className="pixel-brand-seal">TT</span>
          <div>
            <h1>Trade Town</h1>
            <p>AI citizens · explainable markets</p>
          </div>
        </div>

        <div className="pixel-data-console">
          <div className="pixel-mode-switch" role="tablist" aria-label="Market data mode">
            <button
              type="button"
              role="tab"
              aria-selected={dataMode === 'panda_dayview'}
              className={dataMode === 'panda_dayview' ? 'is-active' : ''}
              onClick={() => setDataMode('panda_dayview')}
            >
              Panda DayView
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dataMode === 'injective_testnet'}
              className={dataMode === 'injective_testnet' ? 'is-active' : ''}
              onClick={() => setDataMode('injective_testnet')}
            >
              Testnet
            </button>
          </div>
          <div className="pixel-network">
            <span className={`pixel-network-light status-${activeDashboard.gatewayStatus}`} />
            <div>
              <strong>{modeTitle}</strong>
              <span>
                {activeDashboard.sourceLabel}
                {activeDashboard.blockHeight
                  ? ` · #${activeDashboard.blockHeight.toLocaleString()}`
                  : ` · ${formatClock(activeDashboard.asOf)}`}
              </span>
            </div>
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
            dashboard={activeDashboard}
            selectedSymbol={market?.symbol ?? ''}
            onSelect={setSelectedSymbol}
          />
        </aside>

        <section className="pixel-world-column">
          <div className="pixel-town-stage-wrap">
            <div className="pixel-stage-ribbon">
              <span>
                <i
                  className={
                    activeDashboard.source === 'preview' ? 'pixel-preview-dot' : 'pixel-live-dot'
                  }
                />
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
            {activeDashboard.source !== 'injective' && (
              <span className="pixel-preview-note">
                {dataMode === 'panda_dayview'
                  ? 'Panda DayView mock · adapter-ready'
                  : 'Testnet preview · no confirmed chain fills'}
              </span>
            )}
          </div>

          <TownSummary dashboard={activeDashboard} />
          <ActivityBoard dashboard={activeDashboard} />
        </section>

        <aside className="pixel-side-panel pixel-agent-panel" aria-label="Town citizens">
          <AgentBoard
            dashboard={activeDashboard}
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
        <button type="button" onClick={() => setDrawer(drawer === 'events' ? null : 'events')}>
          <span aria-hidden="true">!</span> Intel
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
              dashboard={activeDashboard}
              selectedSymbol={market?.symbol ?? ''}
              onSelect={setSelectedSymbol}
            />
          )}
          {drawer === 'agents' && (
            <AgentBoard
              dashboard={activeDashboard}
              selectedAgent={trader?.name ?? ''}
              onSelect={focusCitizen}
              onOpenDetails={() => {
                setDrawer(null);
                setAgentDetailOpen(true);
              }}
            />
          )}
          {drawer === 'events' && <ActivityBoard dashboard={activeDashboard} drawer />}
        </section>
      )}

      {agentDetailOpen && trader && (
        <AgentDetailDrawer
          trader={trader}
          avatarIndex={Math.max(
            0,
            activeDashboard.traders.findIndex((candidate) => candidate.name === trader.name),
          )}
          executions={activeDashboard.executions.filter(
            (execution) => execution.agentName === trader.name,
          )}
          onClose={() => setAgentDetailOpen(false)}
        />
      )}

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
              Panda DayView explains beliefs, portfolios, social influence, and simulated trades.
              Injective Testnet is reserved for verifiable orders, fills, balances, and proofs.
            </p>
            <div className="pixel-help-grid">
              <div>
                <strong>Panda DayView</strong>
                <span>Compare five markets and inspect why each agent changed its mind.</span>
              </div>
              <div>
                <strong>Testnet</strong>
                <span>Verify ACME orders and fills when the Injective gateway is connected.</span>
              </div>
            </div>
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

  const pandaMode = dashboard.dataMode === 'panda_dayview';

  return (
    <div className="pixel-board">
      <div className="pixel-board-title pixel-board-title-sourced">
        <div>
          <span>{pandaMode ? 'Five-market daily view' : 'On-chain spot market'}</span>
          <h2>Markets</h2>
        </div>
        <SourceBadge dashboard={dashboard} />
      </div>
      <div className="pixel-market-hero">
        <span>{market.assetClass}</span>
        <h3>
          {market.symbol} {pandaMode ? '' : '/ TOWNUSD'}
        </h3>
        <div>
          <strong>{formatPrice(market.lastPrice)}</strong>
          <small className={market.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.changePct >= 0 ? '+' : ''}
            {market.changePct.toFixed(2)}%
          </small>
        </div>
        <small className="pixel-price-unit">{pandaMode ? 'DAY CLOSE' : 'TOWNUSD'}</small>
      </div>
      <PixelCandles
        values={market.candles}
        symbol={market.symbol}
        periodLabel={pandaMode ? 'DAY' : '10S'}
        sourceLabel={pandaMode ? 'PANDA DATA' : 'TOWN EXCHANGE'}
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
          <dt>{pandaMode ? 'Day volume' : 'Run volume'}</dt>
          <dd>{formatCompact(market.volume)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{formatPrice(market.referencePrice)}</dd>
        </div>
        <div>
          <dt>{pandaMode ? 'Consensus' : 'Best bid'}</dt>
          <dd>
            {pandaMode
              ? `${market.sentiment.consensus}%`
              : formatPrice(Math.max(0, market.lastPrice - 0.04))}
          </dd>
        </div>
        <div>
          <dt>{pandaMode ? 'Divergence' : 'Best ask'}</dt>
          <dd>
            {pandaMode ? `${market.sentiment.divergence}%` : formatPrice(market.lastPrice + 0.04)}
          </dd>
        </div>
      </dl>
      {pandaMode ? (
        <div className="pixel-sentiment">
          <div>
            <span className="pixel-up">▲ {market.sentiment.bulls} bulls</span>
            <strong>{market.sentiment.camp}</strong>
            <span className="pixel-down">{market.sentiment.bears} bears ▼</span>
          </div>
          <i>
            <b
              className="pixel-sentiment-bulls"
              style={{
                width: `${(market.sentiment.bulls / Math.max(1, market.sentiment.bulls + market.sentiment.bears)) * 100}%`,
              }}
            />
          </i>
        </div>
      ) : (
        <div className="pixel-orderbook-preview">
          <span className="pixel-up">BID {formatPrice(market.lastPrice - 0.04)}</span>
          <strong>SPREAD 0.08</strong>
          <span className="pixel-down">ASK {formatPrice(market.lastPrice + 0.04)}</span>
        </div>
      )}
      <div className="pixel-market-list">
        {dashboard.markets.map((item) => (
          <button
            type="button"
            key={item.symbol}
            onClick={() => onSelect(item.symbol)}
            className={item.symbol === market.symbol ? 'is-selected' : ''}
          >
            <span className="pixel-market-gem" style={{ backgroundColor: item.accent }} />
            <span>
              <strong>{item.symbol}</strong>
              <small>
                {formatPrice(item.lastPrice)} · {item.displayName}
              </small>
            </span>
            <span className={item.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
              {item.changePct >= 0 ? '+' : ''}
              {item.changePct.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
      <div className="pixel-chain-rule">
        <span>{pandaMode ? '◇' : '◆'}</span>
        <p>
          <strong>{pandaMode ? 'Simulation boundary' : 'Chain truth'}</strong>
          {pandaMode
            ? 'DayView orders are simulated and never link to Explorer.'
            : 'Only confirmed Injective fills update official balances.'}
        </p>
      </div>
      {dashboard.marketMakers.length > 0 && (
        <div className="pixel-maker-row" aria-label="Liquidity providers">
          <span>Liquidity</span>
          {dashboard.marketMakers.map((maker) => (
            <strong key={maker.name}>
              <i /> {maker.name}
            </strong>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentBoard({
  dashboard,
  selectedAgent,
  onSelect,
  onOpenDetails,
}: {
  dashboard: TradeTownDashboard;
  selectedAgent: string;
  onSelect: (name: string) => void;
  onOpenDetails: () => void;
}) {
  const trader =
    dashboard.traders.find((candidate) => candidate.name === selectedAgent) ?? dashboard.traders[0];
  if (!trader) return null;

  const traderIndex = Math.max(
    0,
    dashboard.traders.findIndex((candidate) => candidate.name === trader.name),
  );

  return (
    <div className="pixel-board">
      <div className="pixel-board-title pixel-board-title-sourced">
        <div>
          <span>{dashboard.traders.length} agents · beliefs &amp; portfolios</span>
          <h2>Citizens</h2>
        </div>
        <SourceBadge dashboard={dashboard} />
      </div>
      <div className="pixel-agent-list">
        {dashboard.traders.map((agent, index) => (
          <button
            type="button"
            key={agent.name}
            className={agent.name === trader.name ? 'is-selected' : ''}
            data-town-citizen-focus
            onClick={() => onSelect(agent.name)}
          >
            <PixelAvatar index={index} />
            <span>
              <strong>{agent.name}</strong>
              <small>{agent.role}</small>
            </span>
            <span className="pixel-agent-state">
              <em className={`pixel-action action-${agent.action.toLowerCase()}`}>
                {agent.action}
              </em>
              <strong className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {formatSignedCompact(agent.pnl)}
              </strong>
            </span>
          </button>
        ))}
      </div>
      <article className="pixel-agent-card">
        <div className="pixel-agent-card-top">
          <span>Selected agent</span>
          <strong className={trader.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
            {formatSignedCompact(trader.pnl)}
          </strong>
        </div>
        <div className="pixel-agent-card-identity">
          <PixelAvatar index={traderIndex} />
          <div>
            <h3>{trader.name}</h3>
            <span>{trader.role}</span>
          </div>
          <em className={`pixel-action action-${trader.action.toLowerCase()}`}>{trader.action}</em>
        </div>
        <p>{trader.beliefAfter}</p>
        <div className="pixel-confidence">
          <span>Confidence</span>
          <i>
            <b style={{ width: `${trader.confidence * 100}%` }} />
          </i>
          <strong>{Math.round(trader.confidence * 100)}%</strong>
        </div>
        <div className="pixel-agent-activity">
          <i /> {trader.activity}
        </div>
        <button type="button" className="pixel-detail-button" onClick={onOpenDetails}>
          Open belief &amp; portfolio
        </button>
      </article>
    </div>
  );
}

function TownSummary({ dashboard }: { dashboard: TradeTownDashboard }) {
  const items = [
    ['Town AUM', formatCompact(dashboard.summary.aum)],
    ['Exposure', formatCompact(dashboard.summary.totalExposure)],
    [
      dashboard.dataMode === 'panda_dayview' ? 'Day volume' : 'Run volume',
      formatCompact(dashboard.summary.volume),
    ],
    ['Profitable', `${dashboard.summary.profitableAgents}/${dashboard.traders.length}`],
    ['Top agent', dashboard.summary.topAgent],
    ['Data issues', String(dashboard.errors.length)],
  ];

  return (
    <section className="pixel-town-summary" aria-label="Town summary">
      {items.map(([label, value]) => (
        <div
          key={label}
          className={
            label === 'Data issues' && dashboard.errors.length > 0 ? 'has-warning' : undefined
          }
          title={
            label === 'Data issues'
              ? dashboard.errors.map((error) => error.message).join('\n')
              : undefined
          }
        >
          <span>{label}</span>
          <strong>
            {value}
            {label === 'Top agent' && dashboard.summary.topReturnPct > 0
              ? ` +${dashboard.summary.topReturnPct.toFixed(2)}%`
              : ''}
          </strong>
        </div>
      ))}
    </section>
  );
}

function ActivityBoard({
  dashboard,
  drawer = false,
}: {
  dashboard: TradeTownDashboard;
  drawer?: boolean;
}) {
  const [tab, setTab] = useState<ActivityTab>('timeline');
  const count =
    tab === 'timeline'
      ? dashboard.events.length
      : tab === 'social'
        ? dashboard.social.length
        : dashboard.executions.length;

  return (
    <section className={`pixel-event-board ${drawer ? 'is-drawer' : ''}`}>
      <div className="pixel-board-title pixel-event-title">
        <div>
          <span>Cause, influence, and execution</span>
          <h2>Town intelligence</h2>
        </div>
        <div className="pixel-event-tabs" role="tablist" aria-label="Town intelligence sections">
          {(['timeline', 'social', 'trades'] as ActivityTab[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'is-active' : ''}
              onClick={() => setTab(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <strong>{count} records</strong>
      </div>

      {tab === 'timeline' && (
        <div className="pixel-event-track">
          {dashboard.events.map((event, index) => (
            <article key={event.id} className={`pixel-event event-${event.kind}`}>
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{event.time}</time>
              <strong>{event.title}</strong>
              <small>{event.actor}</small>
              <p>{event.detail}</p>
              {event.proof && <code>{event.proof}</code>}
            </article>
          ))}
        </div>
      )}

      {tab === 'social' && (
        <div className="pixel-event-track">
          {dashboard.social.map((item, index) => (
            <article key={item.id} className="pixel-event event-interaction">
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{item.time}</time>
              <strong>{item.title}</strong>
              <small>
                {item.actor} · {item.type}
              </small>
              <p>{item.detail}</p>
              <code>{item.impact}</code>
            </article>
          ))}
        </div>
      )}

      {tab === 'trades' && (
        <div className="pixel-event-track">
          {dashboard.executions.length === 0 && (
            <div className="pixel-empty-state">
              <strong>No confirmed executions</strong>
              <span>Connect the gateway or switch to Panda DayView simulation.</span>
            </div>
          )}
          {dashboard.executions.map((execution, index) => (
            <article key={execution.id} className={`pixel-event event-${execution.type}`}>
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{execution.time}</time>
              <strong>
                {execution.side} {execution.quantity} {execution.symbol}
              </strong>
              <small>
                {execution.agentName} · {execution.state}
              </small>
              <p>
                {execution.reason ??
                  `${formatPrice(execution.price)} TOWNUSD · ${
                    execution.isSimulated ? 'SIMULATED' : 'INJECTIVE'
                  }`}
              </p>
              {execution.reference && <code>{execution.reference}</code>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AgentDetailDrawer({
  trader,
  avatarIndex,
  executions,
  onClose,
}: {
  trader: DashboardTrader;
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
        aria-label={`${trader.name} details`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="pixel-drawer-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <header>
          <PixelAvatar index={avatarIndex} />
          <div>
            <span>Agent intelligence</span>
            <h2>{trader.name}</h2>
            <p>{trader.role}</p>
          </div>
          <em className={`pixel-action action-${trader.action.toLowerCase()}`}>{trader.action}</em>
        </header>
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
                  <p>{trader.beliefBefore}</p>
                </article>
                <b aria-hidden="true">→</b>
                <article>
                  <span>After</span>
                  <p>{trader.beliefAfter}</p>
                </article>
              </div>
              <section className="pixel-detail-section">
                <span>Decision thesis</span>
                <p>{trader.thesis}</p>
              </section>
              <section className="pixel-detail-section">
                <span>Evidence</span>
                <div className="pixel-evidence-list">
                  {trader.evidence.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              </section>
              <div className="pixel-detail-metrics">
                <Metric label="Action" value={trader.action} />
                <Metric label="Confidence" value={`${Math.round(trader.confidence * 100)}%`} />
                <Metric
                  label="Risk tolerance"
                  value={`${Math.round(trader.riskTolerance * 100)}`}
                />
              </div>
            </>
          )}

          {tab === 'portfolio' && (
            <>
              <div className="pixel-detail-metrics">
                <Metric label="Start NAV" value={formatTownUsd(trader.navStart)} />
                <Metric label="End NAV" value={formatTownUsd(trader.navEnd)} />
                <Metric
                  label="PnL"
                  value={formatSignedCompact(trader.pnl)}
                  tone={trader.pnl >= 0 ? 'positive' : 'negative'}
                />
                <Metric label="Cash" value={formatTownUsd(trader.cash)} />
              </div>
              <section className="pixel-position-list">
                <div className="pixel-position-head">
                  <span>Symbol</span>
                  <span>Quantity</span>
                  <span>Weight</span>
                  <span>PnL</span>
                </div>
                {trader.positions.length === 0 && (
                  <p className="pixel-no-positions">No open positions.</p>
                )}
                {trader.positions.map((position) => (
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
                  value={`${Math.round(trader.riskTolerance * 100)}`}
                />
                <Metric label="Risk rejections" value={String(trader.riskRejections)} />
                <Metric label="Orders" value={String(trader.orderCount)} />
                <Metric label="Fills" value={String(trader.tradeCount)} />
              </div>
              <section className="pixel-detail-section">
                <span>Current risk reading</span>
                <p>
                  {trader.riskRejections > 0
                    ? `${trader.riskRejections} proposed order(s) were blocked or resized by deterministic portfolio rules.`
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
                    <em>{execution.isSimulated ? 'SIMULATED' : 'INJECTIVE'}</em>
                  </div>
                  <strong>
                    {execution.side} {execution.quantity} {execution.symbol}
                  </strong>
                  <p>
                    {execution.reason ??
                      `${formatPrice(execution.price)} TOWNUSD · ${execution.state}`}
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

function SourceBadge({ dashboard }: { dashboard: TradeTownDashboard }) {
  return (
    <span className={`pixel-source-badge source-${dashboard.source}`} title={dashboard.sourceLabel}>
      {dashboard.source === 'panda'
        ? 'PANDA'
        : dashboard.source === 'injective'
          ? 'CHAIN'
          : 'PREVIEW'}
    </span>
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
    : price.toFixed(2);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
}

function formatTownUsd(value: number) {
  return `${formatCompact(value)} TOWNUSD`;
}

function formatClock(value: number) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
