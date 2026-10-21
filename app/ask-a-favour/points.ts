import { askGroq } from "../lib/groq";

// Points = (minutes ÷ 15) × effort tier × (1 + skill/risk + urgency)
// Whole points, minimum 1, combined multiplier capped. See Formula.md.

const EFFORT_TIER = { light: 1, moderate: 1.5, heavy: 2 };
const MAX_MULTIPLIER = 3;
const BUMP_URGENCY = 0.25;

export type PointFactors = {
  minutes: number;
  effort: keyof typeof EFFORT_TIER;
  skillRisk: number; // 0 to 0.5
  urgency: number; // +0.25 for same-day, +0.25 per bump
};

// Multiply before dividing so halves (e.g. 2.5) stay exact and round up.
const toPoints = (minutes: number, multiplier: number) =>
  Math.max(1, Math.round((minutes * multiplier) / 15));

export function calculatePoints({ minutes, effort, skillRisk, urgency }: PointFactors) {
  return toPoints(
    minutes,
    Math.min(EFFORT_TIER[effort] * (1 + skillRisk + urgency), MAX_MULTIPLIER)
  );
}

// A bump adds urgency, so the favour is worth more. Small favours would round
// that away, so a bump always adds at least 1 point, until the multiplier cap.
export function bump(factors: PointFactors, points: number) {
  const bumped = { ...factors, urgency: factors.urgency + BUMP_URGENCY };
  return {
    factors: bumped,
    points: Math.min(
      Math.max(calculatePoints(bumped), points + 1),
      toPoints(factors.minutes, MAX_MULTIPLIER)
    ),
  };
}

const PROMPT = `You size up a favour an elderly resident asks of their neighbours. Return:
- minutes: realistic time for a helper to do it, including a short walk there and back.
- effort: physical effort. light, moderate or heavy.
- skillRisk: 0 to 0.5 for skill, care or risk needed. 0 for ordinary tasks.
- sameDay: true only if the request says it is needed today or is urgent.

Reference favours (minutes, effort, skillRisk):
- Feed the cat: 15, light, 0
- Sweep the porch: 20, moderate, 0
- Carry groceries upstairs: 30, moderate, 0
- Pick up medicine from a nearby pharmacy: 30, light, 0
- Change a ceiling bulb on a ladder: 15, light, 0.5
- Set up a new phone: 30, light, 0.25
- Move furniture: 45, heavy, 0`;

const SCHEMA = {
  type: "object",
  properties: {
    minutes: { type: "integer" },
    effort: { type: "string", enum: Object.keys(EFFORT_TIER) },
    skillRisk: { type: "number" },
    sameDay: { type: "boolean" },
  },
  required: ["minutes", "effort", "skillRisk", "sameDay"],
  additionalProperties: false,
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(Number(n) || min, min), max);

// AI fills in the formula's inputs from the favour's description.
export async function estimateFactors(description: string): Promise<PointFactors> {
  try {
    const ai = JSON.parse(await askGroq(PROMPT, description, SCHEMA));
    // Clamp the AI's numbers so a bad estimate can't mint a huge reward.
    return {
      minutes: clamp(ai.minutes, 5, 240),
      effort: ai.effort,
      skillRisk: clamp(ai.skillRisk, 0, 0.5),
      urgency: ai.sameDay ? 0.25 : 0,
    };
  } catch (err) {
    console.error("Failed to estimate points:", err);
    // Worth the formula's minimum of 1 point, so an outage never blocks a request.
    return { minutes: 15, effort: "light", skillRisk: 0, urgency: 0 };
  }
}
