import { clamp01 } from '../audio/math';
import type { AudioFeatures } from '../types/audio';
import type { SpeechActivityFrame, SpeechState } from '../types/speech';

export class SpeechStateMachine {
  private previousState: SpeechState = 'idle';
  private lastSpeakingAt = -Infinity;

  update(features: AudioFeatures, micActive = true): SpeechActivityFrame {
    if (!micActive) {
      this.previousState = 'idle';
      return this.frame(features.timestamp, 'idle', 0, false, false, false, false);
    }

    const threshold = Math.max(features.noiseFloor * 3, 0.05);
    const voiceScore = clamp01((features.smoothedRms - threshold) / 0.18) * 0.7 + clamp01(features.midBand * 1.2) * 0.3;
    const speakingIntensity = clamp01(voiceScore);
    const speaking = features.smoothedRms > threshold && features.midBand > threshold * 0.45;
    const wasSpeaking = this.previousState === 'activeSpeech' || this.previousState === 'highEnergySpeech';
    const speechStart = speaking && !wasSpeaking;
    const speechEnd = !speaking && wasSpeaking;
    const highEnergy = speaking && (speakingIntensity > 0.8 || features.transient > 0.7 || features.smoothedRms > 0.28);

    if (speaking) {
      this.lastSpeakingAt = features.timestamp;
    }

    const lowAfterSpeech = !speaking && Number.isFinite(this.lastSpeakingAt);
    const silenceSinceSpeech = features.timestamp - this.lastSpeakingAt;
    const longPause = lowAfterSpeech && silenceSinceSpeech >= 1600;
    const state = this.resolveState(speaking, highEnergy, lowAfterSpeech, longPause);
    const confidence = speaking
      ? Math.max(0.1, speakingIntensity, clamp01(features.smoothedRms / 0.22), clamp01(features.midBand / 0.32))
      : longPause
        ? 0.35
        : 0.2;
    const possibleOverlap = speaking && (features.transient > 0.6 || features.rhythm > 0.65) && features.midBand > 0.12;

    this.previousState = state;
    return this.frame(features.timestamp, state, confidence, speechStart, speechEnd, longPause, possibleOverlap, speakingIntensity);
  }

  reset(): void {
    this.previousState = 'idle';
    this.lastSpeakingAt = -Infinity;
  }

  private resolveState(speaking: boolean, highEnergy: boolean, lowAfterSpeech: boolean, longPause: boolean): SpeechState {
    if (speaking) {
      return highEnergy ? 'highEnergySpeech' : 'activeSpeech';
    }

    if (lowAfterSpeech && !longPause) {
      return 'pauseAfterSpeech';
    }

    return 'listening';
  }

  private frame(
    timestamp: number,
    state: SpeechState,
    confidence: number,
    speechStart: boolean,
    speechEnd: boolean,
    longPause: boolean,
    possibleOverlap: boolean,
    speakingIntensity = 0,
  ): SpeechActivityFrame {
    return {
      timestamp,
      state,
      confidence: clamp01(confidence),
      speakingIntensity: clamp01(speakingIntensity),
      speechStart,
      speechEnd,
      longPause,
      possibleOverlap,
    };
  }
}