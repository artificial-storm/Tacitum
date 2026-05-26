import { describe, expect, test } from 'vitest';
import { topographyRidgeHeight } from './TopographyRenderMath';
import type { AudioFeatures } from '../types/audio';

const makeAudio = (overrides: Partial<AudioFeatures> = {}): AudioFeatures => ({
  timestamp: 100,
  rms: 0.18,
  smoothedRms: 0.18,
  noiseFloor: 0.02,
  transient: 0.12,
  spectralCentroid: 0.48,
  brightness: 0.2,
  frequencyBins: Array.from({ length: 16 }, () => 0.05),
  lowBand: 0.08,
  midBand: 0.16,
  highBand: 0.08,
  rhythm: 0.2,
  roughPitch: null,
  voiceTexture: 0.2,
  ...overrides,
});

const quietAudio = makeAudio({
  smoothedRms: 0.02,
  transient: 0,
  brightness: 0.02,
  frequencyBins: Array.from({ length: 16 }, () => 0.01),
  lowBand: 0.01,
  midBand: 0.01,
  highBand: 0.01,
});

const brightAudio = makeAudio({
  smoothedRms: 0.58,
  transient: 0.82,
  brightness: 0.92,
  frequencyBins: Array.from({ length: 16 }, (_, index) => (index === 9 ? 0.94 : 0.12)),
  lowBand: 0.18,
  midBand: 0.78,
  highBand: 0.64,
});

describe('TopographyRenderMath', () => {
  test('keeps held inactive JOY rows still when live audio changes', () => {
    const heldQuiet = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0,
      audio: quietAudio,
      phaseOffset: 0,
    });
    const heldBright = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0,
      audio: brightAudio,
      phaseOffset: 0,
    });

    expect(heldBright).toBeCloseTo(heldQuiet, 6);
  });

  test('keeps active JOY rows from wobbling when live audio changes at the same held lift', () => {
    const activeQuiet = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0.54,
      audio: quietAudio,
      phaseOffset: 0,
    });
    const activeBright = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0.54,
      audio: brightAudio,
      phaseOffset: 0,
    });

    expect(activeBright).toBeCloseTo(activeQuiet, 6);
  });

  test('does not drop a held JOY peak when the cycle energy leaves the row', () => {
    const activePeak = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.68,
      lineEnergy: 0.56,
      audio: brightAudio,
      phaseOffset: 0,
    });
    const heldPeak = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.68,
      lineEnergy: 0,
      audio: brightAudio,
      phaseOffset: 0,
    });

    expect(heldPeak).toBeGreaterThan(activePeak * 0.98);
  });

  test('keeps default JOY rendered ridge height restrained', () => {
    const height = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0.54,
      audio: brightAudio,
      phaseOffset: 0,
    });

    expect(height).toBeLessThan(18);
  });

  test('scales held JOY rendered height directly from the Lift control', () => {
    const lowLiftHeight = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0,
      audio: brightAudio,
      phaseOffset: 0,
      heightScale: 0.02,
    } as any);
    const highLiftHeight = topographyRidgeHeight({
      frequencyRatio: 0.48,
      rowIndex: 8,
      rowRatio: 0.5,
      lift: 0.58,
      lineEnergy: 0,
      audio: brightAudio,
      phaseOffset: 0,
      heightScale: 1.2,
    } as any);

    expect(lowLiftHeight).toBeLessThan(2);
    expect(highLiftHeight).toBeGreaterThan(lowLiftHeight * 8);
  });
});