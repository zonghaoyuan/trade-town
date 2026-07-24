import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { TOWN_TRADERS } from '../../shared/finance';
import PixelAvatar from './finance/PixelAvatar';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId });

  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  // Always select the other player if we're in a conversation with them.
  if (humanPlayer && humanConversation) {
    const otherPlayerIds = [...humanConversation.participants.keys()].filter(
      (p) => p !== humanPlayer.id,
    );
    playerId = otherPlayerIds[0];
  }

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);

  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );

  const playerDescription = playerId && game.playerDescriptions.get(playerId);

  const startConversation = useSendInput(engineId, 'startConversation');
  const acceptInvite = useSendInput(engineId, 'acceptInvite');
  const rejectInvite = useSendInput(engineId, 'rejectInvite');
  const leaveConversation = useSendInput(engineId, 'leaveConversation');

  if (!playerId) {
    return (
      <div className="h-full text-xl flex text-center items-center p-4">
        Click on an agent on the map to see chat history.
      </div>
    );
  }
  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const canInvite = !isMe && !playerConversation && humanPlayer && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';

  const onStartConversation = async () => {
    if (!humanPlayer || !playerId) {
      return;
    }
    console.log(`Starting conversation`);
    await toastOnError(startConversation({ playerId: humanPlayer.id, invitee: playerId }));
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation || !playerId) {
      return;
    }
    await toastOnError(
      acceptInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) {
      return;
    }
    await toastOnError(
      rejectInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !inConversationWithMe || !humanConversation) {
      return;
    }
    await toastOnError(
      leaveConversation({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const financeProfile = TOWN_TRADERS.find(
    (candidate) => candidate.name === playerDescription?.name,
  );
  const avatarIndex = Math.max(
    0,
    TOWN_TRADERS.findIndex((candidate) => candidate.name === playerDescription?.name),
  );
  const status = inConversationWithMe
    ? { label: 'In conversation', tone: 'is-live' }
    : haveInvite
      ? { label: 'Invitation received', tone: 'is-alert' }
      : waitingForAccept
        ? { label: 'Waiting for reply', tone: 'is-waiting' }
        : waitingForNearby
          ? { label: 'Walking over', tone: 'is-waiting' }
          : playerConversation
            ? { label: 'In conversation', tone: 'is-busy' }
            : canInvite
              ? { label: 'Available', tone: 'is-live' }
              : isMe
                ? { label: 'This is you', tone: 'is-neutral' }
                : { label: 'Town citizen', tone: 'is-neutral' };
  const showActiveConversation =
    !isMe && playerConversation && playerStatus?.kind === 'participating';
  const profileDescription = isMe
    ? 'Your character in Convex Town.'
    : (financeProfile?.style ?? playerDescription?.description);

  return (
    <section className="town-dialog-panel">
      <header className="town-dialog-header">
        <PixelAvatar index={avatarIndex} />
        <div className="town-dialog-identity">
          <h2>{playerDescription?.name ?? 'Unknown citizen'}</h2>
          <p>{financeProfile?.role ?? (isMe ? 'Town resident' : 'AI citizen')}</p>
          <span className={`town-dialog-status ${status.tone}`}>
            <i aria-hidden="true" />
            {status.label}
          </span>
        </div>
        <button
          type="button"
          className="town-dialog-close"
          aria-label="Close citizen details"
          onClick={() => setSelectedElement(undefined)}
        >
          <img src={closeImg} alt="" />
        </button>
      </header>

      <section className="town-dialog-profile" aria-label="Citizen profile">
        <div className="town-dialog-profile-title">
          <strong>Profile</strong>
          {!!financeProfile?.focusSymbols.length && (
            <span className="town-dialog-tags">
              {financeProfile.focusSymbols.map((symbol) => (
                <i key={symbol}>{symbol}</i>
              ))}
            </span>
          )}
        </div>
        <p>{profileDescription}</p>
        {!playerConversation && player.activity && player.activity.until > Date.now() && (
          <div className="town-dialog-activity">
            <i aria-hidden="true" />
            {player.activity.description}
          </div>
        )}
      </section>

      {(canInvite ||
        waitingForAccept ||
        waitingForNearby ||
        inConversationWithMe ||
        haveInvite) && (
        <div className="town-dialog-actions">
          {canInvite && (
            <button type="button" className="is-primary" onClick={onStartConversation}>
              Start conversation
            </button>
          )}
          {waitingForAccept && (
            <button type="button" disabled>
              Waiting for reply...
            </button>
          )}
          {waitingForNearby && (
            <button type="button" disabled>
              Walking over...
            </button>
          )}
          {inConversationWithMe && (
            <button type="button" className="is-secondary" onClick={onLeaveConversation}>
              Leave conversation
            </button>
          )}
          {haveInvite && (
            <>
              <button type="button" className="is-primary" onClick={onAcceptInvite}>
                Accept
              </button>
              <button type="button" className="is-secondary" onClick={onRejectInvite}>
                Reject
              </button>
            </>
          )}
        </div>
      )}

      <div className="town-dialog-content">
        {showActiveConversation && (
          <Messages
            worldId={worldId}
            engineId={engineId}
            inConversationWithMe={inConversationWithMe ?? false}
            conversation={{ kind: 'active', doc: playerConversation }}
            humanPlayer={humanPlayer}
            scrollViewRef={scrollViewRef}
          />
        )}
        {!playerConversation && previousConversation && (
          <Messages
            worldId={worldId}
            engineId={engineId}
            inConversationWithMe={false}
            conversation={{ kind: 'archived', doc: previousConversation }}
            humanPlayer={humanPlayer}
            scrollViewRef={scrollViewRef}
          />
        )}
        {!showActiveConversation && !(!playerConversation && previousConversation) && (
          <div className="town-dialog-empty">
            <span aria-hidden="true">···</span>
            <strong>No conversation yet</strong>
            <p>
              {canInvite
                ? 'Start a conversation to hear this citizen’s latest market view.'
                : 'Conversation history will appear here when it becomes available.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
