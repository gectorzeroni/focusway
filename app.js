const timerPane = document.querySelector('.timer-pane');
const timerDisplay = document.querySelector('#timer-display');
const timerStatus = document.querySelector('#timer-status');
const presetButtons = [...document.querySelectorAll('[data-preset-minutes]')];
const timerToggle = document.querySelector('#timer-toggle');
const timerReset = document.querySelector('#timer-reset');
const timerMinus = document.querySelector('#timer-minus');
const timerPlus = document.querySelector('#timer-plus');
const timerProgress = document.querySelector('.timer-progress');
const timerProgressTrack = document.querySelector('.timer-progress-track');
const timerProgressLine = document.querySelector('.timer-progress-line');
const performanceDate = document.querySelector('#performance-date');
const tallyButton = document.querySelector('#tally-button');
const tallyRemove = document.querySelector('#tally-remove');
const tallyBoard = document.querySelector('#tally-board');
const loginButton = document.querySelector('#login-button');
const loginModal = document.querySelector('#login-modal');
const loginClose = document.querySelector('#login-close');
const loginForm = document.querySelector('#login-form');
const loginName = document.querySelector('#login-name');
const historyTotal = document.querySelector('#history-total');
const miniChartButton = document.querySelector('#mini-chart-button');
const miniChart = document.querySelector('#mini-chart');
const chartModal = document.querySelector('#chart-modal');
const chartClose = document.querySelector('#chart-close');
const chartSubtitle = document.querySelector('#chart-subtitle');
const chartTotal = document.querySelector('#chart-total');
const chartRangeSelect = document.querySelector('#chart-range-select');
const largeChart = document.querySelector('#large-chart');
const chartHistoryList = document.querySelector('#chart-history-list');

const metroPane = document.querySelector('.metronome-pane');
const metroStatus = document.querySelector('#metro-status');
const bpmInput = document.querySelector('#bpm-input');
const bpmSlider = document.querySelector('#bpm-slider');
const bpmMinus = document.querySelector('#bpm-minus');
const bpmPlus = document.querySelector('#bpm-plus');
const metroToggle = document.querySelector('#metro-toggle');
const beatNodes = [...document.querySelectorAll('.beat')];
const soundModeButtons = [...document.querySelectorAll('[data-sound-mode]')];
const metronomePanel = document.querySelector('#metronome-panel');
const musicPanel = document.querySelector('#music-panel');
const spotifyForm = document.querySelector('#spotify-form');
const spotifyInput = document.querySelector('#spotify-input');
const spotifyFrame = document.querySelector('#spotify-frame');

let timerDuration = 30 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerEndsAt = 0;
let editingTimer = false;
let timerProgressPathLength = 0;
let timerProgressWidth = 0;
let timerProgressHeight = 0;

let audioContext = null;
let metroTimer = null;
let metroRunning = false;
let metronomeStartedByTimer = false;
let currentBeat = 0;
let soundMode = 'metronome';
let currentSpotifyEmbedSrc = spotifyFrame.src;
const STORAGE_KEYS = {
  performanceDays: 'focusway.performanceDays',
  performanceMarks: 'focusway.performanceMarks',
  localAccountName: 'focusway.localAccountName',
  localProfiles: 'focusway.localProfiles',
  activeProfile: 'focusway.activeProfileId',
};

migrateProfilePerformanceDays();
let performanceDays = readPerformanceDays();
let performanceMarks = [];
let chartRange = 'today';
let chartCloseTimer = null;
let loginCloseTimer = null;

