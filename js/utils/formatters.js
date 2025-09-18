export function formatGameTime(timeString) {
  if (!timeString || timeString.length < 5) return 'TBD';

  const [hoursRaw, minutesRaw] = timeString.split(':');
  const hours = Number.parseInt(hoursRaw, 10);
  const minutes = Number.parseInt(minutesRaw, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 'TBD';
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatScore(game) {
  return `${game.homeScore ?? 0} - ${game.awayScore ?? 0}`;
}