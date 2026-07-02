export const STORAGE_KEYS = {
  performanceDays: 'focusway.performanceDays',
  performanceMarks: 'focusway.performanceMarks',
  localAccountName: 'focusway.localAccountName',
  localProfiles: 'focusway.localProfiles',
  activeProfile: 'focusway.activeProfileId',
};

export function pad(value) {
  return String(value).padStart(2, '0');
}

function defaultStorage() {
  return globalThis.window?.localStorage ?? globalThis.localStorage ?? null;
}

export function readStoredValue(key, storage = defaultStorage()) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function storeValue(key, value, storage = defaultStorage()) {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function todayKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
}

export function dateFromKey(key) {
  const [year, month, day] = key.split('-').map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day);
}

export function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

export function formatPerformanceDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function halfHourIndex(date) {
  return date.getHours() * 2 + (date.getMinutes() >= 30 ? 1 : 0);
}

export function formatHalfHourLabel(index) {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${pad(hour)}:${minute}`;
}

export function formatTickCount(count) {
  return `${count} ${count === 1 ? 'tick' : 'ticks'}`;
}

export function formatMarkTime(mark) {
  return new Date(mark).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatHistoryTimes(marks) {
  if (!marks.length) return 'No ticks logged';
  return marks
    .slice()
    .sort((a, b) => a - b)
    .map(formatMarkTime)
    .join(', ');
}

export function normalizePerformanceDays(value) {
  if (Array.isArray(value)) {
    return value.reduce((days, mark) => {
      if (!Number.isFinite(mark)) return days;

      const key = todayKey(new Date(mark));
      days[key] = days[key] || [];
      days[key].push(mark);
      return days;
    }, {});
  }

  if (!value || typeof value !== 'object') return {};

  return Object.entries(value).reduce((days, [key, marks]) => {
    if (!Array.isArray(marks)) return days;

    const validMarks = marks.filter((mark) => (
      Number.isFinite(mark) && todayKey(new Date(mark)) === key
    ));

    if (validMarks.length) {
      days[key] = validMarks;
    }

    return days;
  }, {});
}

export function profilePerformanceDaysKey(profileId) {
  return `focusway.profiles.${profileId}.performanceDays`;
}

export function migrateProfilePerformanceDays(storage = defaultStorage()) {
  try {
    if (!storage || storage.getItem(STORAGE_KEYS.performanceDays)) return false;

    const profileIds = [];
    const activeProfileId = storage.getItem(STORAGE_KEYS.activeProfile);
    if (activeProfileId) profileIds.push(activeProfileId);

    const storedProfiles = JSON.parse(storage.getItem(STORAGE_KEYS.localProfiles) || '[]');
    if (Array.isArray(storedProfiles)) {
      storedProfiles.forEach((profile) => {
        if (typeof profile?.id === 'string' && !profileIds.includes(profile.id)) {
          profileIds.push(profile.id);
        }
      });
    }

    if (!profileIds.includes('default')) profileIds.push('default');

    const storedProfileDays = profileIds
      .map((profileId) => storage.getItem(profilePerformanceDaysKey(profileId)))
      .find(Boolean);

    if (!storedProfileDays) return false;

    storage.setItem(
      STORAGE_KEYS.performanceDays,
      JSON.stringify(normalizePerformanceDays(JSON.parse(storedProfileDays))),
    );
    return true;
  } catch {
    return false;
  }
}

export function readPerformanceDays(storage = defaultStorage()) {
  try {
    if (!storage) return {};

    const storedDays = storage.getItem(STORAGE_KEYS.performanceDays);
    if (storedDays) {
      return normalizePerformanceDays(JSON.parse(storedDays));
    }

    const storedMarks = JSON.parse(storage.getItem(STORAGE_KEYS.performanceMarks) || '[]');
    return normalizePerformanceDays(storedMarks);
  } catch {
    return {};
  }
}

export function storePerformanceDays(performanceDays, storage = defaultStorage()) {
  try {
    if (!storage) return false;

    storage.setItem(STORAGE_KEYS.performanceDays, JSON.stringify(performanceDays));
    storage.removeItem(STORAGE_KEYS.performanceMarks);
    return true;
  } catch {
    return false;
  }
}
