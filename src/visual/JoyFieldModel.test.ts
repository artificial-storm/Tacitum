import { describe, expect, test } from 'vitest';
import { JoyFieldModel } from './JoyFieldModel';
import type { JoyFieldUpdate } from './JoyFieldModel';

const makeFrame = (overrides: Partial<JoyFieldUpdate['audio']> = {}, speechOverrides: Partial<JoyFieldUpdate['speech']> = {}): JoyFieldUpdate => ({
  audio: {
    timestamp: 100,
    rms: 0.3,
    smoothedRms: 0.3,
    noiseFloor: 0.02,
    transient: 0.5,
    spectralCentroid: 0.4,
    brightness: 0.7,
    frequencyBins: Array.from({ length: 16 }, () => 0),
    lowBand: 0.2,
    midBand: 0.4,
    highBand: 0.2,
    rhythm: 0.5,
    roughPitch: null,
    voiceTexture: 0.4,
    ...overrides,
  },
  speech: {
    timestamp: overrides.timestamp ?? 100,
    state: 'activeSpeech',
    confidence: 0.8,
    speakingIntensity: 0.8,
    speechStart: true,
    speechEnd: false,
    longPause: false,
    possibleOverlap: false,
    ...speechOverrides,
  },
  speaker: {
    timestamp: overrides.timestamp ?? 100,
    activeSpeakerId: 'speaker-a',
    overlap: false,
    speakers: [],
  },
});

const loudJoyFrame = (timestamp: number): JoyFieldUpdate => makeFrame({
  timestamp,
  rms: 0.36,
  smoothedRms: 0.34,
  transient: 0.42,
  lowBand: 0.18,
  midBand: 0.72,
  highBand: 0.24,
  brightness: 0.42,
}, { speechStart: false });