const spotifyTypes = new Set(['album', 'artist', 'episode', 'playlist', 'show', 'track']);
const METRONOME_DOWNBEAT_VOLUME = 0.14;
const METRONOME_BEAT_VOLUME = 0.095;
const CHART_PANEL_TRANSITION_MS = 320;
const LOGIN_MODAL_TRANSITION_MS = 220;

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`
    : `${minutes}:${pad(remainingSeconds)}`;
}

function parseTimerText(value) {
  const text = value.trim();
  if (!text) return null;

  if (text.includes(':')) {
    const parts = text.split(':').map((part) => parseInt(part, 10));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;

    const [hours = 0, minutes = 0, seconds = 0] =
      parts.length === 3 ? parts : [0, parts[0], parts[1]];

    if (minutes > 59 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const minutes = parseInt(text, 10);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes * 60 : null;
}

function updatePresetState() {
  const remainingMinutes = timerDuration / 60;
  presetButtons.forEach((button) => {
    const selected = Number(button.dataset.presetMinutes) === remainingMinutes;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
}

function setTimerDuration(duration) {
  timerDuration = Math.max(0, duration);
  timerRemaining = timerDuration;
  updatePresetState();
  updateTimerDisplay();
  updateTimerProgress();
}

function updateTimerDisplay() {
  if (editingTimer) return;
  timerDisplay.textContent = formatTime(timerRemaining);
}

function updateTimerProgressPath() {
  const { width, height } = timerProgress.getBoundingClientRect();
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  if (!roundedWidth || !roundedHeight) return;
  if (roundedWidth === timerProgressWidth && roundedHeight === timerProgressHeight) return;

  timerProgressWidth = roundedWidth;
  timerProgressHeight = roundedHeight;

  const strokeWidth = parseFloat(getComputedStyle(timerProgressLine).strokeWidth) || 12;
  const inset = strokeWidth / 2;
  const paneRadius = parseFloat(getComputedStyle(timerPane).borderTopLeftRadius) || 24;
  const radius = Math.max(inset, paneRadius - inset);
  const right = roundedWidth - inset;
  const bottom = roundedHeight - inset;
  const centerY = roundedHeight / 2;

  const path = [
    `M ${right} ${centerY}`,
    `V ${inset + radius}`,
    `Q ${right} ${inset} ${right - radius} ${inset}`,
    `H ${inset + radius}`,
    `Q ${inset} ${inset} ${inset} ${inset + radius}`,
    `V ${bottom - radius}`,
    `Q ${inset} ${bottom} ${inset + radius} ${bottom}`,
    `H ${right - radius}`,
    `Q ${right} ${bottom} ${right} ${bottom - radius}`,
    `V ${centerY}`,
  ].join(' ');

  timerProgress.setAttribute('viewBox', `0 0 ${roundedWidth} ${roundedHeight}`);
  timerProgressTrack.setAttribute('d', path);
  timerProgressLine.setAttribute('d', path);
  timerProgressPathLength = timerProgressLine.getTotalLength();
}

function updateTimerProgress() {
  updateTimerProgressPath();
  const remainingProgress = timerDuration > 0 ? clamp(timerRemaining / timerDuration, 0, 1) : 0;
  const visibleLength = timerProgressPathLength * remainingProgress;
  timerProgressLine.style.strokeDasharray = `${visibleLength} ${timerProgressPathLength}`;
  timerProgressLine.style.strokeDashoffset = 0;
  timerPane.style.setProperty('--timer-color', 'var(--green)');
  timerPane.style.setProperty('--timer-progress-ratio', remainingProgress.toFixed(4));
}

function exitTimerEditMode() {
  editingTimer = false;
  timerDisplay.classList.remove('is-editing');
}

function selectTimerText() {
  const range = document.createRange();
  range.selectNodeContents(timerDisplay);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function commitTimerEdit() {
  exitTimerEditMode();

  const duration = parseTimerText(timerDisplay.textContent);
  if (duration === null || duration <= 0) {
    timerStatus.textContent = 'Invalid';
    updateTimerDisplay();
    return false;
  }

  timerStatus.textContent = 'Ready';
  setTimerDuration(duration);
  return true;
}

function setToggleState(
  button,
  active,
  activeLabel = 'Pause',
  inactiveLabel = 'Start',
  activeText = 'Pause',
  inactiveText = 'Start',
) {
  button.classList.toggle('is-active', active);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', active ? activeLabel : inactiveLabel);
  button.querySelector('.control-label').textContent = active ? activeText : inactiveText;
}

function stopTimer(label = 'Paused') {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerStatus.textContent = label;
  timerPane.classList.remove('is-running');
  setToggleState(timerToggle, false, 'Pause timer', 'Start timer');

  if (metronomeStartedByTimer) {
    stopMetronome();
    metronomeStartedByTimer = false;
  }
}

function tickTimer() {
  timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  updateTimerDisplay();
  updateTimerProgress();

  if (timerRemaining <= 0) {
    stopTimer('Done');
    playTone(880, 0.16, 0.16);
    setTimeout(() => playTone(660, 0.18, 0.14), 130);
  }
}

function startTimer() {
  if (!timerInterval) {
    if (timerRemaining <= 0) {
      timerRemaining = parseTimerText(timerDisplay.textContent) || timerDuration;
      timerDuration = timerRemaining;
    }

    if (timerRemaining <= 0) return;

    timerEndsAt = Date.now() + timerRemaining * 1000;
    timerInterval = window.setInterval(tickTimer, 250);
    timerStatus.textContent = 'Running';
    timerPane.classList.add('is-running');
    setToggleState(timerToggle, true, 'Pause timer', 'Start timer');
    if (soundMode === 'metronome' && !metroRunning) {
      startMetronome();
      metronomeStartedByTimer = true;
    }
    tickTimer();
  }
}

function toggleTimer() {
  if ((editingTimer || timerStatus.textContent === 'Editing') && !commitTimerEdit()) {
    return;
  }

  if (timerInterval) {
    stopTimer('Paused');
    return;
  }

  startTimer();
}

function handleTimerInput() {
  stopTimer('Ready');
  const duration = parseTimerText(timerDisplay.textContent);
  if (duration !== null) {
    setTimerDuration(duration);
  }
}

function nudgeTimerMinutes(direction) {
  exitTimerEditMode();
  timerDisplay.blur();
  stopTimer('Ready');
  setTimerDuration(Math.max(0, timerDuration + direction * 60));
}

function setBpm(value) {
  const bpm = clamp(parseInt(value, 10), 20, 240);
  bpmInput.value = bpm;
  bpmSlider.value = bpm;

  if (metroRunning) {
    stopMetronome(false);
    startMetronome();
  }
}

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

function normalizeAccountName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function updateLoginButton() {
  const name = normalizeAccountName(readStoredValue(STORAGE_KEYS.localAccountName));
  loginButton.textContent = name || 'Log in';
  loginButton.setAttribute('aria-label', name ? `Local account: ${name}` : 'Log in');
}

function todayKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatPerformanceDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatHourLabel(hour) {
  return `${pad(hour)}:00`;
}

function formatMarkTime(mark) {
  return new Date(mark).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTickCount(count) {
  return `${count} ${count === 1 ? 'tick' : 'ticks'}`;
}

function formatMarkTimes(marks) {
  if (!marks.length) return 'No ticks logged';
  return marks
    .slice()
    .sort((a, b) => a - b)
    .map(formatMarkTime)
    .join(', ');
}

function normalizePerformanceDays(value) {
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

function profilePerformanceDaysKey(profileId) {
  return `focusway.profiles.${profileId}.performanceDays`;
}

function migrateProfilePerformanceDays() {
  try {
    if (window.localStorage.getItem(STORAGE_KEYS.performanceDays)) return;

    const profileIds = [];
    const activeProfileId = window.localStorage.getItem(STORAGE_KEYS.activeProfile);
    if (activeProfileId) profileIds.push(activeProfileId);

    const storedProfiles = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.localProfiles) || '[]');
    if (Array.isArray(storedProfiles)) {
      storedProfiles.forEach((profile) => {
        if (typeof profile?.id === 'string' && !profileIds.includes(profile.id)) {
          profileIds.push(profile.id);
        }
      });
    }

    if (!profileIds.includes('default')) profileIds.push('default');

    const storedProfileDays = profileIds
      .map((profileId) => window.localStorage.getItem(profilePerformanceDaysKey(profileId)))
      .find(Boolean);

    if (storedProfileDays) {
      window.localStorage.setItem(
        STORAGE_KEYS.performanceDays,
        JSON.stringify(normalizePerformanceDays(JSON.parse(storedProfileDays))),
      );
    }
  } catch {
    return null;
  }
}

function readPerformanceDays() {
  try {
    const storedDays = window.localStorage.getItem(STORAGE_KEYS.performanceDays);
    if (storedDays) {
      return normalizePerformanceDays(JSON.parse(storedDays));
    }

    const storedMarks = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.performanceMarks) || '[]');
    return normalizePerformanceDays(storedMarks);
  } catch {
    return {};
  }
}

function ensureTodayPerformanceMarks() {
  const key = todayKey();
  performanceDays[key] = performanceDays[key] || [];
  performanceMarks = performanceDays[key];
  return performanceMarks;
}

function storePerformanceDays() {
  try {
    window.localStorage.setItem(STORAGE_KEYS.performanceDays, JSON.stringify(performanceDays));
    window.localStorage.removeItem(STORAGE_KEYS.performanceMarks);
  } catch {
    return null;
  }
}

function clearSvg(svg) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function makeSvgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function renderTally() {
  ensureTodayPerformanceMarks();
  clearSvg(tallyBoard);

  const count = performanceMarks.length;
  tallyButton.setAttribute('aria-label', `Add performance mark, ${count} today`);
  tallyButton.classList.toggle('has-marks', count > 0);
  tallyRemove.disabled = count === 0;

  if (!count) {
    tallyBoard.setAttribute('viewBox', '0 0 360 64');
    tallyBoard.style.width = '';
    return;
  }

  tallyBoard.style.opacity = '1';

  const groupGap = 80;
  const lineGap = 18;
  const startX = 8;
  const strokeInset = 2.5;
  const shownCount = Math.min(count, 12);
  const hiddenCount = count - shownCount;
  let contentRight = startX + strokeInset;

  for (let index = 0; index < shownCount; index += 1) {
    const group = Math.floor(index / 3);
    const offset = index % 3;
    const x = startX + group * groupGap + offset * lineGap;
    contentRight = Math.max(contentRight, x + strokeInset);
    tallyBoard.appendChild(
      makeSvgElement('line', { class: 'tally-mark', x1: x, y1: 0, x2: x, y2: 64 }),
    );

    if (offset === 2) {
      contentRight = Math.max(contentRight, x + 6 + strokeInset);
      tallyBoard.appendChild(
        makeSvgElement('line', { class: 'tally-cross', x1: x - lineGap * 2 - 6, y1: 32, x2: x + 6, y2: 32 }),
      );
    }
  }

  if (hiddenCount > 0) {
    const text = makeSvgElement('text', { class: 'chart-label', x: 330, y: 38, 'text-anchor': 'middle' });
    text.textContent = `+${hiddenCount}`;
    tallyBoard.appendChild(text);
    contentRight = 360;
  }

  tallyBoard.setAttribute('viewBox', `0 0 ${contentRight} 64`);
}

function marksForDay(key) {
  return performanceDays[key] || [];
}

function hourlyPerformance(key = todayKey()) {
  const bins = Array.from({ length: 24 }, () => 0);
  marksForDay(key).forEach((mark) => {
    const date = new Date(mark);
    if (todayKey(date) === key) {
      bins[date.getHours()] += 1;
    }
  });
  return bins;
}

function hourlyPerformanceDetails(key = todayKey()) {
  const bins = hourlyPerformance(key);
  const marksByHour = Array.from({ length: 24 }, () => []);

  marksForDay(key).forEach((mark) => {
    const date = new Date(mark);
    if (todayKey(date) === key) {
      marksByHour[date.getHours()].push(mark);
    }
  });

  return {
    bins,
    hoverDetails: marksByHour.map((marks, hour) => [
      `${formatHourLabel(hour)} · ${formatTickCount(marks.length)}`,
      formatMarkTimes(marks),
    ]),
  };
}

function recentDayKeys(totalDays) {
  const today = new Date();
  return Array.from({ length: totalDays }, (_, index) => addDays(today, index - totalDays + 1));
}

function recentDayPerformance(totalDays) {
  return recentDayKeys(totalDays).map((date) => {
    const key = todayKey(date);
    const marks = marksForDay(key).slice().sort((a, b) => a - b);
    return {
      label: formatShortDate(date),
      value: marks.length,
      marks,
    };
  });
}

function chartPoints(width, height, horizontalInset, verticalInset, bins) {
  const max = Math.max(1, ...bins);
  return bins.map((value, index) => {
    const denominator = Math.max(1, bins.length - 1);
    const x = horizontalInset + (index / denominator) * (width - horizontalInset * 2);
    const y = height - verticalInset - (value / max) * (height - verticalInset * 2);
    return { x, y, value, index };
  });
}

function renderChart(svg, width, height, bins, showLabels = false, labels = [], hoverDetails = []) {
  clearSvg(svg);

  const horizontalInset = showLabels ? 0 : 18;
  const verticalInset = showLabels ? 42 : 18;
  const points = chartPoints(width, height, horizontalInset, verticalInset, bins);
  const hasData = points.some((point) => point.value > 0);
  const path = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  svg.classList.toggle('is-empty', !hasData);

  if (showLabels) {
    svg.append(
      makeSvgElement('line', { class: 'chart-grid', x1: horizontalInset, y1: verticalInset, x2: horizontalInset, y2: height - verticalInset }),
      makeSvgElement('line', { class: 'chart-axis', x1: horizontalInset, y1: height - verticalInset, x2: width - horizontalInset, y2: height - verticalInset }),
    );
  }

  svg.appendChild(makeSvgElement('polyline', { class: 'chart-line', points: path }));

  if (showLabels) {
    labels.forEach(([index, label]) => {
      const point = points[index];
      if (!point) return;

      const textAnchor = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
      const text = makeSvgElement('text', { class: 'chart-label', x: point.x, y: height - 12, 'text-anchor': textAnchor });
      text.textContent = label;
      svg.appendChild(text);
    });
  }

  const hoverGroup = makeSvgElement('g', { class: 'chart-hover', 'aria-hidden': 'true' });
  hoverGroup.append(
    makeSvgElement('line', { class: 'chart-hover-line', x1: horizontalInset, y1: verticalInset, x2: horizontalInset, y2: height - verticalInset }),
    makeSvgElement('circle', { class: 'chart-hover-dot', cx: horizontalInset, cy: height - verticalInset, r: showLabels ? 5 : 4 }),
    makeSvgElement('text', { class: 'chart-hover-label', x: horizontalInset, y: verticalInset - 10, 'text-anchor': 'middle' }),
  );
  svg.appendChild(hoverGroup);
  svg.__chartMeta = { width, height, horizontalInset, verticalInset, points, hoverDetails };
}

function chartConfigForRange(range) {
  if (range === 'previous') {
    const date = addDays(new Date(), -1);
    const key = todayKey(date);
    const details = hourlyPerformanceDetails(key);
    return {
      bins: details.bins,
      labels: [[0, '00'], [6, '06'], [12, '12'], [18, '18'], [23, '23']],
      hoverDetails: details.hoverDetails,
      subtitle: `${formatPerformanceDate(date)} · previous day`,
      total: marksForDay(key).length,
    };
  }

  if (range === 'last5') {
    const days = recentDayPerformance(5);
    return {
      bins: days.map((day) => day.value),
      labels: days.map((day, index) => [index, day.label]),
      hoverDetails: days.map((day) => [
        `${day.label} · ${formatTickCount(day.value)}`,
        formatMarkTimes(day.marks),
      ]),
      subtitle: 'Last 5 days',
      total: days.reduce((sum, day) => sum + day.value, 0),
    };
  }

  if (range === 'last30') {
    const days = recentDayPerformance(30);
    return {
      bins: days.map((day) => day.value),
      labels: days
        .map((day, index) => [index, day.label])
        .filter((_, index) => index === 0 || index === 7 || index === 14 || index === 21 || index === 29),
      hoverDetails: days.map((day) => [
        `${day.label} · ${formatTickCount(day.value)}`,
        formatMarkTimes(day.marks),
      ]),
      subtitle: 'Last 30 days',
      total: days.reduce((sum, day) => sum + day.value, 0),
    };
  }

  const details = hourlyPerformanceDetails(todayKey());
  return {
    bins: details.bins,
    labels: [[0, '00'], [6, '06'], [12, '12'], [18, '18'], [23, '23']],
    hoverDetails: details.hoverDetails,
    subtitle: `${formatPerformanceDate()} · today`,
    total: marksForDay(todayKey()).length,
  };
}

function renderModalChart() {
  const config = chartConfigForRange(chartRange);
  renderChart(largeChart, 720, 300, config.bins, true, config.labels, config.hoverDetails);
  chartTotal.textContent = config.total;
  chartSubtitle.textContent = config.subtitle;
  chartRangeSelect.value = chartRange;
}

function renderChartHistory() {
  while (chartHistoryList.firstChild) {
    chartHistoryList.removeChild(chartHistoryList.firstChild);
  }

  const keys = new Set(Object.keys(performanceDays));
  keys.add(todayKey());

  [...keys]
    .sort((a, b) => b.localeCompare(a))
    .forEach((key) => {
      const row = document.createElement('div');
      row.className = 'chart-history-row';

      const date = document.createElement('time');
      date.dateTime = key;
      date.textContent = formatPerformanceDate(dateFromKey(key));

      const count = marksForDay(key).length;
      const total = document.createElement('strong');
      total.textContent = `${count} ${count === 1 ? 'tick' : 'ticks'}`;

      row.append(date, total);
      chartHistoryList.appendChild(row);
    });
}

function renderPerformance() {
  ensureTodayPerformanceMarks();
  const todayConfig = chartConfigForRange('today');
  renderTally();
  renderChart(miniChart, 220, 64, todayConfig.bins, false, [], todayConfig.hoverDetails);
  renderModalChart();
  renderChartHistory();
  historyTotal.textContent = todayConfig.total;
  performanceDate.dateTime = todayKey();
  performanceDate.textContent = formatPerformanceDate();
}

function updateChartHover(svg, event) {
  const meta = svg.__chartMeta;
  if (!meta || !meta.points.length) return;

  const rect = svg.getBoundingClientRect();
  const pointerX = ((event.clientX - rect.left) / rect.width) * meta.width;
  const nearest = meta.points.reduce((closest, point) => (
    Math.abs(point.x - pointerX) < Math.abs(closest.x - pointerX) ? point : closest
  ), meta.points[0]);
  const hoverGroup = svg.querySelector('.chart-hover');
  if (!hoverGroup) return;

  const labelLines = meta.hoverDetails[nearest.index] || [
    `${nearest.index} · ${formatTickCount(nearest.value)}`,
  ];
  const labelY = Math.max(12, nearest.y - (meta.height > 100 ? 14 : 8));
  const labelX = clamp(nearest.x, 76, meta.width - 76);

  hoverGroup.classList.add('is-visible');
  hoverGroup.querySelector('.chart-hover-line').setAttribute('x1', nearest.x);
  hoverGroup.querySelector('.chart-hover-line').setAttribute('x2', nearest.x);
  hoverGroup.querySelector('.chart-hover-dot').setAttribute('cx', nearest.x);
  hoverGroup.querySelector('.chart-hover-dot').setAttribute('cy', nearest.y);

  const labelNode = hoverGroup.querySelector('.chart-hover-label');
  labelNode.setAttribute('x', labelX);
  labelNode.setAttribute('y', labelY);
  labelNode.textContent = '';
  labelLines.forEach((line, index) => {
    const tspan = makeSvgElement('tspan', {
      x: labelX,
      dy: index === 0 ? 0 : '1.25em',
    });
    tspan.textContent = line;
    labelNode.appendChild(tspan);
  });
}

function hideChartHover(svg) {
  svg.querySelector('.chart-hover')?.classList.remove('is-visible');
}

function addPerformanceMark() {
  ensureTodayPerformanceMarks();
  performanceMarks.push(Date.now());
  storePerformanceDays();
  renderPerformance();
}

function removePerformanceMark() {
  ensureTodayPerformanceMarks();
  if (!performanceMarks.length) return;

  performanceMarks.pop();
  storePerformanceDays();
  renderPerformance();
}

function openLoginModal() {
  window.clearTimeout(loginCloseTimer);
  const storedName = normalizeAccountName(readStoredValue(STORAGE_KEYS.localAccountName));
  loginName.value = storedName;
  loginModal.hidden = false;
  window.requestAnimationFrame(() => {
    loginModal.classList.add('is-open');
  });
  loginName.focus();
  loginName.select();
}

function closeLoginModal() {
  if (loginModal.hidden) return;

  loginModal.classList.remove('is-open');
  loginCloseTimer = window.setTimeout(() => {
    loginModal.hidden = true;
  }, LOGIN_MODAL_TRANSITION_MS);
  loginButton.focus();
}

function createLocalAccount() {
  const name = normalizeAccountName(loginName.value);
  if (!name) return;

  storeValue(STORAGE_KEYS.localAccountName, name);
  updateLoginButton();
  closeLoginModal();
}

function openChartModal() {
  window.clearTimeout(chartCloseTimer);
  renderModalChart();
  chartModal.hidden = false;
  window.requestAnimationFrame(() => {
    chartModal.classList.add('is-open');
  });
  chartClose.focus();
}

function closeChartModal() {
  if (chartModal.hidden) return;

  chartModal.classList.remove('is-open');
  chartCloseTimer = window.setTimeout(() => {
    chartModal.hidden = true;
  }, CHART_PANEL_TRANSITION_MS);
  miniChartButton.focus();
}

function parseSpotifyInput(value) {
  const input = value.trim();
  if (!input) return null;

  if (input.startsWith('spotify:')) {
    const [, type, id] = input.split(':');
    return spotifyTypes.has(type) && id ? { type, id } : null;
  }

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (host !== 'open.spotify.com' || parts.length < 2) return null;

    let offset = parts[0] === 'embed' ? 1 : 0;
    if (parts[offset]?.startsWith('intl-')) {
      offset += 1;
    }

    const type = parts[offset];
    const id = parts[offset + 1];
    return spotifyTypes.has(type) && id ? { type, id } : null;
  } catch {
    return null;
  }
}

function spotifyEmbedSource({ type, id }) {
  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
}

function loadSpotify(value) {
  const parsed = parseSpotifyInput(value);

  if (!parsed) {
    spotifyForm.classList.add('has-error');
    metroStatus.textContent = 'Invalid';
    return;
  }

  spotifyForm.classList.remove('has-error');
  currentSpotifyEmbedSrc = spotifyEmbedSource(parsed);
  spotifyFrame.src = currentSpotifyEmbedSrc;
  spotifyInput.value = `https://open.spotify.com/${parsed.type}/${parsed.id}`;
  metroStatus.textContent = 'Music';
  storeValue('focusway.spotify', spotifyInput.value);
}

