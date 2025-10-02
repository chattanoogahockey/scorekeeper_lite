const PERIOD_ORDER = {
  '1': 1,
  '2': 2,
  '3': 3,
  OT: 4,
  '4': 4,
  SO: 5,
};

function isAnonymousPlayerName(name) {
  const normalized = `${name ?? ''}`.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized === 'sub';
}

function sanitizePlayerDisplayName(name, team) {
  const raw = `${name ?? ''}`.trim();
  if (!raw || isAnonymousPlayerName(raw)) {
    return null;
  }

  let cleaned = raw.replace(/^#\d+\s*/, '').trim();

  if (team) {
    const teamTokens = `${team}`
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.replace(/[^a-z0-9]/gi, '').toLowerCase());

    const nameTokens = cleaned.split(/\s+/).filter(Boolean);
    const normalizedNameTokens = nameTokens.map((token) => token.replace(/[^a-z0-9]/gi, '').toLowerCase());

    let matchesPrefix = teamTokens.length > 0 && normalizedNameTokens.length > teamTokens.length;
    for (let index = 0; matchesPrefix && index < teamTokens.length; index += 1) {
      if (normalizedNameTokens[index] !== teamTokens[index]) {
        matchesPrefix = false;
      }
    }

    if (matchesPrefix) {
      cleaned = nameTokens.slice(teamTokens.length).join(' ').trim();
    }
  }

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    cleaned = parts[parts.length - 1].trim();
  }

  return cleaned || null;
}

function parseClockSeconds(value) {
  const trimmed = `${value ?? ''}`.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }
  const [minutes, seconds] = trimmed.split(':').map((segment) => Number.parseInt(segment, 10));
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  return minutes * 60 + seconds;
}

function describePeriod(value) {
  const trimmed = `${value ?? ''}`.trim().toUpperCase();
  if (!trimmed) {
    return '';
  }
  if (trimmed === '1') return '1st';
  if (trimmed === '2') return '2nd';
  if (trimmed === '3') return '3rd';
  if (trimmed === 'OT' || trimmed === '4') return 'OT';
  if (trimmed === 'SO') return 'SO';
  return trimmed;
}

function formatAssistName(value, team) {
  const display = sanitizePlayerDisplayName(value, team);
  return display ?? '';
}

function formatScorerName(goal) {
  const team = goal?.playerTeam ?? goal?.team ?? '';
  return sanitizePlayerDisplayName(goal?.player, team);
}

function describeGoalAction(goal) {
  const impact = `${goal?.scoreImpact ?? ''}`.trim().toLowerCase();
  if (impact === 'first goal of the game') return 'opened the scoring';
  if (impact === 'go ahead goal') return 'delivered the go-ahead strike';
  if (impact === 'game tying goal') return 'found the equalizer';
  if (impact === 'insurance goal') return 'added insurance';
  if (impact === 'game winning goal') return 'buried the winner';

  const goalType = `${goal?.goalType ?? ''}`.trim().toLowerCase();
  if (goalType === 'power play') return 'scored on the power play';
  if (goalType === 'shorthanded') return 'scored while shorthanded';
  if (goalType === 'empty net') return 'hit the empty net';

  return 'scored';
}

function formatGoalMoment(goal) {
  const time = `${goal?.time ?? ''}`.trim() || '00:00';
  const periodLabel = describePeriod(goal?.period);
  if (!periodLabel) {
    return `at ${time}`;
  }
  if (periodLabel === 'OT') {
    return `in overtime at ${time}`;
  }
  if (periodLabel === 'SO') {
    return 'in the shootout';
  }
  return `at ${time} of the ${periodLabel} period`;
}

function buildGoalContexts(goals, game) {
  const contexts = [];
  let home = 0;
  let away = 0;
  const homeTeam = game.homeTeam;

  goals.forEach((goal) => {
    const entry = {
      goal,
      homeBefore: home,
      awayBefore: away,
    };
    if (goal.team === homeTeam) {
      home += 1;
    } else {
      away += 1;
    }
    entry.homeAfter = home;
    entry.awayAfter = away;
    contexts.push(entry);
  });

  return contexts;
}

