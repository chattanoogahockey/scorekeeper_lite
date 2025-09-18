import { attachTimeEntry, timeEntryMarkup } from '../components/time-entry.js';
import { buildJerseyMap, formatPlayerLabel } from '../components/player-labels.js';

export const penaltyDetailsView = {
  id: 'penalty-details',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return `<div class="card"><p>No active game found.</p></div>`;
    }

    const jerseyMap = buildJerseyMap(game);

    const renderPlayerOptions = (team) => {
      const players = app.data.getPlayersForTeam(team);
      return ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');
    };

    return `
      <div class="card">
        <h2>Add Penalty Details</h2>
        <p><strong>Game:</strong> ${game.homeTeam} vs ${game.awayTeam}</p>

        <div class="penalty-form-grid">
          <div class="form-group">
            <label>Period:</label>
            <select data-field="period">
              <option value="1">Period 1</option>
              <option value="2">Period 2</option>
              <option value="3">Period 3</option>
              <option value="OT">Overtime</option>
            </select>
          </div>

          <div class="form-group">
            <label>Team:</label>
            <select data-field="team">
              <option value="${game.homeTeam}" selected>${game.homeTeam}</option>
              <option value="${game.awayTeam}">${game.awayTeam}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Player:</label>
            <select data-field="player">
              ${renderPlayerOptions(game.homeTeam)}
            </select>
          </div>

          <div class="form-group">
            <label>Penalty Type:</label>
            <select data-field="type">
              <option value="tripping">Tripping</option>
              <option value="hooking">Hooking</option>
              <option value="interference">Interference</option>
              <option value="roughing">Roughing</option>
              <option value="boarding">Boarding</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group form-group--time">
            <label>Time (MM:SS):</label>
            ${timeEntryMarkup()}
          </div>

          <div class="form-group">
            <label>Minutes:</label>
            <div class="minutes-options" data-role="minutes-group">
              <button type="button" class="minutes-button" data-minutes="2">2 min</button>
              <button type="button" class="minutes-button" data-minutes="4">4 min</button>
              <button type="button" class="minutes-button" data-minutes="10">10 min</button>
            </div>
            <input type="hidden" data-field="minutes" value="2">
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" data-action="cancel-penalty">Cancel</button>
          <button class="btn btn-success" data-action="save-penalty">Add Penalty</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const main = app.mainContent;
    const teamSelect = main.querySelector('[data-field="team"]');
    const playerSelect = main.querySelector('[data-field="player"]');
    const timeContainer = main.querySelector('[data-time-input]');

    if (timeContainer) {
      attachTimeEntry(timeContainer);
    }

    const minutesGroup = main.querySelector('[data-role="minutes-group"]');
    const minutesInput = main.querySelector('[data-field="minutes"]');

    const applyMinutesSelection = (value) => {
      if (!minutesGroup || !minutesInput) return;
      minutesInput.value = `${value}`;
      minutesGroup.querySelectorAll('.minutes-button').forEach((button) => {
        const isActive = Number(button.dataset.minutes) === Number(value);
        button.classList.toggle('is-active', isActive);
      });
    };

    minutesGroup?.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('.minutes-button') : null;
      if (!button) return;
      const selected = button.dataset.minutes;
      if (!selected) return;
      applyMinutesSelection(selected);
    });

    if (minutesInput) {
      applyMinutesSelection(minutesInput.value || 2);
    }
    const updatePlayerOptions = (team) => {
      if (!playerSelect) return;
      const jerseyMap = buildJerseyMap(app.data.currentGame);
      const players = app.data.getPlayersForTeam(team);
      const selectedPlayer = playerSelect.value;
      playerSelect.innerHTML = ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');
      if (players.some((p) => p.id === selectedPlayer)) {
        playerSelect.value = selectedPlayer;
      }
      playerSelect.dataset.team = team;
    };

    teamSelect?.addEventListener('change', (event) => updatePlayerOptions(event.target.value));

    if (teamSelect && teamSelect.value) {
      updatePlayerOptions(teamSelect.value);
    }

    main
      .querySelector('[data-action="cancel-penalty"]')
      ?.addEventListener('click', () => app.showScoring());
    main
      .querySelector('[data-action="save-penalty"]')
      ?.addEventListener('click', () => app.submitPenaltyForm());
  },
};














