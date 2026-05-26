export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export const smoothValue = (current: number, target: number, factor: number): number => {
  return lerp(current, target, clamp01(factor));
};

export const computeRms = (samples: ArrayLike<number>): number => {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }

  return Math.sqrt(sum / samples.length);
};

export const bandEnergy = (bins: Uint8Array, startIndex: number, endIndex: number): number => {
  const start = Math.max(0, Math.min(bins.length, Math.floor(startIndex)));
  const end = Math.max(start + 1, Math.min(bins.length, Math.ceil(endIndex)));
  let sum = 0;

  for (let index = start; index < end; index += 1) {
    sum += bins[index];
  }

  return clamp01(sum / ((end - start) * 255));
};

export const spectralCentroid = (bins: Uint8Array): number => {
  if (bins.length <= 1) {
    return 0;
  }

  let weighted = 0;
  let magnitude = 0;

  for (let index = 0; index < bins.length; index += 1) {
    weighted += index * bins[index];
    magnitude += bins[index];
  }

  if (magnitude === 0) {
    return 0;
  }

  return clamp01(weighted / magnitude / (bins.length - 1));
};

export const transientScore = (currentEnergy: number, previousEnergy: number): number => {
  return clamp01((currentEnergy - previousEnergy) * 1.25);
};

export const zeroCrossingPitchProxy = (samples: Float32Array, sampleRate: number): number | null => {
  let crossings = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const crossed = (samples[index - 1] < 0 && samples[index] >= 0) || (samples[index - 1] > 0 && samples[index] <= 0);
    if (crossed) {
      crossings += 1;
    }
  }

  if (crossings < 2) {
    return null;
  }

  const seconds = samples.length / sampleRate;
  const hz = crossings / 2 / seconds;

  if (hz < 70 || hz > 450) {
    return null;
  }

  return hz;
};