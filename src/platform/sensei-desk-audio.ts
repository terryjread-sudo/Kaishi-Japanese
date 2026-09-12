import { deviceStorage } from './storage';

const AUDIO_KEY = 'kaishi-sensei-desk-audio-enabled';
const TRACKS = {
  desk: 'media/sensei-desk/spy-loop.mp3',
  calm: 'media/sensei-desk/sunset-walk.ogg',
} as const;
const EFFECTS = {
  paper: 'media/sensei-desk/paper-flip.ogg',
  stamp: 'media/sensei-desk/stamp.wav',
  success: 'media/sensei-desk/success.mp3',
} as const;

let music: HTMLAudioElement | null = null;

export function senseiDeskAudioEnabled(): boolean {
  return deviceStorage().getItem(AUDIO_KEY) !== 'off';
}

export function setSenseiDeskAudioEnabled(enabled: boolean): void {
  deviceStorage().setItem(AUDIO_KEY, enabled ? 'on' : 'off');
  if (!enabled) stopSenseiDeskMusic();
}

export function startSenseiDeskMusic(scene: keyof typeof TRACKS = 'desk'): void {
  if (!senseiDeskAudioEnabled()) return;
  const source = TRACKS[scene];
  if (!music || music.src !== new URL(source, window.location.href).href) {
    stopSenseiDeskMusic();
    music = new Audio(source);
    music.loop = true;
    music.volume = .16;
  }
  void music.play().catch(() => undefined);
}

export function stopSenseiDeskMusic(): void {
  music?.pause();
  if (music) music.currentTime = 0;
  music = null;
}

export function playSenseiDeskEffect(effect: keyof typeof EFFECTS): void {
  if (!senseiDeskAudioEnabled()) return;
  const sound = new Audio(EFFECTS[effect]);
  sound.volume = effect === 'stamp' ? .42 : .3;
  void sound.play().catch(() => undefined);
}
