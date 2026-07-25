import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TOWN_TRADERS } from '../../../shared/finance';
import type {
  TownActivityFeed,
  TownEventRecord,
  TownSpeechMessage,
  TownTransactionRecord,
} from '../../../shared/activity';
import type { CausalEvent } from '../../finance/demoData';
import PixelAvatar from './PixelAvatar';
import { groupConsecutiveMessages } from './townActivityMessages';

type ActivityTab = 'talk' | 'trades' | 'events';

const tabs: Array<{
  id: ActivityTab;
  icon: string;
  label: string;
}> = [
  { id: 'talk', icon: '“', label: 'Agent Talk' },
  { id: 'trades', icon: '↕', label: 'Live Trades' },
  { id: 'events', icon: '!', label: 'Event History' },
];

export default function TownActivityPanel({
  activity,
  contextEvents,
  drawer = false,
}: {
  activity: TownActivityFeed;
  contextEvents: CausalEvent[];
  drawer?: boolean;
}) {
  const [tab, setTab] = useState<ActivityTab>('talk');
  const events = useMemo(
    () => mergeEvents(activity.events, contextEvents),
    [activity.events, contextEvents],
  );
  const counts: Record<ActivityTab, number> = {
    talk: activity.messages.length,
    trades: activity.transactions.length,
    events: events.length,
  };

  return (
    <section className={`pixel-activity-panel ${drawer ? 'is-drawer' : ''}`}>
      <header className="pixel-activity-header">
        <div className="pixel-activity-tabs" role="tablist" aria-label="Activity sections">
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
                <strong>{item.label}</strong>
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
        <TradeFeed activity={activity} />
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
  const groupedMessages = useMemo(
    () => groupConsecutiveMessages(activity.messages),
    [activity.messages],
  );

  if (activity.loading && activity.messages.length === 0) {
    return <ActivityLoading label="Listening for agent conversations…" />;
  }
  if (activity.messages.length === 0) {
    return (
      <ActivityEmpty
        icon="“"
        title="The town is quiet right now"
        detail="New agent-to-agent messages will appear here automatically—no citizen click required."
      />
    );
  }

  return (
    <>
      {activity.liveConversations.length > 0 && (
        <div className="pixel-live-conversations" aria-label="Live conversations">
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
                  ? `${typing.name} is replying${other ? ` to ${other.name}` : ''}…`
                  : `${conversation.participants.map((participant) => participant.name).join(' ↔ ')} · live`}
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
                    title={`${repeatCount} consecutive matching messages in this conversation`}
                  >
                    ×{repeatCount}
                  </span>
                )}
                <time dateTime={new Date(message.createdAt).toISOString()}>
                  {formatTime(message.createdAt)}
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
          aria-label={`${expanded ? 'Collapse' : 'Expand'} message from ${message.author.name}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function TradeFeed({ activity }: { activity: TownActivityFeed }) {
  if (activity.loading && activity.transactions.length === 0) {
    return <ActivityLoading label="Connecting to the execution ledger…" />;
  }
  if (activity.transactions.length === 0) {
    return (
      <ActivityEmpty
        icon="↕"
        title="No trading activity yet"
        detail="Agent intents, risk decisions, submissions and confirmed Injective fills will appear here."
      />
    );
  }

  return (
    <div className="pixel-trade-ledger">
      <div className="pixel-trade-columns" aria-hidden="true">
        <span>Time / agent</span>
        <span>Order</span>
        <span>Price</span>
        <span>Status</span>
        <span>Proof</span>
      </div>
      {activity.transactions.map((transaction) => (
        <TransactionRow transaction={transaction} key={transaction.id} />
      ))}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: TownTransactionRecord }) {
  const verified = transaction.source === 'injective';
  return (
    <article className={`pixel-trade-row state-${transaction.state}`}>
      <div className="pixel-trade-agent">
        <PixelAvatar index={avatarIndex(transaction.agentName)} />
        <span>
          <time dateTime={new Date(transaction.occurredAt).toISOString()}>
            {formatTime(transaction.occurredAt)}
          </time>
          <strong>{transaction.agentName}</strong>
        </span>
      </div>
      <div className={`pixel-trade-order side-${transaction.side}`}>
        <b>{transaction.side.toUpperCase()}</b>
        <span>
          {formatQuantity(transaction.quantity)} {transaction.symbol}
        </span>
      </div>
      <div className="pixel-trade-price">
        <strong>
          {transaction.price === undefined ? 'MARKET' : formatPrice(transaction.price)}
        </strong>
        <small>{verified ? 'INJ' : 'LIMIT'}</small>
      </div>
      <div className="pixel-trade-state">
        <strong>{formatTransactionState(transaction.state)}</strong>
        <small>{verified ? '◆ CHAIN' : '◇ TOWN FLOW'}</small>
      </div>
      <div className="pixel-trade-proof">
        {transaction.txHash ? (
          <a
            href={explorerUrl(transaction.txHash)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open Injective transaction ${shortReference(transaction.txHash)}`}
          >
            Explorer ↗<small>{shortReference(transaction.txHash)}</small>
          </a>
        ) : (
          <span title={transaction.detail}>
            {transaction.state === 'risk_rejected' ? 'Risk log' : 'Pending'}
            <small>{transaction.detail ?? 'No chain proof yet'}</small>
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
  if (activity.loading && events.length === 0) {
    return <ActivityLoading label="Loading town history…" />;
  }
  if (events.length === 0) {
    return (
      <ActivityEmpty
        icon="!"
        title="No recorded events yet"
        detail="Factual PandaAI data updates and town market events will be preserved here."
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
                <b>{formatEventKind(kind)}</b>
                <time>{live ? formatTime(record.occurredAt) : record.time}</time>
                <span>{source === 'panda' ? '◇ PANDAAI' : txHash ? '◆ VERIFIED' : '◇ TOWN'}</span>
              </header>
              <strong>{record.title}</strong>
              <small>
                {record.actor}
                {live && record.symbols.length > 0 ? ` · ${record.symbols.join(', ')}` : ''}
                {blockHeight ? ` · #${blockHeight.toLocaleString()}` : ''}
              </small>
              <p>{record.detail}</p>
              {txHash &&
                (live && record.txHash ? (
                  <a href={explorerUrl(record.txHash)} target="_blank" rel="noreferrer">
                    Explorer ↗ · {shortReference(record.txHash)}
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

function formatTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatTransactionState(state: TownTransactionRecord['state']) {
  return (
    {
      proposed: 'INTENT',
      risk_rejected: 'RISK BLOCKED',
      queued: 'QUEUED',
      submitted: 'SUBMITTED',
      confirmed: 'CONFIRMED',
      cancelled: 'CANCELLED',
      failed: 'FAILED',
      filled: 'FILLED',
    } satisfies Record<TownTransactionRecord['state'], string>
  )[state];
}

function formatEventKind(kind: CausalEvent['kind'] | TownEventRecord['kind']) {
  return kind.replace('_', ' ').toUpperCase();
}

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
