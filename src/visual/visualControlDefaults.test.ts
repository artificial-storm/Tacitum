import { describe, expect, test } from 'vitest';
import {
  overlapDelayRange,
  rippleHeightRange,
  rippleSpeedRange,
  sensitivityRange,
  tailDampingRange,
  visualModeLiftDefaults,
} from './visualControlDefaults';

describe('visual control defaults', () => {
  test('keeps Sens centered by default', () => {
    expect(sensitivityRange.default).toBeCloseTo((sensitivityRange.min + sensitivityRange.max) / 2, 6);
  });

  test('uses DOT-tuned Lift by default', () => {
    expect(rippleHeightRange.default).toBe(0.1);
  });

  test('keeps separate Lift defaults for DOT and JOY', () => {
    expect(visualModeLiftDefaults.depthPlane).toBe(0.1);
    expect(visualModeLiftDefaults.topography).toBe(0.16);
  });

  test('keeps DOT speed centered at the neutral default', () => {
    expect(rippleSpeedRange.default).toBe(1);
  });

  test('uses a moderate DOT overlap delay by default', () => {
    expect(overlapDelayRange.default).toBe(920);
  });

  test('keeps tail damping neutral by default', () => {
    expect(tailDampingRange.default).toBe(1);
  });
});