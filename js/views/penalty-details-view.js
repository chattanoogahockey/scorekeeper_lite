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

    const editContext = app.editContext;
    const existingPenalty = editContext?.type === 'penalty' ? app.data.getPenaltyById(editContext.id) : null;
    const isEditing = Boolean(existingPenalty);

    const jerseyMap = buildJerseyMap(game);
    const selectedTeam = existingPenalty?.team ?? game.homeTeam;
    const selectedPlayerId = existingPenalty?.playerId ?? '';
    const selectedPeriod = existingPenalty?.period ?? '1';
    const selectedMinutes = existingPenalty?.minutes ?? 2;
    const selectedType = existingPenalty?.type ?? 'tripping';

    const playersForSelectedTeam = Array.isArray(app.data.getPlayersForTeam(selectedTeam))
      ? app.data.getPlayersForTeam(selectedTeam)
      : [];

    const renderPlayerOptions = (players, selectedId) =>
      [
        `<option value=""${selectedId ? '' : ' selected'}>Select Player</option>`,
        ...players.map((player) => {
          const label = formatPlayerLabel(player, jerseyMap);
          const isSelected = player.id === selectedId;
          return `<option value="${player.id}"${isSelected ? ' selected' : ''}>${label}</option>`;
        }),
      ].join('');

    const submitLabel = isEditing ? 'Save Penalty' : 'Add Penalty';
    const deleteButtonMarkup = isEditing
      ? '<button class="btn btn-danger" data-action="delete-penalty">Delete Penalty</button>'
      : '';

    return `
      <div class="card">
        <h2>${isEditing ? 'Edit Penalty Details' : 'Add Penalty Details'}</h2>
        <p><strong>Game:</strong> ${game.homeTeam} vs ${game.awayTeam}</p>

        <div class="penalty-form-grid">
          <div class="form-group">
            <label>Period:</label>
            <div class="minutes-options" data-role="period-group">
              <button type="button" class="minutes-button${selectedPeriod === '1' ? ' is-active' : ''}" data-period="1">1</button>
              <button type="button" class="minutes-button${selectedPeriod === '2' ? ' is-active' : ''}" data-period="2">2</button>
              <button type="button" class="minutes-button${selectedPeriod === '3' ? ' is-active' : ''}" data-period="3">3</button>
              <button type="button" class="minutes-button${selectedPeriod === 'OT' ? ' is-active' : ''}" data-period="OT">OT</button>
            </div>
            <input type="hidden" data-field="period" value="${selectedPeriod}">
          </div>

          <div class="form-group">
            <label>Team:</label>
            <div class="minutes-options" data-role="team-group">
              <button type="button" class="minutes-button${selectedTeam === game.homeTeam ? ' is-active' : ''}" data-team="${game.homeTeam}">${game.homeTeam}</button>
              <button type="button" class="minutes-button${selectedTeam === game.awayTeam ? ' is-active' : ''}" data-team="${game.awayTeam}">${game.awayTeam}</button>
            </div>
            <input type="hidden" data-field="team" value="${selectedTeam}">
          </div>

          <div class="form-group">
            <label>Player:</label>
            <select data-field="player" data-team="${selectedTeam}">
              ${renderPlayerOptions(playersForSelectedTeam, selectedPlayerId)}
            </select>
          </div>

          <div class="form-group">
            <label>Penalty Type:</label>
            <select data-field="type">
              <option value="tripping"${selectedType === 'tripping' ? ' selected' : ''}>Tripping</option>
              <option value="hooking"${selectedType === 'hooking' ? ' selected' : ''}>Hooking</option>
              <option value="slashing"${selectedType === 'slashing' ? ' selected' : ''}>Slashing</option>
              <option value="high-sticking"${selectedType === 'high-sticking' ? ' selected' : ''}>High Sticking</option>
              <option value="interference"${selectedType === 'interference' ? ' selected' : ''}>Interference</option>
              <option value="holding"${selectedType === 'holding' ? ' selected' : ''}>Holding</option>
              <option value="roughing"${selectedType === 'roughing' ? ' selected' : ''}>Roughing</option>
              <option value="other"${selectedType === 'other' ? ' selected' : ''}>Other</option>
            </select>
          </div>

          <div class="form-group form-group--time">
            <label>Time (MM:SS):</label>
            ${timeEntryMarkup()}
          </div>

          <div class="form-group">
            <label>Minutes:</label>
            <div class="minutes-options" data-role="minutes-group">
              <button type="button" class="minutes-button${Number(selectedMinutes) === 2 ? ' is-active' : ''}" data-minutes="2">2 min</button>
              <button type="button" class="minutes-button${Number(selectedMinutes) === 4 ? ' is-active' : ''}" data-minutes="4">4 min</button>
              <button type="button" class="minutes-button${Number(selectedMinutes) === 10 ? ' is-active' : ''}" data-minutes="10">10 min</button>
            </div>
            <input type="hidden" data-field="minutes" value="${selectedMinutes}">
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-success" data-action="save-penalty">${submitLabel}</button>
          ${deleteButtonMarkup}
          <button class="btn btn-secondary" data-action="cancel-penalty">Cancel</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const editContext = app.editContext;
    const existingPenalty = editContext?.type === 'penalty' ? app.data.getPenaltyById(editContext.id) : null;

    const main = app.mainContent;
    const teamInput = main.querySelector('[data-field="team"]');
    const playerSelect = main.querySelector('[data-field="player"]');
    const timeContainer = main.querySelector('[data-time-input]');
    const minutesGroup = main.querySelector('[data-role="minutes-group"]');
    const minutesInput = main.querySelector('[data-field="minutes"]');
    const periodGroup = main.querySelector('[data-role="period-group"]');
    const periodInput = main.querySelector('[data-field="period"]');
    const teamGroup = main.querySelector('[data-role="team-group"]');
    const typeSelect = main.querySelector('[data-field="type"]');

    if (typeSelect && existingPenalty?.type) {
      typeSelect.value = existingPenalty.type;
    }

    if (timeContainer) {
      attachTimeEntry(timeContainer, { initialValue: existingPenalty?.time ?? '' });
    }

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

    if (existingPenalty?.minutes != null && minutesInput) {
      minutesInput.value = `${existingPenalty.minutes}`;
    }
    applyMinutesSelection(minutesInput?.value || 2);

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

    if (existingPenalty?.period && periodInput) {
      periodInput.value = existingPenalty.period;
    }
    applyPeriodSelection(periodInput?.value || '1');

    const updatePlayerOptions = (team) => {
      if (!playerSelect) return;
      const jerseyMap = buildJerseyMap(app.data.currentGame);
      const players = app.data.getPlayersForTeam(team);
      const selectedPlayer = playerSelect.value;
      playerSelect.innerHTML = [
        '<option value="">Select Player</option>',
        ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`),
      ].join('');
      if (selectedPlayer && players.some((p) => p.id === selectedPlayer)) {
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

    if (existingPenalty && playerSelect) {
      playerSelect.value = existingPenalty.playerId ?? '';
    }

    const defaultTeam = existingPenalty?.team ?? teamInput?.value ?? app.data.currentGame?.homeTeam;
    applyTeamSelection(defaultTeam);

    if (existingPenalty && playerSelect) {
      playerSelect.value = existingPenalty.playerId ?? '';
    }

    main
      .querySelector('[data-action="cancel-penalty"]')
      ?.addEventListener('click', () => {
        app.editContext = null;
        app.showScoring();
      });
    if (existingPenalty?.id) {
      main
        .querySelector('[data-action="delete-penalty"]')
        ?.addEventListener('click', () => app.deletePenalty(existingPenalty.id));
    }
    main
      .querySelector('[data-action="save-penalty"]')
      ?.addEventListener('click', () => app.submitPenaltyForm());
  },
};
