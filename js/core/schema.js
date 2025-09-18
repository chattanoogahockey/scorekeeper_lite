import { z } from './zod-loader.js';

export const attendanceEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  team: z.string().min(1),
  jersey: z.string().optional(),
});

export const goalSchema = z.object({
  id: z.string().min(1),
  team: z.string().min(1),
  player: z.string().min(1),
  playerId: z.string().min(1),
  playerLabel: z.string().optional(),
  playerNumber: z.string().optional(),
  assist: z.string().optional(),
  assistId: z.string().optional(),
  assistLabel: z.string().optional(),
  assistNumber: z.string().optional(),
  period: z.union([z.string().regex(/^(1|2|3|OT)$/), z.number().int()]).transform((value) => `${value}`),
  time: z.string().optional(),
  shotType: z.string().optional(),
  goalType: z.string().optional(),
  breakaway: z.string().optional(),
  clockSeconds: z.number().int().nonnegative().optional(),
  timestamp: z.string().datetime().optional(),
});

export const penaltySchema = z.object({
  id: z.string().min(1),
  team: z.string().min(1),
  player: z.string().min(1),
  playerId: z.string().min(1),
  playerLabel: z.string().optional(),
  playerNumber: z.string().optional(),
  type: z.string().min(1),
  minutes: z.number().int().nonnegative(),
  period: z.union([z.string().regex(/^(1|2|3|OT)$/), z.number().int()]).transform((value) => `${value}`),
  time: z.string().optional(),
  clockSeconds: z.number().int().nonnegative().optional(),
  timestamp: z.string().datetime().optional(),
});

export const gameSchema = z.object({
  id: z.string().min(1),
  date: z.string().optional(),
  time: z.string().optional(),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  location: z.string().optional(),
  season: z.string().optional(),
  week: z.string().optional(),
  status: z.string().default('completed'),
  created: z.string().datetime(),
  ended: z.string().datetime().optional(),
  attendance: z.array(attendanceEntrySchema).default([]),
  goals: z.array(goalSchema).default([]),
  penalties: z.array(penaltySchema).default([]),
  homeScore: z.number().int().nonnegative().default(0),
  awayScore: z.number().int().nonnegative().default(0),
});

export function validateGame(game) {
  return gameSchema.parse(game);
}

export function safeValidateGame(game) {
  return gameSchema.safeParse(game);
}
