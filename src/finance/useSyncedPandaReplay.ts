import { useEffect, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { clampReplayDayIndex, PANDA_REPLAY_DAY_COUNT, pandaReplayDates } from './pandaMarket';
import { type PandaReplayController, usePandaReplay } from './usePandaReplay';

type SyncedReplayState = {
  currentDayIndex: number;
  isPlaying: boolean;
  speedMs: number;
  updatedAt: number;
};

/**
 * The Convex clock keeps every connected demo screen on the same Panda day.
 * The local controller is used only while the first query is loading.
 */
export function useSyncedPandaReplay(enabled = true): PandaReplayController {
  const remote = useQuery((api as any).pandaReplay.state, enabled ? {} : 'skip') as
    | SyncedReplayState
    | undefined;
  const setPlayingMutation = useMutation((api as any).pandaReplay.setPlaying);
  const bootstrapMutation = useMutation((api as any).pandaReplay.bootstrap);
  const stepMutation = useMutation((api as any).pandaReplay.step);
  const resetMutation = useMutation((api as any).pandaReplay.reset);
  const setSpeedMutation = useMutation((api as any).pandaReplay.setSpeed);
  const local = usePandaReplay(enabled && remote === undefined);

  useEffect(() => {
    if (enabled && remote?.updatedAt === 0) void bootstrapMutation({});
  }, [bootstrapMutation, enabled, remote?.updatedAt]);

  return useMemo(() => {
    if (!remote) return local;
    const dayIndex = clampReplayDayIndex(remote.currentDayIndex);
    return {
      dayIndex,
      dayCount: PANDA_REPLAY_DAY_COUNT,
      currentDate: pandaReplayDates[dayIndex] ?? '',
      isPlaying: remote.isPlaying,
      speedMs: remote.speedMs,
      togglePlaying: () => {
        void setPlayingMutation({ isPlaying: !remote.isPlaying });
      },
      step: (delta: number) => {
        void stepMutation({ delta });
      },
      reset: () => {
        void resetMutation({});
      },
      setSpeed: (speedMs: number) => {
        void setSpeedMutation({ speedMs });
      },
    };
  }, [local, remote, resetMutation, setPlayingMutation, setSpeedMutation, stepMutation]);
}
