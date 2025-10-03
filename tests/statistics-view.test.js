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

  it('applies overtime shootout winners to displayed scores', () => {
    const games = [
      {
        division: 'Gold',
        homeTeam: 'Wolves',
        awayTeam: 'Hawks',
        homeScore: 3,
        awayScore: 3,
        overtimeResult: { winner: 'Hawks', decidedBy: 'ot_shootout' },
      },
    ];

    const standings = computeStandingsFromGames(games);
    const gold = standings.get('Gold') ?? [];
    const records = Object.fromEntries(gold.map((team) => [team.team, team]));
    expect(records.Wolves).toMatchObject({
      wins: 0,
      losses: 0,
      overtime: 1,
      goalsFor: 3,
      goalsAgainst: 4,
      points: 1,
    });
    expect(records.Hawks).toMatchObject({
      wins: 1,
      losses: 0,
      overtime: 0,
      goalsFor: 4,
      goalsAgainst: 3,
      points: 2,
    });

    const timelines = computeTeamTimelinesFromGames(games);
    const goldTimelines = timelines.get('Gold');
    const wolvesTimeline = goldTimelines?.get('Wolves') ?? [];
    const hawksTimeline = goldTimelines?.get('Hawks') ?? [];
    expect(wolvesTimeline[0]).toMatchObject({ goals: 3, points: 1 });
    expect(hawksTimeline[0]).toMatchObject({ goals: 4, points: 2 });
  });
});

  it('derives games played from attendance', () => {
    const games = [
      {
        id: 'game-a',
        division: 'Gold',
        week: 1,
        homeTeam: 'Slappy Gilmores',
        awayTeam: 'Corn Stars',
        homeScore: 2,
        awayScore: 3,
        goals: [],
        penalties: [],
        attendance: [
          { id: 'slappy_marc_redinger', name: 'Marc Redinger', team: 'Slappy Gilmores', present: true },
        ],
      },
      {
        id: 'game-b',
        division: 'Gold',
        week: 2,
        homeTeam: "Noah's Arknemesis",
        awayTeam: 'Slappy Gilmores',
        homeScore: 4,
        awayScore: 5,
        goals: [
          { team: 'Slappy Gilmores', player: 'Marc Redinger', playerId: 'slappy_marc_redinger', period: '1', time: '10:00' },
        ],
        penalties: [],
        attendance: [
          { id: 'slappy_marc_redinger', name: 'Marc Redinger', team: 'Slappy Gilmores', present: true },
        ],
      },
      {
        id: 'game-c',
        division: 'Gold',
        week: 3,
        homeTeam: 'Slappy Gilmores',
        awayTeam: 'UTC',
        homeScore: 1,
        awayScore: 1,
        goals: [],
        penalties: [],
        attendance: [
          { id: 'slappy_marc_redinger', name: 'Marc Redinger', team: 'Slappy Gilmores', present: true },
        ],
      },
    ];

    const { standings } = computePlayerStandingsFromGames(games);
    const gold = standings.get('Gold') ?? [];
    const marc = gold.find((record) => record.player === 'Marc Redinger');
    expect(marc).toBeTruthy();
    expect(marc?.gamesPlayed).toBe(3);
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
        attendance: [
          { id: 'wolves_alex', name: 'Alex Star', team: 'Wolves', present: true },
          { id: 'bears_sam', name: 'Sam Setter', team: 'Bears', present: true },
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
        attendance: [
          { id: 'wolves_alex', name: 'Alex Star', team: 'Wolves', present: true },
          { id: 'bears_sam', name: 'Sam Setter', team: 'Bears', present: true },
        ],
      },
    ];

    expect(resolveGameIdentifier(repeatedGames[0])).toBe('game-a');
    expect(resolveGameIdentifier(repeatedGames[1])).toBe('game-b');

    const { standings, timelines } = computePlayerStandingsFromGames(repeatedGames);
    const goldPlayers = standings.get('Gold') ?? [];
    expect(goldPlayers.length).toBeGreaterThanOrEqual(1);

    const alexRecord = goldPlayers.find((record) => record.player === 'Alex Star');
    expect(alexRecord).toBeTruthy();
    expect(alexRecord?.gamesPlayed).toBe(2);

    const playerTimelineMap = timelines.get('Gold');
    const alexTimeline = playerTimelineMap?.get(alexRecord?.id ?? '');
    expect(alexTimeline?.[alexTimeline.length - 1]?.cumulativeGames).toBe(2);

    const teamTimelines = computeTeamTimelinesFromGames(repeatedGames);
    const wolvesTimeline = teamTimelines.get('Gold')?.get('Wolves');
    expect(wolvesTimeline?.[wolvesTimeline.length - 1]?.cumulativeGames).toBe(2);
  });
});
