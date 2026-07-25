import type { TownSpeechMessage } from '../../../shared/activity';

export type GroupedTownMessage = {
  message: TownSpeechMessage;
  repeatCount: number;
};

export function groupConsecutiveMessages(messages: TownSpeechMessage[]): GroupedTownMessage[] {
  return messages.reduce<GroupedTownMessage[]>((groups, message) => {
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.message.conversationId === message.conversationId &&
      normalizeMessageText(previous.message.text) === normalizeMessageText(message.text)
    ) {
      previous.repeatCount += 1;
      return groups;
    }
    groups.push({ message, repeatCount: 1 });
    return groups;
  }, []);
}

function normalizeMessageText(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
