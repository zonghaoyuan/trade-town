import { buildTownSpeechMessages } from './messagesFeed';

describe('town conversation feed', () => {
  test('keeps agent-to-agent messages and excludes human conversations', () => {
    const messages = buildTownSpeechMessages({
      candidates: [
        {
          _id: 'message-agent',
          _creationTime: 200,
          conversationId: 'conversation-live',
          author: 'player-mira',
          text: 'Rates change the refinancing case.',
        },
        {
          _id: 'message-human',
          _creationTime: 100,
          conversationId: 'conversation-human',
          author: 'player-human',
          text: 'Hello',
        },
      ],
      participantsByConversation: new Map([
        ['conversation-live', ['player-mira', 'player-theo']],
        ['conversation-human', ['player-human', 'player-mira']],
      ]),
      activeConversationIds: new Set(['conversation-live']),
      agentPlayerIds: new Set(['player-mira', 'player-theo']),
      names: new Map([
        ['player-mira', 'Mira Chen'],
        ['player-theo', 'Theo Grant'],
      ]),
      limit: 10,
    });

    expect(messages).toEqual([
      {
        id: 'message-agent',
        conversationId: 'conversation-live',
        createdAt: 200,
        text: 'Rates change the refinancing case.',
        author: { playerId: 'player-mira', name: 'Mira Chen' },
        recipient: { playerId: 'player-theo', name: 'Theo Grant' },
        conversationState: 'live',
      },
    ]);
  });

  test('respects the requested feed limit in newest-first input order', () => {
    const messages = buildTownSpeechMessages({
      candidates: [
        {
          _id: 'newest',
          _creationTime: 200,
          conversationId: 'conversation',
          author: 'a',
          text: 'Newest',
        },
        {
          _id: 'older',
          _creationTime: 100,
          conversationId: 'conversation',
          author: 'b',
          text: 'Older',
        },
      ],
      participantsByConversation: new Map([['conversation', ['a', 'b']]]),
      activeConversationIds: new Set(),
      agentPlayerIds: new Set(['a', 'b']),
      names: new Map([
        ['a', 'Agent A'],
        ['b', 'Agent B'],
      ]),
      limit: 1,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('newest');
    expect(messages[0].conversationState).toBe('ended');
  });
});
