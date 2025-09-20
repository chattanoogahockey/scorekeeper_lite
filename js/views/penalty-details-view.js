import { buildJerseyMap, formatPlayerLabel } from '../components/player-labels.js';
import { attachTimeEntry, timeEntryMarkup } from '../components/time-entry.js';

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
            <div class="minutes-options" data-role="period-group">
              <button type="button" class="minutes-button" data-period="1">1</button>
              <button type="button" class="minutes-button" data-period="2">2</button>
              <button type="button" class="minutes-button" data-period="3">3</button>
              <button type="button" class="minutes-button" data-period="OT">OT</button>
            </div>
            <input type="hidden" data-field="period" value="1">
          </div>

          <div class="form-group">
            <label>Team:</label>
            <div class="minutes-options" data-role="team-group">
              <button type="button" class="minutes-button" data-team="${game.homeTeam}">${game.homeTeam}</button>
              <button type="button" class="minutes-button" data-team="${game.awayTeam}">${game.awayTeam}</button>
            </div>
            <input type="hidden" data-field="team" value="${game.homeTeam}">
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
              <option value="slashing">Slashing</option>
              <option value="high-sticking">High Sticking</option>
              <option value="interference">Interference</option>
              <option value="holding">Holding</option>
              <option value="roughing">Roughing</option>
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
          <button class="btn btn-success" data-action="save-penalty">Add Penalty</button>
          <button class="btn btn-secondary" data-action="cancel-penalty">Cancel</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const main = app.mainContent;
    const teamInput = main.querySelector('[data-field="team"]');
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

    const periodGroup = main.querySelector('[data-role="period-group"]');
    const periodInput = main.querySelector('[data-field="period"]');
    const teamGroup = main.querySelector('[data-role="team-group"]');

    const applyPeriodSelection = (value) => {
      if (!periodGroup || !periodInput) return;
      periodInput.value = value;
      periodGroup.querySelectorAll('.minutes-button').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.period === value);
      });
    };

    periodGroup?.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('.minutes-button') : null;
      if (!button) return;
      const selected = button.dataset.period;
      if (!selected) return;
      applyPeriodSelection(selected);
    });

    if (periodInput) {
      applyPeriodSelection(periodInput.value || '1');
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

    const applyTeamSelection = (team) => {
      if (!teamInput) return;
      teamInput.value = team;
      if (teamGroup) {
        teamGroup.querySelectorAll('.minutes-button').forEach((button) => {
          button.classList.toggle('is-active', button.dataset.team === team);
        });
      }
      updatePlayerOptions(team);
    };

    teamGroup?.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('.minutes-button') : null;
      if (!button) return;
      const selected = button.dataset.team;
      if (!selected) return;
      applyTeamSelection(selected);
    });

    applyTeamSelection(teamInput?.value || app.data.currentGame?.homeTeam);

    main
      .querySelector('[data-action="cancel-penalty"]')
      ?.addEventListener('click', () => app.showScoring());
    main
      .querySelector('[data-action="save-penalty"]')
      ?.addEventListener('click', () => app.submitPenaltyForm());
  },
};














