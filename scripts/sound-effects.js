import {
  play as playCuelumeSound,
} from './vendor/cuelume/audio/engine.js';

export function playSoundEffect(sound) {
  playCuelumeSound(sound);
}
