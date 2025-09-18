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

    this.selectedGame = game;
    this.bootstrapAttendanceState();
    this.showAttendance();
  }

  bootstrapAttendanceState() {
    if (!this.selectedGame) return;

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

    const attendance = this.buildAttendanceRecords();
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
    input.value = currentValue;
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

    const teamState = this.attendanceState.get(team);
    if (!teamState) return;

    const record = teamState.get(playerId);
    if (record) {
      record.jersey = sanitized;
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

  buildAttendanceRecords() {
    const records = [];
    this.attendanceState.forEach((teamState) => {
      teamState.forEach((record) => {
        if (!record.present) return;
        records.push({
          id: record.playerId,
          name: record.name,
          team: record.team,
          jersey: record.jersey,
        });
      });
    });
    return records;
  }

  syncAttendanceToGame() {
    if (!this.data.currentGame) return;
    this.data.currentGame.attendance = this.buildAttendanceRecords();
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
          summary.home.push(`${record.name}${record.jersey ? ` (#${record.jersey})` : ''}`);
        }
      });
    }

    if (awayState) {
      awayState.forEach((record) => {
        if (record.present) {
          summary.away.push(`${record.name}${record.jersey ? ` (#${record.jersey})` : ''}`);
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

    const player = this.data.getPlayersForTeam(team).find((p) => p.id === playerId);
    const assist = assistId
      ? this.data.getPlayersForTeam(team).find((p) => p.id === assistId)
      : null;

    this.data.addGoal({
      team,
      player: player?.name ?? 'Unknown',
      playerId,
      assist: assist ? assist.name : '',
      assistId: assist ? assist.id : '',
      period,
      shotType,
      goalType,
      time,
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

    const player = this.data.getPlayersForTeam(team).find((p) => p.id === playerId);

    this.data.addPenalty({
      team,
      player: player?.name ?? 'Unknown',
      playerId,
      type,
      minutes,
      period,
      time,
    });

    this.showScoring();
  }

  endGame() {
    if (!this.data.currentGame) return;

    const confirmEnd = window.confirm('End this game and save the final data?');
    if (!confirmEnd) return;

    const completedGame = this.data.endCurrentGame();
    console.log('Game completed', completedGame);
    window.alert('Game saved!');
    this.showStartupMenu();
  }
}
