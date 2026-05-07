const timerPane = document.querySelector('.timer-pane');
const timerDisplay = document.querySelector('#timer-display');
const timerStatus = document.querySelector('#timer-status');
const hoursInput = document.querySelector('#hours-input');
const minutesInput = document.querySelector('#minutes-input');
const secondsInput = document.querySelector('#seconds-input');
const timerToggle = document.querySelector('#timer-toggle');
const timerReset = document.querySelector('#timer-reset');
const timerMinus = document.querySelector('#timer-minus');
const timerPlus = document.querySelector('#timer-plus');

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

let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerEndsAt = 0;

let audioContext = null;
let metroTimer = null;
let metroRunning = false;
let currentBeat = 0;
let soundMode = 'metronome';
let currentSpotifyEmbedSrc = spotifyFrame.src;

const spotifyTypes = new Set(['album', 'artist', 'episode', 'playlist', 'show', 'track']);

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

function readTimerInputs() {
  const hours = clamp(parseInt(hoursInput.value, 10), 0, 99);
  const minutes = clamp(parseInt(minutesInput.value, 10), 0, 59);
  const seconds = clamp(parseInt(secondsInput.value, 10), 0, 59);

  hoursInput.value = hours;
  minutesInput.value = minutes;
  secondsInput.value = seconds;

  return hours * 3600 + minutes * 60 + seconds;
}

function syncInputsFromDuration(duration) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  hoursInput.value = hours;
  minutesInput.value = minutes;
  secondsInput.value = seconds;
}

function setTimerDuration(duration) {
  timerDuration = Math.max(0, duration);
  timerRemaining = timerDuration;
  syncInputsFromDuration(timerDuration);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(timerRemaining);
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
}

function tickTimer() {
  timerRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  updateTimerDisplay();

  if (timerRemaining <= 0) {
    stopTimer('Done');
    playTone(880, 0.14, 0.07);
    setTimeout(() => playTone(660, 0.16, 0.07), 130);
  }
}

function startTimer() {
  if (!timerInterval) {
    if (timerRemaining <= 0) {
      timerRemaining = readTimerInputs();
      timerDuration = timerRemaining;
    }

    if (timerRemaining <= 0) return;

    timerEndsAt = Date.now() + timerRemaining * 1000;
    timerInterval = window.setInterval(tickTimer, 250);
    timerStatus.textContent = 'Running';
    timerPane.classList.add('is-running');
    setToggleState(timerToggle, true, 'Pause timer', 'Start timer');
    tickTimer();
  }
}

function toggleTimer() {
  if (timerInterval) {
    stopTimer('Paused');
    return;
  }

  startTimer();
}

function handleTimerInput() {
  stopTimer('Ready');
  setTimerDuration(readTimerInputs());
}

function nudgeTimerMinutes(direction) {
  stopTimer('Ready');
  setTimerDuration(Math.max(0, readTimerInputs() + direction * 60));
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
  playTone(currentBeat === 0 ? 1080 : 760, 0.035, currentBeat === 0 ? 0.06 : 0.04);
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

[hoursInput, minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('change', handleTimerInput);
  input.addEventListener('input', () => {
    stopTimer('Editing');
    timerRemaining = readTimerInputs();
    timerDuration = timerRemaining;
    updateTimerDisplay();
  });
});

timerToggle.addEventListener('click', toggleTimer);
timerReset.addEventListener('click', () => {
  stopTimer('Ready');
  timerRemaining = timerDuration;
  updateTimerDisplay();
});
timerMinus.addEventListener('click', () => nudgeTimerMinutes(-1));
timerPlus.addEventListener('click', () => nudgeTimerMinutes(1));

bpmInput.addEventListener('input', () => setBpm(bpmInput.value));
bpmSlider.addEventListener('input', () => setBpm(bpmSlider.value));
bpmMinus.addEventListener('click', () => setBpm(parseInt(bpmInput.value, 10) - 1));
bpmPlus.addEventListener('click', () => setBpm(parseInt(bpmInput.value, 10) + 1));
metroToggle.addEventListener('click', toggleMetronome);

soundModeButtons.forEach((button) => {
  button.addEventListener('click', () => setSoundMode(button.dataset.soundMode));
});

spotifyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadSpotify(spotifyInput.value);
});

setTimerDuration(timerDuration);
setBpm(120);

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
