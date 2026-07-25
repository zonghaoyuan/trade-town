export type ActivityPerson = {
  playerId: string;
  name: string;
};

export type TownSpeechMessage = {
  id: string;
  conversationId: string;
  createdAt: number;
  text: string;
  author: ActivityPerson;
  recipient: ActivityPerson;
  conversationState: 'live' | 'ended';
};

export type TownLiveConversation = {
  id: string;
  participants: ActivityPerson[];
  latestMessageAt?: number;
  typing?: ActivityPerson & {
    since: number;
  };
};

export type TownConversationFeed = {
  messages: TownSpeechMessage[];
  liveConversations: TownLiveConversation[];
};

export type TownTransactionState =
  | 'proposed'
  | 'risk_rejected'
  | 'queued'
  | 'submitting'
  | 'submitted'
  | 'confirmed'
  | 'cancelled'
  | 'failed'
  | 'filled';

export type TownTransactionRecord = {
  id: string;
  occurredAt: number;
  agentName: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  state: TownTransactionState;
  source: 'town' | 'injective' | 'paper';
  txHash?: string;
  blockHeight?: number;
  detail?: string;
  fee?: number;
};

export type TownEventRecord = {
  id: string;
  occurredAt: number;
  kind: 'policy' | 'news' | 'conversation' | 'belief' | 'intent' | 'order' | 'fill' | 'risk';
  actor: string;
  title: string;
  detail: string;
  symbols: string[];
  txHash?: string;
  blockHeight?: number;
};

export type TownFinanceActivityFeed = {
  gatewayStatus: 'unconfigured' | 'read_only' | 'signing' | 'degraded';
  blockHeight?: number;
  transactions: TownTransactionRecord[];
  events: TownEventRecord[];
};

export type TownActivityFeed = TownConversationFeed &
  TownFinanceActivityFeed & {
    loading: boolean;
  };

export const emptyTownActivityFeed: TownActivityFeed = {
  loading: false,
  gatewayStatus: 'unconfigured',
  messages: [],
  liveConversations: [],
  transactions: [],
  events: [],
};