function stopSpotifyPlayback() {
  if (spotifyFrame.src !== 'about:blank') {
    spotifyFrame.src = 'about:blank';
  }
}

function setSoundMode(mode) {
  soundMode = mode === 'music' ? 'music' : 'metronome';
  const isMusic = soundMode === 'music';

  soundModeButtons.forEach((button) => {
    const selected = button.dataset.soundMode === soundMode;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });

  metronomePanel.hidden = isMusic;
  musicPanel.hidden = !isMusic;

  if (isMusic) {
    stopMetronome();
    spotifyFrame.src = currentSpotifyEmbedSrc;
    metroStatus.textContent = 'Music';
  } else {
    stopSpotifyPlayback();
    metroStatus.textContent = metroRunning ? 'Playing' : 'Silent';
  }

  storeValue('focusway.soundMode', soundMode);
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(frequency = 960, duration = 0.035, volume = 0.045) {
  const context = ensureAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function renderBeat(index) {
  beatNodes.forEach((node, nodeIndex) => {
    node.classList.toggle('active', nodeIndex === index);
  });
}

function pulseMetronome() {
  renderBeat(currentBeat);
  playTone(
    currentBeat === 0 ? 1080 : 760,
    0.035,
    currentBeat === 0 ? METRONOME_DOWNBEAT_VOLUME : METRONOME_BEAT_VOLUME,
  );
  currentBeat = (currentBeat + 1) % beatNodes.length;
}

function startMetronome() {
  if (metroRunning) return;

  metroRunning = true;
  metroPane.classList.add('is-running');
  metroStatus.textContent = 'Playing';
  setToggleState(metroToggle, true, 'Pause metronome', 'Start metronome');
  pulseMetronome();
  metroTimer = window.setInterval(pulseMetronome, 60000 / parseInt(bpmInput.value, 10));
}

function stopMetronome(updateStatus = true) {
  window.clearInterval(metroTimer);
  metroTimer = null;
  metroRunning = false;
  metronomeStartedByTimer = false;
  metroPane.classList.remove('is-running');
  setToggleState(metroToggle, false, 'Pause metronome', 'Start metronome');

  if (updateStatus) {
    metroStatus.textContent = 'Silent';
  }
}

function toggleMetronome() {
  if (metroRunning) {
    stopMetronome();
    return;
  }

  startMetronome();
}

function playButtonClickRebound(button) {
  if (!button || button.disabled) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverScale = getComputedStyle(button).getPropertyValue('--button-hover-scale').trim() || '0.97';
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const restScale = isFinePointer && button.matches(':hover') ? hoverScale : '1';

  button.clickReboundAnimation?.cancel();
  window.clearTimeout(button.clickReboundTimer);
  window.clearTimeout(button.clickReboundResetTimer);

  if (reduceMotion) {
    button.style.transform = '';
    button.style.transition = '';
    return;
  }

  if (typeof button.animate !== 'function') {
    button.style.transition = 'transform 90ms cubic-bezier(0.23, 1, 0.32, 1)';
    button.style.transform = 'scale(1.018)';

    button.clickReboundTimer = window.setTimeout(() => {
      button.style.transition = 'transform 130ms cubic-bezier(0.23, 1, 0.32, 1)';
      button.style.transform = `scale(${restScale})`;
    }, 90);

    button.clickReboundResetTimer = window.setTimeout(() => {
      button.style.transition = '';
      button.style.transform = '';
    }, 240);

    return;
  }

  button.clickReboundAnimation = button.animate(
    [
      { transform: `scale(${hoverScale})` },
      { transform: 'scale(1.018)', offset: 0.52 },
      { transform: `scale(${restScale})` },
    ],
    {
      duration: 220,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    },
  );

  button.clickReboundAnimation.addEventListener(
    'finish',
    () => {
      button.style.transform = '';
      button.clickReboundAnimation = null;
    },
    { once: true },
  );
}

document.querySelectorAll('button').forEach((button) => {
  button.addEventListener('pointerup', () => playButtonClickRebound(button));
  button.addEventListener('mouseup', () => playButtonClickRebound(button));
  button.addEventListener('touchend', () => playButtonClickRebound(button), { passive: true });
  button.addEventListener('pointercancel', () => {
    button.style.transition = '';
    button.style.transform = '';
  });
});

timerDisplay.addEventListener('focus', () => {
  stopTimer('Editing');
  editingTimer = true;
  timerDisplay.classList.add('is-editing');
  window.setTimeout(selectTimerText, 0);
});

timerDisplay.addEventListener('blur', commitTimerEdit);

timerDisplay.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    timerDisplay.blur();
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    editingTimer = false;
    timerDisplay.classList.remove('is-editing');
    updateTimerDisplay();
    timerDisplay.blur();
  }
});

