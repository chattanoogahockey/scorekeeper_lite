export const penaltyDetailsView = {
  id: 'penalty-details',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return `<div class="card"><p>No active game found.</p></div>`;
    }

    const renderPlayerOptions = (team) => {
      const players = app.data.getPlayersForTeam(team);
      return ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${p.name}</option>`)].join('');
    };

    return `
      <div class="card">
        <h2>Add Penalty Details</h2>
        <p><strong>Game:</strong> ${game.homeTeam} vs ${game.awayTeam}</p>

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

        <div class="form-group">
          <label>Minutes:</label>
          <input type="number" data-field="minutes" value="2" min="1" max="10">
        </div>

        <div class="form-group">
          <label>Period:</label>
          <select data-field="period">
            <option value="1">Period 1</option>
            <option value="2">Period 2</option>
            <option value="3">Period 3</option>
          </select>
        </div>

        <div class="form-group">
          <label>Time (MM:SS):</label>
          <input type="text" data-field="time" placeholder="00:00">
        </div>

        <div style="margin-top: 30px; display: flex; gap: 10px;">
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

    const updatePlayerOptions = (team) => {
      const players = app.data.getPlayersForTeam(team);
      const options = ['<option value="">Select Player</option>', ...players.map((p) => `<option value="${p.id}">${p.name}</option>`)];
      playerSelect.innerHTML = options.join('');
    };

    teamSelect?.addEventListener('change', (event) => updatePlayerOptions(event.target.value));

    main
      .querySelector('[data-action="cancel-penalty"]')
      ?.addEventListener('click', () => app.showScoring());
    main
      .querySelector('[data-action="save-penalty"]')
      ?.addEventListener('click', () => app.submitPenaltyForm());
  },
};