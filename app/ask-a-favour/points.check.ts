// Formula.md's worked examples. Run: bun app/ask-a-favour/points.check.ts
import assert from "node:assert";
import { bump, calculatePoints, type PointFactors } from "./points";

const none = { skillRisk: 0, urgency: 0 };
assert.equal(calculatePoints({ minutes: 15, effort: "light", ...none }), 1); // feed the cat
assert.equal(calculatePoints({ minutes: 20, effort: "moderate", ...none }), 2); // sweep the porch
assert.equal(calculatePoints({ minutes: 15, effort: "light", skillRisk: 0.5, urgency: 0 }), 2); // ceiling bulb on ladder
assert.equal(calculatePoints({ minutes: 30, effort: "moderate", ...none }), 3); // carry groceries
assert.equal(calculatePoints({ minutes: 20, effort: "moderate", skillRisk: 0, urgency: 0.25 }), 3); // porch, 1-week bump
assert.equal(calculatePoints({ minutes: 45, effort: "heavy", ...none }), 6); // move furniture
assert.equal(calculatePoints({ minutes: 15, effort: "heavy", skillRisk: 0.5, urgency: 0.25 }), 3); // capped at 3×
assert.equal(calculatePoints({ minutes: 5, effort: "light", ...none }), 1); // minimum 1

// Bumps: +0.25 urgency each, at least +1 point, never past the 3× cap.
const cat: PointFactors = { minutes: 15, effort: "light", ...none };
assert.equal(bump(cat, 1).points, 2); // 1.25 rounds to 1, so the +1 minimum applies
const porch: PointFactors = { minutes: 20, effort: "moderate", ...none };
assert.equal(bump(porch, 2).points, 3); // the formula's porch bump
let furniture = { factors: { minutes: 45, effort: "heavy", ...none } as PointFactors, points: 6 };
const bumped = [1, 2, 3].map(() => (furniture = bump(furniture.factors, furniture.points)).points);
assert.deepEqual(bumped, [8, 9, 9]); // 7.5 rounds up, then the 3× cap holds it at 9
assert.equal(furniture.factors.urgency, 0.75);
console.log("points ok");
