import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import Game from './components/Game';
import TradeTownShell from './components/finance/TradeTownShell';
import {
  mergeLiveDashboard,
  pandaDayViewDashboard,
  pandaDayViewDashboards,
} from './finance/demoData';
import { ToastContainer } from 'react-toastify';
import FreezeButton from './components/FreezeButton';
import MusicButton from './components/buttons/MusicButton';
import InteractButton from './components/buttons/InteractButton';
import { getAnonymousOwnerId } from './features/create-me/storage';
import { sanitizeCreateMeDraft } from '../shared/createMe';
import { useTownActivityFeed } from './hooks/useTownActivityFeed';

export default function Home() {
  const [ownerId] = useState(getAnonymousOwnerId);
  const financeState = useQuery((api as any).finance.dashboard);
  const replayBundle = useQuery((api as any).townReplay.currentDashboardBundle);
  const storedMe = useQuery(api.createMe.current, { ownerId });
  const createMe = useMutation(api.createMe.create);
  const ensureMeAgent = useMutation(api.createMe.ensureAgent);
  const generateUploadUrl = useMutation(api.createMe.generateUploadUrl);
  const discardUpload = useMutation(api.createMe.discardUpload);
  const dashboard = mergeLiveDashboard(financeState);
  const activityFeed = useTownActivityFeed();
  const replayDayViewDashboards = useMemo(() => {
    if (!replayBundle?.dashboards?.length) return pandaDayViewDashboards;
    return Object.fromEntries(
      replayBundle.dashboards.map((item: any) => [item.symbol, item.dashboard]),
    );
  }, [replayBundle]);
  const replayDayViewDashboard =
    replayDayViewDashboards[replayBundle?.defaultSymbol] ?? pandaDayViewDashboard;
  const ensuredMeVersion = useRef<number | null>(null);
  const currentMe = useMemo(() => {
    if (!storedMe?.look || !storedMe.version) return null;
    return {
      version: storedMe.profile.activeVersion,
      textureUrl: storedMe.look.textureUrl,
      draft: sanitizeCreateMeDraft({
        displayName: storedMe.profile.displayName,
        presetId: storedMe.look.presetId,
        appearanceMode: storedMe.look.source === 'lpc_composed' ? 'custom' : 'preset',
        ...storedMe.look.appearance,
        ...storedMe.version.inputs,
      }),
    };
  }, [storedMe]);

  useEffect(() => {
    const version = storedMe?.profile.activeVersion;
    if (!version || ensuredMeVersion.current === version) return;
    ensuredMeVersion.current = version;
    void ensureMeAgent({ ownerId }).catch((error) => {
      ensuredMeVersion.current = null;
      console.warn('Failed to activate the saved ME Agent.', error);
    });
  }, [ensureMeAgent, ownerId, storedMe?.profile.activeVersion]);

  const submitCreateMe = async ({
    composedWalkSheet,
    ...payload
  }: Parameters<typeof createMe>[0] & { composedWalkSheet?: Blob }) => {
    let storageId: Id<'_storage'> | undefined;
    try {
      if (composedWalkSheet) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: composedWalkSheet,
        });
        if (!uploadResponse.ok) throw new Error('LPC 行走图上传失败');
        const uploaded = (await uploadResponse.json()) as { storageId: Id<'_storage'> };
        storageId = uploaded.storageId;
      }
      const result = await createMe({ ...payload, storageId });
      if (result.duplicate && storageId) {
        await discardUpload({ storageId }).catch(() => undefined);
      }
      return result;
    } catch (error) {
      if (storageId) {
        await discardUpload({ storageId }).catch(() => undefined);
      }
      throw error;
    }
  };

  return (
    <>
      <TradeTownShell
        dashboard={dashboard}
        dayViewDashboard={replayDayViewDashboard}
        dayViewDashboards={replayDayViewDashboards}
        activityFeed={activityFeed}
        town={({ focusedCitizen }) => <Game focusedCitizen={focusedCitizen} />}
        townMode="live"
        currentMe={currentMe}
        onCreateMe={submitCreateMe}
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
