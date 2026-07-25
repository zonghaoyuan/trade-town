import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clampReplayDayIndex,
  PANDA_REPLAY_DAY_COUNT,
  pandaReplayDates,
} from './pandaMarket';

export const PANDA_REPLAY_SPEEDS = [400, 1_000, 2_000] as const;

export type PandaReplayController = {
  dayIndex: number;
  dayCount: number;
  currentDate: string;
  isPlaying: boolean;
  speedMs: number;
  togglePlaying: () => void;
  step: (delta: number) => void;
  reset: () => void;
  setSpeed: (speedMs: number) => void;
};

export function usePandaReplay(enabled = true): PandaReplayController {
  const [dayIndex, setDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMs, setSpeedMs] = useState<number>(PANDA_REPLAY_SPEEDS[1]);
  const finalDayIndex = PANDA_REPLAY_DAY_COUNT - 1;

  useEffect(() => {
    if (!enabled || !isPlaying || PANDA_REPLAY_DAY_COUNT <= 1) return;
    const timer = window.setInterval(() => {
      setDayIndex((current) => Math.min(finalDayIndex, current + 1));
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [enabled, finalDayIndex, isPlaying, speedMs]);

  useEffect(() => {
    if (isPlaying && dayIndex >= finalDayIndex) setIsPlaying(false);
  }, [dayIndex, finalDayIndex, isPlaying]);

  const togglePlaying = useCallback(() => {
    setIsPlaying((current) => {
      if (!current && dayIndex >= finalDayIndex) setDayIndex(0);
      return !current;
    });
  }, [dayIndex, finalDayIndex]);

  const step = useCallback((delta: number) => {
    setIsPlaying(false);
    setDayIndex((current) => clampReplayDayIndex(current + delta));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setDayIndex(0);
  }, []);

  const setSpeed = useCallback((value: number) => {
    const next = PANDA_REPLAY_SPEEDS.includes(
      value as (typeof PANDA_REPLAY_SPEEDS)[number],
    )
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
      speedMs,
      togglePlaying,
      step,
      reset,
      setSpeed,
    }),
    [dayIndex, isPlaying, reset, setSpeed, speedMs, step, togglePlaying],
  );
}
