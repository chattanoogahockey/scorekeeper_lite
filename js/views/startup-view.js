export const startupView = {
  id: 'main-menu',
  hideHeader: false,
  template() {
    return `
      <div class="card">
        <p>Select an option to get started:</p>
        <div style="margin-top: 30px;">
          <button class="btn" data-action="score-new">Score a New Game</button>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn" data-action="view-history">View Game History</button>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn" data-action="statistics">Statistics</button>
        </div>
      </div>
    `;
  },
  navigation() {
    return '';
  },
  bind(app) {
    const main = app.mainContent;
    const scoreNewButton = main.querySelector('[data-action="score-new"]');
    scoreNewButton?.addEventListener('click', () => {
      const PASSCODE = 'chahky2025';
      const input = window.prompt('Enter passcode to score a new game:');
      if (input === null) {
        return;
      }
      if (input === PASSCODE) {
        app.showGameSelection();
      } else {
        window.alert('Incorrect passcode.');
      }
    });
    main
      .querySelector('[data-action="view-history"]')
      .addEventListener('click', () => app.showGameHistory());
    main
      .querySelector('[data-action="statistics"]')
      .addEventListener('click', () => app.showStatistics());
  },
};
