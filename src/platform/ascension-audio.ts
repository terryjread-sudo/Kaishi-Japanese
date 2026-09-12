import { deviceStorage } from './storage';

export type AscensionMusicScene = 'map' | 'combat' | 'boss' | 'reward' | 'victory';

const MUSIC_KEY = 'kaishi-ascension-music-enabled';
const MUSIC_VOLUME = 0.18;
const TRACKS: Record<'level' | 'boss', string> = {
  level: 'media/ascension/woodland-level.mp3',
  boss: 'media/ascension/woodland-boss.mp3',
};
const STINGERS: Record<'reward' | 'victory', string> = {
  reward: 'media/ascension/reward-stinger.mp3',
  victory: 'media/ascension/victory-stinger.mp3',
};

let music: HTMLAudioElement | null = null;
let currentTrack = '';
let musicDucked = false;
let fadeTimer: number | undefined;

export function ascensionMusicEnabled(): boolean {
  return deviceStorage().getItem(MUSIC_KEY) !== 'false';
}

export function setAscensionMusicEnabled(enabled: boolean): void {
  deviceStorage().setItem(MUSIC_KEY, String(enabled));
  if (!enabled) stopAscensionMusic();
}

export function startAscensionMusic(scene: AscensionMusicScene): void {
  if (!ascensionMusicEnabled()) return;
  const track = scene === 'boss' ? TRACKS.boss : TRACKS.level;
  if (music && currentTrack === track && !music.paused) return;
  const previous = music;
  previous?.pause();
  music = new Audio(track);
  currentTrack = track;
  music.loop = true;
  music.volume = 0;
  void music.play().catch(() => {
    // Browsers may require the learner's first click before starting audio.
  });
  if (fadeTimer !== undefined) window.clearInterval(fadeTimer);
  const startedAt = Date.now();
  fadeTimer = window.setInterval(() => {
    if (!music) return;
    const progress = Math.min(1, (Date.now() - startedAt) / 280);
    music.volume = (musicDucked ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME) * progress;
    if (progress >= 1 && fadeTimer !== undefined) { window.clearInterval(fadeTimer); fadeTimer = undefined; }
  }, 30);
}

export function duckAscensionMusic(ducked: boolean): void {
  musicDucked = ducked;
  if (music) music.volume = ducked ? MUSIC_VOLUME * 0.3 : MUSIC_VOLUME;
}

export function playAscensionStinger(scene: 'reward' | 'victory'): void {
  if (!ascensionMusicEnabled()) return;
  const stinger = new Audio(STINGERS[scene]);
  stinger.volume = 0.3;
  void stinger.play().catch(() => undefined);
}

export function stopAscensionMusic(): void {
  if (fadeTimer !== undefined) window.clearInterval(fadeTimer);
  fadeTimer = undefined;
  music?.pause();
  music = null;
  currentTrack = '';
  musicDucked = false;
}
