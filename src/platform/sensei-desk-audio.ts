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
  lampOff: 'media/sensei-desk/lamp-off.mp3',
} as const;

let music: HTMLAudioElement | null = null;
let wordAudio: HTMLAudioElement | null = null;

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

function speakFallback(text: string): void {
  if (!text || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = .82;
  window.speechSynthesis.speak(utterance);
}

export function playSenseiDeskWordAudio(source: string | undefined, fallbackText: string): void {
  if (!senseiDeskAudioEnabled()) return;
  if (!source) {
    speakFallback(fallbackText);
    return;
  }
  try {
    wordAudio?.pause();
    wordAudio = new Audio(source);
    wordAudio.volume = .8;
    void wordAudio.play().catch(() => speakFallback(fallbackText));
  } catch {
    speakFallback(fallbackText);
  }
}