function describeScoreSwing(scoringTeam, prevHome, prevAway, nextHome, nextAway, game) {
  if (!Number.isFinite(prevHome) || !Number.isFinite(prevAway) || !Number.isFinite(nextHome) || !Number.isFinite(nextAway)) {
    return '';
  }
  if (nextHome === nextAway) {
    return 'to tie it up';
  }
  const leader = nextHome > nextAway ? game.homeTeam : game.awayTeam;
  const margin = Math.abs(nextHome - nextAway);
  const scoringIsLeader = scoringTeam === leader;
  const prevDiff = prevHome - prevAway;
  const afterDiff = nextHome - nextAway;
  if (scoringIsLeader) {
    if (prevDiff === 0) {
      return `to give ${leader} the edge`;
    }
    if (Math.sign(afterDiff) !== Math.sign(prevDiff) && prevDiff !== 0) {
      return `to flip momentum back to ${leader}`;
    }
    return `to extend the ${leader} cushion`;
  }
  if (Math.abs(afterDiff) < Math.abs(prevDiff)) {
    return `to pull ${scoringTeam} back within ${margin === 1 ? 'a goal' : `${margin} goals`}`;
  }
  return `to keep ${scoringTeam} within reach`;
}

function findGoAheadGoal(goals, game) {
  if (!goals.length) {
    return null;
  }

  let home = 0;
  let away = 0;
  const homeTeam = game.homeTeam;

  for (const goal of goals) {
    if (goal.team === homeTeam) {
      home += 1;
    } else {
      away += 1;
    }

    if (home !== away) {
      const leader = home > away ? homeTeam : game.awayTeam;
      if (leader === game.winner) {
        return goal;
      }
    }
  }

  return null;
}

function analyzeGameFlow(goals, game) {
  const contexts = buildGoalContexts(goals, game);
  let leadChanges = 0;
  let winnerTrailed = false;
  let largestDeficit = 0;
  let previousLeader = null;
  const winner = game.winner;
  const homeTeam = game.homeTeam;
  let currentTeam = null;
  let currentRun = 0;
  let currentStart = 0;
  const largestRun = { team: null, length: 0, startIndex: 0, endIndex: 0 };

  contexts.forEach((entry, index) => {
    const { goal, homeAfter, awayAfter } = entry;
    const leader = homeAfter === awayAfter ? null : homeAfter > awayAfter ? homeTeam : game.awayTeam;
    if (leader && previousLeader && leader !== previousLeader) {
      leadChanges += 1;
    }
    if (leader !== previousLeader) {
      previousLeader = leader;
    }
    if (goal.team === currentTeam) {
      currentRun += 1;
    } else {
      currentTeam = goal.team;
      currentRun = 1;
      currentStart = index;
    }
    if (currentRun > largestRun.length) {
      largestRun.team = currentTeam;
      largestRun.length = currentRun;
      largestRun.startIndex = currentStart;
      largestRun.endIndex = index;
    }
    if (winner) {
      const winnerScore = winner === homeTeam ? homeAfter : awayAfter;
      const opponentScore = winner === homeTeam ? awayAfter : homeAfter;
      if (opponentScore > winnerScore) {
        winnerTrailed = true;
        largestDeficit = Math.max(largestDeficit, opponentScore - winnerScore);
      }
    }
  });

  let closingRun = 0;
  if (winner) {
    for (let index = contexts.length - 1; index >= 0; index -= 1) {
      if (contexts[index].goal.team === winner) {
        closingRun += 1;
      } else {
        break;
      }
    }
  }

  return { leadChanges, winnerTrailed, largestDeficit, closingRun, largestRun };
}

function buildPlayerKey(id, name, team) {
  const trimmedId = `${id ?? ''}`.trim();
  if (trimmedId) {
    return `id:${trimmedId}`;
  }
  const normalizedName = `${name ?? ''}`.trim().toLowerCase();
  const normalizedTeam = `${team ?? ''}`.trim().toLowerCase();
  return `name:${normalizedName}|team:${normalizedTeam}`;
}

