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
  test('uses max Sens by default', () => {
    expect(sensitivityRange.default).toBe(sensitivityRange.max);
  });

  test('uses a stronger DOT Lift default', () => {
    expect(rippleHeightRange.default).toBe(0.2);
  });

  test('keeps separate Lift defaults for DOT and JOY', () => {
    expect(visualModeLiftDefaults.depthPlane).toBe(0.2);
    expect(visualModeLiftDefaults.topography).toBe(0.16);
  });

  test('uses a slower DOT speed default', () => {
    expect(rippleSpeedRange.default).toBe(0.7);
  });

  test('uses a moderate DOT overlap delay by default', () => {
    expect(overlapDelayRange.default).toBe(920);
  });

  test('keeps tail damping neutral by default', () => {
    expect(tailDampingRange.default).toBe(1);
  });
});