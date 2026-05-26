import { clamp01 } from '../audio/math';
import type { AudioFeatures } from '../types/audio';
import { rippleHeightRange } from './visualControlDefaults';

type TopographyRidgeInput = {
  frequencyRatio: number;
  rowIndex: number;
  rowRatio: number;
  lift: number;
  lineEnergy: number;
  audio: AudioFeatures;
  phaseOffset: number;
  heightScale?: number;
};

export const topographyRidgeHeight = ({ frequencyRatio, rowIndex, rowRatio, lift, phaseOffset, heightScale = rippleHeightRange.default }: TopographyRidgeInput): number => {
  const rowVariation = 0.72 + rowNoise(rowIndex, 0) * 0.28 + rowNoise(rowIndex, 3) * 0.14;
  const rowPeak = Math.max(0.34, rowVariation);
  const sustainedLevel = clamp01(lift * 1.08);
  const contourPhase = lift * (0.34 + rowRatio * 0.12);
  const fineContour = Math.sin((frequencyRatio * 7.4 + rowIndex * 0.071 + phaseOffset + contourPhase) * Math.PI * 2) * 0.042
    + Math.sin((frequencyRatio * 13.2 + rowIndex * 0.113 + rowNoise(rowIndex, 15) * 0.09 + contourPhase * 0.38) * Math.PI * 2) * 0.028;
  const rowContourOffset = rowNoise(rowIndex, 24) * lift * 0.14;
  const contour = Math.max(0.5, 0.84 + rowContourOffset + fineContour * Math.max(0.18, sustainedLevel));
  const audioPulse = Math.pow(Math.max(0, lift), 0.74) * rowPeak * contour;

  return audioPulse * (1.02 + sustainedLevel * 0.26) * (42 + rowRatio * 18 + sustainedLevel * 34) * Math.max(0.02, Math.min(1.2, heightScale));
};

const rowNoise = (rowIndex: number, salt: number): number => {
  const value = Math.sin((rowIndex + 1) * (12.9898 + salt) + salt * 78.233) * 43758.5453;

  return (value - Math.floor(value)) * 2 - 1;
};