function computeGameStar(goals) {
  if (!Array.isArray(goals) || !goals.length) {
    return null;
  }
  const totals = new Map();
  goals.forEach((goal) => {
    const scorerTeam = goal.playerTeam ?? goal.team ?? '';
    const scorerName = sanitizePlayerDisplayName(goal.player, scorerTeam);
    if (scorerName) {
      const key = buildPlayerKey(goal.playerId, scorerName, scorerTeam);
      const record = totals.get(key) ?? { player: scorerName, team: scorerTeam, goals: 0, assists: 0 };
      record.player = scorerName;
      record.team = scorerTeam;
      record.goals += 1;
      totals.set(key, record);
    }

    const helperTeam = goal.assistTeam ?? goal.team ?? '';
    const assistName = sanitizePlayerDisplayName(goal.assist, helperTeam);
    if (assistName) {
      const assistKey = buildPlayerKey(goal.assistId, assistName, helperTeam);
      const assistRecord = totals.get(assistKey) ?? { player: assistName, team: helperTeam, goals: 0, assists: 0 };
      assistRecord.player = assistName;
      assistRecord.team = helperTeam;
      assistRecord.assists += 1;
      totals.set(assistKey, assistRecord);
    }
  });

  const leaders = Array.from(totals.values());
  leaders.sort((a, b) => {
    if (a.goals !== b.goals) {
      return b.goals - a.goals;
    }
    if (a.assists !== b.assists) {
      return b.assists - a.assists;
    }
    return `${a.player}`.localeCompare(`${b.player}`);
  });

  return leaders[0] ?? null;
}

function collectHatTrickPlayers(goals) {
  if (!Array.isArray(goals)) {
    return [];
  }
  const tally = new Map();
  goals.forEach((goal) => {
    const playerName = sanitizePlayerDisplayName(goal.player, goal.playerTeam ?? goal.team ?? '');
    if (!playerName) {
      return;
    }
    const key = buildPlayerKey(goal.playerId, playerName, goal.playerTeam ?? goal.team ?? '');
    const record = tally.get(key) ?? { player: playerName, team: goal.playerTeam ?? goal.team ?? '', goals: 0 };
    record.player = playerName;
    record.team = goal.playerTeam ?? goal.team ?? '';
    record.goals += 1;
    tally.set(key, record);
  });
  return Array.from(tally.values()).filter((entry) => entry.goals >= 3);
}

function summarizePenaltyTone(penalties) {
  if (!Array.isArray(penalties) || !penalties.length) {
    return null;
  }
  let totalMinutes = 0;
  penalties.forEach((penalty) => {
    const minutes = Number.parseInt(`${penalty?.minutes ?? penalty?.duration ?? 0}`, 10);
    if (Number.isFinite(minutes) && minutes > 0) {
      totalMinutes += minutes;
    }
  });

  if (!totalMinutes) {
    return null;
  }

  if (totalMinutes <= 4) {
    return 'Discipline ruled the night with only a few minutes in the box.';
  }
  if (totalMinutes <= 10) {
    return `Special teams made a brief appearance with ${totalMinutes} penalty minutes logged.`;
  }
  return `Whistles were frequent, piling up ${totalMinutes} penalty minutes between the benches.`;
}

function formatScoreLine(homeTeam, awayTeam, homeScore, awayScore) {
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return `${awayTeam} at ${homeTeam}`;
  }
  return `${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}`;
}