timerDisplay.addEventListener('input', handleTimerInput);

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    exitTimerEditMode();
    timerDisplay.blur();
    stopTimer('Ready');
    setTimerDuration(Number(button.dataset.presetMinutes) * 60);
  });
});

timerToggle.addEventListener('click', toggleTimer);
timerReset.addEventListener('click', () => {
  exitTimerEditMode();
  timerDisplay.blur();
  stopTimer('Ready');
  timerRemaining = timerDuration;
  updateTimerDisplay();
  updateTimerProgress();
});
timerMinus.addEventListener('click', () => nudgeTimerMinutes(-1));
timerPlus.addEventListener('click', () => nudgeTimerMinutes(1));

bpmInput.addEventListener('input', () => setBpm(bpmInput.value));
bpmSlider.addEventListener('input', () => setBpm(bpmSlider.value));
bpmMinus.addEventListener('click', () => setBpm(parseInt(bpmInput.value, 10) - 1));
bpmPlus.addEventListener('click', () => setBpm(parseInt(bpmInput.value, 10) + 1));
metroToggle.addEventListener('click', toggleMetronome);
tallyButton.addEventListener('click', addPerformanceMark);
tallyRemove.addEventListener('click', removePerformanceMark);
loginButton.addEventListener('click', openLoginModal);
loginClose.addEventListener('click', closeLoginModal);
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  createLocalAccount();
});
loginModal.addEventListener('click', (event) => {
  if (event.target === loginModal) {
    closeLoginModal();
  }
});
miniChartButton.addEventListener('click', openChartModal);
chartClose.addEventListener('click', closeChartModal);
chartModal.addEventListener('click', (event) => {
  if (event.target === chartModal) {
    closeChartModal();
  }
});