describe('JoyFieldModel', () => {
  test('keeps JOY separate from DOT ripple state', () => {
    const model = new JoyFieldModel({ rings: 4, dotsPerRing: 10, radius: 80 });

    model.update(makeFrame({ rms: 0.34, smoothedRms: 0.32, transient: 0.5 }));

    expect('ripples' in model).toBe(false);
    expect(Math.max(...model.dots.map((dot) => dot.topographyLift))).toBeGreaterThan(0);
  });

  test('transforms only the rows under the current JOY cycle', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 10, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(1000 + index * 80));
    }

    const lineEnergies = model.rows.map((row) => row[0]?.lineEnergy ?? 0);
    const activeRows = lineEnergies.filter((energy) => energy > 0.12).length;
    const quietRows = lineEnergies.filter((energy) => energy < 0.05).length;

    expect(activeRows).toBeGreaterThan(0);
    expect(activeRows).toBeLessThanOrEqual(4);
    expect(quietRows).toBeGreaterThanOrEqual(3);
  });

  test('limits the full JOY cycle band to three or four lines', () => {
    const model = new JoyFieldModel({ rings: 16, dotsPerRing: 10, radius: 80 });

    for (let index = 0; index < 10; index += 1) {
      model.update(loudJoyFrame(1800 + index * 48));
    }

    const lineEnergies = model.rows.map((row) => row[0]?.lineEnergy ?? 0);
    const activeRows = lineEnergies.filter((energy) => energy > 0.11).length;

    expect(activeRows).toBeGreaterThan(0);
    expect(activeRows).toBeLessThanOrEqual(4);
  });

  test('keeps JOY ridges elevated long after the cycle has moved on', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const rememberedRowIndex = model.rows
      .map((row) => Math.max(...row.map((dot) => dot.topographyLift)))
      .reduce((strongestIndex, lift, index, lifts) => (lift > lifts[strongestIndex] ? index : strongestIndex), 0);
    const beforeCycleMoves = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    for (let index = 0; index < 34; index += 1) {
      model.update(loudJoyFrame(1300 + index * 70));
    }

    const afterCycleMoves = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    expect(afterCycleMoves).toBeGreaterThan(beforeCycleMoves * 0.72);
  });

  test('does not let JOY ridges collapse during a long release', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const rememberedRowIndex = model.rows
      .map((row) => Math.max(...row.map((dot) => dot.topographyLift)))
      .reduce((strongestIndex, lift, index, lifts) => (lift > lifts[strongestIndex] ? index : strongestIndex), 0);
    const beforeRelease = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    for (let index = 1; index <= 180; index += 1) {
      model.update(makeFrame({
        timestamp: 480 + index * 16,
        rms: 0,
        smoothedRms: 0.01,
        transient: 0,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
      }, {
        state: 'idle',
        speakingIntensity: 0,
        speechStart: false,
      }));
    }

    const afterRelease = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    expect(afterRelease).toBeGreaterThan(beforeRelease * 0.48);
  });

  test('keeps same-cycle JOY ridge peaks when the active hit weakens', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const strongestDot = model.dots.reduce((strongest, dot) => (dot.topographyLift > strongest.topographyLift ? dot : strongest), model.dots[0]);
    const beforeWeakHit = strongestDot.topographyLift;

    model.update(makeFrame({
      timestamp: 520,
      rms: 0.08,
      smoothedRms: 0.08,
      transient: 0.02,
      lowBand: 0.03,
      midBand: 0.08,
      highBand: 0.03,
      brightness: 0.05,
    }, {
      speakingIntensity: 0.08,
      speechStart: false,
    }));

    expect(strongestDot.topographyLift).toBeGreaterThanOrEqual(beforeWeakHit * 0.99);
  });

  test('keeps JOY peak lift locked when the cycle leaves on the next frames', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const strongestDot = model.dots.reduce((strongest, dot) => (dot.topographyLift > strongest.topographyLift ? dot : strongest), model.dots[0]);
    const peak = strongestDot.topographyLift;

    for (let index = 0; index < 24; index += 1) {
      model.update(loudJoyFrame(1900 + index * 48));
    }

    expect(strongestDot.topographyLift).toBeGreaterThanOrEqual(peak * 0.94);
  });

  test('rewrites a held JOY row downward gradually when the returning cycle is lower', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const rememberedRowIndex = model.rows
      .map((row) => Math.max(...row.map((dot) => dot.topographyLift)))
      .reduce((strongestIndex, lift, index, lifts) => (lift > lifts[strongestIndex] ? index : strongestIndex), 0);

    for (let index = 1; index <= 80; index += 1) {
      model.update(makeFrame({
        timestamp: 520 + index * 24,
        rms: 0,
        smoothedRms: 0.01,
        transient: 0,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
      }, {
        state: 'idle',
        speakingIntensity: 0,
        speechStart: false,
      }));
    }

    const heldBeforeReturn = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));
    const returnTimestamp = 5200 + (rememberedRowIndex / model.rows.length) * 5200;

    model.update(makeFrame({
      timestamp: returnTimestamp,
      rms: 0.08,
      smoothedRms: 0.08,
      transient: 0.025,
      lowBand: 0.025,
      midBand: 0.055,
      highBand: 0.025,
      brightness: 0.04,
    }, {
      speakingIntensity: 0.06,
      speechStart: false,
    }));

    const firstReturn = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    for (let index = 1; index <= 28; index += 1) {
      model.update(makeFrame({
        timestamp: returnTimestamp + index * 48,
        rms: 0.08,
        smoothedRms: 0.08,
        transient: 0.015,
        lowBand: 0.025,
        midBand: 0.055,
        highBand: 0.025,
        brightness: 0.04,
      }, {
        speakingIntensity: 0.06,
        speechStart: false,
      }));
    }

    const afterEase = Math.max(...model.rows[rememberedRowIndex].map((dot) => dot.topographyLift));

    expect(firstReturn).toBeGreaterThan(heldBeforeReturn * 0.88);
    expect(afterEase).toBeLessThan(firstReturn * 0.92);
    expect(afterEase).toBeGreaterThan(heldBeforeReturn * 0.18);
  });

  test('lets the JOY cycle feed every line over a full pass', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 10, radius: 80 });
    const strongestByRow = model.rows.map(() => 0);

    for (let index = 0; index <= 56; index += 1) {
      model.update(loudJoyFrame(index * 110));

      for (let rowIndex = 0; rowIndex < model.rows.length; rowIndex += 1) {
        strongestByRow[rowIndex] = Math.max(strongestByRow[rowIndex], model.rows[rowIndex][0]?.lineEnergy ?? 0);
      }
    }

    expect(Math.min(...strongestByRow)).toBeGreaterThan(0.18);
  });

  test('keeps JOY baseline fixed when volume rises', () => {
    const quiet = new JoyFieldModel({ rings: 4, dotsPerRing: 10, radius: 80 });
    const loud = new JoyFieldModel({ rings: 4, dotsPerRing: 10, radius: 80 });

    quiet.update(makeFrame({ rms: 0.02, smoothedRms: 0.02, lowBand: 0.06, midBand: 0.1, highBand: 0.04 }, { speakingIntensity: 0.1 }));
    loud.update(makeFrame({ rms: 0.42, smoothedRms: 0.42, lowBand: 0.06, midBand: 0.1, highBand: 0.04 }, { speakingIntensity: 0.7 }));

    expect(loud.dots.every((dot, index) => dot.y === quiet.dots[index].y)).toBe(true);
  });

  test('keeps JOY model lift controlled while Lift changes visual height', () => {
    const lowLift = new JoyFieldModel({ rings: 5, dotsPerRing: 14, radius: 80 });
    const highLift = new JoyFieldModel({ rings: 5, dotsPerRing: 14, radius: 80 });

    lowLift.setTopographyHeightScale(0.02);
    highLift.setTopographyHeightScale(1.2);

    for (let index = 0; index < 6; index += 1) {
      const timestamp = 100 + index * 56;

      lowLift.update(loudJoyFrame(timestamp));
      highLift.update(loudJoyFrame(timestamp));
    }

    const lowMax = Math.max(...lowLift.dots.map((dot) => dot.topographyLift));
    const highMax = Math.max(...highLift.dots.map((dot) => dot.topographyLift));

    expect(highMax).toBeGreaterThan(lowMax * 1.1);
    expect(highMax).toBeLessThan(lowMax * 1.6);
  });

  test('holds JOY curves exactly when the cycle leaves instead of bouncing back down', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 12, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      model.update(loudJoyFrame(index * 60));
    }

    const heldShape = model.dots.map((dot) => dot.topographyLift);

    for (let index = 1; index <= 80; index += 1) {
      model.update(makeFrame({
        timestamp: 520 + index * 24,
        rms: 0,
        smoothedRms: 0,
        transient: 0,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins: Array.from({ length: 16 }, () => 0),
      }, {
        state: 'idle',
        speakingIntensity: 0,
        speechStart: false,
      }));
    }

    const afterCycleLeaves = model.dots.map((dot) => dot.topographyLift);

    expect(Math.max(...afterCycleLeaves.map((lift, index) => Math.abs(lift - heldShape[index])))).toBeLessThan(0.00001);
  });

  test('rewrites a held JOY curve to the returning frequency shape instead of adding on top', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 20, radius: 80 });
    const lowBins = Array.from({ length: 32 }, () => 0.002);
    const highBins = Array.from({ length: 32 }, () => 0.002);

    lowBins[7] = 0.86;
    highBins[24] = 0.86;

    for (let index = 0; index < 10; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.28,
        smoothedRms: 0.26,
        transient: 0.18,
        spectralCentroid: 0.24,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins: lowBins,
      }, { speechStart: false }));
    }

    const rememberedRowIndex = model.rows
      .map((row) => Math.max(...row.map((dot) => dot.topographyLift)))
      .reduce((strongestIndex, lift, index, lifts) => (lift > lifts[strongestIndex] ? index : strongestIndex), 0);
    const returnTimestamp = 5200 + (rememberedRowIndex / model.rows.length) * 5200;
    const lowBefore = Math.max(...model.rows[rememberedRowIndex].filter((dot) => dot.frequencyRatio < 0.34).map((dot) => dot.topographyLift));

    for (let index = 0; index < 18; index += 1) {
      model.update(makeFrame({
        timestamp: returnTimestamp + index * 48,
        rms: 0.28,
        smoothedRms: 0.26,
        transient: 0.08,
        spectralCentroid: 0.76,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins: highBins,
      }, { speechStart: false }));
    }

    const lowAfter = Math.max(...model.rows[rememberedRowIndex].filter((dot) => dot.frequencyRatio < 0.34).map((dot) => dot.topographyLift));
    const highAfter = Math.max(...model.rows[rememberedRowIndex].filter((dot) => dot.frequencyRatio > 0.66).map((dot) => dot.topographyLift));

    expect(lowAfter).toBeLessThan(lowBefore * 0.72);
    expect(highAfter).toBeGreaterThan(lowAfter * 1.35);
  });

  test('adds new JOY input into the same active cycle without erasing earlier frequencies', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 20, radius: 80 });
    const lowBins = Array.from({ length: 32 }, () => 0.002);
    const highBins = Array.from({ length: 32 }, () => 0.002);

    lowBins[8] = 0.72;
    highBins[23] = 0.72;

    for (let index = 0; index < 5; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 42,
        rms: 0.22,
        smoothedRms: 0.2,
        transient: 0.12,
        spectralCentroid: 0.26,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins: lowBins,
      }, { speechStart: false }));
    }

    const activeRowIndex = model.rows
      .map((row) => Math.max(...row.map((dot) => dot.topographyLift)))
      .reduce((strongestIndex, lift, index, lifts) => (lift > lifts[strongestIndex] ? index : strongestIndex), 0);
    const lowBefore = Math.max(...model.rows[activeRowIndex].filter((dot) => dot.frequencyRatio < 0.36).map((dot) => dot.topographyLift));
    const highBefore = Math.max(...model.rows[activeRowIndex].filter((dot) => dot.frequencyRatio > 0.64).map((dot) => dot.topographyLift));

    for (let index = 0; index < 5; index += 1) {
      model.update(makeFrame({
        timestamp: 310 + index * 42,
        rms: 0.22,
        smoothedRms: 0.2,
        transient: 0.08,
        spectralCentroid: 0.74,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins: highBins,
      }, { speechStart: false }));
    }

    const lowAfter = Math.max(...model.rows[activeRowIndex].filter((dot) => dot.frequencyRatio < 0.36).map((dot) => dot.topographyLift));
    const highAfter = Math.max(...model.rows[activeRowIndex].filter((dot) => dot.frequencyRatio > 0.64).map((dot) => dot.topographyLift));

    expect(lowAfter).toBeGreaterThan(lowBefore * 0.9);
    expect(highAfter).toBeGreaterThan(highBefore + 0.05);
  });

  test('equalizes JOY broad-band input toward the middle of the lines', () => {
    const lowHeavy = new JoyFieldModel({ rings: 5, dotsPerRing: 20, radius: 80 });
    const midHeavy = new JoyFieldModel({ rings: 5, dotsPerRing: 20, radius: 80 });

    for (let index = 0; index < 8; index += 1) {
      const timestamp = 100 + index * 48;

      lowHeavy.update(makeFrame({ timestamp, rms: 0.24, smoothedRms: 0.22, transient: 0.12, lowBand: 0.72, midBand: 0.18, highBand: 0.08, brightness: 0.08 }, { speechStart: false }));
      midHeavy.update(makeFrame({ timestamp, rms: 0.24, smoothedRms: 0.22, transient: 0.12, lowBand: 0.18, midBand: 0.72, highBand: 0.18, brightness: 0.18 }, { speechStart: false }));
    }

    const centerLift = (model: JoyFieldModel): number => Math.max(...model.dots.filter((dot) => dot.frequencyRatio > 0.38 && dot.frequencyRatio < 0.62).map((dot) => dot.topographyLift));
    const lowSideLift = (model: JoyFieldModel): number => Math.max(...model.dots.filter((dot) => dot.frequencyRatio < 0.3).map((dot) => dot.topographyLift));

    expect(centerLift(lowHeavy)).toBeGreaterThan(lowSideLift(lowHeavy) * 0.82);
    expect(centerLift(midHeavy)).toBeGreaterThan(lowSideLift(midHeavy) * 1.3);
  });

  test('pushes low-heavy JOY energy toward the middle-right and away from the outer left edge', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 24, radius: 80 });
    const frequencyBins = Array.from({ length: 48 }, () => 0.22);

    for (let index = 0; index < 8; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.26,
        smoothedRms: 0.24,
        transient: 0.12,
        spectralCentroid: 0.34,
        lowBand: 0.82,
        midBand: 0.24,
        highBand: 0.08,
        brightness: 0.08,
        frequencyBins,
      }, { speechStart: false }));
    }

    const leftOuterLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio <= 0.18).map((dot) => dot.topographyLift));
    const leftShoulderLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio > 0.18 && dot.frequencyRatio < 0.34).map((dot) => dot.topographyLift));
    const centerRightLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio >= 0.48 && dot.frequencyRatio <= 0.74).map((dot) => dot.topographyLift));
    const farRightEdgeLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio >= 0.88).map((dot) => dot.topographyLift));

    expect(centerRightLift).toBeGreaterThan(leftShoulderLift * 1.08);
    expect(leftShoulderLift).toBeGreaterThan(leftOuterLift * 1.45);
    expect(farRightEdgeLift).toBeLessThan(centerRightLift * 0.22);
  });

  test('lets very soft detailed JOY frequency input make a visible ridge', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 14, radius: 80 });
    const frequencyBins = Array.from({ length: 32 }, () => 0.001);

    frequencyBins[12] = 0.018;

    for (let index = 0; index < 8; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.006,
        smoothedRms: 0.006,
        transient: 0.004,
        spectralCentroid: 0.38,
        lowBand: 0.004,
        midBand: 0.006,
        highBand: 0.004,
        brightness: 0.004,
        frequencyBins,
      }, {
        speakingIntensity: 0,
        speechStart: false,
        state: 'listening',
      }));
    }

    expect(Math.max(...model.dots.map((dot) => dot.topographyLift))).toBeGreaterThan(0.008);
  });

  test('maps JOY spectrum peaks to one side instead of mirrored twin mountains', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 20, radius: 80 });
    const frequencyBins = Array.from({ length: 32 }, () => 0.002);

    frequencyBins[24] = 0.86;

    for (let index = 0; index < 6; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 56,
        rms: 0.24,
        smoothedRms: 0.22,
        transient: 0.16,
        spectralCentroid: 0.78,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins,
      }, { speechStart: false }));
    }

    const highSideLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio > 0.66).map((dot) => dot.topographyLift));
    const mirroredLowLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio < 0.34).map((dot) => dot.topographyLift));

    expect(highSideLift).toBeGreaterThan(mirroredLowLift * 1.7);
  });

  test('keeps the outer ten percent of JOY lines pinned down', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 24, radius: 80 });
    const frequencyBins = Array.from({ length: 48 }, () => 0.28);

    for (let index = 0; index < 8; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.34,
        smoothedRms: 0.34,
        transient: 0.28,
        spectralCentroid: 0.5,
        lowBand: 0.42,
        midBand: 0.76,
        highBand: 0.42,
        brightness: 0.42,
        frequencyBins,
      }, { speechStart: false }));
    }

    const outerLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio <= 0.1 || dot.frequencyRatio >= 0.9).map((dot) => dot.topographyLift));
    const shoulderLift = Math.max(...model.dots.filter((dot) => (dot.frequencyRatio > 0.18 && dot.frequencyRatio < 0.3) || (dot.frequencyRatio > 0.7 && dot.frequencyRatio < 0.82)).map((dot) => dot.topographyLift));
    const centerLift = Math.max(...model.dots.filter((dot) => dot.frequencyRatio > 0.38 && dot.frequencyRatio < 0.62).map((dot) => dot.topographyLift));

    expect(outerLift).toBeLessThan(0.00001);
    expect(shoulderLift).toBeGreaterThan(outerLift + 0.01);
    expect(centerLift).toBeGreaterThan(shoulderLift * 1.08);
  });

  test('keeps JOY peaks selective instead of lifting the whole line uniformly', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 24, radius: 80 });
    const frequencyBins = Array.from({ length: 48 }, () => 0.004);

    frequencyBins[17] = 0.92;
    frequencyBins[29] = 0.68;

    for (let index = 0; index < 8; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.3,
        smoothedRms: 0.28,
        transient: 0.16,
        spectralCentroid: 0.42,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins,
      }, { speechStart: false }));
    }

    const activeRow = model.rows.reduce((strongest, row) => {
      const strongestLift = Math.max(...strongest.map((dot) => dot.topographyLift));
      const rowLift = Math.max(...row.map((dot) => dot.topographyLift));

      return rowLift > strongestLift ? row : strongest;
    }, model.rows[0]);
    const lifts = activeRow.map((dot) => dot.topographyLift);
    const maxLift = Math.max(...lifts);
    const medianLift = lifts.slice().sort((left, right) => left - right)[Math.floor(lifts.length / 2)];
    const highLiftCount = lifts.filter((lift) => lift > maxLift * 0.64).length;

    expect(maxLift).toBeGreaterThan(medianLift * 3.4);
    expect(highLiftCount).toBeLessThan(activeRow.length * 0.24);
  });

  test('keeps JOY side shoulders gradual and much lower than sharp peaks', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 24, radius: 80 });
    const frequencyBins = Array.from({ length: 48 }, () => 0.003);

    frequencyBins[21] = 0.95;
    frequencyBins[27] = 0.7;

    for (let index = 0; index < 9; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.32,
        smoothedRms: 0.3,
        transient: 0.18,
        spectralCentroid: 0.5,
        lowBand: 0.18,
        midBand: 0.34,
        highBand: 0.18,
        brightness: 0.12,
        frequencyBins,
      }, { speechStart: false }));
    }

    const activeRow = model.rows.reduce((strongest, row) => {
      const strongestLift = Math.max(...strongest.map((dot) => dot.topographyLift));
      const rowLift = Math.max(...row.map((dot) => dot.topographyLift));

      return rowLift > strongestLift ? row : strongest;
    }, model.rows[0]);
    const maxLift = Math.max(...activeRow.map((dot) => dot.topographyLift));
    const outerLift = Math.max(...activeRow.filter((dot) => dot.frequencyRatio <= 0.1 || dot.frequencyRatio >= 0.9).map((dot) => dot.topographyLift));
    const lowerShoulderLift = Math.max(...activeRow.filter((dot) => (dot.frequencyRatio > 0.1 && dot.frequencyRatio < 0.2) || (dot.frequencyRatio > 0.8 && dot.frequencyRatio < 0.9)).map((dot) => dot.topographyLift));
    const upperShoulderLift = Math.max(...activeRow.filter((dot) => (dot.frequencyRatio > 0.22 && dot.frequencyRatio < 0.3) || (dot.frequencyRatio > 0.7 && dot.frequencyRatio < 0.78)).map((dot) => dot.topographyLift));
    const highLiftCount = activeRow.filter((dot) => dot.topographyLift > maxLift * 0.64).length;

    expect(outerLift).toBeLessThan(0.00001);
    expect(lowerShoulderLift).toBeLessThan(upperShoulderLift * 0.72);
    expect(upperShoulderLift).toBeLessThan(maxLift * 0.34);
    expect(highLiftCount).toBeLessThan(activeRow.length * 0.18);
  });

  test('places JOY peaks by current frequency away from the absolute center', () => {
    const model = new JoyFieldModel({ rings: 5, dotsPerRing: 24, radius: 80 });
    const frequencyBins = Array.from({ length: 48 }, () => 0.004);

    frequencyBins[14] = 0.76;
    frequencyBins[33] = 0.94;

    for (let index = 0; index < 8; index += 1) {
      model.update(makeFrame({
        timestamp: 100 + index * 48,
        rms: 0.28,
        smoothedRms: 0.26,
        transient: 0.14,
        spectralCentroid: 0.68,
        lowBand: 0,
        midBand: 0,
        highBand: 0,
        brightness: 0,
        frequencyBins,
      }, { speechStart: false }));
    }

    const activeRow = model.rows.reduce((strongest, row) => {
      const strongestLift = Math.max(...strongest.map((dot) => dot.topographyLift));
      const rowLift = Math.max(...row.map((dot) => dot.topographyLift));

      return rowLift > strongestLift ? row : strongest;
    }, model.rows[0]);
    const strongestDot = activeRow.reduce((strongest, dot) => (dot.topographyLift > strongest.topographyLift ? dot : strongest), activeRow[0]);

    expect(strongestDot.frequencyRatio).toBeGreaterThan(0.58);
    expect(Math.abs(strongestDot.frequencyRatio - 0.5)).toBeGreaterThan(0.12);
  });

  test('keeps JOY rows rectangular in world space before camera rotation', () => {
    const model = new JoyFieldModel({ rings: 4, dotsPerRing: 10, radius: 80 });

    model.update(loudJoyFrame(100));

    const rowSpans = model.rows.map((row) => {
      const xPositions = row.map((point) => point.x);

      return Math.max(...xPositions) - Math.min(...xPositions);
    });

    expect(Math.min(...rowSpans)).toBeGreaterThan(Math.max(...rowSpans) * 0.99);
  });

  test('builds JOY on a square world-space plane', () => {
    const model = new JoyFieldModel({ rings: 4, dotsPerRing: 10, radius: 80 });
    const xSpan = Math.max(...model.dots.map((dot) => dot.baseX)) - Math.min(...model.dots.map((dot) => dot.baseX));
    const ySpan = Math.max(...model.dots.map((dot) => dot.baseY)) - Math.min(...model.dots.map((dot) => dot.baseY));
    const zSpan = Math.max(...model.dots.map((dot) => dot.baseZ)) - Math.min(...model.dots.map((dot) => dot.baseZ));

    expect(xSpan).toBeCloseTo(Math.hypot(ySpan, zSpan), 4);
  });
});