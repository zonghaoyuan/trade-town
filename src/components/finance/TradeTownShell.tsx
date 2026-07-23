import { ReactNode, useState } from 'react';
import { TradeTownDashboard } from '../../finance/demoData';
import { Sparkline } from './Sparkline';

export default function TradeTownShell({
  dashboard,
  town,
}: {
  dashboard: TradeTownDashboard;
  town: ReactNode;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState('ACME');
  const [selectedAgent, setSelectedAgent] = useState('Mira Chen');
  const market =
    dashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    dashboard.markets[0];
  const trader =
    dashboard.traders.find((candidate) => candidate.name === selectedAgent) ?? dashboard.traders[0];
  const sourceLabel = dashboard.source === 'injective' ? 'CHAIN DATA' : 'SCENARIO PREVIEW';

  return (
    <main className="trade-shell">
      <div className="scanlines" aria-hidden="true" />
      <header className="terminal-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            TT
          </div>
          <div>
            <h1>Trade Town</h1>
            <p>Autonomous agents · verifiable markets</p>
          </div>
        </div>
        <div className="network-cluster">
          <span className={`status-dot status-${dashboard.gatewayStatus}`} />
          <div>
            <strong>INJECTIVE TESTNET</strong>
            <span>
              {sourceLabel}
              {dashboard.blockHeight ? ` · #${dashboard.blockHeight.toLocaleString()}` : ''}
            </span>
          </div>
          <div className="operator-label">
            ONE WALLET
            <span>10 SUBACCOUNTS</span>
          </div>
        </div>
      </header>

      <section className="ticker-strip" aria-label="Market ticker">
        {dashboard.markets.map((item) => (
          <button
            type="button"
            key={item.symbol}
            className={item.symbol === selectedSymbol ? 'ticker-active' : ''}
            onClick={() => setSelectedSymbol(item.symbol)}
          >
            <span className="ticker-symbol">{item.symbol}</span>
            <span className="ticker-price">
              {formatPrice(item.lastPrice)}
              <small>TOWNUSD</small>
            </span>
            <span className={item.change24h >= 0 ? 'positive' : 'negative'}>
              {item.change24h >= 0 ? '+' : ''}
              {item.change24h.toFixed(2)}%
            </span>
          </button>
        ))}
      </section>

      <div className="terminal-workspace">
        <aside className="market-rail terminal-panel">
          <div className="panel-heading">
            <div>
              <span>MARKET // {market.assetClass.toUpperCase()}</span>
              <h2>{market.symbol}/TOWNUSD</h2>
            </div>
            <span className={`market-state state-${market.status}`}>{market.status}</span>
          </div>
          <div className="hero-quote">
            <strong>{formatPrice(market.lastPrice)}</strong>
            <span className={market.change24h >= 0 ? 'positive' : 'negative'}>
              {market.change24h >= 0 ? '▲' : '▼'} {Math.abs(market.change24h).toFixed(2)}%
            </span>
          </div>
          <Sparkline values={market.series} color={market.accent} className="market-chart" />
          <div className="quote-grid">
            <div>
              <span>24H VOL</span>
              <strong>{formatCompact(market.volume24h)}</strong>
            </div>
            <div>
              <span>REFERENCE</span>
              <strong>{formatPrice(market.referencePrice)}</strong>
            </div>
            <div>
              <span>SETTLEMENT</span>
              <strong>SPOT</strong>
            </div>
            <div>
              <span>MATCHER</span>
              <strong>INJECTIVE</strong>
            </div>
          </div>
          <div className="rail-section-title">
            <span>ASSET BOARD</span>
            <span>04</span>
          </div>
          <div className="asset-list">
            {dashboard.markets.map((item) => (
              <button
                type="button"
                key={item.symbol}
                onClick={() => setSelectedSymbol(item.symbol)}
                className={item.symbol === market.symbol ? 'asset-selected' : ''}
              >
                <span className="asset-accent" style={{ backgroundColor: item.accent }} />
                <span>
                  <strong>{item.symbol}</strong>
                  <small>{item.displayName}</small>
                </span>
                <span className={item.change24h >= 0 ? 'positive' : 'negative'}>
                  {item.change24h >= 0 ? '+' : ''}
                  {item.change24h.toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
          <div className="chain-truth">
            <span className="chain-icon">◆</span>
            <div>
              <strong>CHAIN TRUTH RULE</strong>
              <p>Balances change only after an Injective fill is confirmed.</p>
            </div>
          </div>
        </aside>

        <section className="world-column">
          <div className="town-stage terminal-panel">
            <div className="stage-label">
              <span>LIVE TOWN // CONVEX</span>
              <span>{dashboard.traders.length} AGENTS ONLINE</span>
            </div>
            {town}
          </div>
          <section className="causal-tape terminal-panel">
            <div className="panel-heading compact">
              <div>
                <span>CAUSAL REPLAY</span>
                <h2>RATE SHOCK → MARKET MOVE</h2>
              </div>
              <span className="preview-flag">
                {dashboard.source === 'preview' ? 'ILLUSTRATIVE' : 'VERIFIED'}
              </span>
            </div>
            <div className="event-track">
              {dashboard.events.map((event, index) => (
                <article key={event.id} className={`event-card event-${event.kind}`}>
                  <div className="event-index">{String(index + 1).padStart(2, '0')}</div>
                  <time>{event.time}</time>
                  <strong>{event.title}</strong>
                  <span>{event.actor}</span>
                  <p>{event.detail}</p>
                  {event.proof && <code>{event.proof}</code>}
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="agent-rail terminal-panel">
          <div className="panel-heading">
            <div>
              <span>AGENT NETWORK</span>
              <h2>TRADING DESK</h2>
            </div>
            <span className="agent-count">8 AI + 2 MM</span>
          </div>
          <div className="agent-list">
            {dashboard.traders.map((agent, index) => (
              <button
                type="button"
                key={agent.name}
                onClick={() => setSelectedAgent(agent.name)}
                className={agent.name === trader.name ? 'agent-selected' : ''}
              >
                <span className={`agent-avatar avatar-${(index % 8) + 1}`}>
                  {agent.name
                    .split(/[-\s]/)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="agent-copy">
                  <strong>{agent.name}</strong>
                  <small>{agent.role}</small>
                </span>
                <span className={agent.kind === 'market_maker' ? 'mm-badge' : 'ai-badge'}>
                  {agent.kind === 'market_maker' ? 'MM' : 'AI'}
                </span>
              </button>
            ))}
          </div>
          <div className="agent-inspector">
            <div className="inspector-topline">
              <span>SUBACCOUNT {String(trader.subaccountNonce).padStart(2, '0')}</span>
              <strong className={trader.pnl >= 0 ? 'positive' : 'negative'}>
                {trader.pnl >= 0 ? '+' : ''}
                {trader.pnl.toLocaleString()} TOWNUSD
              </strong>
            </div>
            <h3>{trader.name}</h3>
            <p>{trader.style}</p>
            <div className="risk-meter">
              <span>RISK TOLERANCE</span>
              <div>
                <i style={{ width: `${trader.riskTolerance * 100}%` }} />
              </div>
              <strong>{Math.round(trader.riskTolerance * 100)}</strong>
            </div>
            <div className="agent-activity">
              <span className="pulse" />
              {trader.activity}
            </div>
            <div className="focus-chips">
              {trader.focusSymbols.map((symbol) => (
                <span key={symbol}>{symbol}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <footer className="terminal-footer">
        <span>AI TOWN CORE</span>
        <span>TWINMARKET SEMANTICS</span>
        <span>CONVEX REALTIME CACHE</span>
        <span>INJECTIVE CLOB</span>
        <a href="https://github.com/zonghaoyuan/trade-town">MIT · SOURCE ↗</a>
      </footer>
    </main>
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
