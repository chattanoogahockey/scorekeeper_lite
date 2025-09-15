import pandas as pd
import json
import os
from datetime import datetime

def convert_rosters_to_json(excel_path, output_path):
    """Convert rosters Excel file to JSON format"""
    try:
        # Read Excel file
        df = pd.read_excel(excel_path)

        # Print columns to understand structure
        print("Roster columns:", df.columns.tolist())
        print("First few rows:")
        print(df.head())

        # Group by team
        rosters = {}

        if 'Team' in df.columns and 'Name' in df.columns:
            for team in df['Team'].unique():
                team_df = df[df['Team'] == team]
                players = []

                for idx, row in team_df.iterrows():
                    player = {
                        'id': f"{team}_{row['Name'].replace(' ', '_')}_{idx}".lower().replace('>', '').replace(' ', '_'),
                        'name': row['Name'],
                        'number': idx + 1,  # Use index as jersey number since no number column
                        'position': row.get('Position', ''),
                        'division': row.get('Division', ''),
                        'team': team
                    }
                    players.append(player)

                rosters[team] = players

        # Save to JSON
        with open(output_path, 'w') as f:
            json.dump(rosters, f, indent=2)

        print(f"Rosters converted and saved to {output_path}")
        return rosters

    except Exception as e:
        print(f"Error converting rosters: {e}")
        return {}

def convert_schedule_to_json(excel_path, output_path):
    """Convert schedule Excel file to JSON format"""
    try:
        # Read Excel file
        df = pd.read_excel(excel_path)

        # Print columns to understand structure
        print("Schedule columns:", df.columns.tolist())
        print("First few rows:")
        print(df.head())

        games = []

        for _, row in df.iterrows():
            # Clean team names (remove division prefix)
            home_team = str(row.get('Home Team', '')).split(' > ')[-1] if ' > ' in str(row.get('Home Team', '')) else str(row.get('Home Team', ''))
            away_team = str(row.get('Away Team', '')).split(' > ')[-1] if ' > ' in str(row.get('Away Team', '')) else str(row.get('Away Team', ''))

            game = {
                'id': f"game_{len(games) + 1}",
                'date': str(row.get('Date', '')),
                'time': str(row.get('Start Time', '')),
                'homeTeam': home_team,
                'awayTeam': away_team,
                'location': str(row.get('Event Name', '')),  # Use event name as location
                'season': 'Fall 2025',
                'week': str(row.get('Week', ''))
            }
            games.append(game)

        # Save to JSON
        with open(output_path, 'w') as f:
            json.dump(games, f, indent=2)

        print(f"Schedule converted and saved to {output_path}")
        return games

    except Exception as e:
        print(f"Error converting schedule: {e}")
        return []

if __name__ == "__main__":
    # File paths
    rosters_excel = r"C:\Users\marce\OneDrive\Documents\CHAHKY\data\fall_2025_rosters.xlsx"
    schedule_excel = r"C:\Users\marce\OneDrive\Documents\CHAHKY\data\fall_2025_schedule.xlsx"

    # Output paths
    rosters_json = r"C:\Users\marce\OneDrive\Documents\CHAHKY\scorekeeper_lite\data\rosters.json"
    schedule_json = r"C:\Users\marce\OneDrive\Documents\CHAHKY\scorekeeper_lite\data\schedule.json"

    # Convert files
    print("Converting rosters...")
    convert_rosters_to_json(rosters_excel, rosters_json)

    print("\nConverting schedule...")
    convert_schedule_to_json(schedule_excel, schedule_json)

    print("\nConversion complete!")