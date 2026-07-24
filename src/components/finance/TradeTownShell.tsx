import { ReactNode, useEffect, useRef, useState } from 'react';
import { TradeTownDashboard } from '../../finance/demoData';
import PixelCandles from './PixelCandles';
import PixelAvatar from './PixelAvatar';

type ViewMode = 'overview' | 'immersive';
type Drawer = 'markets' | 'agents' | 'events';

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
  town,
  townControls,
  townMode = 'preview',
}: {
  dashboard: TradeTownDashboard;
  town: ReactNode | ((state: TownRenderState) => ReactNode);
  townControls?: ReactNode;
  townMode?: 'live' | 'preview';
}) {
  const [selectedSymbol, setSelectedSymbol] = useState('ACME');
  const [selectedAgent, setSelectedAgent] = useState('Mira Chen');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ name: string; requestId: number } | null>(
    null,
  );
  const focusRequestId = useRef(0);

  const market =
    dashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    dashboard.markets[0];
  const trader =
    dashboard.traders.find((candidate) => candidate.name === selectedAgent) ?? dashboard.traders[0];
  const immersive = viewMode === 'immersive';
  const dataLabel =
    dashboard.source === 'injective'
      ? 'CHAIN DATA'
      : townMode === 'live'
        ? 'CONVEX TOWN · MARKET PREVIEW'
        : 'OFFLINE SCENARIO PREVIEW';

  useEffect(() => {
    document.body.classList.toggle('town-immersive-open', immersive);
    return () => document.body.classList.remove('town-immersive-open');
  }, [immersive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (helpOpen) {
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
  }, [drawer, focusRequest, helpOpen, immersive]);

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
    ? dashboard.traders.find((candidate) => candidate.name === focusRequest.name)
    : undefined;
  const focusedCitizen = focusedTrader
    ? {
        requestId: focusRequest!.requestId,
        name: focusedTrader.name,
        role: focusedTrader.role,
        pnl: focusedTrader.pnl,
        avatarIndex: Math.max(
          0,
          dashboard.traders.findIndex((candidate) => candidate.name === focusedTrader.name),
        ),
      }
    : null;
  const townContent = typeof town === 'function' ? town({ focusedCitizen }) : town;

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
            <p>AI citizens · on-chain markets</p>
          </div>
        </div>

        <div className="pixel-network">
          <span className={`pixel-network-light status-${dashboard.gatewayStatus}`} />
          <div>
            <strong>Injective Testnet</strong>
            <span>
              {dataLabel}
              {dashboard.blockHeight ? ` · #${dashboard.blockHeight.toLocaleString()}` : ''}
            </span>
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
            dashboard={dashboard}
            selectedSymbol={market.symbol}
            onSelect={setSelectedSymbol}
          />
        </aside>

        <section className="pixel-world-column">
          <div className="pixel-town-stage-wrap">
            <div className="pixel-stage-ribbon">
              <span>
                <i className={townMode === 'live' ? 'pixel-live-dot' : 'pixel-preview-dot'} />
                {townMode === 'live' ? 'Convex town live' : 'Town preview'}
              </span>
              <strong>{dashboard.traders.length} citizens online</strong>
            </div>
            <div className="pixel-town-stage">{townContent}</div>
            {townControls && (
              <div className="pixel-stage-controls" aria-label="Town controls">
                {townControls}
              </div>
            )}
            {dashboard.source === 'preview' && (
              <span className="pixel-preview-note">
                {townMode === 'live'
                  ? 'Town is live · market prices are illustrative'
                  : 'Preview map · connect Convex for the live town'}
              </span>
            )}
          </div>

          <EventBoard dashboard={dashboard} />
        </section>

        <aside className="pixel-side-panel pixel-agent-panel" aria-label="Town citizens">
          <AgentBoard dashboard={dashboard} selectedAgent={trader.name} onSelect={focusCitizen} />
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
          <span aria-hidden="true">!</span> Events
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
              dashboard={dashboard}
              selectedSymbol={market.symbol}
              onSelect={setSelectedSymbol}
            />
          )}
          {drawer === 'agents' && (
            <AgentBoard dashboard={dashboard} selectedAgent={trader.name} onSelect={focusCitizen} />
          )}
          {drawer === 'events' && <EventBoard dashboard={dashboard} drawer />}
        </section>
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
            <h2 id="town-help-title">Welcome to Trade Town</h2>
            <p>
              Drag the map to explore, scroll to zoom, and select a citizen to read their
              conversations. Financial beliefs become intents, but only Injective can match an
              order.
            </p>
            <div className="pixel-help-grid">
              <div>
                <strong>Market view</strong>
                <span>Compare the town with prices, portfolios, and causal events.</span>
              </div>
              <div>
                <strong>Full town</strong>
                <span>Focus on the live map and open financial panels from the bottom dock.</span>
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

  return (
    <div className="pixel-board">
      <div className="pixel-board-title">
        <span>Town exchange</span>
        <h2>Markets</h2>
      </div>
      <div className="pixel-market-hero">
        <span>{market.assetClass}</span>
        <h3>{market.symbol} / TOWNUSD</h3>
        <div>
          <strong>${formatPrice(market.lastPrice)}</strong>
          <small className={market.change24h >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.change24h >= 0 ? '+' : ''}
            {market.change24h.toFixed(2)}%
          </small>
        </div>
      </div>
      <PixelCandles values={market.series} symbol={market.symbol} />
      <dl className="pixel-quote-grid">
        <div>
          <dt>24H volume</dt>
          <dd>{formatCompact(market.volume24h)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{formatPrice(market.referencePrice)}</dd>
        </div>
      </dl>
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
                ${formatPrice(item.lastPrice)} · {item.displayName}
              </small>
            </span>
            <span className={item.change24h >= 0 ? 'pixel-up' : 'pixel-down'}>
              {item.change24h >= 0 ? '+' : ''}
              {item.change24h.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
      <div className="pixel-chain-rule">
        <span>◆</span>
        <p>
          <strong>Chain truth</strong>
          No local matching. Confirmed fills update official balances.
        </p>
      </div>
    </div>
  );
}

function AgentBoard({
  dashboard,
  selectedAgent,
  onSelect,
}: {
  dashboard: TradeTownDashboard;
  selectedAgent: string;
  onSelect: (name: string) => void;
}) {
  const trader =
    dashboard.traders.find((candidate) => candidate.name === selectedAgent) ?? dashboard.traders[0];
  const traderIndex = Math.max(
    0,
    dashboard.traders.findIndex((candidate) => candidate.name === trader.name),
  );

  return (
    <div className="pixel-board">
      <div className="pixel-board-title">
        <span>{dashboard.traders.length} online · AI &amp; market makers</span>
        <h2>Citizens</h2>
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
              <strong className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {formatSignedCompact(agent.pnl)}
              </strong>
              <small>
                <i /> Active
              </small>
            </span>
          </button>
        ))}
      </div>
      <article className="pixel-agent-card">
        <div className="pixel-agent-card-top">
          <span>Selected citizen</span>
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
        </div>
        <p>{trader.style}</p>
        <div className="pixel-risk">
          <span>Risk tolerance</span>
          <i>
            <b style={{ width: `${trader.riskTolerance * 100}%` }} />
          </i>
          <strong>{Math.round(trader.riskTolerance * 100)}</strong>
        </div>
        <div className="pixel-agent-activity">
          <i /> {trader.activity}
        </div>
        <div className="pixel-focus-list">
          {trader.focusSymbols.map((symbol) => (
            <span key={symbol}>{symbol}</span>
          ))}
        </div>
      </article>
    </div>
  );
}

function EventBoard({
  dashboard,
  drawer = false,
}: {
  dashboard: TradeTownDashboard;
  drawer?: boolean;
}) {
  return (
    <section className={`pixel-event-board ${drawer ? 'is-drawer' : ''}`}>
      <div className="pixel-board-title pixel-event-title">
        <div>
          <span>Cause and effect</span>
          <h2>Town chronicle</h2>
        </div>
        <strong>
          {dashboard.source === 'preview' ? 'Illustrative replay' : 'Verified events'}
        </strong>
      </div>
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
    </section>
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
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
  return `${formatted} TOWNUSD`;
}
