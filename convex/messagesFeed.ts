import type { ActivityPerson, TownSpeechMessage } from '../shared/activity';

type FeedMessage = {
  _id: string;
  _creationTime: number;
  conversationId: string;
  author: string;
  text: string;
};

export function buildTownSpeechMessages({
  candidates,
  participantsByConversation,
  activeConversationIds,
  agentPlayerIds,
  names,
  limit,
}: {
  candidates: FeedMessage[];
  participantsByConversation: Map<string, string[]>;
  activeConversationIds: Set<string>;
  agentPlayerIds: Set<string>;
  names: Map<string, string>;
  limit: number;
}): TownSpeechMessage[] {
  const person = (id: string): ActivityPerson => ({
    playerId: id,
    name: names.get(id) ?? 'Unknown citizen',
  });
  const messages: TownSpeechMessage[] = [];
  for (const message of candidates) {
    if (!message.text.trim() || !agentPlayerIds.has(message.author)) {
      continue;
    }
    const recipientId = participantsByConversation
      .get(message.conversationId)
      ?.find((id) => id !== message.author);
    if (!recipientId || !agentPlayerIds.has(recipientId)) {
      continue;
    }
    messages.push({
      id: message._id,
      conversationId: message.conversationId,
      createdAt: message._creationTime,
      text: message.text,
      author: person(message.author),
      recipient: person(recipientId),
      conversationState: activeConversationIds.has(message.conversationId) ? 'live' : 'ended',
    });
    if (messages.length >= limit) {
      break;
    }
  }
  return messages;
}
