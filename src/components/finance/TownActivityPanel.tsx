import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TOWN_TRADERS } from '../../../shared/finance';
import type {
  TownActivityFeed,
  TownEventRecord,
  TownSpeechMessage,
  TownTransactionRecord,
} from '../../../shared/activity';
import type { CausalEvent, DashboardExecution } from '../../finance/demoData';
import PixelAvatar from './PixelAvatar';
import { groupConsecutiveMessages } from './townActivityMessages';
import { mergeTransactions } from './townActivityTransactions';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';

type ActivityTab = 'talk' | 'trades' | 'events';

const tabs: Array<{
  id: ActivityTab;
  icon: string;
  labelKey: MessageKey;
}> = [
  { id: 'talk', icon: '“', labelKey: 'activity.agentTalk' },
  { id: 'trades', icon: '↕', labelKey: 'activity.liveTrades' },
  { id: 'events', icon: '!', labelKey: 'activity.eventHistory' },
];

export default function TownActivityPanel({
  activity,
  contextEvents,
  contextExecutions = [],
  contextAsOf,
  drawer = false,
}: {
  activity: TownActivityFeed;
  contextEvents: CausalEvent[];
  contextExecutions?: DashboardExecution[];
  contextAsOf?: number;
  drawer?: boolean;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ActivityTab>('talk');
  const events = useMemo(
    () => mergeEvents(activity.events, contextEvents),
    [activity.events, contextEvents],
  );
  const transactions = useMemo(
    () => mergeTransactions(activity.transactions, contextExecutions, contextAsOf),
    [activity.transactions, contextAsOf, contextExecutions],
  );
  const counts: Record<ActivityTab, number> = {
    talk: activity.messages.length,
    trades: transactions.length,
    events: events.length,
  };

  return (
    <section className={`pixel-activity-panel ${drawer ? 'is-drawer' : ''}`}>
      <header className="pixel-activity-header">
        <div
          className="pixel-activity-tabs"
          role="tablist"
          aria-label={t('activity.sections')}
        >
          {tabs.map((item) => (
            <button
              type="button"
              id={`town-activity-tab-${item.id}${drawer ? '-drawer' : ''}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`town-activity-panel-${item.id}${drawer ? '-drawer' : ''}`}
              className={tab === item.id ? 'is-active' : ''}
              onClick={() => setTab(item.id)}
              key={item.id}
            >
              <i aria-hidden="true">{item.icon}</i>
              <span>
                <strong>{t(item.labelKey)}</strong>
              </span>
              <b>{counts[item.id]}</b>
            </button>
          ))}
        </div>
      </header>

      <div
        id={`town-activity-panel-talk${drawer ? '-drawer' : ''}`}
        role="tabpanel"
        aria-labelledby={`town-activity-tab-talk${drawer ? '-drawer' : ''}`}
        className="pixel-activity-body pixel-talk-body"
        hidden={tab !== 'talk'}
      >
        <TalkFeed activity={activity} />
      </div>

      <div
        id={`town-activity-panel-trades${drawer ? '-drawer' : ''}`}
        role="tabpanel"
        aria-labelledby={`town-activity-tab-trades${drawer ? '-drawer' : ''}`}
        className="pixel-activity-body pixel-trade-body"
        hidden={tab !== 'trades'}
      >
        <TradeFeed loading={activity.loading} transactions={transactions} />
      </div>

      <div
        id={`town-activity-panel-events${drawer ? '-drawer' : ''}`}
        role="tabpanel"
        aria-labelledby={`town-activity-tab-events${drawer ? '-drawer' : ''}`}
        className="pixel-activity-body pixel-history-body"
        hidden={tab !== 'events'}
      >
        <EventFeed activity={activity} events={events} />
      </div>
    </section>
  );
}

function TalkFeed({ activity }: { activity: TownActivityFeed }) {
  const { t, formatDateTime } = useI18n();
  const groupedMessages = useMemo(
    () => groupConsecutiveMessages(activity.messages),
    [activity.messages],
  );

  if (activity.loading && activity.messages.length === 0) {
    return <ActivityLoading label={t('activity.listening')} />;
  }
  if (activity.messages.length === 0) {
    return (
      <ActivityEmpty
        icon="“"
        title={t('activity.quietTitle')}
        detail={t('activity.quietDetail')}
      />
    );
  }

  return (
    <>
      {activity.liveConversations.length > 0 && (
        <div
          className="pixel-live-conversations"
          aria-label={t('activity.liveConversations')}
        >
          {activity.liveConversations.map((conversation) => {
            const typing = conversation.typing;
            const other = typing
              ? conversation.participants.find(
                  (participant) => participant.playerId !== typing.playerId,
                )
              : undefined;
            return (
              <span key={conversation.id}>
                <i aria-hidden="true" />
                {typing
                  ? other
                    ? t('activity.replyingTo', {
                        name: typing.name,
                        other: other.name,
                      })
                    : t('activity.replying', { name: typing.name })
                  : t('activity.liveSuffix', {
                      names: conversation.participants
                        .map((participant) => participant.name)
                        .join(' ↔ '),
                    })}
              </span>
            );
          })}
        </div>
      )}
      <div className="pixel-talk-stream" aria-live="polite">
        {groupedMessages.map(({ message, repeatCount }, index) => (
          <article
            className={`pixel-talk-message ${
              message.conversationState === 'live' ? 'is-live' : 'is-ended'
            } ${index === 0 ? 'is-latest' : ''}`}
            key={message.id}
          >
            <PixelAvatar index={avatarIndex(message.author.name)} />
            <div className="pixel-talk-content">
              <header>
                <strong>{message.author.name}</strong>
                <span aria-hidden="true">→</span>
                <em>{message.recipient.name}</em>
                {repeatCount > 1 && (
                  <span
                    className="pixel-talk-repeat"
                    title={t('activity.repeatTitle', { count: repeatCount })}
                  >
                    ×{repeatCount}
                  </span>
                )}
                <time dateTime={new Date(message.createdAt).toISOString()}>
                  {formatDateTime(message.createdAt, timeOptions)}
                </time>
              </header>
              <ExpandableMessage message={message} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ExpandableMessage({ message }: { message: TownSpeechMessage }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const copyRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (expanded) return;
    const copy = copyRef.current;
    if (!copy) return;

    const measure = () => setCanExpand(copy.scrollHeight > copy.clientHeight + 1);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [expanded, message.text]);

  return (
    <div className="pixel-talk-message-copy">
      <p ref={copyRef} className={expanded ? 'is-expanded' : undefined}>
        {message.text}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={t(
            expanded ? 'activity.collapseMessage' : 'activity.expandMessage',
            { name: message.author.name },
          )}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t('activity.showLess') : t('activity.readMore')}
        </button>
      )}
    </div>
  );
}

function TradeFeed({
  loading,
  transactions,
}: {
  loading: boolean;
  transactions: TownTransactionRecord[];
}) {
  const { t } = useI18n();
  if (loading && transactions.length === 0) {
    return <ActivityLoading label={t('activity.connectingLedger')} />;
  }
  if (transactions.length === 0) {
    return (
      <ActivityEmpty
        icon="↕"
        title={t('activity.noTradesTitle')}
        detail={t('activity.noTradesDetail')}
      />
    );
  }

  return (
    <div className="pixel-trade-ledger">
      <div className="pixel-trade-columns" aria-hidden="true">
        <span>{t('activity.timeAgent')}</span>
        <span>{t('activity.order')}</span>
        <span>{t('common.price')}</span>
        <span>{t('common.status')}</span>
        <span>{t('common.proof')}</span>
      </div>
      {transactions.map((transaction) => (
        <TransactionRow transaction={transaction} key={transaction.id} />
      ))}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: TownTransactionRecord }) {
  const { t, formatDateTime, formatNumber } = useI18n();
  const verified = transaction.source === 'injective';
  const paper = transaction.source === 'paper';
  return (
    <article className={`pixel-trade-row state-${transaction.state}`}>
      <div className="pixel-trade-agent">
        <PixelAvatar index={avatarIndex(transaction.agentName)} />
        <span>
          <time dateTime={new Date(transaction.occurredAt).toISOString()}>
            {paper
              ? formatDateTime(transaction.occurredAt, replayTradeTimeOptions)
              : formatDateTime(transaction.occurredAt, timeOptions)}
          </time>
          <strong>{transaction.agentName}</strong>
        </span>
      </div>
      <div className={`pixel-trade-order side-${transaction.side}`}>
        <b>{transaction.side.toUpperCase()}</b>
        <span>
          {formatNumber(transaction.quantity, quantityOptions)} {transaction.symbol}
        </span>
      </div>
      <div className="pixel-trade-price">
        <strong>
          {transaction.price === undefined
            ? t('activity.market')
            : formatNumber(transaction.price, priceOptions(transaction.price))}
        </strong>
        <small>{verified ? 'INJ' : paper ? 'CNY' : t('activity.limit')}</small>
      </div>
      <div className="pixel-trade-state">
        <strong>{t(transactionStateKeys[transaction.state])}</strong>
        <small>
          {verified
            ? t('activity.chain')
            : paper
              ? t('activity.paper')
              : t('activity.townFlow')}
        </small>
      </div>
      <div className="pixel-trade-proof">
        {transaction.txHash ? (
          <a
            href={explorerUrl(transaction.txHash)}
            target="_blank"
            rel="noreferrer"
            aria-label={t('activity.openTransaction', {
              reference: shortReference(transaction.txHash),
            })}
          >
            {t('activity.explorer')}
            <small>{shortReference(transaction.txHash)}</small>
          </a>
        ) : (
          <span title={transaction.detail}>
            {transaction.state === 'risk_rejected'
              ? t('activity.riskLog')
              : paper
                ? t('activity.replayLog')
                : t('activity.pending')}
            <small>
              {transaction.detail ??
                (paper ? t('activity.noChainReplay') : t('activity.noChainProof'))}
            </small>
          </span>
        )}
      </div>
    </article>
  );
}

type DisplayEvent =
  | { source: 'live'; record: TownEventRecord }
  | { source: 'panda'; record: CausalEvent };

function EventFeed({ activity, events }: { activity: TownActivityFeed; events: DisplayEvent[] }) {
  const { t, formatDateTime, formatNumber } = useI18n();
  if (activity.loading && events.length === 0) {
    return <ActivityLoading label={t('activity.loadingHistory')} />;
  }
  if (events.length === 0) {
    return (
      <ActivityEmpty
        icon="!"
        title={t('activity.noEventsTitle')}
        detail={t('activity.noEventsDetail')}
      />
    );
  }

  return (
    <div className="pixel-history-stream">
      {events.map(({ source, record }) => {
        const live = source === 'live';
        const kind = record.kind;
        const txHash = live ? record.txHash : record.proof;
        const blockHeight = live ? record.blockHeight : undefined;
        return (
          <article className={`pixel-history-event event-${kind}`} key={`${source}:${record.id}`}>
            <div className="pixel-history-marker">
              <i aria-hidden="true">{eventIcon(kind)}</i>
              <span />
            </div>
            <div className="pixel-history-copy">
              <header>
                <b>{t(eventKindKeys[kind])}</b>
                <time>
                  {live
                    ? formatDateTime(record.occurredAt, timeOptions)
                    : record.occurredAt
                      ? formatDateTime(record.occurredAt, replayTimeOptions)
                      : record.time}
                </time>
                <span>
                  {source === 'panda'
                    ? t('activity.sourcePanda')
                    : txHash
                      ? t('activity.sourceVerified')
                      : t('activity.sourceTown')}
                </span>
              </header>
              <strong>{record.title}</strong>
              <small>
                {record.actor}
                {live && record.symbols.length > 0 ? ` · ${record.symbols.join(', ')}` : ''}
                {blockHeight ? ` · #${formatNumber(blockHeight)}` : ''}
              </small>
              <p>{record.detail}</p>
              {txHash &&
                (live && record.txHash ? (
                  <a href={explorerUrl(record.txHash)} target="_blank" rel="noreferrer">
                    {t('intelligence.explorer', {
                      reference: shortReference(record.txHash),
                    })}
                  </a>
                ) : (
                  <code>{shortReference(txHash)}</code>
                ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ActivityEmpty({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="pixel-activity-empty">
      <i aria-hidden="true">{icon}</i>
      <span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </span>
    </div>
  );
}

function ActivityLoading({ label }: { label: string }) {
  return (
    <div className="pixel-activity-loading">
      <i aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function mergeEvents(liveEvents: TownEventRecord[], contextEvents: CausalEvent[]): DisplayEvent[] {
  const seen = new Set(liveEvents.map((event) => event.id));
  return [
    ...liveEvents.map((record) => ({ source: 'live' as const, record })),
    ...contextEvents
      .filter((record) => !seen.has(record.id))
      .map((record) => ({ source: 'panda' as const, record })),
  ];
}

function avatarIndex(name: string) {
  return Math.max(
    0,
    TOWN_TRADERS.findIndex((trader) => trader.name === name),
  );
}

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const replayTimeOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
};

const replayTradeTimeOptions: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
};

const quantityOptions: Intl.NumberFormatOptions = {
  maximumFractionDigits: 4,
};

function priceOptions(value: number): Intl.NumberFormatOptions {
  return { maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2 };
}

const transactionStateKeys = {
  proposed: 'activity.state.proposed',
  risk_rejected: 'activity.state.riskRejected',
  queued: 'activity.state.queued',
  submitting: 'activity.state.submitting',
  submitted: 'activity.state.submitted',
  confirmed: 'activity.state.confirmed',
  cancelled: 'activity.state.cancelled',
  failed: 'activity.state.failed',
  filled: 'activity.state.filled',
} satisfies Record<TownTransactionRecord['state'], MessageKey>;

const eventKindKeys = {
  policy: 'activity.event.policy',
  news: 'activity.event.news',
  belief: 'activity.event.belief',
  conversation: 'activity.event.conversation',
  intent: 'activity.event.intent',
  risk: 'activity.event.risk',
  chain: 'activity.event.chain',
  post: 'activity.event.post',
  interaction: 'activity.event.interaction',
  error: 'activity.event.error',
  order: 'activity.event.order',
  fill: 'activity.event.fill',
} satisfies Record<CausalEvent['kind'] | TownEventRecord['kind'], MessageKey>;

function eventIcon(kind: CausalEvent['kind'] | TownEventRecord['kind']) {
  if (kind === 'fill' || kind === 'chain') return '◆';
  if (kind === 'risk' || kind === 'error') return '×';
  if (kind === 'conversation' || kind === 'interaction' || kind === 'post') return '“';
  if (kind === 'news' || kind === 'policy') return '!';
  return '◇';
}

function explorerUrl(txHash: string) {
  return `https://testnet.explorer.injective.network/transaction/${txHash}`;
}

function shortReference(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}
