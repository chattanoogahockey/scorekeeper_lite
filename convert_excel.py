# -*- coding: utf-8 -*-
import pandas as pd
import json
from datetime import datetime

TEAM_ALIASES = {
    'Slappy Gilmores': "Slappy Gilmore's",
}

def normalize_team_name(raw):
    if isinstance(raw, str):
        value = raw.replace('\u2019', "'")
        return value.encode('ascii', 'ignore').decode('ascii').strip()
    if pd.isna(raw):
        return ''
    value = str(raw).replace('\u2019', "'")
    return value.encode('ascii', 'ignore').decode('ascii').strip()

def slugify(value):
    normalized = normalize_team_name(value)
    return ''.join(ch if ch.isalnum() else '_' for ch in normalized.lower())

def convert_rosters_to_json(excel_path, output_path):
    """Convert rosters Excel file to JSON format"""
    try:
        df = pd.read_excel(excel_path)

        print("Roster columns:", df.columns.tolist())
        print("First few rows:")
        print(df.head())

        rosters = {}

        if 'Team' in df.columns and 'Name' in df.columns:
            for raw_team in df['Team'].dropna().unique():
                team = TEAM_ALIASES.get(normalize_team_name(raw_team), normalize_team_name(raw_team))
                if not team:
                    continue

                team_df = df[df['Team'] == raw_team]
                players = []

                for idx, row in team_df.iterrows():
                    name = normalize_team_name(row.get('Name', ''))
                    if not name:
                        continue

                    player_id = f"{slugify(team)}_{slugify(name)}_{idx}"
                    number_value = row.get('Number', idx + 1)
                    if pd.isna(number_value):
                        number_value = idx + 1

                    player = {
                        'id': player_id,
                        'name': name,
                        'number': int(number_value),
                        'position': normalize_team_name(row.get('Position', '')),
                        'division': normalize_team_name(row.get('Division', '')),
                        'team': team,
                    }
                    players.append(player)

                if players:
                    rosters[team] = players

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(rosters, f, indent=2)

        print(f"Rosters converted and saved to {output_path}")
        return rosters

    except Exception as e:
        print(f"Error converting rosters: {e}")
        return {}

def convert_schedule_to_json(excel_path, output_path):
    """Convert schedule Excel file to JSON format"""
    try:
        df = pd.read_excel(excel_path)

        print("Schedule columns:", df.columns.tolist())
        print("First few rows:")
        print(df.head())

        games = []

        for _, row in df.iterrows():
            raw_home = row.get('Home Team', '')
            raw_away = row.get('Away Team', '')

            home_team = TEAM_ALIASES.get(normalize_team_name(str(raw_home).split(' > ')[-1]), normalize_team_name(str(raw_home).split(' > ')[-1]))
            away_team = TEAM_ALIASES.get(normalize_team_name(str(raw_away).split(' > ')[-1]), normalize_team_name(str(raw_away).split(' > ')[-1]))

            if not home_team or not away_team:
                continue

            event_name = normalize_team_name(row.get('Event Name', f"{away_team} at {home_team}"))

            date_value = row.get('Date', '')
            if isinstance(date_value, datetime):
                date_str = date_value.strftime('%Y-%m-%d %H:%M:%S')
            else:
                date_str = normalize_team_name(date_value)

            start_time = normalize_team_name(row.get('Start Time', ''))
            week_value = normalize_team_name(row.get('Week', ''))
            season_value = normalize_team_name(row.get('Season', 'Fall 2025')) or 'Fall 2025'

            game = {
                'id': f"game_{len(games) + 1}",
                'date': date_str,
                'time': start_time,
                'homeTeam': home_team,
                'awayTeam': away_team,
                'location': event_name if event_name else f"{away_team} at {home_team}",
                'season': season_value,
                'week': week_value,
            }
            games.append(game)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(games, f, indent=2)

        print(f"Schedule converted and saved to {output_path}")
        return games

    except Exception as e:
        print(f"Error converting schedule: {e}")
        return []

if __name__ == "__main__":
    rosters_excel = r"C:\Users\marce\OneDrive\Documents\CHAHKY\data\fall_2025_rosters.xlsx"
    schedule_excel = r"C:\Users\marce\OneDrive\Documents\CHAHKY\data\fall_2025_schedule.xlsx"

    rosters_json = r"C:\Users\marce\OneDrive\Documents\CHAHKY\scorekeeper_lite\data\rosters.json"
    schedule_json = r"C:\Users\marce\OneDrive\Documents\CHAHKY\scorekeeper_lite\data\schedule.json"

    print("Converting rosters...")
    convert_rosters_to_json(rosters_excel, rosters_json)

    print("\nConverting schedule...")
    convert_schedule_to_json(schedule_excel, schedule_json)

    print("\nConversion complete!")
