import { describe, expect, it } from 'vitest';

import { statisticsInternals } from '../js/views/statistics-view.js';

const {
  computeStandingsFromGames,
  computePlayerStandingsFromGames,
  computeTeamTimelinesFromGames,
  detectOvertime,
  resolveGameIdentifier,
} = statisticsInternals;

describe('statistics overtime handling', () => {
  it('awards overtime losses and points for extra-time results', () => {
    const games = [
      {
        id: 'game-1',
        division: 'Gold',
        homeTeam: 'Wolves',
        awayTeam: 'Bears',
        homeScore: 3,
        awayScore: 1,
      },
      {
        id: 'game-2',
        division: 'Gold',
        homeTeam: 'Wolves',
        awayTeam: 'Hawks',
        homeScore: 2,
        awayScore: 1,
        overtimeResult: { winner: 'Wolves', decidedBy: 'ot_shootout' },
      },
      {
        id: 'game-3',
        division: 'Gold',
        homeTeam: 'Bears',
        awayTeam: 'Hawks',
        homeScore: 2,
        awayScore: 3,
        goals: [
          { team: 'Bears', player: 'Sam Setter', playerTeam: 'Bears', period: '1', time: '10:00' },
          { team: 'Hawks', player: 'Robin Swift', playerTeam: 'Hawks', period: '3', time: '05:00' },
          { team: 'Hawks', player: 'Robin Swift', playerTeam: 'Hawks', period: 'OT', time: '01:00' },
        ],
      },
    ];

    const standings = computeStandingsFromGames(games);
    const gold = standings.get('Gold');
    expect(gold).toBeTruthy();

    const records = Object.fromEntries(gold.map((team) => [team.team, team]));

    expect(records.Wolves).toMatchObject({ wins: 2, losses: 0, overtime: 0, points: 4, gamesPlayed: 2 });
    expect(records.Bears).toMatchObject({ wins: 0, losses: 1, overtime: 1, points: 1, gamesPlayed: 2 });
    expect(records.Hawks).toMatchObject({ wins: 1, losses: 0, overtime: 1, points: 3, gamesPlayed: 2 });

    Object.values(records).forEach((record) => {
      expect(record.gamesPlayed).toBe(record.wins + record.losses + record.overtime);
    });
  });

  it('detects overtime via decidedBy metadata and period tags', () => {
    const shootoutGame = {
      division: 'Gold',
      homeTeam: 'Wolves',
      awayTeam: 'Hawks',
      homeScore: 2,
      awayScore: 1,
      overtimeResult: { winner: 'Wolves', decidedBy: 'ot_shootout' },
    };

    const regulationGame = {
      division: 'Gold',
      homeTeam: 'Wolves',
      awayTeam: 'Hawks',
      homeScore: 4,
      awayScore: 2,
      overtimeResult: { winner: 'Wolves', decidedBy: 'regulation' },
    };

    const extraPeriodGame = {
      division: 'Gold',
      homeTeam: 'Bears',
      awayTeam: 'Hawks',
      homeScore: 1,
      awayScore: 2,
      goals: [
        { team: 'Bears', player: 'Sam Setter', playerTeam: 'Bears', period: '1', time: '08:00' },
        { team: 'Hawks', player: 'Robin Swift', playerTeam: 'Hawks', period: 'SO', time: '00:00' },
      ],
    };

    expect(detectOvertime(shootoutGame)).toBe(true);
    expect(detectOvertime(regulationGame)).toBe(false);
    expect(detectOvertime(extraPeriodGame)).toBe(true);
  });
});

describe('statistics game identifiers', () => {
  it('uses game id when available to keep repeat matchups distinct', () => {
    const repeatedGames = [
      {
        id: 'game-a',
        file: 'shared.json',
        division: 'Gold',
        week: 1,
        homeTeam: 'Wolves',
        awayTeam: 'Bears',
        homeScore: 1,
        awayScore: 0,
        goals: [
          {
            team: 'Wolves',
            player: 'Alex Star',
            playerId: 'wolves_alex',
            playerTeam: 'Wolves',
            period: '1',
            time: '12:00',
          },
        ],
      },
      {
        id: 'game-b',
        file: 'shared.json',
        division: 'Gold',
        week: 2,
        homeTeam: 'Wolves',
        awayTeam: 'Bears',
        homeScore: 1,
        awayScore: 0,
        goals: [
          {
            team: 'Wolves',
            player: 'Alex Star',
            playerId: 'wolves_alex',
            playerTeam: 'Wolves',
            period: '1',
            time: '10:00',
          },
        ],
      },
    ];

    expect(resolveGameIdentifier(repeatedGames[0])).toBe('game-a');
    expect(resolveGameIdentifier(repeatedGames[1])).toBe('game-b');

    const { standings, timelines } = computePlayerStandingsFromGames(repeatedGames);
    const goldPlayers = standings.get('Gold') ?? [];
    expect(goldPlayers).toHaveLength(1);
    const playerRecord = goldPlayers[0];
    expect(playerRecord.player).toBe('Alex Star');
    expect(playerRecord.gamesPlayed).toBe(2);

    const playerTimelineMap = timelines.get('Gold');
    const playerTimeline = playerTimelineMap ? Array.from(playerTimelineMap.values())[0] : undefined;
    expect(playerTimeline?.[playerTimeline.length - 1]?.cumulativeGames).toBe(2);

    const teamTimelines = computeTeamTimelinesFromGames(repeatedGames);
    const wolvesTimeline = teamTimelines.get('Gold')?.get('Wolves');
    expect(wolvesTimeline?.[wolvesTimeline.length - 1]?.cumulativeGames).toBe(2);
  });
});
