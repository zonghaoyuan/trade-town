import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';
import type { FocusedTownCitizen } from './finance/TradeTownShell.tsx';
import type { Player as ServerPlayer } from '../../convex/aiTown/player.ts';
import { locationFields, playerLocation, type Location } from '../../convex/aiTown/location.ts';
import { useHistoricalValue } from '../hooks/useHistoricalValue.ts';
import type { Locale } from '../i18n';

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  setSelectedElement: SelectElement;
  focusedCitizen?: FocusedTownCitizen | null;
  onFocusedCitizenPositionChange?: (position: { x: number; y: number } | null) => void;
  locale: Locale;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();

  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: props.worldId }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;
  const humanIsInConversation =
    humanPlayerId !== undefined &&
    [...props.game.world.conversations.values()].some(
      (conversation) =>
        conversation.participants.get(humanPlayerId)?.status.kind === 'participating',
    );

  const moveTo = useSendInput(props.engineId, 'moveTo');

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const onMapPointerUp = async (e: any) => {
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        return;
      }
    }
    if (!humanPlayerId || humanIsInConversation) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const tileDim = props.game.worldMap.tileDim;
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    await toastOnError(moveTo({ playerId: humanPlayerId, destination: roundedTiles }));
  };
  const { width, height, tileDim } = props.game.worldMap;
  const players = [...props.game.world.players.values()];
  const focusedPlayer = props.focusedCitizen
    ? players.find(
        (player) =>
          props.game.playerDescriptions.get(player.id)?.name === props.focusedCitizen?.name,
      )
    : undefined;

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        key={`static-map-${props.locale}`}
        map={props.game.worldMap}
        locale={props.locale}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {focusedPlayer && props.focusedCitizen && props.onFocusedCitizenPositionChange && (
        <FocusedCitizenCamera
          player={focusedPlayer}
          game={props.game}
          historicalTime={props.historicalTime}
          tileDim={tileDim}
          requestId={props.focusedCitizen.requestId}
          viewportRef={viewportRef}
          app={pixiApp}
          onPositionChange={props.onFocusedCitizenPositionChange}
        />
      )}
      {players.map((p) => (
        <Player
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          isViewer={p.id === humanPlayerId}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
    </PixiViewport>
  );
};
export default PixiGame;

function FocusedCitizenCamera({
  player,
  game,
  historicalTime,
  tileDim,
  requestId,
  viewportRef,
  app,
  onPositionChange,
}: {
  player: ServerPlayer;
  game: ServerGame;
  historicalTime: number | undefined;
  tileDim: number;
  requestId: number;
  viewportRef: MutableRefObject<Viewport | undefined>;
  app: PIXI.Application;
  onPositionChange: (position: { x: number; y: number } | null) => void;
}) {
  const historicalLocation = useHistoricalValue<Location>(
    locationFields,
    historicalTime,
    playerLocation(player),
    game.world.historicalLocations?.get(player.id),
  );
  const locationRef = useRef(historicalLocation);
  const lastScreenPosition = useRef<{ x: number; y: number } | null>(null);
  locationRef.current = historicalLocation;

  useEffect(() => {
    const viewport = viewportRef.current;
    const location = locationRef.current;
    if (!viewport || !location) return;

    viewport.animate({
      position: new PIXI.Point(
        location.x * tileDim + tileDim / 2,
        location.y * tileDim + tileDim / 2,
      ),
      scale: Math.max(1.35, viewport.scale.x),
      time: 520,
      ease: 'easeInOutSine',
    });
  }, [player.id, requestId, tileDim, viewportRef]);

  useEffect(() => {
    const updatePosition = () => {
      const viewport = viewportRef.current;
      const location = locationRef.current;
      if (!viewport || !location) return;

      const screenPosition = viewport.toScreen(
        new PIXI.Point(
          location.x * tileDim + tileDim / 2,
          location.y * tileDim + tileDim / 2 - tileDim * 0.55,
        ),
      );
      const next = { x: screenPosition.x, y: screenPosition.y };
      const previous = lastScreenPosition.current;
      if (previous && Math.abs(previous.x - next.x) < 0.5 && Math.abs(previous.y - next.y) < 0.5) {
        return;
      }
      lastScreenPosition.current = next;
      onPositionChange(next);
    };

    app.ticker.add(updatePosition);
    updatePosition();
    return () => {
      app.ticker.remove(updatePosition);
      onPositionChange(null);
    };
  }, [app, onPositionChange, player.id, tileDim, viewportRef]);

  return null;
}
