import { CSSProperties, useEffect, useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import type { FocusedTownCitizen } from './finance/TradeTownShell.tsx';
import PixelAvatar from './finance/PixelAvatar.tsx';
import { useI18n } from '../i18n';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game({
  focusedCitizen = null,
  hudInspectorOpen = false,
}: {
  focusedCitizen?: FocusedTownCitizen | null;
  hudInspectorOpen?: boolean;
}) {
  const { locale, t, formatNumber } = useI18n();
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [focusedCitizenPosition, setFocusedCitizenPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [gameWrapperRef, { width, height }] = useObservedElementSize<HTMLDivElement>();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedCitizenPosition(null);
  }, [focusedCitizen?.requestId]);

  useEffect(() => {
    if (hudInspectorOpen) setSelectedElement(undefined);
  }, [hudInspectorOpen]);

  if (!worldId || !engineId || !game) {
    return (
      <div className="town-loading">
        <span />
        {t('game.loading')}
      </div>
    );
  }
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div
        className={`trade-town-game game-frame grid ${
          selectedElement ? 'has-town-selection' : 'has-no-town-selection'
        }`}
      >
        {/* Game area */}
        <div className="town-map-pane relative overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <div className="container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x7ab5ff }}>
                {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={width}
                    height={height}
                    historicalTime={historicalTime}
                    setSelectedElement={setSelectedElement}
                    focusedCitizen={focusedCitizen}
                    onFocusedCitizenPositionChange={setFocusedCitizenPosition}
                    locale={locale}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          </div>
          {focusedCitizen && focusedCitizenPosition && (
            <aside
              className="pixel-map-agent"
              aria-live="polite"
              style={
                {
                  '--map-agent-x': `${focusedCitizenPosition.x}px`,
                  '--map-agent-y': `${focusedCitizenPosition.y}px`,
                } as CSSProperties
              }
            >
              <PixelAvatar
                index={focusedCitizen.avatarIndex}
                textureUrl={focusedCitizen.avatarUrl}
              />
              <span>
                <strong>{focusedCitizen.name}</strong>
                <small>{focusedCitizen.role}</small>
                <em className={focusedCitizen.pnl >= 0 ? 'pixel-up' : 'pixel-down'}>
                  {t('game.pnl', {
                    value: formatSignedCompact(focusedCitizen.pnl, formatNumber),
                  })}
                </em>
              </span>
            </aside>
          )}
        </div>
        {/* Right column area */}
        {selectedElement && (
          <div className="town-detail-pane text-brown-100">
            <PlayerDetails
              worldId={worldId}
              engineId={engineId}
              game={game}
              playerId={selectedElement.id}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
            />
          </div>
        )}
      </div>
    </>
  );
}

function useObservedElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;

    const updateSize = () => {
      const next = {
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, size] as const;
}

function formatSignedCompact(
  value: number,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
) {
  const formatted = formatNumber(value, {
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
  return `${formatted} TOWNUSD`;
}
