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
          <button class="btn" data-action="statistics">Statistics</button>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn" data-action="rink-report">The Rink Report (Coming Soon)</button>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn" data-action="admin-panel">Admin Panel</button>
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
      .querySelector('[data-action="statistics"]')
      .addEventListener('click', () => app.showStatistics());
    main
      .querySelector('[data-action="rink-report"]')
      .addEventListener('click', () => {
        const RINK_REPORT_PASS = 'rinkreport2025';
        const input = window.prompt('Enter password to view The Rink Report:');
        if (input === null) {
          return;
        }
        if (input === RINK_REPORT_PASS) {
          app.showRinkReport();
        } else {
          window.alert('Incorrect password.');
        }
      });
    main
      .querySelector('[data-action="admin-panel"]')
      .addEventListener('click', () => {
        const ADMIN_PASS = 'chahkyadmin';
        const input = window.prompt('Enter admin password:');
        if (input === null) {
          return;
        }
        if (input === ADMIN_PASS) {
          app.showAdmin();
        } else {
          window.alert('Incorrect password.');
        }
      });
  },
};
