import { useCallback, useEffect, useMemo, useState } from 'react';
import { clampReplayDayIndex, PANDA_REPLAY_DAY_COUNT, pandaReplayDates } from './pandaMarket';

export const PANDA_REPLAY_SPEEDS = [400, 1_000, 2_000] as const;

export type PandaReplayController = {
  dayIndex: number;
  dayCount: number;
  currentDate: string;
  isPlaying: boolean;
  isLooping: boolean;
  speedMs: number;
  togglePlaying: () => void;
  toggleLooping: () => void;
  step: (delta: number) => void;
  reset: () => void;
  setSpeed: (speedMs: number) => void;
};

export function usePandaReplay(enabled = true): PandaReplayController {
  const [dayIndex, setDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [speedMs, setSpeedMs] = useState<number>(PANDA_REPLAY_SPEEDS[1]);
  const finalDayIndex = PANDA_REPLAY_DAY_COUNT - 1;

  useEffect(() => {
    if (!enabled || !isPlaying || PANDA_REPLAY_DAY_COUNT <= 1) return;
    const timer = window.setInterval(() => {
      setDayIndex((current) => {
        if (current < finalDayIndex) return current + 1;
        if (isLooping) return 0;
        setIsPlaying(false);
        return current;
      });
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [enabled, finalDayIndex, isLooping, isPlaying, speedMs]);

  const togglePlaying = useCallback(() => {
    setIsPlaying((current) => {
      if (!current && dayIndex >= finalDayIndex) setDayIndex(0);
      return !current;
    });
  }, [dayIndex, finalDayIndex]);

  const toggleLooping = useCallback(() => {
    setIsLooping((current) => !current);
  }, []);

  const step = useCallback((delta: number) => {
    setIsPlaying(false);
    setDayIndex((current) => clampReplayDayIndex(current + delta));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setDayIndex(0);
  }, []);

  const setSpeed = useCallback((value: number) => {
    const next = PANDA_REPLAY_SPEEDS.includes(value as (typeof PANDA_REPLAY_SPEEDS)[number])
      ? value
      : PANDA_REPLAY_SPEEDS[1];
    setSpeedMs(next);
  }, []);

  return useMemo(
    () => ({
      dayIndex,
      dayCount: PANDA_REPLAY_DAY_COUNT,
      currentDate: pandaReplayDates[dayIndex] ?? '',
      isPlaying,
      isLooping,
      speedMs,
      togglePlaying,
      toggleLooping,
      step,
      reset,
      setSpeed,
    }),
    [dayIndex, isLooping, isPlaying, reset, setSpeed, speedMs, step, toggleLooping, togglePlaying],
  );
}
