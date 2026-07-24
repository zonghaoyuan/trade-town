import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { TownActivityFeed } from '../../shared/activity';

export function useTownActivityFeed(): TownActivityFeed {
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const conversationFeed = useQuery(
    api.messages.recentTownMessages,
    worldStatus ? { worldId: worldStatus.worldId, limit: 40 } : 'skip',
  );
  const financeFeed = useQuery(api.finance.activityFeed, { limit: 40 });

  return useMemo(
    () => ({
      loading:
        worldStatus === undefined ||
        financeFeed === undefined ||
        Boolean(worldStatus && conversationFeed === undefined),
      gatewayStatus: financeFeed?.gatewayStatus ?? 'unconfigured',
      blockHeight: financeFeed?.blockHeight,
      messages: conversationFeed?.messages ?? [],
      liveConversations: conversationFeed?.liveConversations ?? [],
      transactions: financeFeed?.transactions ?? [],
      events: financeFeed?.events ?? [],
    }),
    [conversationFeed, financeFeed, worldStatus],
  );
}