function buildDetailedGameStory(game, goals, options = {}) {
  const { includeStar = false } = options;
  if (!Array.isArray(goals) || !goals.length) {
    if (!Number.isFinite(game.homeScore) || !Number.isFinite(game.awayScore)) {
      return ['No scoring summary is available for this matchup yet.'];
    }
    if (game.homeScore === game.awayScore) {
      return [`${game.homeTeam} and ${game.awayTeam} battled to a ${game.homeScore}-${game.awayScore} draw.`];
    }
    if (game.homeScore > game.awayScore) {
      return [`${game.homeTeam} edged ${game.awayTeam} ${game.homeScore}-${game.awayScore} in a defensive duel.`];
    }
    return [`${game.awayTeam} edged ${game.homeTeam} ${game.awayScore}-${game.homeScore} in a defensive duel.`];
  }

  const contexts = buildGoalContexts(goals, game);
  const sentences = [];

  const composeLine = (goal, context, extraOptions = {}) => {
    const { includeScore = false, extraFragment = null } = extraOptions;
    const scorerName = formatScorerName(goal);
    const assistName = formatAssistName(goal.assist, goal.assistTeam ?? goal.team ?? '');
    const action = describeGoalAction(goal);
    const moment = formatGoalMoment(goal);
    const impact = describeScoreSwing(
      goal.team,
      context.homeBefore,
      context.awayBefore,
      context.homeAfter,
      context.awayAfter,
      game,
    );

    const subject = scorerName ? `${scorerName} (${goal.team})` : `${goal.team}`;
    const fragments = [`${subject} ${action}`.trim()];
    if (moment) {
      fragments.push(moment);
    }
    if (impact) {
      fragments.push(impact);
    }
    if (assistName) {
      fragments.push(`with ${assistName} on the helper`);
    }
    if (extraFragment) {
      fragments.push(extraFragment);
    }

    let line = fragments.filter(Boolean).join(' ');
    if (includeScore) {
      const scoreLine = formatScoreLine(game.homeTeam, game.awayTeam, context.homeAfter, context.awayAfter);
      if (scoreLine) {
        line = `${line} (${scoreLine})`;
      }
    }
    return line ? `${line}.` : '';
  };

  const firstContext = contexts[0];
  const firstGoal = firstContext.goal;
  const firstLine = composeLine(firstGoal, firstContext, { includeScore: true });
  if (firstLine) {
    sentences.push(firstLine);
  }

  const responseContext = contexts.find((entry, index) => index > 0 && entry.goal.team !== firstGoal.team);
  if (responseContext) {
    const responseGoal = responseContext.goal;
    const scoringTeamScore =
      responseGoal.team === game.homeTeam ? responseContext.homeAfter : responseContext.awayAfter;
    const opponentScore =
      responseGoal.team === game.homeTeam ? responseContext.awayAfter : responseContext.homeAfter;
    let responseClause = 'to answer right back';
    if (scoringTeamScore === opponentScore) {
      responseClause = 'to draw even';
    } else if (scoringTeamScore > opponentScore) {
      responseClause = 'to grab the lead';
    } else {
      responseClause = 'to trim the deficit';
    }
    const responseLine = composeLine(responseGoal, responseContext, {
      includeScore: true,
      extraFragment: responseClause,
    });
    if (responseLine) {
      sentences.push(responseLine);
    }
  }

  const flow = analyzeGameFlow(goals, game);
  const goAheadGoal = findGoAheadGoal(goals, game);
  if (goAheadGoal) {
    const index = goals.indexOf(goAheadGoal);
    const goContext = index >= 0 ? contexts[index] : null;
    if (goContext) {
      const comebackFragment =
        flow.winnerTrailed && flow.largestDeficit > 0
          ? `after erasing a ${flow.largestDeficit}-goal hole`
          : null;
      const goLine = composeLine(goAheadGoal, goContext, {
        includeScore: true,
        extraFragment: comebackFragment,
      });
      if (goLine) {
        sentences.push(goLine);
      }
    }
  } else if (flow.leadChanges > 0) {
    sentences.push(`The lead changed ${flow.leadChanges} ${flow.leadChanges === 1 ? 'time' : 'times'} before the final horn.`);
  }

  if (flow.largestRun.team && flow.largestRun.length >= 3) {
    sentences.push(
      `${flow.largestRun.team} strung together ${flow.largestRun.length} unanswered to tilt the ice during the decisive stretch.`,
    );
  }

  const winnerName = game.winner;
  if (winnerName) {
    const finalScore = `${game.winnerScore}-${game.loserScore}`;
    if (flow.closingRun > 1) {
      sentences.push(`${winnerName} closed with ${flow.closingRun} straight to lock in the ${finalScore} win.`);
    } else {
      sentences.push(`${winnerName} managed the final minutes to ice the ${finalScore} decision.`);
    }
  } else {
    const drawScore = `${game.homeScore}-${game.awayScore}`;
    sentences.push(`${game.homeTeam} and ${game.awayTeam} traded blows until it settled at ${drawScore}.`);
  }

  const hatTricks = collectHatTrickPlayers(goals);
  if (hatTricks.length) {
    const hatLines = hatTricks
      .map((entry) => `${entry.player} (${entry.team}) stacked ${entry.goals} goals`)
      .join('; ');
    sentences.push(`${hatLines}, marking milestone nights.`);
  }

  const penaltyNote = summarizePenaltyTone(Array.isArray(game.penalties) ? game.penalties : []);
  if (penaltyNote) {
    sentences.push(penaltyNote);
  }

  if (includeStar) {
    const star = computeGameStar(goals);
    if (star) {
      sentences.push(
        `${star.player} finished with ${star.goals} goals${
          star.assists ? ` and ${star.assists} assists` : ''
        } to headline the sheet.`,
      );
    }
  }

  return sentences;
}

export {
  PERIOD_ORDER,
  analyzeGameFlow,
  buildGoalContexts,
  buildDetailedGameStory,
  computeGameStar,
  describeGoalAction,
  describePeriod,
  describeScoreSwing,
  findGoAheadGoal,
  formatAssistName,
  formatGoalMoment,
  formatScoreLine,
  formatScorerName,
  isAnonymousPlayerName,
  parseClockSeconds,
  sanitizePlayerDisplayName,
};
