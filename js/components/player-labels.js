export function buildJerseyMap(game) {
  const map = new Map();
  if (!game || !Array.isArray(game.attendance)) {
    return map;
  }

  game.attendance.forEach((record) => {
    if (!record?.id) return;
    const normalized = (record.jersey ?? '').trim();
    map.set(record.id, normalized || '##');
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
  if (jerseyMap.has(player.id)) {
    const attendanceNumber = jerseyMap.get(player.id) ?? '';
    return normalizeJersey(attendanceNumber) || '##';
  }

  return '##';
}

export function formatPlayerLabel(player, jerseyMap) {
  const jersey = resolvePlayerJersey(player, jerseyMap);
  if (!jersey || jersey === '##') {
    return `## ${player.name}`;
  }
  return `#${jersey} ${player.name}`;
}
