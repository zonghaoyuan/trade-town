import TradeTownShell from './components/finance/TradeTownShell';
import TownPreview from './components/finance/TownPreview';
import { injectivePreviewDashboard, pandaDayViewDashboard } from './finance/demoData';
import { emptyTownActivityFeed } from '../shared/activity';

export default function DemoApp() {
  return (
    <TradeTownShell
      dashboard={injectivePreviewDashboard}
      dayViewDashboard={pandaDayViewDashboard}
      activityFeed={emptyTownActivityFeed}
      town={({ focusedCitizen }) => <TownPreview focusedCitizen={focusedCitizen} />}
      townMode="preview"
    />
  );
}
