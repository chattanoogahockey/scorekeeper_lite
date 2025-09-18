import { formatGameTime } from '../utils/formatters.js';

export const gameSelectionView = {
  id: 'game-selection',
  hideHeader: true,
  template(app) {
    const games = app.data.getUpcomingGames();

    if (!games.length) {
      return `
        <div class="card">
          <h2>Select a Game</h2>
          <p>No upcoming games found. Please check the schedule data.</p>
        </div>
      `;
    }

    const gamesHTML = games
      .map(
        (game) => `
          <div class="game-item" data-game-id="${game.id}">
            <h3>${game.homeTeam} vs ${game.awayTeam}</h3>
            <p><strong>Date:</strong> ${new Date(game.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${formatGameTime(game.time)}</p>
          </div>
        `,
      )
      .join('');

    return `
      <h1>Select a Game to Score</h1>
      <div class="card">
        <div style="margin-bottom: 20px; display: flex; justify-content: center;">
          <button class="btn" data-action="back-to-menu">Back to Menu</button>
        </div>
        <div class="game-grid">
          ${gamesHTML}
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
      .querySelector('[data-action="back-to-menu"]')
      ?.addEventListener('click', () => app.showStartupMenu());

    main.querySelectorAll('.game-item').forEach((item) => {
      item.addEventListener('click', () => {
        const gameId = item.getAttribute('data-game-id');
        app.selectGame(gameId);
      });
    });
  },
};