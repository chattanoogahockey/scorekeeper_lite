import {
  PERIOD_ORDER,
  analyzeGameFlow,
  buildGoalContexts,
  buildDetailedGameStory,
  computeGameStar,
  describeGoalAction,
  describeScoreSwing,
  formatAssistName,
  formatGoalMoment,
  formatScoreLine,
  formatScorerName,
  parseClockSeconds,
  findGoAheadGoal,
} from './narrative-helpers.js';

function sortGoals(goals) {
  return (Array.isArray(goals) ? goals : [])
    .slice()
    .map((goal, index) => ({ ...goal, __index: index }))
    .sort((goalA, goalB) => {
      const periodA = `${goalA.period ?? ''}`.trim().toUpperCase();
      const periodB = `${goalB.period ?? ''}`.trim().toUpperCase();
      const orderA = PERIOD_ORDER[periodA] ?? Number.parseInt(periodA, 10) ?? 99;
      const orderB = PERIOD_ORDER[periodB] ?? Number.parseInt(periodB, 10) ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const secondsA = Number.isFinite(goalA.clockSeconds)
        ? goalA.clockSeconds
        : parseClockSeconds(`${goalA.time ?? ''}`) ?? 0;
      const secondsB = Number.isFinite(goalB.clockSeconds)
        ? goalB.clockSeconds
        : parseClockSeconds(`${goalB.time ?? ''}`) ?? 0;

      if (secondsA !== secondsB) {
        return secondsB - secondsA;
      }

      return goalA.__index - goalB.__index;
    });
}

function buildHighlightLine(game, context, prefix) {
  if (!context) {
    return null;
  }
  const { goal, homeBefore, awayBefore, homeAfter, awayAfter } = context;
  const scorerName = formatScorerName(goal) ?? goal.team;
  const assistName = formatAssistName(goal.assist, goal.assistTeam ?? goal.team ?? '');
  const moment = formatGoalMoment(goal);
  const impact = describeScoreSwing(goal.team, homeBefore, awayBefore, homeAfter, awayAfter, game);
  const action = describeGoalAction(goal);
  const pieces = [`${scorerName} ${action}`];
  if (assistName) {
    pieces.push(`with ${assistName} assisting`);
  }
  if (moment) {
    pieces.push(moment);
  }
  if (impact) {
    pieces.push(impact);
  }
  const line = `${pieces.filter(Boolean).join(' ')}.`;
  return prefix ? `${prefix}: ${line}` : line;
}

function buildMetricsLine(game, goals, flow) {
  const metrics = [];
  if (Array.isArray(goals)) {
    metrics.push(`${goals.length} goals`);
  }
  if (flow.leadChanges > 0) {
    metrics.push(`${flow.leadChanges} lead change${flow.leadChanges === 1 ? '' : 's'}`);
  }
  if (flow.winnerTrailed && flow.largestDeficit > 0) {
    metrics.push(`rallied from ${flow.largestDeficit} down`);
  }
  if (flow.closingRun > 1) {
    metrics.push(`${flow.closingRun} unanswered to finish`);
  }
  if (game.isOvertime) {
    metrics.push('went to extra time');
  }
  return metrics.join(' | ');
}

function buildStarLine(star) {
  if (!star) {
    return null;
  }
  const assistLabel = star.assists ? `, ${star.assists} assist${star.assists === 1 ? '' : 's'}` : '';
  return `${star.player} (${star.team}) posted ${star.goals} goal${star.goals === 1 ? '' : 's'}${assistLabel}.`;
}

export function buildWeeklyGameSummary(game) {
  if (!game || typeof game !== 'object') {
    return {
      summary: 'No game data available.',
      highlights: [],
      metrics: '',
      starLine: null,
      headline: '',
    };
  }

  const goals = sortGoals(game.goals ?? []);
  const contexts = buildGoalContexts(goals, game);
  const flow = analyzeGameFlow(goals, game);
  const storySentences = buildDetailedGameStory(game, goals).slice(0, 2);
  const summary = storySentences.length ? storySentences.join(' ') : 'This matchup unfolded in a hurry.';

  const highlights = [];
  const usedGoals = new Set();

  if (contexts.length) {
    const firstContext = contexts[0];
    const firstLine = buildHighlightLine(game, firstContext, 'First strike');
    if (firstLine) {
      highlights.push(firstLine);
      usedGoals.add(firstContext.goal);
    }
  }

  const goAheadGoal = findGoAheadGoal(goals, game);
  if (goAheadGoal && !usedGoals.has(goAheadGoal)) {
    const goAheadContext = contexts.find((context) => context.goal === goAheadGoal);
    const goAheadLine = buildHighlightLine(game, goAheadContext, 'Turning point');
    if (goAheadLine) {
      highlights.push(goAheadLine);
      usedGoals.add(goAheadGoal);
    }
  }

  if (contexts.length) {
    const finalContext = contexts[contexts.length - 1];
    if (!usedGoals.has(finalContext.goal)) {
      const finalLine = buildHighlightLine(game, finalContext, 'Final say');
      if (finalLine) {
        highlights.push(finalLine);
      }
    }
  }

  const star = computeGameStar(goals);
  const starLine = buildStarLine(star);

  const metrics = buildMetricsLine(game, goals, flow);

  const headline = game.winner
    ? `${game.winner} ${game.winnerScore} - ${game.loser} ${game.loserScore}`
    : formatScoreLine(game.homeTeam, game.awayTeam, game.homeScore, game.awayScore);

  return {
    summary,
    highlights,
    metrics,
    starLine,
    headline,
  };
}
