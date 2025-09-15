# The Scorekeeper

A modern web application for tracking scores, goals, penalties, and attendance for Chattanooga Roller Hockey League games.

## Features

- **Game Selection**: Choose from upcoming games in the schedule
- **Attendance Tracking**: Mark which players are present for each game
- **Live Scoring**: Track goals and penalties in real-time
- **Data Export**: Download game data as JSON for analysis
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. **Start a Game**: Click "Score a New Game" from the main menu
2. **Select Game**: Choose the game you want to score from the schedule
3. **Mark Attendance**: Check off which players from each team are present
4. **Score the Game**:
   - Add goals by selecting the team, player, and optional assist
   - Add penalties by selecting the team, player, type, and duration
   - View live score updates
5. **End Game**: Click "End Game" to save the data and download as JSON

## Data Structure

The app captures the following data for each game:

- **Game Info**: Date, time, teams, location
- **Attendance**: List of present players from both teams
- **Goals**: Player, team, assists, timestamps
- **Penalties**: Player, team, type, duration, timestamps
- **Scores**: Running totals for both teams

## Technical Details

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Data Storage**: JSON files with consistent schema
- **Deployment**: GitHub Pages ready
- **Responsive**: Mobile-friendly design

## File Structure

```
scorekeeper_lite/
├── index.html          # Main application
├── css/
│   └── style.css       # Modern styling
├── js/
│   ├── app.js          # Main application logic
│   └── data.js         # Data management
└── data/
    ├── rosters.json    # Player rosters by team
    ├── schedule.json   # Game schedule
    └── games.json      # Completed game data
```

## Data Updates

To update rosters or schedules:
1. Edit the Excel files (fall_2025_rosters.xlsx, fall_2025_schedule.xlsx)
2. Run the conversion script: `python convert_excel.py`
3. The JSON files in the `data/` folder will be updated automatically

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript
- CSS Grid and Flexbox
- localStorage API
- Blob API for downloads