import type { TownSpeechMessage } from '../../../shared/activity';
import { groupConsecutiveMessages } from './townActivityMessages';

const message = (id: string, conversationId: string, text: string): TownSpeechMessage => ({
  id,
  conversationId,
  createdAt: Number(id),
  text,
  author: { playerId: 'author', name: 'Author' },
  recipient: { playerId: 'recipient', name: 'Recipient' },
  conversationState: 'live',
});

describe('groupConsecutiveMessages', () => {
  it('groups normalized matching messages when they are consecutive in one conversation', () => {
    const groups = groupConsecutiveMessages([
      message('3', 'conversation-a', 'Standing by.'),
      message('2', 'conversation-a', '  standing   by. '),
      message('1', 'conversation-a', 'STANDING BY.'),
    ]);

    expect(groups).toEqual([
      {
        message: message('3', 'conversation-a', 'Standing by.'),
        repeatCount: 3,
      },
    ]);
  });

  it('keeps matching text separate across conversations or interruptions', () => {
    const groups = groupConsecutiveMessages([
      message('4', 'conversation-a', 'Standing by.'),
      message('3', 'conversation-b', 'Standing by.'),
      message('2', 'conversation-a', 'New information.'),
      message('1', 'conversation-a', 'Standing by.'),
    ]);

    expect(groups.map((group) => group.repeatCount)).toEqual([1, 1, 1, 1]);
    expect(groups.map((group) => group.message.id)).toEqual(['4', '3', '2', '1']);
  });
});
