import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { TradeTownDashboard } from '../../finance/demoData';
import PixelCandles from './PixelCandles';

type ViewMode = 'overview' | 'immersive';
type Drawer = 'markets' | 'agents' | 'events';

const spriteSlots = [0, 3, 5, 2, 6, 1, 7, 4, 0, 3];

export default function TradeTownShell({
  dashboard,
  town,
  townControls,
  townMode = 'preview',
}: {
  dashboard: TradeTownDashboard;
  town: ReactNode;
  townControls?: ReactNode;
  townMode?: 'live' | 'preview';
}) {
  const [selectedSymbol, setSelectedSymbol] = useState('ACME');
  const [selectedAgent, setSelectedAgent] = useState('Mira Chen');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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
      } else if (immersive) {
        setViewMode('overview');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawer, helpOpen, immersive]);

  const toggleView = () => {
    setDrawer(null);
    setViewMode((current) => (current === 'overview' ? 'immersive' : 'overview'));
  };

  return (
    <main className={`pixel-town-shell ${immersive ? 'is-immersive' : 'is-overview'}`}>
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

      <MarketTicker
        dashboard={dashboard}
        selectedSymbol={market.symbol}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          if (immersive) setDrawer('markets');
        }}
      />

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
            <div className="pixel-town-stage">{town}</div>
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

        <aside className="pixel-citizen-rail" aria-label="Town citizen shortcuts">
          <CitizenRail
            dashboard={dashboard}
            selectedAgent={trader.name}
            onSelect={(name) => {
              setSelectedAgent(name);
              setDrawer('agents');
            }}
          />
        </aside>
      </div>

      <div className="pixel-town-toolbelt">
        <div className="pixel-original-controls">{townControls}</div>
        <div className="pixel-truth-rule">
          <span>◆</span>
          Holdings change only after an Injective fill is confirmed
        </div>
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
            <AgentBoard
              dashboard={dashboard}
              selectedAgent={trader.name}
              onSelect={setSelectedAgent}
            />
          )}
          {drawer === 'events' && <EventBoard dashboard={dashboard} drawer />}
        </section>
      )}

      {!immersive && (
        <footer className="pixel-town-footer">
          <span>AI Town core</span>
          <span>TwinMarket minds</span>
          <span>Convex realtime</span>
          <span>Injective CLOB</span>
          <a href="https://www.tradingview.com/">TradingView charts ↗</a>
          <a href="https://github.com/zonghaoyuan/trade-town">MIT source ↗</a>
        </footer>
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

function CitizenRail({
  dashboard,
  selectedAgent,
  onSelect,
}: {
  dashboard: TradeTownDashboard;
  selectedAgent: string;
  onSelect: (name: string) => void;
}) {
  return (
    <>
      <div className="pixel-citizen-rail-title">
        <span>Citizens</span>
        <strong>10</strong>
      </div>
      <div className="pixel-citizen-rail-list">
        {dashboard.traders.map((agent, index) => (
          <button
            type="button"
            key={agent.name}
            className={agent.name === selectedAgent ? 'is-selected' : ''}
            title={`${agent.name} · ${agent.role}`}
            aria-label={`Open ${agent.name}`}
            onClick={() => onSelect(agent.name)}
          >
            <PixelAvatar index={index} />
            <em>{agent.kind === 'market_maker' ? 'MM' : 'AI'}</em>
          </button>
        ))}
      </div>
    </>
  );
}

function MarketTicker({
  dashboard,
  selectedSymbol,
  onSelect,
}: {
  dashboard: TradeTownDashboard;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <section className="pixel-market-ticker" aria-label="Market ticker">
      {dashboard.markets.map((market) => (
        <button
          type="button"
          key={market.symbol}
          className={market.symbol === selectedSymbol ? 'is-selected' : ''}
          onClick={() => onSelect(market.symbol)}
        >
          <strong>{market.symbol}</strong>
          <span>{formatPrice(market.lastPrice)}</span>
          <small className={market.change24h >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.change24h >= 0 ? '▲' : '▼'} {Math.abs(market.change24h).toFixed(2)}%
          </small>
        </button>
      ))}
    </section>
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
        <h2>Market board</h2>
      </div>
      <div className="pixel-market-hero">
        <span>{market.assetClass}</span>
        <h3>{market.symbol}/TOWNUSD</h3>
        <div>
          <strong>{formatPrice(market.lastPrice)}</strong>
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
        <div>
          <dt>Settlement</dt>
          <dd>Spot</dd>
        </div>
        <div>
          <dt>Matcher</dt>
          <dd>Injective</dd>
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
              <small>{item.displayName}</small>
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

  return (
    <div className="pixel-board">
      <div className="pixel-board-title">
        <span>8 AI · 2 deterministic MM</span>
        <h2>Town citizens</h2>
      </div>
      <div className="pixel-agent-list">
        {dashboard.traders.map((agent, index) => (
          <button
            type="button"
            key={agent.name}
            className={agent.name === trader.name ? 'is-selected' : ''}
            onClick={() => onSelect(agent.name)}
          >
            <PixelAvatar index={index} />
            <span>
              <strong>{agent.name}</strong>
              <small>{agent.role}</small>
            </span>
            <em>{agent.kind === 'market_maker' ? 'MM' : 'AI'}</em>
          </button>
        ))}
      </div>
      <article className="pixel-agent-card">
        <div className="pixel-agent-card-top">
          <span>Subaccount {String(trader.subaccountNonce).padStart(2, '0')}</span>
          <strong className={trader.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
            {trader.pnl >= 0 ? '+' : ''}
            {trader.pnl.toLocaleString()} TOWNUSD
          </strong>
        </div>
        <h3>{trader.name}</h3>
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

function PixelAvatar({ index }: { index: number }) {
  const slot = spriteSlots[index % spriteSlots.length];
  const x = (slot % 4) * 96;
  const y = Math.floor(slot / 4) * 128;
  const style = {
    '--sprite-x': `${-x}px`,
    '--sprite-y': `${-y}px`,
  } as CSSProperties;

  return (
    <span className="pixel-agent-avatar" aria-hidden="true">
      <i style={style} />
    </span>
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
