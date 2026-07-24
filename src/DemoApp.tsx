import TradeTownShell from './components/finance/TradeTownShell';
import TownPreview from './components/finance/TownPreview';
import { injectivePreviewDashboard, pandaDayViewDashboard } from './finance/demoData';

export default function DemoApp() {
  return (
    <TradeTownShell
      dashboard={injectivePreviewDashboard}
      dayViewDashboard={pandaDayViewDashboard}
      town={({ focusedCitizen }) => <TownPreview focusedCitizen={focusedCitizen} />}
      townMode="preview"
    />
  );
}
