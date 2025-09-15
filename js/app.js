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
        const topNav = document.getElementById('top-navigation');
        const header = document.querySelector('header');
        
        mainContent.innerHTML = this.getViewHTML();
        topNav.innerHTML = this.getNavigationHTML();
        
        // Hide header on game selection page
        if (this.currentView === 'game-selection') {
            header.style.display = 'none';
        } else {
            header.style.display = 'block';
        }
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

    getNavigationHTML() {
        switch (this.currentView) {
            case 'main-menu':
                return ''; // No navigation needed on startup menu
            case 'game-selection':
                return '<button class="nav-btn" onclick="app.showStartupMenu()">← Back to Menu</button>';
            case 'attendance':
                return '<button class="nav-btn" onclick="app.showGameSelection()">← Back to Games</button><button class="nav-btn primary" onclick="app.startScoring()">Start Scoring Game</button>';
            case 'scoring':
                return '<button class="nav-btn" onclick="app.showAttendance()">← Back to Attendance</button>';
            case 'goal-details':
            case 'penalty-details':
                return '<button class="nav-btn" onclick="app.showScoring()">← Back to Scoring</button>';
            default:
                return '<button class="nav-btn" onclick="app.showStartupMenu()">← Back to Menu</button>';
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
            </div>
        `}).join('');

        return `
            <h1>Select a Game to Score</h1>
            <div class="card">
                <div class="game-grid">
                    ${gamesHTML}
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
                    <label for="player_${player.id}">${player.name}</label>
                </div>
            `}).join('');
        };

        return `
            <div class="card">
                <h2>Mark Attendance</h2>
                <p><strong>Game:</strong> ${this.selectedGame.homeTeam} vs ${this.selectedGame.awayTeam}</p>
                <p><strong>Date:</strong> ${new Date(this.selectedGame.date).toLocaleDateString()}</p>

                <div class="attendance-grid">
                    <div class="team-column">
                        <h3>${this.selectedGame.homeTeam}</h3>
                        <div class="checkbox-group">
                            ${createPlayerCheckboxes(homePlayers, this.selectedGame.homeTeam)}
                        </div>
                    </div>

                    <div class="team-column">
                        <h3>${this.selectedGame.awayTeam}</h3>
                        <div class="checkbox-group">
                            ${createPlayerCheckboxes(awayPlayers, this.selectedGame.awayTeam)}
                        </div>
                    </div>
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
                </div>
            </div>
        `;
    }

    getGoalDetailsHTML() {
        if (!this.selectedGame) {
            return this.getStartupMenuHTML();
        }

        return `
            <h1>Add Goal Details</h1>
            <div class="card">
                <div class="goal-form-grid">
                    <!-- Left Column -->
                    <div class="form-column">
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
                                <option value="wrist" selected>Wrist</option>
                                <option value="slapshot">Slap</option>
                                <option value="backhand">Backhand</option>
                                <option value="snapshot">Snap</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Goal Type:</label>
                            <select id="goal-type">
                                <option value="regular" selected>Regular</option>
                                <option value="shorthanded">Short</option>
                                <option value="powerplay">Power</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Breakaway:</label>
                            <select id="goal-breakaway">
                                <option value="no" selected>No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>
                    </div>

                    <!-- Right Column -->
                    <div class="form-column">
                        <div class="form-group">
                            <label>Period:</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input type="radio" name="goal-period" value="1" checked> 1
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="goal-period" value="2"> 2
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="goal-period" value="3"> 3
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Time:</label>
                            <div class="time-input-container">
                                <input type="text" id="goal-time" placeholder="00:00" readonly>
                                <div class="time-keypad">
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('1')">1</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('2')">2</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('3')">3</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('4')">4</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('5')">5</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('6')">6</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('7')">7</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('8')">8</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('9')">9</button>
                                    <button type="button" class="keypad-btn clear-btn" onclick="app.clearTime()">Clear</button>
                                    <button type="button" class="keypad-btn" onclick="app.addTimeDigit('0')">0</button>
                                    <button type="button" class="keypad-btn colon-btn" onclick="app.addColon()">:</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button class="btn btn-secondary" onclick="app.showScoring()" style="flex: 1;">Cancel</button>
                    <button class="btn btn-success" onclick="app.addGoal()" style="flex: 1;">Add Goal</button>
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

    // Time keypad methods
    addTimeDigit(digit) {
        const input = document.getElementById('goal-time');
        const currentValue = input.value.replace(':', '');
        
        if (currentValue.length < 4) {
            input.value = currentValue + digit;
            this.formatGoalTime(input);
        }
    }

    clearTime() {
        const input = document.getElementById('goal-time');
        input.value = '';
    }

    addColon() {
        const input = document.getElementById('goal-time');
        const currentValue = input.value;
        
        if (currentValue.length >= 2 && !currentValue.includes(':')) {
            input.value = currentValue.slice(0, 2) + ':' + currentValue.slice(2);
        }
    }

    updatePlayerDropdowns() {
        const goalTeamSelect = document.getElementById('goal-team');
        const penaltyTeamSelect = document.getElementById('penalty-team');

        const updatePlayers = (teamValue, playerSelectId) => {
            if (!teamValue) return;

            const allPlayers = dataManager.getPlayersForTeam(teamValue);

            // Filter players based on attendance if available
            let availablePlayers = allPlayers;
            if (dataManager.currentGame && dataManager.currentGame.attendance) {
                const attendedPlayerIds = dataManager.currentGame.attendance
                    .filter(att => att.team === teamValue)
                    .map(att => att.id);
                availablePlayers = allPlayers.filter(player => attendedPlayerIds.includes(player.id));
            }

            const playerSelect = document.getElementById(playerSelectId);
            if (playerSelect) {
                playerSelect.innerHTML = '<option value="">Select Player</option>' +
                    availablePlayers.map(player => `<option value="${player.id}">${player.name}</option>`).join('');
            }
        };

        // Add event listeners for goal team dropdown
        if (goalTeamSelect) {
            goalTeamSelect.addEventListener('change', () => {
                updatePlayers(goalTeamSelect.value, 'goal-player');
                updatePlayers(goalTeamSelect.value, 'goal-assist');
            });
        }

        // Add event listeners for penalty team dropdown
        if (penaltyTeamSelect) {
            penaltyTeamSelect.addEventListener('change', () => updatePlayers(penaltyTeamSelect.value, 'penalty-player'));
        }

        // Initialize with current values
        if (goalTeamSelect) {
            updatePlayers(goalTeamSelect.value, 'goal-player');
            updatePlayers(goalTeamSelect.value, 'goal-assist');
        }
        if (penaltyTeamSelect) {
            updatePlayers(penaltyTeamSelect.value, 'penalty-player');
        }

        // Update assist dropdown when player changes
        const goalPlayerSelect = document.getElementById('goal-player');
        const assistSelect = document.getElementById('goal-assist');

        if (goalPlayerSelect && assistSelect && goalTeamSelect) {
            goalPlayerSelect.addEventListener('change', () => {
                const selectedTeam = goalTeamSelect.value;
                if (!selectedTeam) return;

                const allPlayers = dataManager.getPlayersForTeam(selectedTeam);
                let availablePlayers = allPlayers;

                // Filter by attendance
                if (dataManager.currentGame && dataManager.currentGame.attendance) {
                    const attendedPlayerIds = dataManager.currentGame.attendance
                        .filter(att => att.team === selectedTeam)
                        .map(att => att.id);
                    availablePlayers = allPlayers.filter(player => attendedPlayerIds.includes(player.id));
                }

                assistSelect.innerHTML = '<option value="">No Assist</option>' +
                    availablePlayers.filter(p => p.id !== goalPlayerSelect.value)
                        .map(player => `<option value="${player.id}">${player.name}</option>`).join('');
            });
        }
    }

    addGoal() {
        const team = document.getElementById('goal-team').value;
        const playerId = document.getElementById('goal-player').value;
        const assistId = document.getElementById('goal-assist').value;
        const shotType = document.getElementById('goal-shot-type').value;
        const breakaway = document.getElementById('goal-breakaway').value;
        const goalType = document.getElementById('goal-type').value;
        const period = document.querySelector('input[name="goal-period"]:checked').value;
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
        // Reset dropdown to home team
        document.getElementById('goal-team').value = this.selectedGame.homeTeam;

        // Reset radio buttons to defaults
        document.querySelector('input[name="goal-period"][value="1"]').checked = true;

        // Reset dropdowns to defaults
        document.getElementById('goal-shot-type').value = 'wrist';
        document.getElementById('goal-breakaway').value = 'no';
        document.getElementById('goal-type').value = 'regular';

        // Reset dropdowns and time
        document.getElementById('goal-player').value = '';
        document.getElementById('goal-assist').value = '';
        document.getElementById('goal-time').value = '';

        // Re-populate player dropdowns for the default team
        this.updatePlayerDropdowns();
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