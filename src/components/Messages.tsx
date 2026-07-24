import { Doc, Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MessageInput } from './MessageInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';
import { useEffect, useRef } from 'react';

export function Messages({
  worldId,
  engineId,
  conversation,
  inConversationWithMe,
  humanPlayer,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  conversation:
    | { kind: 'active'; doc: Conversation }
    | { kind: 'archived'; doc: Doc<'archivedConversations'> };
  inConversationWithMe: boolean;
  humanPlayer?: Player;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const humanPlayerId = humanPlayer?.id;
  const descriptions = useQuery(api.world.gameDescriptions, { worldId });
  const messages = useQuery(api.messages.listMessages, {
    worldId,
    conversationId: conversation.doc.id,
  });
  let currentlyTyping = conversation.kind === 'active' ? conversation.doc.isTyping : undefined;
  if (messages !== undefined && currentlyTyping) {
    if (messages.find((m) => m.messageUuid === currentlyTyping!.messageUuid)) {
      currentlyTyping = undefined;
    }
  }
  const currentlyTypingName =
    currentlyTyping &&
    descriptions?.playerDescriptions.find((p) => p.playerId === currentlyTyping?.playerId)?.name;

  const isScrolledToBottom = useRef(true);
  const hasPositionedScroll = useRef(false);
  useEffect(() => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) {
      return undefined;
    }

    const onScroll = () => {
      isScrolledToBottom.current =
        scrollView.scrollHeight - scrollView.scrollTop - 50 <= scrollView.clientHeight;
    };
    onScroll();
    scrollView.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollView.removeEventListener('scroll', onScroll);
  }, [messages !== undefined, scrollViewRef]);

  useEffect(() => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) {
      return;
    }
    if (!hasPositionedScroll.current) {
      scrollView.scrollTop = scrollView.scrollHeight;
      hasPositionedScroll.current = true;
      isScrolledToBottom.current = true;
      return;
    }
    if (isScrolledToBottom.current) {
      scrollView.scrollTo({
        top: scrollView.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, currentlyTyping, scrollViewRef]);

  if (messages === undefined) {
    return (
      <section className="town-chat-shell">
        <ChatHeading active={conversation.kind === 'active'} />
        <div className="town-chat-loading">
          <i aria-hidden="true" />
          Loading conversation...
        </div>
      </section>
    );
  }

  const visibleMessages = messages.filter((message) => message.text.trim().length > 0);
  const messageNodes: { time: number; node: React.ReactNode }[] = visibleMessages.map((message) => {
    const mine = message.author === humanPlayerId;
    const node = (
      <article
        key={`text-${message._id}`}
        className={`town-chat-message ${mine ? 'is-mine' : 'is-theirs'}`}
      >
        <header>
          <span>{mine ? 'You' : message.authorName}</span>
          <time dateTime={new Date(message._creationTime).toISOString()}>
            {formatChatTime(message._creationTime)}
          </time>
        </header>
        <div className="town-chat-bubble">
          <p>{message.text}</p>
        </div>
      </article>
    );
    return { node, time: message._creationTime };
  });
  const lastMessageTs = visibleMessages
    .map((message) => message._creationTime)
    .reduce((a, b) => Math.max(a, b), 0);

  const membershipNodes: typeof messageNodes = [];
  if (conversation.kind === 'active') {
    for (const [playerId, membership] of conversation.doc.participants) {
      const playerName = descriptions?.playerDescriptions.find(
        (description) => description.playerId === playerId,
      )?.name;
      const started =
        membership.status.kind === 'participating' ? membership.status.started : undefined;
      if (started) {
        membershipNodes.push({
          node: (
            <div key={`joined-${playerId}`} className="town-chat-system">
              <span>{playerName ?? 'A citizen'} joined the conversation.</span>
            </div>
          ),
          time: started,
        });
      }
    }
  } else {
    for (const playerId of conversation.doc.participants) {
      const playerName = descriptions?.playerDescriptions.find(
        (description) => description.playerId === playerId,
      )?.name;
      const started = conversation.doc.created;
      membershipNodes.push({
        node: (
          <div key={`joined-${playerId}`} className="town-chat-system">
            <span>{playerName ?? 'A citizen'} joined the conversation.</span>
          </div>
        ),
        time: started,
      });
      const ended = conversation.doc.ended;
      membershipNodes.push({
        node: (
          <div key={`left-${playerId}`} className="town-chat-system">
            <span>{playerName ?? 'A citizen'} left the conversation.</span>
          </div>
        ),
        // Keep archived departures after the final text message.
        time: Math.max(lastMessageTs + 1, ended),
      });
    }
  }

  const nodes = [...messageNodes, ...membershipNodes].sort((a, b) => a.time - b.time);
  return (
    <section className="town-chat-shell">
      <ChatHeading active={conversation.kind === 'active'} />
      <div className="town-chat-scroll" ref={scrollViewRef}>
        {nodes.length > 0 ? (
          nodes.map((item) => item.node)
        ) : (
          <div className="town-chat-empty-log">
            <span aria-hidden="true">···</span>
            <p>Conversation started. Say hello.</p>
          </div>
        )}
        {currentlyTyping && currentlyTyping.playerId !== humanPlayerId && (
          <article className="town-chat-message is-theirs is-typing">
            <header>
              <span>{currentlyTypingName ?? 'Citizen'}</span>
              <time dateTime={new Date(currentlyTyping.since).toISOString()}>
                {formatChatTime(currentlyTyping.since)}
              </time>
            </header>
            <div className="town-chat-bubble">
              <p>
                Typing<span aria-hidden="true">...</span>
              </p>
            </div>
          </article>
        )}
      </div>
      {humanPlayer && inConversationWithMe && conversation.kind === 'active' && (
        <MessageInput
          worldId={worldId}
          engineId={engineId}
          conversation={conversation.doc}
          humanPlayer={humanPlayer}
        />
      )}
    </section>
  );
}

function ChatHeading({ active }: { active: boolean }) {
  return (
    <header className="town-chat-heading">
      <span>{active ? 'Live conversation' : 'Previous conversation'}</span>
      <small className={active ? 'is-live' : undefined}>
        <i aria-hidden="true" />
        {active ? 'Live' : 'Archived'}
      </small>
    </header>
  );
}

function formatChatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
