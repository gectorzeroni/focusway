import { addDays, todayKey, dateFromKey, readStoredValue, storeValue } from './performance-store.js';

export const ACHIEVEMENTS = [
  { id: 'first', title: 'Your first entry', icon: '✓', pun: 'Well, that ticks a box.', description: 'Log your very first tick.' },
  { id: 'record', title: 'Your biggest streak yet', icon: '↗', pun: 'You’re ticking all the records.', description: 'Log more ticks in one local calendar day than your best earlier day.' },
  { id: 'five', title: 'Five-day streak', icon: '⑤', pun: 'High five. Higher focus.', description: 'Log at least 5 ticks a day for 5 consecutive local calendar days.' },
  { id: 'tickless', title: 'Tickless', icon: '…', pun: 'No ticks given. A little rest is timeless.', description: 'Go 72 hours without a tick after you start using the app.' },
];
const KEY = 'focusway.achievements.v1';
const GAP = 72 * 60 * 60 * 1000;

export function evaluateAchievements(days, previous = {}, now = Date.now()) {
  const marks = Object.values(days).flat().filter(t => Number.isFinite(t) && t <= now).sort((a, b) => a - b);
  const startedAt = Number.isFinite(previous.startedAt) ? previous.startedAt : (marks[0] ?? now);
  const unlocked = { ...previous.unlocked };
  const buckets = {};
  marks.forEach(t => { const key = todayKey(new Date(t)); (buckets[key] ??= []).push(t); });
  const keys = Object.keys(buckets).sort();
  const earned = {};
  if (marks.length) earned.first = marks[0];
  let best = 0;
  let run = 0;
  let lastKey;
  for (const key of keys) {
    const entries = buckets[key];
    if (best > 0 && entries.length > best && !earned.record) earned.record = entries[best];
    best = Math.max(best, entries.length);
    run = entries.length >= 5
      ? (lastKey === todayKey(addDays(dateFromKey(key), -1)) ? run + 1 : 1) : 0;
    if (run >= 5 && !earned.five) earned.five = entries[4];
    lastKey = key;
  }
  let last = Math.min(startedAt, marks[0] ?? startedAt);
  for (const mark of [...marks, now]) {
    if (mark - last >= GAP) { earned.tickless = last + GAP; break; }
    last = mark;
  }
  for (const [id, at] of Object.entries(earned)) {
    if (!unlocked[id]) unlocked[id] = { at, seen: false, acknowledged: false };
  }
  return { startedAt, unlocked };
}

export function createAchievements(getDays) {
  const button = document.querySelector('#achievements-button');
  const panel = document.querySelector('#achievements-dialog');
  const popup = document.querySelector('#achievement-unlock');
  const list = document.querySelector('#achievements-list');
  let state;
  try { state = JSON.parse(readStoredValue(KEY) || '{}') || {}; } catch { state = {}; }
  // Keep malformed persisted entries from blocking notifications.
  state.unlocked = Object.fromEntries(ACHIEVEMENTS.flatMap(({ id }) => {
    const entry = state.unlocked?.[id];
    return Number.isFinite(entry?.at) ? [[id, entry]] : [];
  }));
  let activeId;
  const save = () => storeValue(KEY, JSON.stringify(state));
  function render() {
    const unread = Object.values(state.unlocked).some(entry => !entry.seen);
    button.classList.toggle('has-unread', unread);
    button.setAttribute('aria-label', `Achievements${unread ? ', new achievement unlocked' : ''}`);
    document.querySelector('#achievements-count').textContent = `${Object.keys(state.unlocked).length} of ${ACHIEVEMENTS.length} unlocked`;
    list.replaceChildren(...ACHIEVEMENTS.map(achievement => {
      const entry = state.unlocked[achievement.id];
      const card = document.createElement('li');
      card.className = `achievement-card${entry ? ' is-earned' : ''}`;
      const icon = document.createElement('span');
      icon.className = 'achievement-icon';
      icon.textContent = achievement.icon;
      icon.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div');
      for (const [tag, text] of [['h3', achievement.title], ['p', achievement.pun], ['small', achievement.description], ['span', entry ? `Unlocked ${new Date(entry.at).toLocaleDateString()}` : 'Locked']]) {
        const node = document.createElement(tag);
        node.textContent = text;
        content.append(node);
      }
      card.append(icon, content);
      return card;
    }));
  }
  function showNext() {
    if (popup.open || panel.open || document.querySelector('.login-modal:not([hidden]), .chart-modal:not([hidden])')) return;
    const next = ACHIEVEMENTS.find(item => state.unlocked[item.id] && !state.unlocked[item.id].acknowledged);
    if (!next) return;
    activeId = next.id;
    document.querySelector('#unlock-icon').textContent = next.icon;
    document.querySelector('#unlock-title').textContent = next.title;
    document.querySelector('#unlock-pun').textContent = next.pun;
    document.querySelector('#unlock-description').textContent = next.description;
    popup.showModal();
  }
  function refresh() {
    state = evaluateAchievements(getDays(), state);
    save();
    render();
    showNext();
  }
  button.addEventListener('click', () => {
    Object.values(state.unlocked).forEach(entry => { entry.seen = true; });
    save();
    render();
    panel.showModal();
  });
  document.querySelector('#achievements-close').addEventListener('click', () => panel.close());
  panel.addEventListener('close', () => { button.focus(); showNext(); });
  panel.addEventListener('click', event => { if (event.target === panel && event.clientX !== 0) {
    const r = panel.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) panel.close();
  } });
  function acknowledge() {
    if (activeId) state.unlocked[activeId].acknowledged = true;
    save();
    popup.close();
  }
  document.querySelector('#unlock-ok').addEventListener('click', acknowledge);
  popup.addEventListener('cancel', event => { event.preventDefault(); acknowledge(); });
  popup.addEventListener('close', showNext);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.setInterval(refresh, 30_000);
  refresh();
  return { refresh };
}
