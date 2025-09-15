// Main application logic for The Scorekeeper

class ScorekeeperApp {
    constructor() {
        this.currentView = 'main-menu';
        this.selectedGame = null;
        this.attendance = [];
        this.init();
    }

    async init() {
        await dataManager.loadData();
        this.render();
        this.bindEvents();
    }

    render() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = this.getViewHTML();
    }

    getViewHTML() {
        switch (this.currentView) {
            case 'main-menu':
                return this.getStartupMenuHTML();
            case 'game-selection':
                return this.getGameSelectionHTML();
            case 'attendance':
                return this.getAttendanceHTML();
            case 'scoring':
                return this.getScoringHTML();
            case 'goal-details':
                return this.getGoalDetailsHTML();
            case 'penalty-details':
                return this.getPenaltyDetailsHTML();
            default:
                return this.getStartupMenuHTML();
        }
    }

    getStartupMenuHTML() {
        return `
            <div class="card">
                <p>Select an option to get started:</p>
                <div style="margin-top: 30px;">
                    <button class="btn" onclick="app.showGameSelection()">Score a New Game</button>
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn" onclick="app.showGameHistory()">View Game History</button>
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn" onclick="alert('Statistics feature coming soon!')">Statistics</button>
                </div>
            </div>
        `;
    }

    getGameSelectionHTML() {
        const upcomingGames = dataManager.getUpcomingGames();

        if (upcomingGames.length === 0) {
            return `
                <div class="card">
                    <h2>Select a Game</h2>
                    <p>No upcoming games found. Please check the schedule data.</p>
                    <button class="btn btn-secondary" onclick="app.showStartupMenu()">Back to Startup Menu</button>
                </div>
            `;
        }

        const gamesHTML = upcomingGames.map(game => {
            // Convert 24-hour time to 12-hour AM/PM format
            let timeDisplay = 'TBD';
            if (game.time && game.time.length >= 5) {
                const [hours, minutes] = game.time.split(':').map(Number);
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12;
                timeDisplay = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }

            return `
            <div class="game-item" onclick="app.selectGame('${game.id}')">
                <h3>${game.homeTeam} vs ${game.awayTeam}</h3>
                <p><strong>Date:</strong> ${new Date(game.date).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${timeDisplay}</p>
                <p><strong>Location:</strong> ${game.location}</p>
            </div>
        `}).join('');

        return `
            <div class="card">
                <h2>Select a Game to Score</h2>
                <div class="game-list">
                    ${gamesHTML}
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="app.showStartupMenu()">Back to Startup Menu</button>
                </div>
            </div>
        `;
    }

    getAttendanceHTML() {
        if (!this.selectedGame) {
            return this.getStartupMenuHTML();
        }

        const homePlayers = dataManager.getPlayersForTeam(this.selectedGame.homeTeam);
        const awayPlayers = dataManager.getPlayersForTeam(this.selectedGame.awayTeam);

        const createPlayerCheckboxes = (players, teamName) => {
            return players.map(player => {
                // Uncheck players with "Sub" in their name by default
                const isChecked = !player.name.toLowerCase().includes('sub');
                const checkedAttr = isChecked ? 'checked' : '';

                return `
                <div class="checkbox-item">
                    <input type="checkbox" id="player_${player.id}" value="${player.id}" ${checkedAttr}
                           data-team="${teamName}" data-name="${player.name}">
                    <label for="player_${player.id}">${player.name} (${player.number})</label>
                </div>
            `}).join('');
        };

        return `
            <div class="card">
                <h2>Mark Attendance</h2>
                <p><strong>Game:</strong> ${this.selectedGame.homeTeam} vs ${this.selectedGame.awayTeam}</p>
                <p><strong>Date:</strong> ${new Date(this.selectedGame.date).toLocaleDateString()}</p>

                <div class="form-group">
                    <h3>${this.selectedGame.homeTeam} Players</h3>
                    <div class="checkbox-group">
                        ${createPlayerCheckboxes(homePlayers, this.selectedGame.homeTeam)}
                    </div>
                </div>

                <div class="form-group">
                    <h3>${this.selectedGame.awayTeam} Players</h3>
                    <div class="checkbox-group">
                        ${createPlayerCheckboxes(awayPlayers, this.selectedGame.awayTeam)}
                    </div>
                </div>

                <div style="margin-top: 30px;">
                    <button class="btn" onclick="app.startScoring()">Start Scoring Game</button>
                    <button class="btn btn-secondary" onclick="app.showGameSelection()">Back to Game Selection</button>
                </div>
            </div>
        `;
    }

    getScoringHTML() {
        if (!this.selectedGame) {
            return this.getStartupMenuHTML();
        }

        return `
            <div class="card">
                <h2>Live Scoring</h2>
                <p><strong>Game:</strong> ${this.selectedGame.homeTeam} vs ${this.selectedGame.awayTeam}</p>

                <div class="score-display">
                    <div class="team-score">
                        <h3>${this.selectedGame.homeTeam}</h3>
                        <div class="score" id="home-score">${dataManager.currentGame?.homeScore || 0}</div>
                    </div>
                    <div style="font-size: 2em; font-weight: bold;">VS</div>
                    <div class="team-score">
                        <h3>${this.selectedGame.awayTeam}</h3>
                        <div class="score" id="away-score">${dataManager.currentGame?.awayScore || 0}</div>
                    </div>
                </div>

                <div class="stats-section">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <h4>Goals & Penalties</h4>
                            <div style="display: flex; gap: 10px; margin-top: 15px;">
                                <button class="btn btn-success" onclick="app.showGoalDetails()" style="flex: 1;">Add Goal</button>
                                <button class="btn btn-warning" onclick="app.showPenaltyDetails()" style="flex: 1;">Add Penalty</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px;">
                    <button class="btn btn-danger" onclick="app.endGame()">End Game</button>
                    <button class="btn btn-secondary" onclick="app.showAttendance()">Back to Attendance</button>
                </div>
            </div>
        `;
    }

    getGoalDetailsHTML() {
        if (!this.selectedGame) {
            return this.getStartupMenuHTML();
        }

        return `
            <div class="card">
                <h2>Add Goal Details</h2>
                <p><strong>Game:</strong> ${this.selectedGame.homeTeam} vs ${this.selectedGame.awayTeam}</p>

                <div class="form-group">
                    <label>Team:</label>
                    <select id="goal-team">
                        <option value="${this.selectedGame.homeTeam}">${this.selectedGame.homeTeam}</option>
                        <option value="${this.selectedGame.awayTeam}">${this.selectedGame.awayTeam}</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Player:</label>
                    <select id="goal-player">
                        <option value="">Select Player</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Assist (optional):</label>
                    <select id="goal-assist">
                        <option value="">No Assist</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Shot Type:</label>
                    <select id="goal-shot-type">
                        <option value="wrist" selected>Wrist Shot</option>
                        <option value="slapshot">Slapshot</option>
                        <option value="backhand">Backhand</option>
                        <option value="snapshot">Snapshot</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Breakaway:</label>
                    <select id="goal-breakaway">
                        <option value="no" selected>No</option>
                        <option value="yes">Yes</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Goal Type:</label>
                    <select id="goal-type">
                        <option value="regular" selected>Regular</option>
                        <option value="shorthanded">Shorthanded</option>
                        <option value="powerplay">Powerplay</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Period:</label>
                    <select id="goal-period">
                        <option value="1">Period 1</option>
                        <option value="2">Period 2</option>
                        <option value="3">Period 3</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Time (MM:SS):</label>
                    <input type="text" id="goal-time" placeholder="00:00" maxlength="5" oninput="app.formatGoalTime(this)">
                </div>

                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button class="btn btn-success" onclick="app.addGoal()" style="flex: 1;">Add Goal</button>
                    <button class="btn btn-secondary" onclick="app.showScoring()" style="flex: 1;">Cancel</button>
                </div>
            </div>
        `;
    }

    getPenaltyDetailsHTML() {
        if (!this.selectedGame) {
            return this.getStartupMenuHTML();
        }

        return `
            <div class="card">
                <h2>Add Penalty Details</h2>
                <p><strong>Game:</strong> ${this.selectedGame.homeTeam} vs ${this.selectedGame.awayTeam}</p>

                <div class="form-group">
                    <label>Team:</label>
                    <select id="penalty-team">
                        <option value="${this.selectedGame.homeTeam}">${this.selectedGame.homeTeam}</option>
                        <option value="${this.selectedGame.awayTeam}">${this.selectedGame.awayTeam}</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Player:</label>
                    <select id="penalty-player">
                        <option value="">Select Player</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Penalty Type:</label>
                    <select id="penalty-type">
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
                    <input type="number" id="penalty-minutes" value="2" min="1" max="10">
                </div>

                <div class="form-group">
                    <label>Period:</label>
                    <select id="penalty-period">
                        <option value="1">Period 1</option>
                        <option value="2">Period 2</option>
                        <option value="3">Period 3</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Time (MM:SS):</label>
                    <input type="text" id="penalty-time" placeholder="00:00" maxlength="5" oninput="app.formatPenaltyTime(this)">
                </div>

                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button class="btn btn-warning" onclick="app.addPenalty()" style="flex: 1;">Add Penalty</button>
                    <button class="btn btn-secondary" onclick="app.showScoring()" style="flex: 1;">Cancel</button>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Events are bound through onclick attributes in HTML
    }

    showStartupMenu() {
        this.currentView = 'main-menu';
        this.selectedGame = null;
        this.attendance = [];
        this.render();
    }

    showGameSelection() {
        this.currentView = 'game-selection';
        this.render();
    }

    selectGame(gameId) {
        this.selectedGame = dataManager.schedule.find(game => game.id === gameId);
        if (this.selectedGame) {
            this.showAttendance();
        }
    }

    showAttendance() {
        this.currentView = 'attendance';
        this.render();
    }

    startScoring() {
        // Collect attendance data
        const checkedPlayers = document.querySelectorAll('input[type="checkbox"]:checked');
        this.attendance = Array.from(checkedPlayers).map(cb => ({
            id: cb.value,
            name: cb.dataset.name,
            team: cb.dataset.team
        }));

        // Create game in data manager
        dataManager.currentGame = dataManager.createGame({
            ...this.selectedGame,
            attendance: this.attendance
        });

        this.showScoring();
    }

    showScoring() {
        this.currentView = 'scoring';
        this.render();
        this.updatePlayerDropdowns();
    }

    showGoalDetails() {
        this.currentView = 'goal-details';
        this.render();
        this.updatePlayerDropdowns();
    }

    showPenaltyDetails() {
        this.currentView = 'penalty-details';
        this.render();
        this.updatePlayerDropdowns();
    }

    formatGoalTime(input) {
        let value = input.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters

        if (value.length === 0) {
            input.value = '';
            return;
        }

        // Handle different input lengths
        if (value.length === 1) {
            // Single digit: 1 -> 00:01
            input.value = `00:0${value}`;
        } else if (value.length === 2) {
            // Two digits: 11 -> 00:11
            input.value = `00:${value}`;
        } else if (value.length === 3) {
            // Three digits: 120 -> 01:20
            input.value = `0${value[0]}:${value.slice(1)}`;
        } else if (value.length === 4) {
            // Four digits: 1220 -> 12:20
            input.value = `${value.slice(0, 2)}:${value.slice(2)}`;
        } else if (value.length >= 5) {
            // Five or more digits: take first 4 and format
            value = value.slice(0, 4);
            input.value = `${value.slice(0, 2)}:${value.slice(2)}`;
        }

        // Validate the time is within range (00:00 to 17:00)
        const [minutes, seconds] = input.value.split(':').map(Number);
        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds > 1020) { // 17:00 = 1020 seconds
            input.value = '17:00';
        }
    }

    formatPenaltyTime(input) {
        let value = input.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters

        if (value.length === 0) {
            input.value = '';
            return;
        }

        // Handle different input lengths
        if (value.length === 1) {
            // Single digit: 1 -> 00:01
            input.value = `00:0${value}`;
        } else if (value.length === 2) {
            // Two digits: 11 -> 00:11
            input.value = `00:${value}`;
        } else if (value.length === 3) {
            // Three digits: 120 -> 01:20
            input.value = `0${value[0]}:${value.slice(1)}`;
        } else if (value.length === 4) {
            // Four digits: 1220 -> 12:20
            input.value = `${value.slice(0, 2)}:${value.slice(2)}`;
        } else if (value.length >= 5) {
            // Five or more digits: take first 4 and format
            value = value.slice(0, 4);
            input.value = `${value.slice(0, 2)}:${value.slice(2)}`;
        }

        // Validate the time is within range (00:00 to 17:00)
        const [minutes, seconds] = input.value.split(':').map(Number);
        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds > 1020) { // 17:00 = 1020 seconds
            input.value = '17:00';
        }
    }

    updatePlayerDropdowns() {
        const goalTeamSelect = document.getElementById('goal-team');
        const penaltyTeamSelect = document.getElementById('penalty-team');

        const updatePlayers = (teamSelect, playerSelectId) => {
            const selectedTeam = teamSelect.value;
            const players = dataManager.getPlayersForTeam(selectedTeam);
            const playerSelect = document.getElementById(playerSelectId);

            playerSelect.innerHTML = '<option value="">Select Player</option>' +
                players.map(player => `<option value="${player.id}">${player.name} (${player.number})</option>`).join('');
        };

        goalTeamSelect.addEventListener('change', () => updatePlayers(goalTeamSelect, 'goal-player'));
        penaltyTeamSelect.addEventListener('change', () => updatePlayers(penaltyTeamSelect, 'penalty-player'));

        // Initialize with home team
        updatePlayers(goalTeamSelect, 'goal-player');
        updatePlayers(penaltyTeamSelect, 'penalty-player');

        // Update assist dropdown
        const goalPlayerSelect = document.getElementById('goal-player');
        const assistSelect = document.getElementById('goal-assist');

        goalPlayerSelect.addEventListener('change', () => {
            const selectedTeam = goalTeamSelect.value;
            const players = dataManager.getPlayersForTeam(selectedTeam);
            assistSelect.innerHTML = '<option value="">No Assist</option>' +
                players.filter(p => p.id !== goalPlayerSelect.value)
                    .map(player => `<option value="${player.id}">${player.name} (${player.number})</option>`).join('');
        });
    }

    addGoal() {
        const team = document.getElementById('goal-team').value;
        const playerId = document.getElementById('goal-player').value;
        const assistId = document.getElementById('goal-assist').value;
        const shotType = document.getElementById('goal-shot-type').value;
        const breakaway = document.getElementById('goal-breakaway').value;
        const goalType = document.getElementById('goal-type').value;
        const period = document.getElementById('goal-period').value;
        const time = document.getElementById('goal-time').value;

        if (!playerId) {
            alert('Please select a player who scored the goal.');
            return;
        }

        if (!time || !time.includes(':')) {
            alert('Please enter a valid time in MM:SS format.');
            return;
        }

        const players = dataManager.getPlayersForTeam(team);
        const player = players.find(p => p.id === playerId);
        const assist = assistId ? players.find(p => p.id === assistId) : null;

        dataManager.addGoal({
            team,
            player: player ? player.name : 'Unknown',
            playerId,
            assist: assist ? assist.name : null,
            assistId: assist ? assist.id : null,
            shotType,
            breakaway: breakaway === 'yes',
            goalType,
            period: parseInt(period),
            time
        });

        this.updateScores();
        this.clearGoalForm();
        this.showScoring(); // Go back to scoring view after adding goal
        alert('Goal added successfully!');
    }

    addPenalty() {
        const team = document.getElementById('penalty-team').value;
        const playerId = document.getElementById('penalty-player').value;
        const type = document.getElementById('penalty-type').value;
        const minutes = parseInt(document.getElementById('penalty-minutes').value);
        const period = document.getElementById('penalty-period').value;
        const time = document.getElementById('penalty-time').value;

        if (!playerId) {
            alert('Please select a player who received the penalty.');
            return;
        }

        if (!time || !time.includes(':')) {
            alert('Please enter a valid time in MM:SS format.');
            return;
        }

        const players = dataManager.getPlayersForTeam(team);
        const player = players.find(p => p.id === playerId);

        dataManager.addPenalty({
            team,
            player: player ? player.name : 'Unknown',
            playerId,
            type,
            minutes,
            period: parseInt(period),
            time
        });

        this.clearPenaltyForm();
        this.showScoring(); // Go back to scoring view after adding penalty
        alert(`Penalty added: ${player.name} - ${type} (${minutes} minutes)`);
    }

    updateScores() {
        if (dataManager.currentGame) {
            document.getElementById('home-score').textContent = dataManager.currentGame.homeScore;
            document.getElementById('away-score').textContent = dataManager.currentGame.awayScore;
        }
    }

    clearGoalForm() {
        document.getElementById('goal-player').value = '';
        document.getElementById('goal-assist').value = '';
        document.getElementById('goal-shot-type').value = 'wrist';
        document.getElementById('goal-breakaway').value = 'no';
        document.getElementById('goal-type').value = 'regular';
        document.getElementById('goal-period').value = '1';
        document.getElementById('goal-time').value = '';
    }

    clearPenaltyForm() {
        document.getElementById('penalty-player').value = '';
        document.getElementById('penalty-type').value = 'tripping';
        document.getElementById('penalty-minutes').value = '2';
        document.getElementById('penalty-period').value = '1';
        document.getElementById('penalty-time').value = '';
    }

    endGame() {
        if (confirm('Are you sure you want to end this game? This will save the final data.')) {
            dataManager.endGame();
            alert('Game ended and data saved!');
            this.showStartupMenu();
        }
    }

    showGameHistory() {
        // This would show past games - for now just show a placeholder
        alert('Game history feature coming soon!');
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ScorekeeperApp();
});