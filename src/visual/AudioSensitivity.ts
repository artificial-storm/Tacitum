import { clamp01 } from '../audio/math';
import type { ListeningCoreFrame } from './ListeningCoreRenderer';

export const applyVisualSensitivity = (frame: ListeningCoreFrame, sensitivity: number): ListeningCoreFrame => {
  const clampedSensitivity = Math.min(5, Math.max(0.45, sensitivity));

  return {
    ...frame,
    audio: {
      ...frame.audio,
      rms: expandQuietValue(frame.audio.rms, clampedSensitivity),
      smoothedRms: expandQuietValue(frame.audio.smoothedRms, clampedSensitivity),
      transient: clamp01(expandQuietValue(frame.audio.transient, clampedSensitivity) * (0.86 + clampedSensitivity * 0.16)),
      brightness: expandQuietValue(frame.audio.brightness, clampedSensitivity),
      frequencyBins: frame.audio.frequencyBins.map((value) => expandQuietValue(value, clampedSensitivity)),
      lowBand: expandQuietValue(frame.audio.lowBand, clampedSensitivity),
      midBand: expandQuietValue(frame.audio.midBand, clampedSensitivity),
      highBand: expandQuietValue(frame.audio.highBand, clampedSensitivity),
      rhythm: clamp01(frame.audio.rhythm * (0.82 + clampedSensitivity * 0.22)),
      voiceTexture: expandQuietValue(frame.audio.voiceTexture, clampedSensitivity),
    },
    speech: {
      ...frame.speech,
      speakingIntensity: expandQuietValue(frame.speech.speakingIntensity, clampedSensitivity),
      confidence: clamp01(frame.speech.confidence * (0.9 + clampedSensitivity * 0.12)),
    },
  };
};

const expandQuietValue = (value: number, sensitivity: number): number => {
  const normalized = clamp01(value);

  if (normalized === 0) {
    return 0;
  }

  const quietLift = Math.max(0, sensitivity - 1) / 4;
  const drive = 7 + sensitivity * 3.2 + quietLift * 9;
  const compressed = 1 - Math.exp(-normalized * drive);
  const peakCeiling = 0.96 - quietLift * 0.02;

  return Math.min(peakCeiling, compressed);
};