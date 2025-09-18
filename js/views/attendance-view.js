export const attendanceView = {
  id: 'attendance',
  hideHeader: true,
  template(app) {
    const { selectedGame } = app;
    if (!selectedGame) {
      return `<div class="card"><p>Please select a game first.</p></div>`;
    }

    const homePlayers = app.data.getPlayersForTeam(selectedGame.homeTeam);
    const awayPlayers = app.data.getPlayersForTeam(selectedGame.awayTeam);

    const renderPlayerList = (players, team) =>
      players
        .map((player) => {
          const checked = app.isPlayerChecked(team, player.id) ? 'checked' : '';
          const jersey = app.getPlayerJersey(team, player.id);
          const rosterNumber = player.number != null ? String(player.number).padStart(2, '0') : '';
          const labelText = rosterNumber ? `#${rosterNumber} ${player.name}` : player.name;
          const placeholder = rosterNumber || '#';
          return `
            <div class="checkbox-item" data-player-row="${player.id}">
              <input type="checkbox" data-role="attendance-checkbox" data-team="${team}" data-player-id="${player.id}" ${checked}>
              <label>${labelText}</label>
              <input type="text" data-role="jersey-input" data-team="${team}" data-player-id="${player.id}" class="jersey-number-input" placeholder="${placeholder}" value="${jersey ?? ''}" maxlength="2" readonly>
            </div>
          `;
        })
        .join('');

    return `
      <h1>Record Attendance</h1>
      <div class="card">
        <p style="text-align: center; margin-bottom: 20px; font-size: 16px; color: var(--text-color);">
          Select all players at the game and record jersey numbers. You can edit later from the in-game menu.
        </p>

        <div style="margin-top: 20px; margin-bottom: 20px; display: flex; gap: 10px; justify-content: center;">
          <button class="btn" data-action="back-to-games">Back to Games</button>
          <button class="btn btn-success" data-action="start-scoring">Start Scoring Game</button>
        </div>

        <div class="attendance-grid">
          <div class="team-column">
            <h3>${selectedGame.homeTeam}</h3>
            <div class="checkbox-group">
              ${renderPlayerList(homePlayers, selectedGame.homeTeam)}
            </div>
          </div>

          <div class="team-column">
            <h3>${selectedGame.awayTeam}</h3>
            <div class="checkbox-group">
              ${renderPlayerList(awayPlayers, selectedGame.awayTeam)}
            </div>
          </div>
        </div>
      </div>

      <div id="number-dialog" class="modal" style="display: none;" data-role="number-dialog">
        <div class="modal-content">
          <h3 id="dialog-title">Enter Jersey Number</h3>
          <p id="dialog-player-name">Player</p>
          <input type="text" id="number-input" maxlength="2" placeholder="00" data-role="number-input">
          <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button class="btn btn-secondary" data-action="close-number-dialog">Cancel</button>
            <button class="btn btn-primary" data-action="save-jersey-number">Save</button>
          </div>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const main = app.mainContent;
    main
      .querySelector('[data-action="back-to-games"]')
      ?.addEventListener('click', () => app.showGameSelection());
    main
      .querySelector('[data-action="start-scoring"]')
      ?.addEventListener('click', () => app.startScoring());

    main.querySelectorAll('[data-role="attendance-checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const target = event.currentTarget;
        const team = target.getAttribute('data-team');
        const playerId = target.getAttribute('data-player-id');
        app.toggleAttendance(team, playerId, target.checked);
      });
    });

    main.querySelectorAll('[data-role="jersey-input"]').forEach((input) => {
      input.addEventListener('click', () => {
        const team = input.getAttribute('data-team');
        const playerId = input.getAttribute('data-player-id');
        const row = input.closest('[data-player-row]');
        const playerName = row?.querySelector('label')?.textContent ?? 'Player';
        app.showNumberDialog({ team, playerId, playerName });
      });
    });

    const modal = main.querySelector('[data-role="number-dialog"]');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          app.closeNumberDialog();
        }
      });
    }

    main
      .querySelector('[data-action="close-number-dialog"]')
      ?.addEventListener('click', () => app.closeNumberDialog());
    main
      .querySelector('[data-action="save-jersey-number"]')
      ?.addEventListener('click', () => app.saveJerseyNumber());
  },
};