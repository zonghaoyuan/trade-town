import { useMemo } from 'react';
import TradeTownShell from './components/finance/TradeTownShell';
import TownPreview from './components/finance/TownPreview';
import { buildPandaDayViewDashboards, injectivePreviewDashboard } from './finance/demoData';
import { usePandaReplay } from './finance/usePandaReplay';

export default function DemoApp() {
  const pandaReplay = usePandaReplay();
  const dayViewDashboards = useMemo(
    () => buildPandaDayViewDashboards(pandaReplay.dayIndex),
    [pandaReplay.dayIndex],
  );
  const dayViewDashboard = Object.values(dayViewDashboards)[0];

  return (
    <TradeTownShell
      dashboard={injectivePreviewDashboard}
      dayViewDashboard={dayViewDashboard}
      dayViewDashboards={dayViewDashboards}
      replay={{
        mode: 'deterministic',
        dayIndex: pandaReplay.dayIndex,
        dayCount: pandaReplay.dayCount,
        currentDate: pandaReplay.currentDate,
        status: pandaReplay.isPlaying ? 'replaying' : 'paused',
        controller: pandaReplay,
      }}
      town={({ focusedCitizen }) => <TownPreview focusedCitizen={focusedCitizen} />}
      townMode="preview"
    />
  );
}
