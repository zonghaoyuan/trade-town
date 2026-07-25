import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { TOWN_TRADERS } from '../../../shared/finance';
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
import { emptyTownActivityFeed, type TownActivityFeed } from '../../../shared/activity';
import TownActivityPanel from './TownActivityPanel';
import CreateMeModal, { CreatedMeView, CreateMePayload } from '../create-me/CreateMeModal';
import { loadCreatedMe } from '../../features/create-me/storage';
import { augmentDashboardWithMe, getMeAgentName } from '../../finance/meSimulation';
import { PANDA_REPLAY_SPEEDS, type PandaReplayController } from '../../finance/usePandaReplay';

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
  avatarUrl?: string;
  pnlSource: 'simulated' | 'verified';
};

type TownRenderState = {
  focusedCitizen: FocusedTownCitizen | null;
};

export type ReplayDisplayState = {
  mode: 'llm' | 'deterministic';
  dayIndex: number;
  dayCount: number;
  currentDate: string;
  status: 'replaying' | 'waiting' | 'completed' | 'failed' | 'paused';
  controller?: PandaReplayController;
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
  replay,
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
  replay?: ReplayDisplayState;
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

  const activeMe =
    currentMe && localMe
      ? (localMe.version ?? 0) > (currentMe.version ?? 0)
        ? localMe
        : currentMe
      : (currentMe ?? localMe);
  const baseActiveDashboard = dayViewDashboards?.[selectedSymbol] ?? dayViewDashboard;
  const activeDashboard = useMemo(
    () => augmentDashboardWithMe(baseActiveDashboard, activeMe, selectedSymbol),
    [activeMe, baseActiveDashboard, selectedSymbol],
  );
  const market =
    activeDashboard.markets.find((candidate) => candidate.symbol === selectedSymbol) ??
    activeDashboard.markets[0];
  const trader =
    activeDashboard.traders.find((candidate) => candidate.name === selectedAgent) ??
    activeDashboard.traders[0];
  const immersive = viewMode === 'immersive';

  useEffect(() => {
    const symbolExists = activeDashboard.markets.some(
      (candidate) => candidate.symbol === selectedSymbol,
    );
    if (!symbolExists) {
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
  const focusedFinancialTrader = focusedTrader
    ? resolveAgentFinancialTrader(
        focusedTrader,
        dashboard.traders.find((candidate) => candidate.name === focusedTrader.name),
        dashboard,
      )
    : undefined;
  const focusedCitizen: FocusedTownCitizen | null = focusedTrader
    ? {
        requestId: focusRequest!.requestId,
        name: focusedTrader.name,
        role: focusedTrader.role,
        pnl: focusedFinancialTrader!.pnl,
        pnlSource: focusedFinancialTrader === focusedTrader ? 'simulated' : 'verified',
        avatarIndex: Math.max(0, townTraderAvatarIndex(focusedTrader.name)),
        avatarUrl: focusedTrader.avatarUrl,
      }
    : null;
  const townContent = typeof town === 'function' ? town({ focusedCitizen }) : town;

  return (
    <main
      className={`pixel-town-shell ${immersive ? 'is-immersive' : 'is-overview'}${
        immersive && drawer ? ' has-hud-drawer' : ''
      }`}
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

        {replay && <ReplayStatus replay={replay} />}

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
            dashboard={activeDashboard}
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
          </div>

          <TownActivityPanel
            activity={activityFeed}
            contextEvents={activeDashboard.events}
            contextExecutions={replay?.mode === 'llm' ? [] : activeDashboard.executions}
            contextAsOf={activeDashboard.asOf}
          />
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
          className={drawer === 'activity' ? 'is-active' : undefined}
          aria-expanded={drawer === 'activity'}
          aria-controls="town-activity-drawer"
          onClick={() => setDrawer(drawer === 'activity' ? null : 'activity')}
        >
          <span aria-hidden="true">{immersive ? '“' : '!'}</span>
          {immersive ? 'Agent Talk' : 'Activity'}
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
        <section
          id={drawer === 'activity' ? 'town-activity-drawer' : undefined}
          className={`pixel-hud-drawer drawer-${drawer}`}
          aria-label={drawer === 'activity' ? 'Agent Talk panel' : `${drawer} panel`}
        >
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
              contextExecutions={replay?.mode === 'llm' ? [] : activeDashboard.executions}
              contextAsOf={activeDashboard.asOf}
              drawer
            />
          )}
        </section>
      )}

      {agentDetailOpen &&
        trader &&
        (() => {
          const financialTrader = resolveAgentFinancialTrader(
            trader,
            dashboard.traders.find((candidate) => candidate.name === trader.name),
            dashboard,
          );
          const executions = (
            financialTrader === trader ? activeDashboard.executions : dashboard.executions
          ).filter((execution) => execution.agentName === trader.name);

          return (
            <AgentDetailDrawer
              reasoningTrader={trader}
              financialTrader={financialTrader}
              avatarIndex={townTraderAvatarIndex(trader.name)}
              executions={executions}
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
                  Agent outputs are generated by the town. Orders, fills, positions, and assets use
                  available financial records.
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

      {createMeOpen && (
        <CreateMeModal
          initialMe={activeMe}
          onClose={() => setCreateMeOpen(false)}
          onSubmit={onCreateMe}
          onCreated={(me) => {
            setLocalMe(me);
            setSelectedAgent(
              getMeAgentName(
                me.draft.displayName,
                baseActiveDashboard.traders.map((candidate) => candidate.name),
              ),
            );
          }}
        />
      )}
    </main>
  );
}

function ReplayStatus({ replay }: { replay: ReplayDisplayState }) {
  const controller = replay.mode === 'deterministic' ? replay.controller : undefined;
  const atStart = replay.dayIndex <= 0;
  const atEnd = replay.dayIndex >= replay.dayCount - 1;
  const statusLabel = {
    replaying: 'REPLAYING',
    waiting: 'WAITING',
    completed: 'COMPLETED',
    failed: 'FAILED',
    paused: 'PAUSED',
  }[replay.status];

  return (
    <section
      className={`pixel-replay-status is-${replay.status}`}
      aria-label={`Replay day ${replay.dayIndex + 1} of ${replay.dayCount}, ${replay.currentDate}, ${statusLabel.toLowerCase()}`}
      aria-live="polite"
    >
      <div className="pixel-replay-status-copy">
        <span>
          DAY {replay.dayIndex + 1}/{replay.dayCount}
        </span>
        <time dateTime={replay.currentDate} data-short-date={replay.currentDate.slice(5)}>
          {replay.currentDate}
        </time>
        <small>
          <i aria-hidden="true" />
          {statusLabel}
        </small>
      </div>
      {controller && (
        <div className="pixel-replay-status-controls" aria-label="Panda replay controls">
          <button
            type="button"
            aria-label="Previous Panda day"
            title="Previous day"
            onClick={() => controller.step(-1)}
            disabled={atStart}
          >
            ◀
          </button>
          <button
            type="button"
            className="is-primary"
            aria-label={controller.isPlaying ? 'Pause replay' : 'Play replay'}
            onClick={controller.togglePlaying}
          >
            {controller.isPlaying ? 'Ⅱ' : '▶'}
          </button>
          <button
            type="button"
            aria-label="Next Panda day"
            title="Next day"
            onClick={() => controller.step(1)}
            disabled={atEnd}
          >
            ▶
          </button>
          <select
            aria-label="Replay speed"
            value={controller.speedMs}
            onChange={(event) => controller.setSpeed(Number(event.target.value))}
          >
            {PANDA_REPLAY_SPEEDS.map((speed) => (
              <option value={speed} key={speed}>
                {speed === 400 ? '2.5×' : speed === 1_000 ? '1×' : '0.5×'}
              </option>
            ))}
          </select>
          <label className="pixel-replay-loop" title="Automatically restart after the last day">
            <input
              type="checkbox"
              checked={controller.isLooping}
              onChange={controller.toggleLooping}
            />
            <span aria-hidden="true">
              <i />
            </span>
            <em>LOOP</em>
          </label>
        </div>
      )}
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
          <small className={market.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.changePct >= 0 ? '+' : ''}
            {market.changePct.toFixed(2)}%
          </small>
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
          <dd>{formatCompact(market.volume)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{formatPrice(market.referencePrice)}</dd>
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
              <strong>{item.displayName}</strong>
              <small>
                {formatPrice(item.lastPrice)} {item.quoteCurrency ?? 'CNY'} · {item.symbol}
              </small>
            </span>
            <span className={item.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
              {item.changePct >= 0 ? '+' : ''}
              {item.changePct.toFixed(2)}%
            </span>
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
  const financialTrader = resolveAgentFinancialTrader(
    pandaTrader,
    testnetDashboard.traders.find((candidate) => candidate.name === pandaTrader.name),
    testnetDashboard,
  );
  const rankedTraders = [...dayViewDashboard.traders].sort(
    (left, right) => right.navEnd - left.navEnd || left.name.localeCompare(right.name),
  );
  const traderIndex = townTraderAvatarIndex(pandaTrader.name);
  const selectedRank =
    rankedTraders.findIndex((candidate) => candidate.name === pandaTrader.name) + 1;

  return (
    <div className="pixel-board pixel-unified-agent-board">
      <div className="pixel-board-title">
        <h2>Citizens</h2>
      </div>
      <div className="pixel-agent-list">
        {rankedTraders.map((agent, index) => (
          <button
            type="button"
            key={agent.name}
            className={agent.name === pandaTrader.name ? 'is-selected' : ''}
            data-town-citizen-focus
            onClick={() => onSelect(agent.name)}
          >
            <strong className={`pixel-agent-rank rank-${index + 1}`}>#{index + 1}</strong>
            <PixelAvatar index={townTraderAvatarIndex(agent.name)} textureUrl={agent.avatarUrl} />
            <span className="pixel-agent-identity">
              <strong>{agent.name}</strong>
              <small title={agent.role}>{agent.role}</small>
            </span>
            <span className="pixel-agent-scan-state">
              <em className={`pixel-action action-${agent.action.toLowerCase()}`}>
                {agent.action}
              </em>
              <strong className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {formatCompact(agent.navEnd)} {agent.currency ?? 'CNY'}
              </strong>
              <small className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {formatSignedPercent(agent.navStart > 0 ? (agent.pnl / agent.navStart) * 100 : 0)}
              </small>
            </span>
          </button>
        ))}
      </div>
      <article className="pixel-agent-card pixel-agent-summary-card">
        <div className="pixel-agent-card-identity">
          <PixelAvatar index={traderIndex} textureUrl={pandaTrader.avatarUrl} />
          <div>
            <h3>
              #{selectedRank} {pandaTrader.name}
            </h3>
            <span>
              {formatCompact(pandaTrader.navEnd)} {pandaTrader.currency ?? 'CNY'} NAV
            </span>
          </div>
          <em className={`pixel-action action-${pandaTrader.action.toLowerCase()}`}>
            {pandaTrader.action}
          </em>
        </div>
        <div className="pixel-selected-agent-state">
          <strong>Agent reasoning</strong>
          <p>{pandaTrader.beliefAfter}</p>
        </div>
        <div className="pixel-agent-summary-metrics">
          <div>
            <span>Confidence</span>
            <strong>{Math.round(pandaTrader.confidence * 100)}%</strong>
          </div>
          <div>
            <span>P&amp;L</span>
            <strong className={financialTrader.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
              {formatSignedCompact(financialTrader.pnl)}
            </strong>
          </div>
          <div>
            <span>Position</span>
            <strong>
              {financialTrader.positions.length > 0
                ? `${financialTrader.positions.length} OPEN`
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

function resolveAgentFinancialTrader(
  fallbackTrader: DashboardTrader,
  recordedTrader: DashboardTrader | undefined,
  dashboard: TradeTownDashboard,
) {
  const hasRecordedFinancialState =
    dashboard.source === 'injective' &&
    Boolean(recordedTrader) &&
    (recordedTrader!.tradeCount > 0 ||
      recordedTrader!.positions.length > 0 ||
      recordedTrader!.orderCount > 0);

  return hasRecordedFinancialState ? recordedTrader! : fallbackTrader;
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
  reasoningTrader,
  financialTrader,
  avatarIndex,
  executions,
  onClose,
}: {
  reasoningTrader: DashboardTrader;
  financialTrader: DashboardTrader;
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
          <PixelAvatar index={avatarIndex} textureUrl={reasoningTrader.avatarUrl} />
          <div>
            <span>Agent intelligence</span>
            <h2>{reasoningTrader.name}</h2>
            <p>{reasoningTrader.role}</p>
          </div>
          <em className={`pixel-action action-${reasoningTrader.action.toLowerCase()}`}>
            {reasoningTrader.action}
          </em>
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
                    <em>{execution.type.toUpperCase()}</em>
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

function formatSignedCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function townTraderAvatarIndex(name: string) {
  const knownIndex = TOWN_TRADERS.findIndex((candidate) => candidate.name === name);
  if (knownIndex >= 0) return knownIndex;
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return hash % Math.max(1, TOWN_TRADERS.length);
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

function formatReference(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}
