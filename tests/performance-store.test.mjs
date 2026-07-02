import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORAGE_KEYS,
  formatHalfHourLabel,
  halfHourIndex,
  migrateProfilePerformanceDays,
  normalizePerformanceDays,
  profilePerformanceDaysKey,
  readPerformanceDays,
  storePerformanceDays,
  todayKey,
} from '../scripts/performance-store.js';

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

test('normalizes legacy flat mark arrays into day buckets', () => {
  const first = new Date(2026, 0, 2, 9, 15).getTime();
  const second = new Date(2026, 0, 2, 9, 45).getTime();
  const invalid = Number.NaN;

  assert.deepEqual(normalizePerformanceDays([first, invalid, second]), {
    '2026-01-02': [first, second],
  });
});

test('drops object marks that do not belong to their date key', () => {
  const valid = new Date(2026, 2, 10, 8, 0).getTime();
  const wrongDay = new Date(2026, 2, 11, 8, 0).getTime();

  assert.deepEqual(normalizePerformanceDays({
    '2026-03-10': [valid, wrongDay, 'bad'],
    empty: [],
  }), {
    '2026-03-10': [valid],
  });
});

test('reads legacy performanceMarks when performanceDays is absent', () => {
  const mark = new Date(2026, 4, 4, 12, 30).getTime();
  const storage = memoryStorage({
    [STORAGE_KEYS.performanceMarks]: JSON.stringify([mark]),
  });

  assert.deepEqual(readPerformanceDays(storage), {
    '2026-05-04': [mark],
  });
});

test('migrates the active profile history into the canonical performanceDays key', () => {
  const profileMark = new Date(2026, 6, 1, 10, 0).getTime();
  const storage = memoryStorage({
    [STORAGE_KEYS.activeProfile]: 'main',
    [STORAGE_KEYS.localProfiles]: JSON.stringify([{ id: 'other' }]),
    [profilePerformanceDaysKey('main')]: JSON.stringify({ '2026-07-01': [profileMark] }),
  });

  assert.equal(migrateProfilePerformanceDays(storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.performanceDays)), {
    '2026-07-01': [profileMark],
  });
});

test('stores canonical performanceDays and removes legacy performanceMarks', () => {
  const storage = memoryStorage({
    [STORAGE_KEYS.performanceMarks]: JSON.stringify([1]),
  });

  assert.equal(storePerformanceDays({ '2026-01-01': [123] }, storage), true);
  assert.equal(storage.getItem(STORAGE_KEYS.performanceMarks), null);
  assert.equal(storage.getItem(STORAGE_KEYS.performanceDays), '{"2026-01-01":[123]}');
});

test('formats half-hour indexes consistently', () => {
  assert.equal(todayKey(new Date(2026, 6, 1)), '2026-07-01');
  assert.equal(halfHourIndex(new Date(2026, 6, 1, 23, 45)), 47);
  assert.equal(formatHalfHourLabel(47), '23:30');
});
