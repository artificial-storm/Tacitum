export const sensitivityRange = {
  min: 0.5,
  max: 5,
  step: 0.05,
  default: 2.75,
} as const;

export const rippleHeightRange = {
  min: 0.02,
  max: 1.2,
  step: 0.01,
  default: 0.1,
} as const;

export const rippleSpeedRange = {
  min: 0.45,
  max: 1.5,
  step: 0.01,
  default: 1,
} as const;

export const overlapDelayRange = {
  min: 400,
  max: 1400,
  step: 10,
  default: 920,
} as const;

export const tailDampingRange = {
  min: 0.55,
  max: 1.6,
  step: 0.01,
  default: 1,
} as const;

export const visualModeLiftDefaults = {
  depthPlane: 0.1,
  topography: 0.16,
} as const;

export const joyModelHeightScaleFor = (scale: number): number => {
  const normalizedScale = Math.max(rippleHeightRange.min, Math.min(rippleHeightRange.max, scale)) / visualModeLiftDefaults.topography;

  return Math.min(1.18, Math.max(0.62, 0.9 + Math.log1p(normalizedScale) * 0.1));
};