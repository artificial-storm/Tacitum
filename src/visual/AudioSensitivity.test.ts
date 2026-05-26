import { describe, expect, test } from 'vitest';
import { silentAudioFeatures } from '../types/audio';
import { idleSpeechFrame } from '../types/speech';
import { sensitivityRange } from './visualControlDefaults';
import { applyVisualSensitivity } from './AudioSensitivity';
import type { ListeningCoreFrame } from './ListeningCoreRenderer';

const makeFrame = (overrides: Partial<ListeningCoreFrame['audio']> = {}): ListeningCoreFrame => ({
  audio: {
    timestamp: 100,
    rms: 0.004,
    smoothedRms: 0.004,
    noiseFloor: 0.008,
    transient: 0.012,
    spectralCentroid: 0.34,
    brightness: 0.01,
    frequencyBins: Array.from({ length: 32 }, () => 0.005),
    lowBand: 0.006,
    midBand: 0.007,
    highBand: 0.005,
    rhythm: 0,
    roughPitch: null,
    voiceTexture: 0.01,
    ...overrides,
  },
  speech: idleSpeechFrame(overrides.timestamp ?? 100),
  speaker: {
    timestamp: overrides.timestamp ?? 100,
    activeSpeakerId: null,
    overlap: false,
    speakers: [],
  },
});

describe('applyVisualSensitivity', () => {
  test('expands quiet nonzero audio so low sounds can drive both visuals', () => {
    const quiet = makeFrame();
    const boosted = applyVisualSensitivity(quiet, 3.2);

    expect(boosted.audio.rms).toBeGreaterThan(quiet.audio.rms * 12);
    expect(boosted.audio.midBand).toBeGreaterThan(quiet.audio.midBand * 10);
    expect(boosted.audio.transient).toBeGreaterThan(quiet.audio.transient * 2);
    expect(boosted.audio.rms).toBeLessThan(0.1);
  });

  test('compresses conversationally quiet input into visible visual energy', () => {
    const quietSpeech = makeFrame({
      rms: 0.0025,
      smoothedRms: 0.0025,
      transient: 0.004,
      lowBand: 0.002,
      midBand: 0.003,
      highBand: 0.002,
      frequencyBins: Array.from({ length: 32 }, () => 0.002),
    });
    const boosted = applyVisualSensitivity(quietSpeech, sensitivityRange.default);

    expect(boosted.audio.rms).toBeGreaterThan(0.045);
    expect(boosted.audio.midBand).toBeGreaterThan(0.05);
    expect(boosted.audio.frequencyBins[0]).toBeGreaterThan(0.035);
  });

  test('soft-compresses loud input below the hard ceiling', () => {
    const loud = makeFrame({
      rms: 0.62,
      smoothedRms: 0.58,
      transient: 0.82,
      lowBand: 0.74,
      midBand: 0.88,
      highBand: 0.68,
      brightness: 0.9,
      frequencyBins: Array.from({ length: 32 }, () => 0.8),
    });
    const boosted = applyVisualSensitivity(loud, sensitivityRange.max);

    expect(boosted.audio.rms).toBeLessThanOrEqual(0.96);
    expect(boosted.audio.midBand).toBeLessThanOrEqual(0.96);
    expect(boosted.audio.transient).toBeLessThanOrEqual(1);
  });

  test('allows sensitivity above the previous ceiling for very quiet input', () => {
    const quiet = makeFrame();
    const boosted = applyVisualSensitivity(quiet, 5);

    expect(boosted.audio.rms).toBeGreaterThan(applyVisualSensitivity(quiet, 3.2).audio.rms * 1.15);
    expect(boosted.audio.midBand).toBeGreaterThan(applyVisualSensitivity(quiet, 3.2).audio.midBand * 1.15);
  });

  test('does not invent audio from silence', () => {
    const silent = makeFrame(silentAudioFeatures(100));
    const boosted = applyVisualSensitivity(silent, 3.2);

    expect(boosted.audio.rms).toBe(0);
    expect(boosted.audio.smoothedRms).toBe(0);
    expect(boosted.audio.frequencyBins.every((value) => value === 0)).toBe(true);
  });
});