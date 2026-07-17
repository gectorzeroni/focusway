import {
  play as playCuelumeSound,
} from '../node_modules/cuelume/dist/index.js';

export function playSoundEffect(sound) {
  playCuelumeSound(sound);
}
