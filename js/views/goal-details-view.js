import { attachTimeEntry, timeEntryMarkup } from '../components/time-entry.js';
import { buildJerseyMap, formatPlayerLabel } from '../components/player-labels.js';

export const goalDetailsView = {
  id: 'goal-details',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return `<div class="card"><p>No active game found.</p></div>`;
    }

    const playersByTeam = {
      [game.homeTeam]: app.data.getPlayersForTeam(game.homeTeam),
      [game.awayTeam]: app.data.getPlayersForTeam(game.awayTeam),
    };
    const jerseyMap = buildJerseyMap(game);

    const renderPlayerOptions = (players) =>
      ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');

    const renderAssistOptions = (players) =>
      ['<option value="">No Assist</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');

    return `
      <div class="card">
        <h2>Add Goal Details</h2>
        <p><strong>Game:</strong> ${game.homeTeam} vs ${game.awayTeam}</p>

        <div class="goal-form-grid">
          <!-- Column 1 -->
          <div class="form-group">
            <label>Team:</label>
            <select data-field="team">
              <option value="${game.homeTeam}" selected>${game.homeTeam}</option>
              <option value="${game.awayTeam}">${game.awayTeam}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Scorer:</label>
            <select data-field="player" data-team="${game.homeTeam}">
              ${renderPlayerOptions(playersByTeam[game.homeTeam])}
            </select>
          </div>

          <div class="form-group">
            <label>Assist (optional):</label>
            <select data-field="assist" data-team="${game.homeTeam}">
              ${renderAssistOptions(playersByTeam[game.homeTeam])}
            </select>
          </div>

          <div class="form-group">
            <label>Goal Type:</label>
            <select data-field="goalType">
              <option value="regular" selected>Regular</option>
              <option value="shorthanded">Shorthanded</option>
              <option value="powerplay">Power Play</option>
            </select>
          </div>

          <div class="form-group">
            <label>Shot Type:</label>
            <select data-field="shotType">
              <option value="wrist" selected>Wrist</option>
              <option value="slap">Slap</option>
              <option value="backhand">Backhand</option>
              <option value="snapshot">Snapshot</option>
            </select>
          </div>

          <!-- Column 2 -->
          <div class="form-group">
            <label>Period:</label>
            <select data-field="period">
              <option value="1">Period 1</option>
              <option value="2">Period 2</option>
              <option value="3">Period 3</option>
              <option value="OT">Overtime</option>
            </select>
          </div>

          <div class="form-group form-group--time">
            <label>Time (MM:SS):</label>
            ${timeEntryMarkup()}
          </div>

          <div class="form-group">
            <label>Breakaway:</label>
            <select data-field="breakaway">
              <option value="no" selected>No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-success" data-action="save-goal">Add Goal</button>
          <button class="btn btn-secondary" data-action="cancel-goal">Cancel</button>
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
    const scorerSelect = main.querySelector('[data-field="player"]');
    const assistSelect = main.querySelector('[data-field="assist"]');
    const timeContainer = main.querySelector('[data-time-input]');

    if (timeContainer) {
      attachTimeEntry(timeContainer);
    }

    const getPlayers = (team) => app.data.getPlayersForTeam(team);

    const populateOptions = (team) => {
      if (!scorerSelect || !assistSelect) return;
      const jerseyMap = buildJerseyMap(app.data.currentGame);
      const players = getPlayers(team);
      const selectedScorer = scorerSelect.value;
      const selectedAssist = assistSelect.value;

      scorerSelect.innerHTML = ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');
      assistSelect.innerHTML = ['<option value="">No Assist</option>', ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`)].join('');

      if (players.some((p) => p.id === selectedScorer)) {
        scorerSelect.value = selectedScorer;
      }
      if (selectedAssist && players.some((p) => p.id === selectedAssist)) {
        assistSelect.value = selectedAssist;
      }

      scorerSelect.dataset.team = team;
      assistSelect.dataset.team = team;
    };

    teamSelect?.addEventListener('change', (event) => {
      populateOptions(event.target.value);
    });

    if (teamSelect && teamSelect.value) {
      populateOptions(teamSelect.value);
    }

    main
      .querySelector('[data-action="cancel-goal"]')
      ?.addEventListener('click', () => app.showScoring());
    main
      .querySelector('[data-action="save-goal"]')
      ?.addEventListener('click', () => app.submitGoalForm());
  },
};
