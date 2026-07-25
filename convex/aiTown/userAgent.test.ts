import { HUMAN_IDLE_TOO_LONG } from '../constants';
import { agentInputs } from './agentInputs';
import { allocGameId } from './ids';
import { Player } from './player';
import { PlayerDescription } from './playerDescription';

function makeGame() {
  const playerId = allocGameId('players', 1);
  const player = new Player({
    id: playerId,
    human: 'Me',
    lastInput: 0,
    position: { x: 2, y: 2 },
    facing: { dx: 0, dy: 1 },
    speed: 0,
  });
  const playerDescription = new PlayerDescription({
    playerId,
    name: 'Me',
    character: 'f1',
    description: 'A user player',
  });
  let nextAgentId = 2;
  return {
    player,
    game: {
      world: {
        players: new Map([[playerId, player]]),
        agents: new Map(),
        conversations: new Map(),
      },
      playerDescriptions: new Map([[playerId, playerDescription]]),
      agentDescriptions: new Map(),
      allocId: (kind: 'agents') => allocGameId(kind, nextAgentId++),
      descriptionsModified: false,
    },
  };
}

describe('user-created autonomous town agent', () => {
  test('upserts one agent for the user player and updates its profile idempotently', () => {
    const { game, player } = makeGame();
    const args = {
      tokenIdentifier: 'Me',
      name: 'Veylor',
      character: 'f2',
      description: 'A user-created financial digital twin.',
      textureUrl: 'https://example.test/veylor.png',
      identity: 'Evidence-driven user Agent.',
      plan: 'Simulate decisions inside portfolio limits.',
    };

    const first = agentInputs.upsertUserAgent.handler(game as any, 1_000, args);
    const second = agentInputs.upsertUserAgent.handler(game as any, 2_000, {
      ...args,
      plan: 'Updated autonomous plan.',
    });

    expect(second).toEqual(first);
    expect(game.world.players.size).toBe(1);
    expect(game.world.agents.size).toBe(1);
    expect(game.agentDescriptions.get(first.agentId)).toMatchObject({
      identity: args.identity,
      plan: 'Updated autonomous plan.',
    });
    expect(game.playerDescriptions.get(player.id)).toMatchObject({
      name: 'Veylor',
      character: 'f2',
      textureUrl: args.textureUrl,
    });
  });

  test('keeps an autonomous user in town past the human idle timeout and removes both together', () => {
    const { game, player } = makeGame();
    agentInputs.upsertUserAgent.handler(game as any, 1_000, {
      tokenIdentifier: 'Me',
      name: 'Veylor',
      character: 'f1',
      description: 'A user-created financial digital twin.',
      identity: 'Evidence-driven user Agent.',
      plan: 'Simulate decisions inside portfolio limits.',
    });

    player.tick(game as any, 1_000 + HUMAN_IDLE_TOO_LONG + 1);
    expect(game.world.players.has(player.id)).toBe(true);

    player.leave(game as any, 1_000 + HUMAN_IDLE_TOO_LONG + 2);
    expect(game.world.players.size).toBe(0);
    expect(game.world.agents.size).toBe(0);
    expect(game.playerDescriptions.size).toBe(0);
    expect(game.agentDescriptions.size).toBe(0);
  });
});
