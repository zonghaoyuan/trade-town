import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Game from './components/Game';
import TradeTownShell from './components/finance/TradeTownShell';
import { mergeLiveDashboard } from './finance/demoData';
import { ToastContainer } from 'react-toastify';
import FreezeButton from './components/FreezeButton';
import MusicButton from './components/buttons/MusicButton';
import InteractButton from './components/buttons/InteractButton';

export default function Home() {
  const financeState = useQuery((api as any).finance.dashboard);
  const dashboard = mergeLiveDashboard(financeState);

  return (
    <>
      <TradeTownShell
        dashboard={dashboard}
        town={({ focusedCitizen }) => <Game focusedCitizen={focusedCitizen} />}
        townMode="live"
        townControls={
          <>
            <FreezeButton />
            <MusicButton />
            <InteractButton />
          </>
        }
      />
      <ToastContainer position="bottom-right" autoClose={2500} closeOnClick theme="dark" />
    </>
  );
}
