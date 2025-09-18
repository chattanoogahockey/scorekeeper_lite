export function buildJerseyMap(game) {
  const map = new Map();
  if (!game || !Array.isArray(game.attendance)) {
    return map;
  }

  game.attendance.forEach((record) => {
    if (!record?.id) return;
    map.set(record.id, (record.jersey ?? '').trim());
  });

  return map;
}

function normalizeJersey(value) {
  if (value == null) {
    return '';
  }
  const trimmed = `${value}`.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed;
}

export function resolvePlayerJersey(player, jerseyMap) {
  const attendanceNumber = jerseyMap.get(player.id);
  if (attendanceNumber) {
    return normalizeJersey(attendanceNumber);
  }

  if (player.number != null) {
    return normalizeJersey(player.number);
  }

  return '';
}

export function formatPlayerLabel(player, jerseyMap) {
  const jersey = resolvePlayerJersey(player, jerseyMap);
  if (!jersey) {
    return player.name;
  }
  return `#${jersey} ${player.name}`;
}
