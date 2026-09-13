import { deviceStorage } from './storage';

const AUDIO_KEY = 'kaishi-kotoba-checkpoint-audio-enabled';
const TRACK = 'media/kotoba-checkpoint/terminal-ambience.ogg';
const EFFECTS = { stamp: 'media/kotoba-checkpoint/stamp.wav', clear: 'media/kotoba-checkpoint/clear.mp3' } as const;
let ambience: HTMLAudioElement | null = null;

export function checkpointAudioEnabled(): boolean { return deviceStorage().getItem(AUDIO_KEY) !== 'off'; }
export function startCheckpointAmbience(): void {
  if (!checkpointAudioEnabled()) return;
  if (!ambience) { ambience = new Audio(TRACK); ambience.loop = true; ambience.volume = .16; }
  void ambience.play().catch(() => undefined);
}
export function stopCheckpointAmbience(): void { ambience?.pause(); if (ambience) ambience.currentTime = 0; ambience = null; }
export function playCheckpointEffect(effect: keyof typeof EFFECTS): void { if (checkpointAudioEnabled()) { const sound = new Audio(EFFECTS[effect]); sound.volume = effect === 'stamp' ? .42 : .3; void sound.play().catch(() => undefined); } }
export function playCheckpointAudio(text: string): void {
  if (!checkpointAudioEnabled() || !text || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .82; window.speechSynthesis.speak(utterance);
}
