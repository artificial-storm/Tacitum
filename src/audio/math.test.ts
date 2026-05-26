import { describe, expect, test } from 'vitest';
import { bandEnergy, clamp01, computeRms, lerp, smoothValue, spectralCentroid, transientScore } from './math';

describe('audio math helpers', () => {
  test('computes RMS from normalized time samples', () => {
    expect(computeRms(new Float32Array([0, 1, -1, 0]))).toBeCloseTo(Math.sqrt(0.5), 5);
  });

  test('clamps values to normalized range', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.5)).toBe(1);
  });

  test('interpolates and smooths values', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(smoothValue(0.2, 1, 0.1)).toBeCloseTo(0.28, 5);
  });

  test('computes normalized band energy from byte bins', () => {
    const bins = new Uint8Array([0, 128, 255, 64]);

    expect(bandEnergy(bins, 1, 3)).toBeCloseTo((128 + 255) / (255 * 2), 5);
  });

  test('computes spectral centroid as a normalized bin position', () => {
    const bins = new Uint8Array([0, 0, 255, 0]);

    expect(spectralCentroid(bins)).toBeCloseTo(2 / 3, 5);
  });

  test('scores transients relative to prior smoothed energy', () => {
    expect(transientScore(0.8, 0.2)).toBeGreaterThan(0.5);
    expect(transientScore(0.2, 0.8)).toBe(0);
  });
});