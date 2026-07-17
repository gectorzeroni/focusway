# Focusway sound-effects plan

## Goal

Use sound as sparse, meaningful feedback for completed actions and state changes. Focusway already has continuous metronome audio and a two-tone timer completion alert, so interaction sounds should remain quiet and should not compete with either one.

## Implementation status

Implemented with `cuelume@0.1.2`:

- `scripts/sound-effects.js` owns the Cuelume integration.
- Sound effects remain enabled without a user-facing on/off control.
- P0 and P1 cues are wired to their successful or invalid state transitions.
- Timer presets and reset use the planned P2 cues.
- Metronome controls, rapid steppers/sliders, chart hover, and ordinary hover remain intentionally silent.
- Timer completion keeps its existing distinct two-tone alert.
- Timer start does not add a Cuelume cue in Metronome mode; the first/current beat already supplies feedback.

## Integration prerequisite

`cuelume` is ESM-only. The sound adapter imports its installed ESM output by relative path, which works with Focusway's current static development server. Any future deployment must run `npm install` and publish the dependency path, or bundle/vendor Cuelume as part of its build.

## Recommended sound map

| Priority | App event | Code location | Cuelume sound | Reason |
| --- | --- | --- | --- | --- |
| P0 | Timer starts | `startTimer()` | `ready` | Signals entry into a focus session with a calm, intentional cue. |
| P0 | Timer pauses | `toggleTimer()` pause branch | `droplet` | A soft descending cue clearly contrasts with start. |
| P0 | Timer finishes | `tickTimer()` | Keep the existing two-tone alert initially | Completion is important enough to remain distinct from general UI feedback. Evaluate replacing it with `success` only after listening tests. |
| P0 | Performance tick added | `addPerformanceMark()` | `press` | Gives the tally action a physical, pencil-mark-like response. |
| P0 | Performance tick removed | `removePerformanceMark()` | `whisper` | Keeps removal subtle without making it sound like an error. |
| P0 | Spotify URL accepted | `loadSpotify()` success path | `ready` | Confirms that the requested media source was loaded. |
| P0 | Spotify URL rejected | `loadSpotify()` invalid path | `error` | Provides accessible feedback for a recoverable input error. |
| P1 | Timer duration rejected | `commitTimerEdit()` invalid path | `error` | Matches the visible `Invalid` status. |
| P1 | Local account created | `createLocalAccount()` | `success` | Confirms a completed, persisted action. |
| P1 | Sound source changed | `setSoundMode()` | `toggle` | Fits the Metronome/Spotify tab switch. |
| P1 | Chart range changed | `chartRangeSelect` change handler | `page` | Treats range changes as paging through history. |
| P1 | Login or chart opens | `openLoginModal()`, `openChartModal()` | `bloom` | A gentle reveal cue supports the panel transition. |
| P1 | Login or chart closes | `closeLoginModal()`, `closeChartModal()` | `droplet` | A matching collapse/dismiss cue. |
| P2 | Timer preset selected | preset button click handler | `toggle` | Confirms discrete 5/10/30-minute selection. |
| P2 | Timer reset | timer reset click handler | `release` | Short neutral feedback; avoid using `success` for a reversible action. |
| P2 | Metronome manually starts/stops | `toggleMetronome()` | None initially | The metronome's first beat and resulting silence already communicate the state. An added cue would overlap the beat. |
| P2 | BPM and timer steppers/sliders | BPM and timer adjustment handlers | None initially | Rapid repeated controls become noisy and the changing values already provide immediate feedback. |
| P2 | Chart hover and ordinary button hover | chart hover handlers / global UI | None | Hover sounds would add constant noise to a calm focus tool. |

## Accessibility

- Do not trigger sounds from passive page load, timer ticks, chart pointer movement, or background state changes.
- Only play success/error sounds after the action outcome is known.
- Keep every effect paired with existing visual text/state feedback; sound must never be the only signal.

## Implementation sequence

1. Add the browser import path and the sound adapter.
2. Implement the P0 events, then test them with the metronome on, Spotify active, and system volume low.
3. Implement P1 events only if the first pass still feels restrained.
4. Run keyboard and touch tests. Cuelume's imperative `play()` calls should occur on the same successful state transitions regardless of input method.
5. Test rapid repeat actions, modal open/close, invalid inputs, tab backgrounding, and browsers that block or lack Web Audio.
6. Decide after listening tests whether to keep the existing timer completion tones or replace them with Cuelume's `success`.

## Acceptance criteria

- No sound plays more than once for a single state transition.
- Repeated tally clicks remain clear without clipping or becoming harsh.
- Starting the timer with the metronome enabled does not produce a distracting collision.
- Invalid timer and Spotify input produce `error`; valid corrections do not replay the earlier error.
- Core controls remain fully understandable if browser or system audio is unavailable.
