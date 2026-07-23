import TradeTownShell from './components/finance/TradeTownShell';
import TownPreview from './components/finance/TownPreview';
import { previewDashboard } from './finance/demoData';

export default function DemoApp() {
  return <TradeTownShell dashboard={previewDashboard} town={<TownPreview />} />;
}
