function renderGoals(goals) {
  if (!goals.length) {
    return '<p class="muted">No goals recorded yet.</p>';
  }

  return `
    <ol class="event-list">
      ${goals
        .map((goal) => {
          const playerName = goal.playerLabel || goal.player;
          const assistName = goal.assistLabel || goal.assist;
          const assistLine = assistName ? `<span class="muted">Assist: ${assistName}</span>` : '';
          return `
            <li>
              <strong>${goal.team}</strong> - ${playerName} (${goal.period}P ${goal.time || '??:??'})
              ${assistLine}
            </li>
          `;
        })
        .join('')}
    </ol>
  `;
}

function renderPenalties(penalties) {
  if (!penalties.length) {
    return '<p class="muted">No penalties recorded yet.</p>';
  }

  return `
    <ol class="event-list">
      ${penalties
        .map((penalty) => {
          const playerName = penalty.playerLabel || penalty.player;
          return `
            <li>
              <strong>${penalty.team}</strong> - ${playerName} (${penalty.minutes} min ${penalty.type})
              <span class="muted">${penalty.period}P ${penalty.time || '??:??'}</span>
            </li>
          `;
        })
        .join('')}
    </ol>
  `;
}

export const scoringView = {
  id: 'scoring',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return `<div class="card"><p>No active game. Return to the menu to start one.</p></div>`;
    }

    const attendanceSummary = app.getAttendanceSummary();
    const overtimeWinner = game.overtimeResult && game.overtimeResult.winner ? game.overtimeResult.winner : '';
    const overtimeStatus = overtimeWinner
      ? `<div class="overtime-banner is-set">OT/Shootout winner recorded: <strong>${overtimeWinner}</strong>.</div>`
      : '<div class="overtime-banner">OT/Shootout winner not recorded yet.</div>';

    return `
      <div class="card">
        <div class="scoreboard">
          <div class="team">
            <h2>${game.homeTeam}</h2>
            <div id="home-score" class="score">${game.homeScore}</div>
          </div>
          <div class="score-divider">vs</div>
          <div class="team">
            <h2>${game.awayTeam}</h2>
            <div id="away-score" class="score">${game.awayScore}</div>
          </div>
        </div>

        <div class="shot-actions">
          <button type="button" class="shot-button" data-action="add-shot" data-team="${game.homeTeam}">Shots on Goal: ${game.homeTeam} (${game.homeShots ?? 0})</button>
          <button type="button" class="shot-button" data-action="add-shot" data-team="${game.awayTeam}">Shots on Goal: ${game.awayTeam} (${game.awayShots ?? 0})</button>
        </div>

        ${overtimeStatus}
        <div class="score-actions">
          <button class="btn btn-primary" data-action="add-goal">Add Goal</button>
          <button class="btn btn-primary" data-action="add-penalty">Add Penalty</button>
          <button class="btn" data-action="edit-attendance">Edit Attendance</button>
          <button class="btn btn-warning" data-action="record-overtime">OT / Shootout</button>
          <button class="btn btn-success" data-action="submit-game">Submit Game</button>
        </div>

        <div class="event-columns">
          <div class="event-column">
            <h3>Goals (${game.goals.length})</h3>
            ${renderGoals(game.goals)}
          </div>
          <div class="event-column">
            <h3>Penalties (${game.penalties.length})</h3>
            ${renderPenalties(game.penalties)}
          </div>
        </div>

        <div class="attendance-summary">
          <h3>Attendance</h3>
          <p><strong>${game.homeTeam}</strong>: ${attendanceSummary.home.join(', ') || '-'}</p>
          <p><strong>${game.awayTeam}</strong>: ${attendanceSummary.away.join(', ') || '-'}</p>
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
      .querySelector('[data-action="add-goal"]')
      ?.addEventListener('click', () => app.showGoalDetails());
    main
      .querySelector('[data-action="add-penalty"]')
      ?.addEventListener('click', () => app.showPenaltyDetails());
    main
      .querySelector('[data-action="edit-attendance"]')
      ?.addEventListener('click', () => app.showAttendance());
    main
      .querySelector('[data-action="record-overtime"]')
      ?.addEventListener('click', () => app.showOvertimeSelection());
    main
      .querySelectorAll('[data-action="add-shot"]')
      .forEach((button) => {
        const team = button.dataset.team;
        if (!team) return;
        button.addEventListener('click', () => {
          app.addShotOnGoal(team);
        });
      });
    main
      .querySelector('[data-action="submit-game"]')
      ?.addEventListener('click', () => app.submitGame());
  },
};

