export const overtimeView = {
  id: 'overtime',
  hideHeader: true,
  template(app) {
    const game = app.data.currentGame;
    if (!game) {
      return '<div class="card"><p>No active game found.</p></div>';
    }

    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    const overtimeWinner = game.overtimeResult && game.overtimeResult.winner ? game.overtimeResult.winner : '';
    const statusMessage = overtimeWinner
      ? `<p class="overtime-banner is-set">Currently recorded OT/Shootout winner: <strong>${overtimeWinner}</strong>.</p>`
      : '<p class="overtime-banner">No OT/Shootout winner recorded yet.</p>';

    const highlightClass = (team) => (overtimeWinner === team ? ' is-active' : '');

    return `
      <div class="card">
        <h2>OT / Shootout Result</h2>
        <p>Select the team that won in overtime or the shootout. This will not change the final score (${game.homeScore} - ${game.awayScore}).</p>
        ${statusMessage}
        <div class="minutes-options overtime-team-options">
          <button type="button" class="minutes-button${highlightClass(homeTeam)}" data-team="${homeTeam}">${homeTeam}</button>
          <button type="button" class="minutes-button${highlightClass(awayTeam)}" data-team="${awayTeam}">${awayTeam}</button>
        </div>
        <p class="muted" style="margin-top: 16px;">After selecting a team you'll be asked to submit the game.</p>
        <div class="form-actions">
          <button class="btn btn-secondary" data-action="back-to-scoring">Back</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const main = app.mainContent;
    main.querySelectorAll('.minutes-button[data-team]').forEach((button) => {
      button.addEventListener('click', () => {
        const team = button.dataset.team;
        if (!team) return;
        app.handleOvertimeWinnerSelection(team);
      });
    });

    main
      .querySelector('[data-action="back-to-scoring"]')
      ?.addEventListener('click', () => app.showScoring());
  },
};
