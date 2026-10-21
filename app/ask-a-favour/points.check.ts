// Formula.md's worked examples. Run: bun app/ask-a-favour/points.check.ts
import assert from "node:assert";
import { calculatePoints } from "./points";

const none = { skillRisk: 0, urgency: 0 };
assert.equal(calculatePoints({ minutes: 15, effort: "light", ...none }), 1); // feed the cat
assert.equal(calculatePoints({ minutes: 20, effort: "moderate", ...none }), 2); // sweep the porch
assert.equal(calculatePoints({ minutes: 15, effort: "light", skillRisk: 0.5, urgency: 0 }), 2); // ceiling bulb on ladder
assert.equal(calculatePoints({ minutes: 30, effort: "moderate", ...none }), 3); // carry groceries
assert.equal(calculatePoints({ minutes: 20, effort: "moderate", skillRisk: 0, urgency: 0.25 }), 3); // porch, 1-week bump
assert.equal(calculatePoints({ minutes: 45, effort: "heavy", ...none }), 6); // move furniture
assert.equal(calculatePoints({ minutes: 15, effort: "heavy", skillRisk: 0.5, urgency: 0.25 }), 3); // capped at 3×
assert.equal(calculatePoints({ minutes: 5, effort: "light", ...none }), 1); // minimum 1
console.log("points ok");
