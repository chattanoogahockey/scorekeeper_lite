import { buildJerseyMap, formatPlayerLabel } from '../components/player-labels.js';
import { attachTimeEntry, timeEntryMarkup } from '../components/time-entry.js';

export const goalDetailsView = {
  id: 'goal-details',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return `<div class="card"><p>No active game found.</p></div>`;
    }

    const editContext = app.editContext;
    const existingGoal = editContext?.type === 'goal' ? app.data.getGoalById(editContext.id) : null;
    const isEditing = Boolean(existingGoal);

    const playersByTeam = {
      [game.homeTeam]: app.data.getPlayersForTeam(game.homeTeam),
      [game.awayTeam]: app.data.getPlayersForTeam(game.awayTeam),
    };
    const jerseyMap = buildJerseyMap(game);

    const selectedTeam = existingGoal?.team ?? game.homeTeam;
    const selectedPlayerId = existingGoal?.playerId ?? '';
    const selectedAssistId = existingGoal?.assistId ?? '';
    const selectedPeriod = existingGoal?.period ?? '1';
    const selectedGoalType = existingGoal?.goalType ?? 'regular';
    const selectedShotType = existingGoal?.shotType ?? 'wrist';
    const selectedBreakaway = existingGoal?.breakaway ?? 'no';

    const playersForSelectedTeam = Array.isArray(playersByTeam[selectedTeam])
      ? playersByTeam[selectedTeam]
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

    const renderAssistOptions = (players, selectedId) =>
      [
        `<option value=""${selectedId ? '' : ' selected'}>No Assist</option>`,
        ...players.map((player) => {
          const label = formatPlayerLabel(player, jerseyMap);
          const isSelected = player.id === selectedId;
          return `<option value="${player.id}"${isSelected ? ' selected' : ''}>${label}</option>`;
        }),
      ].join('');

    const submitLabel = isEditing ? 'Save Goal' : 'Add Goal';
    const deleteButtonMarkup = isEditing
      ? '<button class="btn btn-danger" data-action="delete-goal">Delete Goal</button>'
      : '';

    return `
      <div class="card">
        <h2>${isEditing ? 'Edit Goal Details' : 'Add Goal Details'}</h2>
        <p><strong>Game:</strong> ${game.homeTeam} vs ${game.awayTeam}</p>

        <div class="goal-form-grid">
          <!-- Column 1 -->
          <div class="form-group">
            <label>Team:</label>
            <div class="minutes-options" data-role="team-group">
              <button type="button" class="minutes-button${selectedTeam === game.homeTeam ? ' is-active' : ''}" data-team="${game.homeTeam}">${game.homeTeam}</button>
              <button type="button" class="minutes-button${selectedTeam === game.awayTeam ? ' is-active' : ''}" data-team="${game.awayTeam}">${game.awayTeam}</button>
            </div>
            <input type="hidden" data-field="team" value="${selectedTeam}">
          </div>

          <div class="form-group">
            <label>Scorer:</label>
            <select data-field="player" data-team="${selectedTeam}">
              ${renderPlayerOptions(playersForSelectedTeam, selectedPlayerId)}
            </select>
          </div>

          <div class="form-group">
            <label>Assist (optional):</label>
            <select data-field="assist" data-team="${selectedTeam}">
              ${renderAssistOptions(playersForSelectedTeam, selectedAssistId)}
            </select>
          </div>

          <div class="form-group">
            <label>Goal Type:</label>
            <select data-field="goalType">
              <option value="regular"${selectedGoalType === 'regular' ? ' selected' : ''}>Regular</option>
              <option value="shorthanded"${selectedGoalType === 'shorthanded' ? ' selected' : ''}>Shorthanded</option>
              <option value="powerplay"${selectedGoalType === 'powerplay' ? ' selected' : ''}>Power Play</option>
            </select>
          </div>

          <div class="form-group">
            <label>Shot Type:</label>
            <select data-field="shotType">
              <option value="wrist"${selectedShotType === 'wrist' ? ' selected' : ''}>Wrist</option>
              <option value="slap"${selectedShotType === 'slap' ? ' selected' : ''}>Slap</option>
              <option value="backhand"${selectedShotType === 'backhand' ? ' selected' : ''}>Backhand</option>
              <option value="snapshot"${selectedShotType === 'snapshot' ? ' selected' : ''}>Snapshot</option>
            </select>
          </div>

          <!-- Column 2 -->
          <div class="form-group">
            <label>Period:</label>
            <div class="minutes-options" data-role="period-group">
              <button type="button" class="minutes-button${selectedPeriod === '1' ? ' is-active' : ''}" data-period="1">1</button>
              <button type="button" class="minutes-button${selectedPeriod === '2' ? ' is-active' : ''}" data-period="2">2</button>
              <button type="button" class="minutes-button${selectedPeriod === '3' ? ' is-active' : ''}" data-period="3">3</button>
            </div>
            <input type="hidden" data-field="period" value="${selectedPeriod}">
          </div>

          <div class="form-group form-group--time">
            <label>Time (MM:SS):</label>
            ${timeEntryMarkup()}
          </div>

          <div class="form-group">
            <label>Breakaway:</label>
            <select data-field="breakaway">
              <option value="no"${selectedBreakaway === 'no' ? ' selected' : ''}>No</option>
              <option value="yes"${selectedBreakaway === 'yes' ? ' selected' : ''}>Yes</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-success" data-action="save-goal">${submitLabel}</button>
          ${deleteButtonMarkup}
          <button class="btn btn-secondary" data-action="cancel-goal">Cancel</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const editContext = app.editContext;
    const existingGoal = editContext?.type === 'goal' ? app.data.getGoalById(editContext.id) : null;

    const main = app.mainContent;
    const teamInput = main.querySelector('[data-field="team"]');
    const teamGroup = main.querySelector('[data-role="team-group"]');
    const scorerSelect = main.querySelector('[data-field="player"]');
    const assistSelect = main.querySelector('[data-field="assist"]');
    const timeContainer = main.querySelector('[data-time-input]');
    const periodGroup = main.querySelector('[data-role="period-group"]');
    const periodInput = main.querySelector('[data-field="period"]');
    const goalTypeSelect = main.querySelector('[data-field="goalType"]');
    const shotTypeSelect = main.querySelector('[data-field="shotType"]');
    const breakawaySelect = main.querySelector('[data-field="breakaway"]');

    if (goalTypeSelect && existingGoal?.goalType) {
      goalTypeSelect.value = existingGoal.goalType;
    }
    if (shotTypeSelect && existingGoal?.shotType) {
      shotTypeSelect.value = existingGoal.shotType;
    }
    if (breakawaySelect && existingGoal?.breakaway) {
      breakawaySelect.value = existingGoal.breakaway;
    }

    if (timeContainer) {
      attachTimeEntry(timeContainer, { initialValue: existingGoal?.time ?? '' });
    }

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

    if (existingGoal?.period && periodInput) {
      periodInput.value = existingGoal.period;
    }
    applyPeriodSelection(periodInput?.value || '1');

    const getPlayers = (team) => app.data.getPlayersForTeam(team);

    const populateOptions = (team) => {
      if (!scorerSelect || !assistSelect) return;
      const jerseyMap = buildJerseyMap(app.data.currentGame);
      const players = getPlayers(team);
      const selectedScorer = scorerSelect.value;
      const selectedAssist = assistSelect.value;

      scorerSelect.innerHTML = [
        '<option value="">Select Player</option>',
        ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`),
      ].join('');
      assistSelect.innerHTML = [
        '<option value="">No Assist</option>',
        ...players.map((p) => `<option value="${p.id}">${formatPlayerLabel(p, jerseyMap)}</option>`),
      ].join('');

      if (selectedScorer && players.some((p) => p.id === selectedScorer)) {
        scorerSelect.value = selectedScorer;
      }
      if (selectedAssist && players.some((p) => p.id === selectedAssist)) {
        assistSelect.value = selectedAssist;
      }

      scorerSelect.dataset.team = team;
      assistSelect.dataset.team = team;
    };

    const applyTeamSelection = (team) => {
      if (!teamInput) return;
      teamInput.value = team;
      if (teamGroup) {
        teamGroup.querySelectorAll('.minutes-button').forEach((button) => {
          button.classList.toggle('is-active', button.dataset.team === team);
        });
      }
      populateOptions(team);
    };

    teamGroup?.addEventListener('click', (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest('.minutes-button') : null;
      if (!button) return;
      const selected = button.dataset.team;
      if (!selected) return;
      applyTeamSelection(selected);
    });

    if (existingGoal && scorerSelect) {
      scorerSelect.value = existingGoal.playerId ?? '';
    }
    if (existingGoal && assistSelect) {
      assistSelect.value = existingGoal.assistId ?? '';
    }

    const defaultTeam = existingGoal?.team ?? teamInput?.value ?? app.data.currentGame?.homeTeam;
    applyTeamSelection(defaultTeam);

    if (existingGoal && scorerSelect) {
      scorerSelect.value = existingGoal.playerId ?? '';
    }
    if (existingGoal && assistSelect) {
      assistSelect.value = existingGoal.assistId ?? '';
    }

    main
      .querySelector('[data-action="cancel-goal"]')
      ?.addEventListener('click', () => {
        app.editContext = null;
        app.showScoring();
      });
    if (existingGoal?.id) {
      main
        .querySelector('[data-action="delete-goal"]')
        ?.addEventListener('click', () => app.deleteGoal(existingGoal.id));
    }
    main
      .querySelector('[data-action="save-goal"]')
      ?.addEventListener('click', () => app.submitGoalForm());
  },
};
