// Data management for The Scorekeeper

class DataManager {
    constructor() {
        this.rosters = {};
        this.schedule = [];
        this.currentGame = null;
        this.gamesData = [];
    }

    // Load data from JSON files
    async loadData() {
        try {
            // Load rosters
            const rostersResponse = await fetch('data/rosters.json');
            if (rostersResponse.ok) {
                this.rosters = await rostersResponse.json();
            }

            // Load schedule
            const scheduleResponse = await fetch('data/schedule.json');
            if (scheduleResponse.ok) {
                this.schedule = await scheduleResponse.json();
            }

            // Load existing games data
            const gamesResponse = await fetch('data/games.json');
            if (gamesResponse.ok) {
                this.gamesData = await gamesResponse.json();
            }

            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Save game data
    async saveGame(gameData) {
        this.gamesData.push(gameData);

        // In a real app, this would save to a backend
        // For now, we'll use localStorage for persistence
        localStorage.setItem('chahky_games', JSON.stringify(this.gamesData));

        // Also save to a downloadable JSON file (simulated)
        this.downloadGameData(gameData);
    }

    // Download game data as JSON
    downloadGameData(gameData) {
        const dataStr = JSON.stringify(gameData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `game_${gameData.id}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Get players for a specific team
    getPlayersForTeam(teamName) {
        return this.rosters[teamName] || [];
    }

    // Get upcoming games (or all games if in development)
    getUpcomingGames() {
        // For development/testing, show all games
        // In production, filter for upcoming games:
        // const now = new Date();
        // return this.schedule.filter(game => new Date(game.date) >= now);
        return this.schedule;
    }

    // Create new game object
    createGame(gameInfo) {
        return {
            id: Date.now().toString(),
            ...gameInfo,
            attendance: gameInfo.attendance || [],
            goals: [],
            penalties: [],
            homeScore: 0,
            awayScore: 0,
            status: 'in_progress',
            created: new Date().toISOString()
        };
    }

    // Add goal to current game
    addGoal(goalData) {
        if (!this.currentGame) return;

        this.currentGame.goals.push({
            id: Date.now().toString(),
            ...goalData,
            timestamp: new Date().toISOString()
        });

        // Update score
        if (goalData.team === this.currentGame.homeTeam) {
            this.currentGame.homeScore++;
        } else {
            this.currentGame.awayScore++;
        }
    }

    // Add penalty to current game
    addPenalty(penaltyData) {
        if (!this.currentGame) return;

        this.currentGame.penalties.push({
            id: Date.now().toString(),
            ...penaltyData,
            timestamp: new Date().toISOString()
        });
    }

    // Set attendance for current game
    setAttendance(attendanceList) {
        if (!this.currentGame) return;
        this.currentGame.attendance = attendanceList;
    }

    // End current game
    endGame() {
        if (!this.currentGame) return;

        this.currentGame.status = 'completed';
        this.currentGame.ended = new Date().toISOString();
        this.saveGame(this.currentGame);
        this.currentGame = null;
    }
}

// Global data manager instance
const dataManager = new DataManager();