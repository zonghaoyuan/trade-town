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
import LanguageSwitcher from '../LanguageSwitcher';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import {
  localizeMarketName,
  localizeTraderRole,
} from '../../i18n/domain';

type ViewMode = 'overview' | 'immersive';
type Drawer = 'markets' | 'agents' | 'activity';
type ActivityTab = 'timeline' | 'social' | 'trades';
type AgentTab = 'belief' | 'portfolio' | 'risk' | 'trades';
type RecordSource = 'panda' | 'injective' | 'preview';

const drawerIds: Record<Drawer, string> = {
  markets: 'town-markets-drawer',
  agents: 'town-agents-drawer',
  activity: 'town-activity-drawer',
};

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
  hudInspectorOpen: boolean;
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
  const { locale, t } = useI18n();
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
  const hasCompactReplay = replay?.mode === 'deterministic' && Boolean(replay.controller);

  useEffect(() => {
    const symbolExists = activeDashboard.markets.some(
      (candidate) => candidate.symbol === selectedSymbol,
    );
    const agentExists = activeDashboard.traders.some(
      (candidate) => candidate.name === selectedAgent,
    );
    if (!symbolExists) {
      setSelectedSymbol(activeDashboard.markets[0]?.symbol ?? '');
    }
    if (!agentExists) {
      setSelectedAgent(activeDashboard.traders[0]?.name ?? '');
    }
    if (!symbolExists || !agentExists) {
      setFocusRequest(null);
      setAgentDetailOpen(false);
    }
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

  const toggleDrawer = (nextDrawer: Drawer) => {
    setAgentDetailOpen(false);
    setDrawer((current) => (current === nextDrawer ? null : nextDrawer));
  };

  const openHelp = () => {
    setDrawer(null);
    setAgentDetailOpen(false);
    setHelpOpen(true);
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
        role: localizeTraderRole(
          locale,
          focusedTrader.name,
          focusedTrader.role,
        ),
        pnl: focusedFinancialTrader!.pnl,
        pnlSource: focusedFinancialTrader === focusedTrader ? 'simulated' : 'verified',
        avatarIndex: Math.max(0, townTraderAvatarIndex(focusedTrader.name)),
        avatarUrl: focusedTrader.avatarUrl,
      }
    : null;
  const townContent =
    typeof town === 'function'
      ? town({ focusedCitizen, hudInspectorOpen: drawer !== null })
      : town;

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

      <header
        className={`pixel-town-header${hasCompactReplay ? ' has-compact-replay' : ''}`}
      >
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
              aria-label={t('shell.pandaAria')}
            >
              <span className="pixel-panda-mark" aria-hidden="true">
                <img src="/assets/brand/pandaai-mark.svg" alt="" />
              </span>
              <span className="pixel-brand-credit-full">{t('shell.pandaFull')}</span>
              <span className="pixel-brand-credit-compact">{t('shell.pandaCompact')}</span>
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
            aria-label={
              activeMe ? t('shell.editCharacter') : t('shell.createCharacter')
            }
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
                <span className="pixel-create-me-symbol">+</span>
                <span className="pixel-create-me-label-full">{t('shell.createMe')}</span>
                <span className="pixel-create-me-label-compact">ME</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="pixel-button pixel-button-small pixel-help-trigger"
            aria-haspopup="dialog"
            onClick={openHelp}
          >
            <span>?</span> {t('common.help')}
          </button>
          <button
            type="button"
            className="pixel-button pixel-view-toggle"
            aria-pressed={immersive}
            onClick={toggleView}
          >
            <span aria-hidden="true">{immersive ? '↙' : '↗'}</span>
            {immersive ? t('shell.marketView') : t('shell.fullTown')}
          </button>
          <LanguageSwitcher />
          <InjectiveConnectionStatus />
        </div>

        {hasCompactReplay && replay && <CompactReplayControls replay={replay} />}
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
              <div className="pixel-stage-controls" aria-label={t('shell.townControls')}>
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

        <aside
          className="pixel-side-panel pixel-agent-panel"
          aria-label={t('shell.townCitizens')}
        >
          <AgentBoard
            testnetDashboard={dashboard}
            dayViewDashboard={activeDashboard}
            selectedAgent={trader?.name ?? ''}
            onSelect={focusCitizen}
            onOpenDetails={() => setAgentDetailOpen(true)}
          />
        </aside>
      </div>

      <nav className="pixel-hud-dock" aria-label={t('shell.townInformation')}>
        <button
          type="button"
          className={drawer === 'markets' ? 'is-active' : undefined}
          aria-expanded={drawer === 'markets'}
          aria-controls={drawerIds.markets}
          onClick={() => toggleDrawer('markets')}
        >
          <span aria-hidden="true">▥</span> {t('common.markets')}
        </button>
        <button
          type="button"
          className={drawer === 'agents' ? 'is-active' : undefined}
          aria-expanded={drawer === 'agents'}
          aria-controls={drawerIds.agents}
          onClick={() => toggleDrawer('agents')}
        >
          <span aria-hidden="true">♟</span> {t('common.citizens')}
        </button>
        <button
          type="button"
          className={drawer === 'activity' ? 'is-active' : undefined}
          aria-expanded={drawer === 'activity'}
          aria-controls={drawerIds.activity}
          onClick={() => toggleDrawer('activity')}
        >
          <span aria-hidden="true">{immersive ? '“' : '!'}</span>
          {immersive ? t('common.agentTalk') : t('common.activity')}
        </button>
        {immersive && (
          <button
            type="button"
            className="pixel-hud-help"
            aria-haspopup="dialog"
            onClick={openHelp}
          >
            <span aria-hidden="true">?</span> {t('common.help')}
          </button>
        )}
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
              {activeMe ? t('shell.editMe') : t('shell.create')}
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={openHelp}
            >
              <span aria-hidden="true">?</span> {t('common.help')}
            </button>
          </>
        )}
      </nav>

      {drawer && (
        <section
          id={drawerIds[drawer]}
          className={`pixel-hud-drawer drawer-${drawer}`}
          aria-label={
            drawer === 'activity'
              ? t('shell.drawerActivity')
              : drawer === 'markets'
                ? t('shell.drawerMarkets')
                : t('shell.drawerAgents')
          }
        >
          <div className="pixel-hud-drawer-toolbar">
            <button
              type="button"
              className="pixel-drawer-close"
              aria-label={t('shell.closePanel')}
              onClick={() => setDrawer(null)}
            >
              ×
            </button>
          </div>
          <div className="pixel-hud-drawer-body">
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
          </div>
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
              aria-label={t('help.close')}
              onClick={() => setHelpOpen(false)}
            >
              ×
            </button>
            <span className="pixel-modal-kicker">{t('help.kicker')}</span>
            <h2 id="town-help-title">{t('help.title')}</h2>
            <p>{t('help.intro')}</p>
            <div className="pixel-help-grid">
              <div>
                <strong>{t('help.pandaTitle')}</strong>
                <span>{t('help.pandaBody')}</span>
              </div>
              <div>
                <strong>{t('help.recordsTitle')}</strong>
                <span>{t('help.recordsBody')}</span>
              </div>
            </div>
            <div
              className="pixel-platform-credits"
              aria-label={t('help.sourcesAria')}
            >
              <span>{t('common.sources')}</span>
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
            <p>{t('help.demo')}</p>
            <p className="pixel-asset-credits">
              {t('help.visualsPrefix')}{' '}
              <a href="https://kenney.nl/assets/rpg-urban-pack" target="_blank" rel="noreferrer">
                Kenney RPG Urban Pack
              </a>{' '}
              {t('help.visualsMiddle')}{' '}
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
                {t('help.visualsCredits')}
              </a>
            </p>
            <p className="pixel-help-shortcuts">{t('help.shortcuts')}</p>
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
  const { t } = useI18n();
  const statusKey = {
    replaying: 'replay.status.replaying',
    waiting: 'replay.status.waiting',
    completed: 'replay.status.completed',
    failed: 'replay.status.failed',
    paused: 'replay.status.paused',
  } satisfies Record<ReplayDisplayState['status'], MessageKey>;
  const statusLabel = t(statusKey[replay.status]);

  return (
    <section
      className={`pixel-replay-status is-${replay.status}`}
      aria-label={t('replay.aria', {
        current: replay.dayIndex + 1,
        total: replay.dayCount,
        date: replay.currentDate,
        status: statusLabel,
      })}
      aria-live="polite"
    >
      <div className="pixel-replay-status-copy">
        <span>
          {t('replay.dayDisplay', {
            current: replay.dayIndex + 1,
            total: replay.dayCount,
          })}
        </span>
        <time dateTime={replay.currentDate} data-short-date={replay.currentDate.slice(5)}>
          {replay.currentDate}
        </time>
        <small>
          <i aria-hidden="true" />
          {statusLabel}
        </small>
      </div>
      <ReplayControls replay={replay} />
    </section>
  );
}

function CompactReplayControls({ replay }: { replay: ReplayDisplayState }) {
  const { t } = useI18n();
  return (
    <div
      className="pixel-compact-replay"
      aria-label={t('replay.compactAria', {
        current: replay.dayIndex + 1,
        total: replay.dayCount,
      })}
    >
      <span className="pixel-compact-replay-day">
        {t('replay.dayDisplay', {
          current: replay.dayIndex + 1,
          total: replay.dayCount,
        })}
      </span>
      <ReplayControls replay={replay} compact />
    </div>
  );
}

function ReplayControls({
  replay,
  compact = false,
}: {
  replay: ReplayDisplayState;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const controller = replay.mode === 'deterministic' ? replay.controller : undefined;
  if (!controller) return null;

  const atStart = replay.dayIndex <= 0;
  const atEnd = replay.dayIndex >= replay.dayCount - 1;

  if (compact) {
    return (
      <div
        className="pixel-compact-replay-controls"
        aria-label={t('replay.compactControls')}
      >
        <button
          type="button"
          className="pixel-replay-primary"
          aria-label={
            controller.isPlaying ? t('replay.pause') : t('replay.play')
          }
          onClick={controller.togglePlaying}
        >
          {controller.isPlaying ? 'Ⅱ' : '▶'}
        </button>
        <select
          className="pixel-replay-speed"
          aria-label={t('replay.speed')}
          value={controller.speedMs}
          onChange={(event) => controller.setSpeed(Number(event.target.value))}
        >
          {PANDA_REPLAY_SPEEDS.map((speed) => (
            <option value={speed} key={speed}>
              {speed === 400 ? '2.5×' : speed === 1_000 ? '1×' : '0.5×'}
            </option>
          ))}
        </select>
        <details className="pixel-replay-more">
          <summary aria-label={t('replay.more')}>•••</summary>
          <div className="pixel-replay-more-menu" aria-label={t('replay.additional')}>
            <button
              type="button"
              aria-label={t('replay.previous')}
              title={t('replay.previousTitle')}
              onClick={() => controller.step(-1)}
              disabled={atStart}
            >
              {t('replay.previousButton')}
            </button>
            <button
              type="button"
              aria-label={t('replay.next')}
              title={t('replay.nextTitle')}
              onClick={() => controller.step(1)}
              disabled={atEnd}
            >
              {t('replay.nextButton')}
            </button>
            <label className="pixel-replay-loop" title={t('replay.loopTitle')}>
              <input
                type="checkbox"
                checked={controller.isLooping}
                onChange={controller.toggleLooping}
              />
              <span aria-hidden="true">
                <i />
              </span>
              <em>{t('replay.loop')}</em>
            </label>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="pixel-replay-status-controls" aria-label={t('replay.controls')}>
      <button
        type="button"
        aria-label={t('replay.previous')}
        title={t('replay.previousTitle')}
        onClick={() => controller.step(-1)}
        disabled={atStart}
      >
        ◀
      </button>
      <button
        type="button"
        className="is-primary"
        aria-label={controller.isPlaying ? t('replay.pause') : t('replay.play')}
        onClick={controller.togglePlaying}
      >
        {controller.isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <button
        type="button"
        aria-label={t('replay.next')}
        title={t('replay.nextTitle')}
        onClick={() => controller.step(1)}
        disabled={atEnd}
      >
        ▶
      </button>
      <select
        aria-label={t('replay.speed')}
        value={controller.speedMs}
        onChange={(event) => controller.setSpeed(Number(event.target.value))}
      >
        {PANDA_REPLAY_SPEEDS.map((speed) => (
          <option value={speed} key={speed}>
            {speed === 400 ? '2.5×' : speed === 1_000 ? '1×' : '0.5×'}
          </option>
        ))}
      </select>
      <label className="pixel-replay-loop" title={t('replay.loopTitle')}>
        <input
          type="checkbox"
          checked={controller.isLooping}
          onChange={controller.toggleLooping}
        />
        <span aria-hidden="true">
          <i />
        </span>
        <em>{t('replay.loop')}</em>
      </label>
    </div>
  );
}

function InjectiveConnectionStatus() {
  const { t } = useI18n();
  return (
    <div
      className="pixel-injective-status"
      role="status"
      aria-label={t('shell.injectiveConnected')}
      title={`Injective Testnet · ${t('common.connected')}`}
    >
      <span className="pixel-injective-status-mark" aria-hidden="true">
        <img src="/assets/brand/inj-logo.png" alt="" />
      </span>
      <span className="pixel-injective-status-copy">
        <span>Injective Testnet</span>
        <strong>
          <i aria-hidden="true" />
          {t('common.connected')}
        </strong>
      </span>
    </div>
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
  const { locale, t, formatNumber } = useI18n();
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
        <h2>{t('common.markets')}</h2>
      </div>
      <div className="pixel-market-hero">
        <h3>{market.symbol}</h3>
        <div>
          <strong>{formatPrice(market.lastPrice, formatNumber)}</strong>
          <small className={market.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
            {market.changePct >= 0 ? '+' : ''}
            {formatNumber(Math.abs(market.changePct), {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            %
          </small>
        </div>
        <small className="pixel-price-unit">
          {quoteCurrency} · {t('market.dayClose')}
        </small>
      </div>
      <PixelCandles
        values={market.candles}
        symbol={market.symbol}
        periodLabel={t('market.periodDay')}
        sourceLabel={t('market.pandaData')}
      />
      <div
        className="pixel-indicator-row"
        aria-label={t('market.indicatorsAria', { symbol: market.symbol })}
      >
        {market.indicators.map((indicator) => (
          <span key={indicator.label} className={`tone-${indicator.tone}`}>
            <small>{indicator.label}</small>
            <strong>{indicator.value}</strong>
          </span>
        ))}
      </div>
      <dl className="pixel-quote-grid pixel-quote-grid-four">
        <div>
          <dt>{t('market.dayVolume')}</dt>
          <dd>{formatCompact(market.volume, formatNumber)}</dd>
        </div>
        <div>
          <dt>{t('market.reference')}</dt>
          <dd>{formatPrice(market.referencePrice, formatNumber)}</dd>
        </div>
        <div>
          <dt>{t('market.dayHigh')}</dt>
          <dd>
            {formatPrice(latestCandle?.high ?? market.lastPrice, formatNumber)}
          </dd>
        </div>
        <div>
          <dt>{t('market.dayLow')}</dt>
          <dd>
            {formatPrice(latestCandle?.low ?? market.lastPrice, formatNumber)}
          </dd>
        </div>
      </dl>
      {hasSentiment ? (
        <div className="pixel-sentiment">
          <small className="pixel-sentiment-label">{t('market.consensus')}</small>
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
        <div className="pixel-sentiment pixel-sentiment-empty">
          {t('market.consensusUnavailable')}
        </div>
      )}
      <div
        className="pixel-market-list pixel-market-list-single"
        aria-label={t('market.listAria')}
      >
        {dashboard.markets.map((item) => (
          <button
            type="button"
            key={item.symbol}
            onClick={() => onSelect(item.symbol)}
            className={item.symbol === selectedSymbol ? 'is-selected' : ''}
          >
            <PixelMarketIcon symbol={item.symbol} accent={item.accent} />
            <span className="pixel-market-copy">
              <strong>
                {localizeMarketName(locale, item.symbol, item.displayName)}
              </strong>
              <small>
                {formatPrice(item.lastPrice, formatNumber)}{' '}
                {item.quoteCurrency ?? 'CNY'} · {item.symbol}
              </small>
            </span>
            <span className={item.changePct >= 0 ? 'pixel-up' : 'pixel-down'}>
              {item.changePct >= 0 ? '+' : ''}
              {formatNumber(Math.abs(item.changePct), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              %
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
  const { locale, t, formatNumber } = useI18n();
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
        <h2>{t('common.citizens')}</h2>
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
              <small title={localizeTraderRole(locale, agent.name, agent.role)}>
                {localizeTraderRole(locale, agent.name, agent.role)}
              </small>
            </span>
            <span className="pixel-agent-scan-state">
              <em className={`pixel-action action-${agent.action.toLowerCase()}`}>
                {agent.action}
              </em>
              <strong className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {t('agents.simulatedValue', {
                  value: formatCompact(agent.navEnd, formatNumber),
                  currency: agent.currency ?? 'CNY',
                })}
              </strong>
              <small className={agent.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                {formatSignedPercent(
                  agent.navStart > 0 ? (agent.pnl / agent.navStart) * 100 : 0,
                  formatNumber,
                )}
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
              {t('agents.simulatedNav', {
                value: formatCompact(pandaTrader.navEnd, formatNumber),
                currency: pandaTrader.currency ?? 'CNY',
              })}
            </span>
          </div>
          <em className={`pixel-action action-${pandaTrader.action.toLowerCase()}`}>
            {pandaTrader.action}
          </em>
        </div>
        <div className="pixel-selected-agent-state">
          <strong>{t('agents.reasoning')}</strong>
          <p>{pandaTrader.beliefAfter}</p>
        </div>
        <div className="pixel-agent-summary-metrics">
          <div>
            <span>{t('common.confidence')}</span>
            <strong>{Math.round(pandaTrader.confidence * 100)}%</strong>
          </div>
          <div>
            <span>P&amp;L</span>
            <strong className={financialTrader.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
              {formatSignedCompact(financialTrader.pnl, formatNumber)}
            </strong>
          </div>
          <div>
            <span>{t('common.position')}</span>
            <strong>
              {financialTrader.positions.length > 0
                ? `${financialTrader.positions.length} ${t('common.open')}`
                : t('common.flat')}
            </strong>
          </div>
        </div>
        <button type="button" className="pixel-detail-button" onClick={onOpenDetails}>
          {t('agents.viewDetails')}
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
  const { t, formatDateTime, formatNumber } = useI18n();
  const [tab, setTab] = useState<ActivityTab>('timeline');
  const chainEvents = testnetDashboard.events.filter(
    (event) => event.kind === 'chain' || Boolean(event.proof),
  );
  const testnetStatusEvent: CausalEvent = {
    id: 'injective-status',
    time: formatClock(testnetDashboard.asOf, formatDateTime),
    kind: testnetDashboard.source === 'injective' ? 'chain' : 'error',
    actor: t('intelligence.worker'),
    title:
      testnetDashboard.source === 'injective'
        ? t('intelligence.connectedTitle')
        : t('intelligence.pendingTitle'),
    detail:
      testnetDashboard.source === 'injective'
        ? t('intelligence.connectedDetail')
        : t('intelligence.pendingDetail'),
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
          <span>{t('intelligence.kicker')}</span>
          <h2>{t('intelligence.title')}</h2>
        </div>
        <div
          className="pixel-event-tabs"
          role="tablist"
          aria-label={t('intelligence.sections')}
        >
          {(['timeline', 'social', 'trades'] as ActivityTab[]).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'is-active' : ''}
              onClick={() => setTab(item)}
              key={item}
            >
              {t(
                {
                  timeline: 'intelligence.timeline',
                  social: 'intelligence.social',
                  trades: 'intelligence.trades',
                }[item] as MessageKey,
              )}
            </button>
          ))}
        </div>
        <strong>{t('common.records', { count })}</strong>
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
                    {t('intelligence.explorer', {
                      reference: formatReference(event.proof),
                    })}
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
              <strong>{t('intelligence.noExecutions')}</strong>
              <span>{t('intelligence.noExecutionsBody')}</span>
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
                  `${formatPrice(execution.price, formatNumber)} ${
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
                    {t('intelligence.explorer', {
                      reference: formatReference(execution.reference),
                    })}
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
  const { t } = useI18n();
  return (
    <span className={`pixel-event-source source-${source}`}>
      {source === 'panda'
        ? t('intelligence.sourcePanda')
        : source === 'injective'
          ? t('intelligence.sourceInjective')
          : t('intelligence.sourcePreview')}
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
  const { locale, t, formatNumber } = useI18n();
  const [tab, setTab] = useState<AgentTab>('belief');

  return (
    <div className="pixel-agent-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="pixel-agent-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('agents.detailsAria', { name: reasoningTrader.name })}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pixel-drawer-close"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          ×
        </button>
        <header>
          <PixelAvatar index={avatarIndex} textureUrl={reasoningTrader.avatarUrl} />
          <div>
            <span>{t('agents.intelligence')}</span>
            <h2>{reasoningTrader.name}</h2>
            <p>
              {localizeTraderRole(
                locale,
                reasoningTrader.name,
                reasoningTrader.role,
              )}
            </p>
          </div>
          <em className={`pixel-action action-${reasoningTrader.action.toLowerCase()}`}>
            {reasoningTrader.action}
          </em>
        </header>
        {financialTrader.injectiveAccount && (
          <InjectiveAccountCard account={financialTrader.injectiveAccount} />
        )}
        <nav
          className="pixel-agent-tabs"
          role="tablist"
          aria-label={t('agents.detailsTabs')}
        >
          {(['belief', 'portfolio', 'risk', 'trades'] as AgentTab[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'is-active' : ''}
              onClick={() => setTab(item)}
            >
              {t(`agents.tab.${item}` as MessageKey)}
            </button>
          ))}
        </nav>

        <div className="pixel-agent-drawer-content">
          {tab === 'belief' && (
            <>
              <div className="pixel-belief-compare">
                <article>
                  <span>{t('common.before')}</span>
                  <p>{reasoningTrader.beliefBefore}</p>
                </article>
                <b aria-hidden="true">→</b>
                <article>
                  <span>{t('common.after')}</span>
                  <p>{reasoningTrader.beliefAfter}</p>
                </article>
              </div>
              <section className="pixel-detail-section">
                <span>{t('agents.decisionThesis')}</span>
                <p>{reasoningTrader.thesis}</p>
              </section>
              <section className="pixel-detail-section">
                <span>{t('common.evidence')}</span>
                <div className="pixel-evidence-list">
                  {reasoningTrader.evidence.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              </section>
              <div className="pixel-detail-metrics">
                <Metric label={t('common.action')} value={reasoningTrader.action} />
                <Metric
                  label={t('common.confidence')}
                  value={`${Math.round(reasoningTrader.confidence * 100)}%`}
                />
                <Metric
                  label={t('agents.riskTolerance')}
                  value={`${Math.round(reasoningTrader.riskTolerance * 100)}`}
                />
              </div>
            </>
          )}

          {tab === 'portfolio' && (
            <>
              <div className="pixel-detail-metrics">
                <Metric
                  label={t('agents.startNav')}
                  value={formatMoney(
                    financialTrader.navStart,
                    financialTrader.currency,
                    formatNumber,
                  )}
                />
                <Metric
                  label={t('agents.endNav')}
                  value={formatMoney(
                    financialTrader.navEnd,
                    financialTrader.currency,
                    formatNumber,
                  )}
                />
                <Metric
                  label="PnL"
                  value={formatSignedCompact(financialTrader.pnl, formatNumber)}
                  tone={financialTrader.pnl >= 0 ? 'positive' : 'negative'}
                />
                <Metric
                  label={t('common.cash')}
                  value={formatMoney(
                    financialTrader.cash,
                    financialTrader.currency,
                    formatNumber,
                  )}
                />
              </div>
              <section className="pixel-position-list">
                <div className="pixel-position-head">
                  <span>{t('common.symbol')}</span>
                  <span>{t('common.quantity')}</span>
                  <span>{t('common.weight')}</span>
                  <span>PnL</span>
                </div>
                {financialTrader.positions.length === 0 && (
                  <p className="pixel-no-positions">{t('agents.noPositions')}</p>
                )}
                {financialTrader.positions.map((position) => (
                  <div key={position.symbol}>
                    <strong>{position.symbol}</strong>
                    <span>{formatNumber(position.quantity)}</span>
                    <span>{position.weightPct}%</span>
                    <span className={position.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                      {formatSignedCompact(position.pnl, formatNumber)}
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
                  label={t('agents.riskTolerance')}
                  value={`${Math.round(reasoningTrader.riskTolerance * 100)}`}
                />
                <Metric
                  label={t('agents.riskRejections')}
                  value={formatNumber(financialTrader.riskRejections)}
                />
                <Metric
                  label={t('common.orders')}
                  value={formatNumber(financialTrader.orderCount)}
                />
                <Metric
                  label={t('common.fills')}
                  value={formatNumber(financialTrader.tradeCount)}
                />
              </div>
              <section className="pixel-detail-section">
                <span>{t('agents.currentRisk')}</span>
                <p>
                  {financialTrader.riskRejections > 0
                    ? t('agents.riskBlocked', {
                        count: financialTrader.riskRejections,
                      })
                    : t('agents.riskClear')}
                </p>
              </section>
              <section className="pixel-detail-section">
                <span>{t('agents.ruleBoundary')}</span>
                <p>{t('agents.ruleBoundaryBody')}</p>
              </section>
            </>
          )}

          {tab === 'trades' && (
            <section className="pixel-agent-executions">
              {executions.length === 0 && (
                <div className="pixel-empty-state">
                  <strong>{t('agents.noExecutions')}</strong>
                  <span>{t('agents.noExecutionsBody')}</span>
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
                      `${formatPrice(execution.price, formatNumber)} ${
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

function InjectiveAccountCard({
  account,
}: {
  account: NonNullable<DashboardTrader['injectiveAccount']>;
}) {
  const { t, formatNumber } = useI18n();
  const proof = account.lastAction?.txHash;
  const secondaryProof = account.lastAction?.orderHash ?? account.lastAction?.tradeId;
  return (
    <section
      className="pixel-injective-account"
      aria-label={t('agents.injectiveAccount')}
    >
      <header>
        <span>{t('agents.injectiveVerified')}</span>
        <code>{formatReference(account.subaccountId)}</code>
      </header>
      <div>
        <p>
          <span>{t('common.balance')}</span>
          <strong>
            {formatPrice(account.quoteAvailable, formatNumber)} INJ ·{' '}
            {formatCompact(account.baseAvailable, formatNumber)} ACME
          </strong>
        </p>
        <p>
          <span>{t('common.activityLabel')}</span>
          <strong>
            {t('agents.accountActivity', {
              orders: formatNumber(account.openOrderCount),
              fills: formatNumber(account.fillCount),
            })}
          </strong>
        </p>
      </div>
      {account.lastAction && (
        <footer>
          <span>
            {account.lastAction.state} · {account.lastAction.side} {account.lastAction.quantity}{' '}
            ACME @ {formatPrice(account.lastAction.price, formatNumber)} INJ
          </span>
          {proof ? (
            <a
              href={`https://testnet.explorer.injective.network/transaction/${proof}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('intelligence.explorer', { reference: formatReference(proof) })}
            </a>
          ) : secondaryProof ? (
            <code>{formatReference(secondaryProof)}</code>
          ) : null}
        </footer>
      )}
    </section>
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

type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string;
type DateTimeFormatter = (
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
) => string;

function formatPrice(price: number, formatNumber: NumberFormatter) {
  const digits = price >= 1000 ? 1 : price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return formatNumber(price, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value: number, formatNumber: NumberFormatter) {
  return formatNumber(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

function formatSignedCompact(value: number, formatNumber: NumberFormatter) {
  return formatNumber(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
}

function formatSignedPercent(value: number, formatNumber: NumberFormatter) {
  return `${value >= 0 ? '+' : '-'}${formatNumber(Math.abs(value), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function townTraderAvatarIndex(name: string) {
  const knownIndex = TOWN_TRADERS.findIndex((candidate) => candidate.name === name);
  if (knownIndex >= 0) return knownIndex;
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return hash % Math.max(1, TOWN_TRADERS.length);
}

function formatMoney(
  value: number,
  currency: string | undefined,
  formatNumber: NumberFormatter,
) {
  return `${formatCompact(value, formatNumber)} ${currency ?? 'TOWNUSD'}`;
}

function formatClock(value: number, formatDateTime: DateTimeFormatter) {
  return formatDateTime(value, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatReference(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}
