export const historyView = {
  id: 'history',
  hideHeader: false,
  template(app) {
    const history = app.data.getHistory();
    if (!history.length) {
      return `
        <div class="card">
          <h2>Game History</h2>
          <p>No completed games yet. Start scoring to build history.</p>
        </div>
      `;
    }

    const items = history
      .map(
        (game) => `
          <div class="card" data-history-game-id="${game.id}">
            <h3>${game.homeTeam} vs ${game.awayTeam}</h3>
            <p><strong>Date:</strong> ${new Date(game.created).toLocaleString()}</p>
            <p><strong>Final:</strong> ${game.homeTeam} ${game.homeScore} – ${game.awayTeam} ${game.awayScore}</p>
            <p><strong>Status:</strong> ${game.status}</p>
            ${game.overtimeResult && game.overtimeResult.winner ? `<p><strong>OT/Shootout:</strong> ${game.overtimeResult.winner}</p>` : ''}
          </div>
        `,
      )
      .join('');

    return `
      <h1>Game History</h1>
      <div class="history-grid">${items}</div>
    `;
  },
  navigation() {
    return '<button class="nav-btn" data-action="back-to-menu">Back to Menu</button>';
  },
  bind(app) {
    const nav = app.topNavigation;
    nav
      .querySelector('[data-action="back-to-menu"]')
      ?.addEventListener('click', () => app.showStartupMenu());
  },
};