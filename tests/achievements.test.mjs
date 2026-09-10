import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAchievements } from '../scripts/achievements.js';
import { todayKey } from '../scripts/performance-store.js';
const day = (d, count) => Array.from({ length: count }, (_, i) => new Date(2026, 7, d, 12, i).getTime());
const history = (...rows) => Object.fromEntries(rows.map(([d, n]) => [todayKey(new Date(2026, 7, d)), day(d, n)]));
const now = new Date(2026, 7, 10, 18).getTime();
test('newcomers unlock only after their first tick', () => {
  assert.deepEqual(evaluateAchievements({}, {}, now).unlocked, {});
  assert.deepEqual(Object.keys(evaluateAchievements(history([10, 1]), {}, now).unlocked), ['first']);
});
test('record requires an earlier day and strictly beats its best', () => {
  assert.equal(evaluateAchievements(history([9, 6], [10, 6]), {}, now).unlocked.record, undefined);
  assert.ok(evaluateAchievements(history([9, 6], [10, 7]), {}, now).unlocked.record);
  assert.equal(evaluateAchievements(history([10, 20]), {}, now).unlocked.record, undefined);
});
test('five days require five ticks each and no gaps', () => {
  assert.ok(evaluateAchievements(history([6, 5], [7, 5], [8, 5], [9, 5], [10, 5]), {}, now).unlocked.five);
  assert.equal(evaluateAchievements(history([6, 5], [7, 4], [8, 5], [9, 5], [10, 5]), {}, now).unlocked.five, undefined);
  assert.equal(evaluateAchievements(history([5, 5], [7, 5], [8, 5], [9, 5], [10, 5]), {}, now).unlocked.five, undefined);
});
test('tickless waits exactly 72 hours, including across reloads and historical gaps', () => {
  const start = now - 72 * 3600000;
  assert.equal(evaluateAchievements({}, { startedAt: start }, now - 1).unlocked.tickless, undefined);
  assert.ok(evaluateAchievements({}, { startedAt: start }, now).unlocked.tickless);
  assert.ok(evaluateAchievements(history([1, 1], [10, 1]), {}, now).unlocked.tickless);
});
test('unlocks and notification acknowledgements survive undo and reevaluation', () => {
  const state = evaluateAchievements(history([10, 1]), {}, now);
  state.unlocked.first.seen = true;
  state.unlocked.first.acknowledged = true;
  assert.deepEqual(evaluateAchievements({}, state, now).unlocked.first, state.unlocked.first);
});
