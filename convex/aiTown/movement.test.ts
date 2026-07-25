import { allocGameId } from './ids';
import { movePlayer } from './movement';
import { Player } from './player';

describe('movePlayer', () => {
  test('ignores a stale movement request after a conversation becomes active', () => {
    const playerId = allocGameId('players', 1);
    const conversationId = allocGameId('conversations', 2);
    const player = new Player({
      id: playerId,
      lastInput: 0,
      position: { x: 2, y: 2 },
      facing: { dx: 0, dy: 1 },
      speed: 0,
    });
    const game = {
      world: {
        conversations: new Map([
          [
            conversationId,
            {
              participants: new Map([
                [playerId, { status: { kind: 'participating', started: 1_000 } }],
              ]),
            },
          ],
        ]),
      },
    };

    expect(() => movePlayer(game as any, 1_001, player, { x: 3, y: 2 })).not.toThrow();
    expect(player.pathfinding).toBeUndefined();
  });
});