chartRangeSelect.addEventListener('change', () => {
  chartRange = chartRangeSelect.value;
  renderModalChart();
});

[miniChart, largeChart].forEach((chart) => {
  chart.addEventListener('mousemove', (event) => updateChartHover(chart, event));
  chart.addEventListener('mouseleave', () => hideChartHover(chart));
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !loginModal.hidden) {
    closeLoginModal();
    return;
  }

  if (event.key === 'Escape' && !chartModal.hidden) {
    closeChartModal();
  }
});

soundModeButtons.forEach((button) => {
  button.addEventListener('click', () => setSoundMode(button.dataset.soundMode));
});

spotifyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadSpotify(spotifyInput.value);
});

window.addEventListener('resize', () => {
  timerProgressWidth = 0;
  timerProgressHeight = 0;
  updateTimerProgress();
});

setTimerDuration(timerDuration);
setBpm(120);
updateLoginButton();

const storedSpotify = readStoredValue('focusway.spotify');
if (storedSpotify) {
  const parsed = parseSpotifyInput(storedSpotify);
  if (parsed) {
    currentSpotifyEmbedSrc = spotifyEmbedSource(parsed);
    spotifyFrame.src = currentSpotifyEmbedSrc;
    spotifyInput.value = storedSpotify;
  }
}

setSoundMode(readStoredValue('focusway.soundMode') || 'metronome');
renderPerformance();
