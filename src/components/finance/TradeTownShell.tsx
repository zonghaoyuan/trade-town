import { ReactNode, useEffect, useRef, useState } from 'react';
import type {
  CausalEvent,
  DashboardExecution,
  SocialActivity,
  DashboardTrader,
  TradeTownDashboard,
} from '../../finance/demoData';
import PixelCandles from './PixelCandles';
import PixelAvatar from './PixelAvatar';
import PixelMarketIcon from './PixelMarketIcon';
import {
  emptyTownActivityFeed,
  type TownActivityFeed,
} from '../../../shared/activity';
import TownActivityPanel from './TownActivityPanel';
import CreateMeModal, {
  CreatedMeView,
  CreateMePayload,
} from '../create-me/CreateMeModal';
import { loadCreatedMe } from '../../features/create-me/storage';

type ViewMode = 'overview' | 'immersive';
type Drawer = 'markets' | 'agents' | 'activity';
type ActivityTab = 'timeline' | 'social' | 'trades';
type AgentTab = 'belief' | 'portfolio' | 'risk' | 'trades';
type RecordSource = 'panda' | 'injective' | 'preview';

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
  dayViewDashboards,
  activityFeed = emptyTownActivityFeed,
  town,
  townControls,
  currentMe,
  onCreateMe,
}: {
  dashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  dayViewDashboards?: Record<string, TradeTownDashboard>;
  activityFeed?: TownActivityFeed;
  town: ReactNode | ((state: TownRenderState) => ReactNode);
  townControls?: ReactNode;
  townMode?: 'live' | 'preview';
  currentMe?: CreatedMeView | null;
  onCreateMe?: (payload: CreateMePayload) => Promise<unknown>;
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(
    dayViewDashboard.markets[0]?.symbol ?? 'ACME',
  );
  const [selectedAgent, setSelectedAgent] = useState(dayViewDashboard.traders[0]?.name ?? '');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [createMeOpen, setCreateMeOpen] = useState(false);
  const [localMe, setLocalMe] = useState<CreatedMeView | null>(() => loadCreatedMe());
  const [agentDetailOpen, setAgentDetailOpen] = useState(false);
  const createMeTriggerRef = useRef<HTMLButtonElement>(null);
  const createMeWasOpen = useRef(false);
  const [focusRequest, setFocusRequest] = useState<{ name: string; requestId: number } | null>(
    null,
  );
  const focusRequestId = useRef(0);

  const activeDashboard = dayViewDashboards?.[selectedSymbol] ?? dayViewDashboard;
  const selectedMarketDashboard = activeDashboard.markets.some(
    (candidate) => candidate.symbol === selectedSymbol,
  )
    ? activeDashboard
    : dashboard;
  const market =
    selectedMarketDashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    selectedMarketDashboard.markets[0];
  const trader =
    activeDashboard.traders.find((candidate) => candidate.name === selectedAgent) ??
    activeDashboard.traders[0];
  const immersive = viewMode === 'immersive';
  const activeMe = currentMe ?? localMe;

  useEffect(() => {
    const symbolExists =
      activeDashboard.markets.some((candidate) => candidate.symbol === selectedSymbol) ||
      dashboard.markets.some((candidate) => candidate.symbol === selectedSymbol);
    if (!symbolExists) {
      setSelectedSymbol(activeDashboard.markets[0]?.symbol ?? dashboard.markets[0]?.symbol ?? '');
    }
    if (!activeDashboard.traders.some((candidate) => candidate.name === selectedAgent)) {
      setSelectedAgent(activeDashboard.traders[0]?.name ?? '');
    }
    setFocusRequest(null);
    setAgentDetailOpen(false);
  }, [activeDashboard, dashboard, selectedAgent, selectedSymbol]);

  useEffect(() => {
    document.body.classList.toggle('town-immersive-open', immersive);
    return () => document.body.classList.remove('town-immersive-open');
  }, [immersive]);

  useEffect(() => {
    if (createMeWasOpen.current && !createMeOpen) {
      createMeTriggerRef.current?.focus();
    }
    createMeWasOpen.current = createMeOpen;
  }, [createMeOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (agentDetailOpen) {
        setAgentDetailOpen(false);
      } else if (createMeOpen) {
        setCreateMeOpen(false);
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
  }, [agentDetailOpen, createMeOpen, drawer, focusRequest, helpOpen, immersive]);

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
  const focusedCitizen: FocusedTownCitizen | null = focusedTrader
    ? {
        requestId: focusRequest!.requestId,
        name: focusedTrader.name,
        role: focusedTrader.role,
        pnl: focusedTrader.pnl,
        pnlSource: 'simulated',
        avatarIndex: Math.max(
          0,
          activeDashboard.traders.findIndex((candidate) => candidate.name === focusedTrader.name),
        ),
      }
    : null;
  const townContent = typeof town === 'function' ? town({ focusedCitizen }) : town;
  const dataWarningCount = activeDashboard.errors.length + dashboard.errors.length;

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

        <div className="pixel-data-console">
          <div className="pixel-unified-heading">
            <strong>Unified market overview</strong>
            <span>One town · two evidence layers</span>
          </div>
          <div className="pixel-network is-unified">
            <div className="pixel-source-legend" aria-label="Data source legend">
              <span className="source-panda">
                <i aria-hidden="true">◇</i>
                Panda · historical / sim · {formatMarketDate(activeDashboard.asOf)}
              </span>
              <span className={`source-${dashboard.source}`}>
                <i aria-hidden="true">{dashboard.source === 'injective' ? '◆' : '◈'}</i>
                Injective · {dashboard.source === 'injective' ? 'verified' : 'preview'}
                {dashboard.blockHeight ? ` · #${dashboard.blockHeight.toLocaleString()}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="pixel-header-actions">
          <button
            ref={createMeTriggerRef}
            type="button"
            className={`pixel-button pixel-button-small pixel-create-me-trigger ${
              activeMe ? 'is-avatar-only' : ''
            }`}
            aria-haspopup="dialog"
            aria-label={activeMe ? '编辑角色' : '创建角色'}
            onClick={() => setCreateMeOpen(true)}
          >
            {activeMe ? (
              <i
                className="pixel-create-me-avatar"
                style={{ backgroundImage: `url("${activeMe.textureUrl}")` }}
                aria-hidden="true"
              />
            ) : (
              <>
                <span>+</span> Create ME
              </>
            )}
          </button>
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
            testnetDashboard={dashboard}
            dayViewDashboard={activeDashboard}
            selectedSymbol={market?.symbol ?? ''}
            onSelect={setSelectedSymbol}
          />
        </aside>

        <section className="pixel-world-column">
          <div className="pixel-town-stage-wrap">
            <div className="pixel-town-stage">{townContent}</div>
            {townControls && (
              <div className="pixel-stage-controls" aria-label="Town controls">
                {townControls}
              </div>
            )}
            <span className="pixel-preview-note">
              {dataWarningCount > 0 && (
                <>
                  <strong className="is-warning">{dataWarningCount}</strong> data warning
                  {dataWarningCount === 1 ? '' : 's'} ·{' '}
                </>
              )}
              <strong className="is-online">{activeDashboard.traders.length}</strong> agents
              online
            </span>
          </div>

          <TownSummary testnetDashboard={dashboard} dayViewDashboard={activeDashboard} />
          <TownActivityPanel activity={activityFeed} contextEvents={activeDashboard.events} />
        </section>

        <aside className="pixel-side-panel pixel-agent-panel" aria-label="Town citizens">
          <AgentBoard
            testnetDashboard={dashboard}
            dayViewDashboard={activeDashboard}
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
        <button
          type="button"
          onClick={() => setDrawer(drawer === 'activity' ? null : 'activity')}
        >
          <span aria-hidden="true">!</span> Activity
        </button>
        {!immersive && (
          <>
            <button
              type="button"
              onClick={() => {
                setDrawer(null);
                setCreateMeOpen(true);
              }}
            >
              <span aria-hidden="true">{activeMe ? '✎' : '+'}</span>
              {activeMe ? 'Edit ME' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawer(null);
                setHelpOpen(true);
              }}
            >
              <span aria-hidden="true">?</span> Help
            </button>
          </>
        )}
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
              testnetDashboard={dashboard}
              dayViewDashboard={activeDashboard}
              selectedSymbol={market?.symbol ?? ''}
              onSelect={setSelectedSymbol}
            />
          )}
          {drawer === 'agents' && (
            <AgentBoard
              testnetDashboard={dashboard}
              dayViewDashboard={activeDashboard}
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
              contextEvents={activeDashboard.events}
              drawer
            />
          )}
        </section>
      )}

      {agentDetailOpen && trader && (
        <AgentDetailDrawer
          trader={trader}
          avatarIndex={Math.max(
            0,
            activeDashboard.traders.findIndex((candidate) => candidate.name === trader.name),
          )}
          testnetTrader={dashboard.traders.find((candidate) => candidate.name === trader.name)}
          testnetDashboard={dashboard}
          executions={[...activeDashboard.executions, ...dashboard.executions].filter(
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
              PandaAI supplies the historical market bars used by DayView. Agent beliefs,
              portfolios, social influence, and replay trades are generated by INJ Trade Town.
              Injective Testnet is reserved for verifiable orders, fills, balances, and proofs.
            </p>
            <div className="pixel-help-grid">
              <div>
                <strong>PandaAI data</strong>
                <span>Inspect sourced historical market bars alongside a generated agent replay.</span>
              </div>
              <div>
                <strong>Injective Testnet</strong>
                <span>Verify ACME orders and fills when the Injective gateway is connected.</span>
              </div>
            </div>
            <div className="pixel-platform-credits" aria-label="Data and infrastructure sources">
              <span>Sources</span>
              <a
                href="https://www.pandaaiquant.com/data-service"
                target="_blank"
                rel="noreferrer"
              >
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

      {createMeOpen && (
        <CreateMeModal
          initialMe={activeMe}
          onClose={() => setCreateMeOpen(false)}
          onSubmit={onCreateMe}
          onCreated={setLocalMe}
        />
      )}
    </main>
  );
}

function MarketBoard({
  testnetDashboard,
  dayViewDashboard,
  selectedSymbol,
  onSelect,
}: {
  testnetDashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const dashboard = dayViewDashboard.markets.some(
    (candidate) => candidate.symbol === selectedSymbol,
  )
    ? dayViewDashboard
    : testnetDashboard;
  const market =
    dashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    dayViewDashboard.markets[0] ??
    testnetDashboard.markets[0];
  if (!market) return null;

  const pandaMode = dashboard.dataMode === 'panda_dayview';
  const latestCandle = market.candles[market.candles.length - 1];
  const hasSentiment = pandaMode && market.sentiment;
  const quoteCurrency = market.quoteCurrency ?? (pandaMode ? 'CNY' : 'INJ');
  const priceTick = market.priceTick ?? (market.lastPrice < 1 ? 0.0001 : 0.04);

  return (
    <div className="pixel-board pixel-unified-market-board">
      <div className="pixel-board-title pixel-board-title-sourced">
        <div>
          <span>Historical context + chain execution</span>
          <h2>Markets</h2>
        </div>
        <div className="pixel-dual-badges" aria-label="Market sources">
          <SourceBadge dashboard={dayViewDashboard} label="◇ PANDA · SIM" />
          <SourceBadge
            dashboard={testnetDashboard}
            label={testnetDashboard.source === 'injective' ? '◆ VERIFIED' : '◈ PREVIEW'}
          />
        </div>
      </div>
      <div className={`pixel-market-hero source-focus-${pandaMode ? 'panda' : 'injective'}`}>
        <span>
          {pandaMode ? '◇ PANDA DAYVIEW · HISTORICAL' : '◆ INJECTIVE TESTNET · EXECUTION'}
        </span>
        <h3>
          {market.symbol} {pandaMode ? '' : `/ ${quoteCurrency}`}
        </h3>
        <div>
          <strong>{formatPrice(market.lastPrice)}</strong>
          <small className={market.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.changePct >= 0 ? '+' : ''}
            {market.changePct.toFixed(2)}%
          </small>
        </div>
        <small className="pixel-price-unit">
          {pandaMode ? `${quoteCurrency} · DAY CLOSE` : quoteCurrency}
        </small>
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
          <dt>{pandaMode ? (hasSentiment ? 'Consensus' : 'Day high') : 'Best bid'}</dt>
          <dd>
            {pandaMode
              ? hasSentiment
                ? `${market.sentiment!.consensus}%`
                : formatPrice(latestCandle?.high ?? market.lastPrice)
              : formatPrice(Math.max(0, market.lastPrice - priceTick))}
          </dd>
        </div>
        <div>
          <dt>{pandaMode ? (hasSentiment ? 'Divergence' : 'Day low') : 'Best ask'}</dt>
          <dd>
            {pandaMode
              ? hasSentiment
                ? `${market.sentiment!.divergence}%`
                : formatPrice(latestCandle?.low ?? market.lastPrice)
              : formatPrice(market.lastPrice + priceTick)}
          </dd>
        </div>
      </dl>
      {hasSentiment ? (
        <div className="pixel-sentiment">
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
      ) : pandaMode ? (
        <div className="pixel-sentiment">
          <div>
            <span>Agent sentiment</span>
            <strong>NOT AVAILABLE</strong>
            <span>market data only</span>
          </div>
        </div>
      ) : (
        <div className="pixel-orderbook-preview">
          <span className="pixel-up">BID {formatPrice(market.lastPrice - priceTick)}</span>
          <strong>SPREAD {formatPrice(priceTick * 2)}</strong>
          <span className="pixel-down">ASK {formatPrice(market.lastPrice + priceTick)}</span>
        </div>
      )}
      <div className="pixel-market-source-groups">
        <MarketSourceGroup
          dashboard={dayViewDashboard}
          kind="panda"
          selectedSymbol={market.symbol}
          onSelect={onSelect}
        />
        <MarketSourceGroup
          dashboard={testnetDashboard}
          kind={testnetDashboard.source === 'injective' ? 'injective' : 'preview'}
          selectedSymbol={market.symbol}
          onSelect={onSelect}
        />
      </div>
      <div className="pixel-dual-boundary">
        <div className="source-panda">
          <span>◇</span>
          <p>
            <strong>Panda · context / simulation</strong>
            Historical bars are observed; beliefs and replay orders are generated.
          </p>
        </div>
        <div className={`source-${testnetDashboard.source}`}>
          <span>{testnetDashboard.source === 'injective' ? '◆' : '◈'}</span>
          <p>
            <strong>Injective · chain truth</strong>
            Only confirmed testnet fills update verified balances.
          </p>
        </div>
      </div>
      {testnetDashboard.marketMakers.length > 0 && (
        <div className="pixel-maker-row" aria-label="Liquidity providers">
          <span>Liquidity</span>
          {testnetDashboard.marketMakers.map((maker) => (
            <strong key={maker.name}>
              <i /> {maker.name}
            </strong>
          ))}
        </div>
      )}
    </div>
  );
}

function MarketSourceGroup({
  dashboard,
  kind,
  selectedSymbol,
  onSelect,
}: {
  dashboard: TradeTownDashboard;
  kind: RecordSource;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const panda = kind === 'panda';
  const verified = kind === 'injective';

  return (
    <section className={`pixel-market-source-group source-${kind}`}>
      <header>
        <span aria-hidden="true">{panda ? '◇' : verified ? '◆' : '◈'}</span>
        <div>
          <strong>{panda ? 'Panda DayView' : 'Injective Testnet'}</strong>
          <small>
            {panda
              ? `Historical · ${formatMarketDate(dashboard.asOf)}`
              : verified
                ? `Verified${dashboard.blockHeight ? ` · #${dashboard.blockHeight.toLocaleString()}` : ''}`
                : 'Preview · awaiting chain fills'}
          </small>
        </div>
      </header>
      <div className="pixel-market-list">
        {dashboard.markets.map((item) => (
          <button
            type="button"
            key={`${kind}-${item.symbol}`}
            onClick={() => onSelect(item.symbol)}
            className={item.symbol === selectedSymbol ? 'is-selected' : ''}
          >
            <PixelMarketIcon symbol={item.symbol} accent={item.accent} />
            <span className="pixel-market-copy">
              <strong>{item.symbol}</strong>
              <small>
                {formatPrice(item.lastPrice)} {item.quoteCurrency ?? (panda ? 'CNY' : 'INJ')} ·{' '}
                {item.displayName}
              </small>
            </span>
            <span className={item.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
              {item.changePct >= 0 ? '+' : ''}
              {item.changePct.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
    </section>
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

  const traderIndex = Math.max(
    0,
    dayViewDashboard.traders.findIndex((candidate) => candidate.name === pandaTrader.name),
  );

  return (
    <div className="pixel-board pixel-unified-agent-board">
      <div className="pixel-board-title pixel-board-title-sourced">
        <div>
          <span>{dayViewDashboard.traders.length} agents · dual-source state</span>
          <h2>Citizens</h2>
        </div>
        <div className="pixel-dual-badges" aria-label="Citizen state sources">
          <SourceBadge dashboard={dayViewDashboard} label="◇ SIM" />
          <SourceBadge
            dashboard={testnetDashboard}
            label={testnetDashboard.source === 'injective' ? '◆ CHAIN' : '◈ PREVIEW'}
          />
        </div>
      </div>
      <div className="pixel-agent-list">
        {dayViewDashboard.traders.map((agent, index) => {
          const chainAgent = testnetDashboard.traders.find(
            (candidate) => candidate.name === agent.name,
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
              <span className="pixel-agent-dual-state">
                <span className="source-panda">
                  <small>◇ Panda · sim</small>
                  <strong>
                    {agent.action} · {formatSignedCompact(agent.pnl)} {agent.currency ?? 'CNY'}
                  </strong>
                </span>
                <span className={`source-${testnetDashboard.source}`}>
                  <small>
                    {testnetDashboard.source === 'injective' ? '◆' : '◈'} Testnet ·{' '}
                    {testnetDashboard.source === 'injective' ? 'verified' : 'preview'}
                  </small>
                  <strong>{formatTestnetAgentState(chainAgent, testnetDashboard)}</strong>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <article className="pixel-agent-card">
        <div className="pixel-agent-card-top">
          <span>Selected agent</span>
          <span>
            ◇ SIM + {testnetDashboard.source === 'injective' ? '◆ VERIFIED' : '◈ PREVIEW'}
          </span>
        </div>
        <div className="pixel-agent-card-identity">
          <PixelAvatar index={traderIndex} />
          <div>
            <h3>{pandaTrader.name}</h3>
            <span>{pandaTrader.role}</span>
          </div>
          <em className={`pixel-action action-${pandaTrader.action.toLowerCase()}`}>
            {pandaTrader.action}
          </em>
        </div>
        <div className="pixel-selected-source-state source-panda">
          <strong>◇ Panda thesis · simulated</strong>
          <p>{pandaTrader.beliefAfter}</p>
          <span>
            {pandaTrader.action} · {Math.round(pandaTrader.confidence * 100)}% confidence ·{' '}
            {formatSignedCompact(pandaTrader.pnl)} {pandaTrader.currency ?? 'CNY'}
          </span>
        </div>
        <div className={`pixel-selected-source-state source-${testnetDashboard.source}`}>
          <strong>
            {testnetDashboard.source === 'injective' ? '◆' : '◈'} Injective ·{' '}
            {testnetDashboard.source === 'injective' ? 'verified' : 'preview'}
          </strong>
          <p>{formatTestnetAgentState(testnetTrader, testnetDashboard)}</p>
          <span>{testnetTrader?.activity ?? 'Awaiting a chain-backed account observation.'}</span>
        </div>
        <button type="button" className="pixel-detail-button" onClick={onOpenDetails}>
          Open full evidence
        </button>
      </article>
    </div>
  );
}

function formatTestnetAgentState(
  trader: DashboardTrader | undefined,
  dashboard: TradeTownDashboard,
) {
  if (!trader || dashboard.source !== 'injective' || trader.tradeCount === 0) {
    return 'No confirmed fill';
  }
  const currency = trader.currency ?? dashboard.markets[0]?.quoteCurrency ?? 'INJ';
  return `${trader.positions.length} position${trader.positions.length === 1 ? '' : 's'} · ${formatSignedCompact(trader.pnl)} ${currency}`;
}

function TownSummary({
  testnetDashboard,
  dayViewDashboard,
}: {
  testnetDashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
}) {
  const pandaCurrency = dayViewDashboard.markets[0]?.quoteCurrency ?? 'CNY';
  const testnetCurrency = testnetDashboard.markets[0]?.quoteCurrency ?? 'INJ';
  const groups = [
    {
      source: 'panda',
      label: '◇ Simulated · Panda',
      status: `${formatMarketDate(dayViewDashboard.asOf)} · generated replay`,
      items: [
        ['Sim AUM', formatMoney(dayViewDashboard.summary.aum, pandaCurrency)],
        ['Sim exposure', formatMoney(dayViewDashboard.summary.totalExposure, pandaCurrency)],
        ['Day volume', formatCompact(dayViewDashboard.summary.volume)],
        ['Top agent', dayViewDashboard.summary.topAgent],
      ],
    },
    {
      source: testnetDashboard.source,
      label:
        testnetDashboard.source === 'injective'
          ? '◆ Verified · Injective'
          : '◈ Preview · Injective',
      status:
        testnetDashboard.source === 'injective'
          ? `chain truth${testnetDashboard.blockHeight ? ` · #${testnetDashboard.blockHeight.toLocaleString()}` : ''}`
          : 'awaiting confirmed fills',
      items: [
        ['Chain AUM', formatMoney(testnetDashboard.summary.aum, testnetCurrency)],
        ['Real exposure', formatMoney(testnetDashboard.summary.totalExposure, testnetCurrency)],
        ['Run volume', formatCompact(testnetDashboard.summary.volume)],
        ['Data issues', String(testnetDashboard.errors.length)],
      ],
    },
  ];

  return (
    <section className="pixel-town-summary is-unified" aria-label="Dual-source town summary">
      {groups.map((group) => (
        <section className={`pixel-summary-source source-${group.source}`} key={group.label}>
          <header>
            <strong>{group.label}</strong>
            <span>{group.status}</span>
          </header>
          <div className="pixel-summary-metrics">
            {group.items.map(([label, value]) => (
              <div
                key={label}
                className={
                  label === 'Data issues' && testnetDashboard.errors.length > 0
                    ? 'has-warning'
                    : undefined
                }
                title={
                  label === 'Data issues'
                    ? testnetDashboard.errors.map((error) => error.message).join('\n')
                    : undefined
                }
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function ActivityBoard({
  testnetDashboard,
  dayViewDashboard,
  drawer = false,
}: {
  testnetDashboard: TradeTownDashboard;
  dayViewDashboard: TradeTownDashboard;
  drawer?: boolean;
}) {
  const [tab, setTab] = useState<ActivityTab>('timeline');
  const chainEvents = testnetDashboard.events.filter(
    (event) => event.kind === 'chain' || Boolean(event.proof),
  );
  const testnetStatusEvent: CausalEvent = {
    id: 'injective-status',
    time: formatClock(testnetDashboard.asOf),
    kind: testnetDashboard.source === 'injective' ? 'chain' : 'error',
    actor: 'Injective Gateway',
    title:
      testnetDashboard.source === 'injective'
        ? 'Connected · no confirmed fill yet'
        : 'Testnet evidence pending',
    detail:
      testnetDashboard.source === 'injective'
        ? 'The gateway is connected. Explorer proof appears here after a confirmed order or fill.'
        : 'Preview values stay isolated from Panda simulation and never update verified balances.',
  };
  const timeline: Array<{ record: CausalEvent; source: RecordSource }> = [
    ...dayViewDashboard.events.map((record) => ({ record, source: 'panda' as const })),
    ...(chainEvents.length > 0
      ? chainEvents.map((record) => ({
          record,
          source:
            testnetDashboard.source === 'injective' ? ('injective' as const) : ('preview' as const),
        }))
      : [{ record: testnetStatusEvent, source: 'preview' as const }]),
  ].sort((left, right) => left.record.time.localeCompare(right.record.time));
  const social: Array<{ record: SocialActivity; source: RecordSource }> =
    dayViewDashboard.social.map((record) => ({ record, source: 'panda' }));
  const executions: Array<{ record: DashboardExecution; source: RecordSource }> = [
    ...dayViewDashboard.executions.map((record) => ({ record, source: 'panda' as const })),
    ...testnetDashboard.executions
      .filter((record) => !record.isSimulated)
      .map((record) => ({
        record,
        source:
          testnetDashboard.source === 'injective' ? ('injective' as const) : ('preview' as const),
      })),
  ];
  const count =
    tab === 'timeline' ? timeline.length : tab === 'social' ? social.length : executions.length;

  return (
    <section className={`pixel-event-board is-unified ${drawer ? 'is-drawer' : ''}`}>
      <div className="pixel-board-title pixel-event-title">
        <div>
          <span>Cross-source evidence chain · simulation never counts as chain truth</span>
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
          {timeline.map(({ record: event, source }, index) => (
            <article
              key={`${source}-${event.id}`}
              className={`pixel-event event-${event.kind} source-${source}`}
            >
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{event.time}</time>
              <EventSourceTag source={source} />
              <strong>{event.title}</strong>
              <small>{event.actor}</small>
              <p>{event.detail}</p>
              {event.proof &&
                (source === 'injective' ? (
                  <a
                    className="pixel-explorer-link"
                    href={`https://testnet.explorer.injective.network/transaction/${event.proof}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer ↗ · {formatReference(event.proof)}
                  </a>
                ) : (
                  <code>{formatReference(event.proof)}</code>
                ))}
            </article>
          ))}
        </div>
      )}

      {tab === 'social' && (
        <div className="pixel-event-track">
          {social.map(({ record: item, source }, index) => (
            <article
              key={`${source}-${item.id}`}
              className={`pixel-event event-interaction source-${source}`}
            >
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{item.time}</time>
              <EventSourceTag source={source} />
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
          {executions.length === 0 && (
            <div className="pixel-empty-state">
              <strong>No executions</strong>
              <span>Panda simulation and Injective verification remain separate here.</span>
            </div>
          )}
          {executions.map(({ record: execution, source }, index) => (
            <article
              key={`${source}-${execution.id}`}
              className={`pixel-event event-${execution.type} source-${source}`}
            >
              <span className="pixel-event-number">{String(index + 1).padStart(2, '0')}</span>
              <time>{execution.time}</time>
              <EventSourceTag source={source} />
              <strong>
                {execution.side} {execution.quantity} {execution.symbol}
              </strong>
              <small>
                {execution.agentName} · {execution.state}
              </small>
              <p>
                {execution.reason ??
                  `${formatPrice(execution.price)} ${
                    execution.priceUnit ??
                    (source === 'panda' ? dayViewDashboard : testnetDashboard).markets.find(
                      (market) => market.symbol === execution.symbol,
                    )?.quoteCurrency ??
                    (source === 'panda' ? 'CNY' : 'INJ')
                  } · ${execution.isSimulated ? 'SIMULATED' : 'INJECTIVE'}`}
              </p>
              {execution.reference &&
                (source === 'injective' ? (
                  <a
                    className="pixel-explorer-link"
                    href={`https://testnet.explorer.injective.network/transaction/${execution.reference}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer ↗ · {formatReference(execution.reference)}
                  </a>
                ) : (
                  <code>{formatReference(execution.reference)}</code>
                ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EventSourceTag({ source }: { source: RecordSource }) {
  return (
    <span className={`pixel-event-source source-${source}`}>
      {source === 'panda'
        ? '◇ Panda · sim'
        : source === 'injective'
          ? '◆ Injective · verified'
          : '◈ Injective · preview'}
    </span>
  );
}

function AgentDetailDrawer({
  trader,
  testnetTrader,
  testnetDashboard,
  avatarIndex,
  executions,
  onClose,
}: {
  trader: DashboardTrader;
  testnetTrader?: DashboardTrader;
  testnetDashboard: TradeTownDashboard;
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
        <div className="pixel-agent-source-strip">
          <span className="source-panda">◇ Panda · simulated reasoning</span>
          <span className={`source-${testnetDashboard.source}`}>
            {testnetDashboard.source === 'injective'
              ? '◆ Injective · verified'
              : '◈ Injective · preview'}
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
              <section className={`pixel-detail-section source-${testnetDashboard.source}`}>
                <span>{testnetDashboard.source === 'injective' ? '◆' : '◈'} Injective status</span>
                <p>{formatTestnetAgentState(testnetTrader, testnetDashboard)}</p>
              </section>
            </>
          )}

          {tab === 'portfolio' && (
            <>
              <div className="pixel-detail-metrics">
                <Metric label="Start NAV" value={formatMoney(trader.navStart, trader.currency)} />
                <Metric label="End NAV" value={formatMoney(trader.navEnd, trader.currency)} />
                <Metric
                  label="PnL"
                  value={formatSignedCompact(trader.pnl)}
                  tone={trader.pnl >= 0 ? 'positive' : 'negative'}
                />
                <Metric label="Cash" value={formatMoney(trader.cash, trader.currency)} />
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
              <section className={`pixel-detail-section source-${testnetDashboard.source}`}>
                <span>
                  {testnetDashboard.source === 'injective'
                    ? '◆ Verified testnet portfolio'
                    : '◈ Testnet portfolio preview'}
                </span>
                {testnetDashboard.source === 'injective' && testnetTrader ? (
                  <p>
                    {formatMoney(
                      testnetTrader.navEnd,
                      testnetTrader.currency ?? testnetDashboard.markets[0]?.quoteCurrency ?? 'INJ',
                    )}{' '}
                    NAV · {testnetTrader.positions.length} open position
                    {testnetTrader.positions.length === 1 ? '' : 's'}
                  </p>
                ) : (
                  <p>No chain-backed balance is available yet.</p>
                )}
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
                      `${formatPrice(execution.price)} ${execution.priceUnit ?? trader.currency ?? 'INJ'} · ${execution.state}`}
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

function SourceBadge({
  dashboard,
  label,
  source,
  title,
}: {
  dashboard: TradeTownDashboard;
  label?: string;
  source?: TradeTownDashboard['source'];
  title?: string;
}) {
  const resolvedSource = source ?? dashboard.source;
  return (
    <span
      className={`pixel-source-badge source-${resolvedSource}`}
      title={title ?? dashboard.sourceLabel}
    >
      {label ??
        (resolvedSource === 'panda'
          ? 'PANDA'
          : resolvedSource === 'injective'
            ? 'CHAIN'
            : 'PREVIEW')}
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

function formatClock(value: number) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMarketDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatReference(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}
