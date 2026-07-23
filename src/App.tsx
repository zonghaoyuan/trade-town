import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import Game from './components/Game';
import TradeTownShell from './components/finance/TradeTownShell';
import { mergeLiveDashboard } from './finance/demoData';
import { ToastContainer } from 'react-toastify';

export default function Home() {
  const financeState = useQuery((api as any).finance.dashboard);
  const dashboard = mergeLiveDashboard(financeState);

  return (
    <>
      <TradeTownShell dashboard={dashboard} town={<Game />} />
      <ToastContainer position="bottom-right" autoClose={2500} closeOnClick theme="dark" />
    </>
  );
}
