import { buildJerseyMap, formatPlayerLabel, resolvePlayerJersey } from '../components/player-labels.js';
import { TimeEntryLimits } from '../components/time-entry.js';
import { dataManager } from '../core/data-manager.js';
import { attendanceView } from '../views/attendance-view.js';
import { gameSelectionView } from '../views/game-selection-view.js';
import { goalDetailsView } from '../views/goal-details-view.js';
import { historyView } from '../views/history-view.js';
import { penaltyDetailsView } from '../views/penalty-details-view.js';
import { scoringView } from '../views/scoring-view.js';
import { startupView } from '../views/startup-view.js';

const VIEWS = [
  startupView,
  gameSelectionView,
  attendanceView,
  scoringView,
  goalDetailsView,
  penaltyDetailsView,
  historyView,
];

function parseClockTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [mm, ss] = value.split(':').map((segment) => Number.parseInt(segment, 10));
  if (Number.isNaN(mm) || Number.isNaN(ss)) {
    return null;
  }

  const totalSeconds = mm * 60 + ss;
  if (totalSeconds < TimeEntryLimits.MIN_SECONDS || totalSeconds > TimeEntryLimits.MAX_SECONDS) {
    return null;
  }

  return { minutes: mm, seconds: ss, total: totalSeconds };
}

export class ScorekeeperApp {
  constructor(mainContent, topNavigation, header) {
    this.mainContent = mainContent;
    this.topNavigation = topNavigation;
    this.header = header;

    this.data = dataManager;
    this.views = new Map(VIEWS.map((view) => [view.id, view]));

    this.currentView = 'main-menu';
    this.selectedGame = null;
    this.attendanceState = new Map();
    this.dialogContext = null;
    this.boundNumberKeyHandler = null;
  }

  async init() {
    await this.data.init();

    if (this.data.currentGame) {
      // Keep the app on the main menu so the user can choose whether to resume.
      this.attendanceState.clear();
      this.selectedGame = null;
    }

    this.render();
  }

  render() {
    const view = this.views.get(this.currentView) ?? startupView;
    const navHtml = typeof view.navigation === 'function' ? view.navigation(this) : '';
    const templateHtml = view.template(this);

    this.mainContent.innerHTML = templateHtml;
    this.topNavigation.innerHTML = navHtml;
    this.header.style.display = view.hideHeader ? 'none' : 'block';

    if (typeof view.bind === 'function') {
      view.bind(this);
    }
  }

  showView(viewId) {
    this.currentView = viewId;
    this.render();
  }

  showStartupMenu() {
    this.attendanceState.clear();
    this.dialogContext = null;
    this.boundNumberKeyHandler = null;
    this.selectedGame = null;
    this.showView('main-menu');
  }

  showGameSelection() {
    this.showView('game-selection');
  }

  selectGame(gameId) {
    const game = this.data.getGameById(gameId);
    if (!game) return;

    const inProgressGame = this.data.currentGame;
    const isSameMatch = inProgressGame && inProgressGame.id === game.id;

    if (isSameMatch) {
      const resume = window.confirm('Resume your in-progress game for this matchup?');
      if (resume) {
        this.hydrateFromCurrentGame();
        this.showScoring();
        return;
      }
    }

    if (inProgressGame) {
      this.data.discardCurrentGame();
      this.attendanceState.clear();
      this.dialogContext = null;
      this.boundNumberKeyHandler = null;
      this.selectedGame = null;
    }

    this.selectedGame = game;
    this.bootstrapAttendanceState();
    this.showAttendance();
  }

  bootstrapAttendanceState() {
    if (!this.selectedGame) return;

    this.attendanceState.clear();

    const seedTeamState = (teamName) => {
      const players = this.data.getPlayersForTeam(teamName);
      const teamState = new Map();

      players.forEach((player) => {
        const defaultPresent = !player.name.toLowerCase().includes('sub');
        teamState.set(player.id, {
          playerId: player.id,
          team: teamName,
          name: player.name,
          present: defaultPresent,
          jersey: '',
        });
      });

      this.attendanceState.set(teamName, teamState);
    };

    seedTeamState(this.selectedGame.homeTeam);
    seedTeamState(this.selectedGame.awayTeam);
  }

