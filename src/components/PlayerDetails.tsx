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
import { useI18n } from '../i18n';
import { localizeTraderRole, localizeTraderStyle } from '../i18n/domain';

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
  const { locale, t } = useI18n();
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
        {t('player.clickAgent')}
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
    ? { label: t('player.status.inConversation'), tone: 'is-live' }
    : haveInvite
      ? { label: t('player.status.invitation'), tone: 'is-alert' }
      : waitingForAccept
        ? { label: t('player.status.waiting'), tone: 'is-waiting' }
        : waitingForNearby
          ? { label: t('player.status.walking'), tone: 'is-waiting' }
          : playerConversation
            ? { label: t('player.status.inConversation'), tone: 'is-busy' }
            : canInvite
              ? { label: t('player.status.available'), tone: 'is-live' }
              : isMe
                ? { label: t('player.status.you'), tone: 'is-neutral' }
                : { label: t('player.status.citizen'), tone: 'is-neutral' };
  const showActiveConversation =
    !isMe && playerConversation && playerStatus?.kind === 'participating';
  const profileDescription = isMe
    ? t('player.yourCharacter')
    : financeProfile
      ? localizeTraderStyle(locale, financeProfile.name, financeProfile.style)
      : playerDescription?.description;

  return (
    <section className="town-dialog-panel">
      <header className="town-dialog-header">
        <PixelAvatar index={avatarIndex} />
        <div className="town-dialog-identity">
          <h2>{playerDescription?.name ?? t('player.unknown')}</h2>
          <p>
            {financeProfile
              ? localizeTraderRole(locale, financeProfile.name, financeProfile.role)
              : isMe
                ? t('player.resident')
                : t('player.aiCitizen')}
          </p>
          <span className={`town-dialog-status ${status.tone}`}>
            <i aria-hidden="true" />
            {status.label}
          </span>
        </div>
        <button
          type="button"
          className="town-dialog-close"
          aria-label={t('player.closeDetails')}
          onClick={() => setSelectedElement(undefined)}
        >
          <img src={closeImg} alt="" />
        </button>
      </header>

      <section className="town-dialog-profile" aria-label={t('player.profileAria')}>
        <div className="town-dialog-profile-title">
          <strong>{t('player.profile')}</strong>
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
              {t('player.startConversation')}
            </button>
          )}
          {waitingForAccept && (
            <button type="button" disabled>
              {t('player.waitingReply')}
            </button>
          )}
          {waitingForNearby && (
            <button type="button" disabled>
              {t('player.walkingOver')}
            </button>
          )}
          {inConversationWithMe && (
            <button type="button" className="is-secondary" onClick={onLeaveConversation}>
              {t('player.leaveConversation')}
            </button>
          )}
          {haveInvite && (
            <>
              <button type="button" className="is-primary" onClick={onAcceptInvite}>
                {t('player.accept')}
              </button>
              <button type="button" className="is-secondary" onClick={onRejectInvite}>
                {t('player.decline')}
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
            <strong>{t('player.noConversation')}</strong>
            <p>
              {canInvite
                ? t('player.startLatest')
                : t('player.historyFuture')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