  showAttendance() {
    this.showView('attendance');
  }

  showScoring() {
    this.showView('scoring');
  }

  addShotOnGoal(team) {
    if (!team) return;
    this.data.addShotOnGoal(team);
    if (this.currentView === 'scoring') {
      this.render();
    }
  }

  showGoalDetails() {
    this.showView('goal-details');
  }

  showPenaltyDetails() {
    this.showView('penalty-details');
  }

  showGameHistory() {
    this.showView('history');
  }

  showStatistics() {
    window.alert('Statistics feature coming soon.');
  }

  startScoring() {
    if (!this.selectedGame) return;

    const attendance = this.buildAttendanceRecords(this.selectedGame);
    const game = this.data.beginGame({
      ...this.selectedGame,
      attendance,
    });

    this.syncAttendanceToGame();
    console.log('Started game', game);
    this.showScoring();
  }

  toggleAttendance(team, playerId, isPresent) {
    const teamState = this.attendanceState.get(team);
    if (!teamState) return;

    const record = teamState.get(playerId);
    if (!record) return;

    record.present = isPresent;
    this.syncAttendanceToGame();
  }

  showNumberDialog({ team, playerId, playerName }) {
    const modal = this.mainContent.querySelector('[data-role="number-dialog"]');
    const input = modal?.querySelector('[data-role="number-input"]');
    const playerNameLabel = modal?.querySelector('#dialog-player-name');

    if (!modal || !input) return;

    this.dialogContext = { team, playerId };
    const currentValue = this.getPlayerJersey(team, playerId) ?? '';
    input.value = currentValue === '##' ? '' : currentValue;
    if (playerNameLabel) {
      playerNameLabel.textContent = playerName;
    }

    const handler = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.saveJerseyNumber();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closeNumberDialog();
      }
    };

    this.boundNumberKeyHandler = handler;
    input.addEventListener('keydown', handler);

    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);
  }

  closeNumberDialog() {
    const modal = this.mainContent.querySelector('[data-role="number-dialog"]');
    if (modal) {
      const input = modal.querySelector('[data-role="number-input"]');
      if (input && this.boundNumberKeyHandler) {
        input.removeEventListener('keydown', this.boundNumberKeyHandler);
      }
      modal.style.display = 'none';
    }
    this.dialogContext = null;
    this.boundNumberKeyHandler = null;
  }

  saveJerseyNumber() {
    if (!this.dialogContext) return;
    const { team, playerId } = this.dialogContext;
    const modal = this.mainContent.querySelector('[data-role="number-dialog"]');
    const input = modal?.querySelector('[data-role="number-input"]');

    if (!input) return;
    const sanitized = input.value.replace(/[^0-9]/g, '').slice(0, 2);
    const jerseyValue = sanitized || '##';

    const teamState = this.attendanceState.get(team);
    if (!teamState) return;

    const record = teamState.get(playerId);
    if (record) {
      record.jersey = jerseyValue;
    }

    this.syncAttendanceToGame();
    this.closeNumberDialog();
    this.render();
  }

  isPlayerChecked(team, playerId) {
    const teamState = this.attendanceState.get(team);
    return teamState?.get(playerId)?.present ?? false;
  }

  getPlayerJersey(team, playerId) {
    const teamState = this.attendanceState.get(team);
    return teamState?.get(playerId)?.jersey ?? '';
  }

  buildAttendanceRecords(contextGame = null) {
    const records = [];
    const game = contextGame ?? this.selectedGame ?? this.data.currentGame;
    const teams = new Set();

    if (game) {
      if (game.homeTeam) teams.add(game.homeTeam);
      if (game.awayTeam) teams.add(game.awayTeam);
    } else {
      this.attendanceState.forEach((_, teamName) => {
        if (teamName) teams.add(teamName);
      });
    }

    teams.forEach((teamName) => {
      const teamState = this.attendanceState.get(teamName);
      if (!teamState) return;

      teamState.forEach((record) => {
        const normalizedJersey = (record.jersey ?? '').trim();
        records.push({
          id: record.playerId,
          name: record.name,
          team: teamName,
          jersey: normalizedJersey || '##',
          present: Boolean(record.present),
        });
      });
    });

    return records;
  }

  syncAttendanceToGame() {
    const currentGame = this.data.currentGame;
    if (!currentGame) return;
    this.data.addAttendance(this.buildAttendanceRecords(currentGame));
  }

  hydrateFromCurrentGame() {
    const currentGame = this.data.currentGame;
    if (!currentGame) return;

    this.selectedGame = {
      id: currentGame.id,
      homeTeam: currentGame.homeTeam,
      awayTeam: currentGame.awayTeam,
      location: currentGame.location ?? '',
      date: currentGame.date ?? '',
      time: currentGame.time ?? '',
      season: currentGame.season ?? '',
      week: currentGame.week ?? '',
    };

    this.attendanceState.clear();

    const attendanceById = new Map();
    (currentGame.attendance ?? []).forEach((record) => {
      if (!record?.id) return;
      attendanceById.set(record.id, record);
    });

    const seedTeamState = (teamName) => {
      const players = this.data.getPlayersForTeam(teamName);
      const teamState = new Map();

      players.forEach((player) => {
        const attendanceRecord = attendanceById.get(player.id);
        teamState.set(player.id, {
          playerId: player.id,
          team: teamName,
          name: player.name,
          present: Boolean(attendanceRecord),
          jersey: attendanceRecord?.jersey ?? '',
        });
      });

      (currentGame.attendance ?? [])
        .filter((record) => record.team === teamName && !teamState.has(record.id))
        .forEach((record) => {
          teamState.set(record.id, {
            playerId: record.id,
            team: teamName,
            name: record.name,
            present: true,
            jersey: record.jersey ?? '',
          });
        });

      this.attendanceState.set(teamName, teamState);
    };

    seedTeamState(currentGame.homeTeam);
    seedTeamState(currentGame.awayTeam);
  }

  getAttendanceSummary() {
    const summary = { home: [], away: [] };
    const game = this.data.currentGame;
    if (!game) return summary;

    const homeState = this.attendanceState.get(game.homeTeam);
    const awayState = this.attendanceState.get(game.awayTeam);

    if (homeState) {
      homeState.forEach((record) => {
        if (record.present) {
          const jersey = (record.jersey ?? '').trim() || '##';
          const display = jersey === '##' ? '##' : `#${jersey}`;
          summary.home.push(`${record.name} (${display})`);
        }
      });
    }

    if (awayState) {
      awayState.forEach((record) => {
        if (record.present) {
          const jersey = (record.jersey ?? '').trim() || '##';
          const display = jersey === '##' ? '##' : `#${jersey}`;
          summary.away.push(`${record.name} (${display})`);
        }
      });
    }

    return summary;
  }

  submitGoalForm() {
    const main = this.mainContent;
    const team = main.querySelector('[data-field="team"]').value;
    const playerId = main.querySelector('[data-field="player"]').value;
    const assistId = main.querySelector('[data-field="assist"]').value;
    const period = main.querySelector('[data-field="period"]').value;
    const shotType = main.querySelector('[data-field="shotType"]').value;
    const goalType = main.querySelector('[data-field="goalType"]').value;
    const time = main.querySelector('[data-field="time"]').value;
    const breakaway = main.querySelector('[data-field="breakaway"]').value;

    if (!team || !playerId) {
      window.alert('Select a team and player before saving.');
      return;
    }

    const parsedTime = parseClockTime(time);
    if (!parsedTime) {
      window.alert('Enter a valid time between 00:01 and 16:59.');
      return;
    }

    const playersForTeam = this.data.getPlayersForTeam(team);
    const player = playersForTeam.find((p) => p.id === playerId);
    const assist = assistId ? playersForTeam.find((p) => p.id === assistId) : null;
    const jerseyMap = buildJerseyMap(this.data.currentGame);
    const currentGame = this.data.currentGame;
    const homeScore = Number((currentGame && currentGame.homeScore) || 0);
    const awayScore = Number((currentGame && currentGame.awayScore) || 0);

    let teamScore = homeScore;
    let opponentScore = awayScore;
    if (currentGame && team === currentGame.homeTeam) {
      teamScore = homeScore + 1;
      opponentScore = awayScore;
    } else if (currentGame && team === currentGame.awayTeam) {
      teamScore = awayScore + 1;
      opponentScore = homeScore;
    }

    let scoreImpact = '';
    if (currentGame) {
      if (teamScore === 1 && opponentScore === 0) {
        scoreImpact = 'first goal of the game';
      } else if (teamScore === opponentScore) {
        scoreImpact = 'game tying goal';
      } else if (teamScore >= opponentScore + 2) {
        scoreImpact = 'insurance goal';
      } else if (teamScore > opponentScore) {
        scoreImpact = 'go ahead goal';
      }
    }

    const existingGoals = Array.isArray(currentGame?.goals) ? currentGame.goals : [];
    const previousGoalsForPlayer = existingGoals.filter((goal) => goal.playerId === playerId).length;
    const totalGameGoals = previousGoalsForPlayer + 1;
    const hatTrickIndicator = totalGameGoals >= 3 ? 'yes' : 'no';

    const clockSeconds = parsedTime.total;
    const isThirdPeriod = period === '3';
    const isFirstPeriod = period === '1';

    const lateGameGoal = isThirdPeriod && clockSeconds >= 1 && clockSeconds <= 120 ? 'yes' : 'no';
    const earlyGameGoal = isFirstPeriod && clockSeconds >= 15 * 60 && clockSeconds <= 16 * 60 + 59 ? 'yes' : 'no';

    const previousTeamScore = teamScore - 1;
    const previousOpponentScore = opponentScore;
    const wasTrailingByTwoOrMore = previousOpponentScore - previousTeamScore >= 2;
    const nowDeficit = opponentScore - teamScore;
    const comebackGoal = wasTrailingByTwoOrMore && nowDeficit <= 1 ? 'yes' : 'no';

    const clutchGoal =
      isThirdPeriod && clockSeconds <= 300 && (teamScore === opponentScore || teamScore > opponentScore) ? 'yes' : 'no';

    const playerLabel = player ? formatPlayerLabel(player, jerseyMap) : 'Unknown';
    const playerNumber = player ? resolvePlayerJersey(player, jerseyMap) : '';
    const assistLabel = assist ? formatPlayerLabel(assist, jerseyMap) : '';
    const assistNumber = assist ? resolvePlayerJersey(assist, jerseyMap) : '';

    this.data.addGoal({
      team,
      teamScore,
      opponentScore,
      scoreImpact,
      totalGameGoals,
      hatTrickIndicator,
      lateGameGoal,
      earlyGameGoal,
      comebackGoal,
      clutchGoal,
      player: player?.name ?? 'Unknown',
      playerId,
      playerLabel,
      playerNumber,
      assist: assist ? assist.name : '',
      assistId: assist ? assist.id : '',
      assistLabel,
      assistNumber,
      period,
      shotType,
      goalType,
      time,
      clockSeconds,
      breakaway,
    });

    this.showScoring();
  }

  submitPenaltyForm() {
    const main = this.mainContent;
    const team = main.querySelector('[data-field="team"]').value;
    const playerId = main.querySelector('[data-field="player"]').value;
    const type = main.querySelector('[data-field="type"]').value;
    const minutes = Number.parseInt(main.querySelector('[data-field="minutes"]').value, 10) || 2;
    const period = main.querySelector('[data-field="period"]').value;
    const time = main.querySelector('[data-field="time"]').value;

    if (!team || !playerId) {
      window.alert('Select a team and player before saving.');
      return;
    }

    const parsedTime = parseClockTime(time);
    if (!parsedTime) {
      window.alert('Enter a valid time between 00:01 and 16:59.');
      return;
    }

    const players = this.data.getPlayersForTeam(team);
    const player = players.find((p) => p.id === playerId);
    const jerseyMap = buildJerseyMap(this.data.currentGame);
    const currentGame = this.data.currentGame;
    const homeScore = Number((currentGame && currentGame.homeScore) || 0);
    const awayScore = Number((currentGame && currentGame.awayScore) || 0);

    let teamScore = team === currentGame?.homeTeam ? homeScore : awayScore;
    let opponentScore = team === currentGame?.homeTeam ? awayScore : homeScore;

    let penaltyImpact = '';
    const scoreDiff = teamScore - opponentScore;
    if (scoreDiff < 0) {
      penaltyImpact = 'trailing penalty';
    } else if (scoreDiff === 0) {
      penaltyImpact = 'tied penalty';
    } else if (scoreDiff >= 2) {
      penaltyImpact = 'costly penalty';
    } else {
      penaltyImpact = 'leading penalty';
    }

    const clockSeconds = parsedTime.total;
    const isThirdPeriod = period === '3';
    const isFirstPeriod = period === '1';

    const latePenalty = isThirdPeriod && clockSeconds >= 1 && clockSeconds <= 120 ? 'yes' : 'no';
    const earlyPenalty = isFirstPeriod && clockSeconds >= 15 * 60 && clockSeconds <= 16 * 60 + 59 ? 'yes' : 'no';
    const clutchPenalty =
      isThirdPeriod && clockSeconds <= 300 && (teamScore === opponentScore || teamScore > opponentScore) ? 'yes' : 'no';
    const comebackThreat = isThirdPeriod && teamScore > opponentScore && scoreDiff <= 1 ? 'yes' : 'no';

    const existingPenalties = Array.isArray(currentGame?.penalties) ? currentGame.penalties : [];
    const previousPenaltiesForPlayer = existingPenalties.filter((penalty) => penalty.playerId === playerId).length;
    const penaltiesThisGame = previousPenaltiesForPlayer + 1;
    const teamPenaltyCount = existingPenalties.filter((penalty) => penalty.team === team).length + 1;

    const lastGoal = currentGame?.goals?.length ? currentGame.goals[currentGame.goals.length - 1] : null;
    const momentumSwing = lastGoal && lastGoal.team === team ? 'yes' : 'no';

    const playerLabel = player ? formatPlayerLabel(player, jerseyMap) : 'Unknown';
    const playerNumber = player ? resolvePlayerJersey(player, jerseyMap) : '';

    this.data.addPenalty({
      team,
      teamScore,
      opponentScore,
      penaltyImpact,
      penaltiesThisGame,
      teamPenaltyCount,
      momentumSwing,
      latePenalty,
      earlyPenalty,
      clutchPenalty,
      comebackThreat,
      player: player?.name ?? 'Unknown',
      playerId,
      playerLabel,
      playerNumber,
      type,
      minutes,
      period,
      time,
      clockSeconds,
    });

    this.showScoring();
  }

  submitGame() {
    if (!this.data.currentGame) return;

    const confirmSubmit = window.confirm('Submit this game and save the results?');
    if (!confirmSubmit) return;

    const completedGame = this.data.endCurrentGame();
    console.log('Game submitted', completedGame);
    window.alert('Game submitted!');
    this.showStartupMenu();
  }
}

