import { clamp01, smoothValue } from '../audio/math';
import type { AudioFeatures } from '../types/audio';
import type { SpeechActivityFrame } from '../types/speech';
import type { SpeakerFrame } from '../types/speakers';
import { visualPlaneDimensions } from './VisualGeometry';
import { joyModelHeightScaleFor, rippleHeightRange } from './visualControlDefaults';

export type JoyFieldOptions = {
  rings: number;
  dotsPerRing: number;
  radius: number;
};

export type JoyPointState = {
  id: string;
  baseX: number;
  baseY: number;
  baseZ: number;
  frequencyRatio: number;
  x: number;
  y: number;
  z: number;
  ringIndex: number;
  depth: number;
  topographyLift: number;
  lineEnergy: number;
};

export type JoyFieldUpdate = {
  audio: AudioFeatures;
  speech: SpeechActivityFrame;
  speaker: SpeakerFrame;
};

export class JoyFieldModel {
  readonly dots: JoyPointState[];
  readonly rows: JoyPointState[][];
  readonly options: JoyFieldOptions;
  private readonly lineEnergies: number[];
  private readonly lineWasActive: boolean[];
  private readonly lineActiveCycleIndexes: number[];
  private readonly cycleTopographyTargets: number[];
  private readonly cycleDuration = 5200;
  private topographyHeightScale = joyModelHeightScaleFor(rippleHeightRange.default);
  private soundMemory = 0;
  private previousSoundPresence = 0;

  constructor(options: JoyFieldOptions) {
    this.options = options;
    this.dots = this.generatePoints(options);
    this.rows = this.groupRows(this.dots);
    this.lineEnergies = this.rows.map(() => 0);
    this.lineWasActive = this.rows.map(() => false);
    this.lineActiveCycleIndexes = this.rows.map(() => -1);
    this.cycleTopographyTargets = this.dots.map(() => 0);
  }

  setTopographyHeightScale(scale: number): void {
    this.topographyHeightScale = joyModelHeightScaleFor(scale);
  }

  update(frame: JoyFieldUpdate): void {
    const spectrumPresence = this.spectrumPresence(frame.audio.frequencyBins);
    const detailedPresence = Math.sqrt(spectrumPresence) * 0.24;
    const rawSoundPresence = clamp01(frame.audio.rms * 9 + frame.audio.transient * 0.55 + frame.audio.midBand * 1.2 + spectrumPresence * 1.8);
    const releaseEnergy = clamp01(this.previousSoundPresence - rawSoundPresence);
    const abruptRelease = releaseEnergy > 0.18 && rawSoundPresence < 0.12;
    const fadingRelease = releaseEnergy > 0.02 && rawSoundPresence >= 0.12;
    const memoryRate = rawSoundPresence > this.soundMemory ? 0.26 : abruptRelease ? 0.36 : fadingRelease ? 0.06 : 0.09;

    this.soundMemory = smoothValue(this.soundMemory, rawSoundPresence, memoryRate);

    const soundPresence = clamp01(rawSoundPresence * 0.62 + this.soundMemory * 0.38 + detailedPresence);
    const liveSoundPresence = clamp01(rawSoundPresence + detailedPresence);
    const heightLevel = clamp01(frame.audio.smoothedRms * 1.18 + frame.audio.rms * 0.42 + frame.speech.speakingIntensity * 0.1 + detailedPresence * 0.72);
    const liftReleaseRate = abruptRelease ? 0.08 : fadingRelease ? 0.048 : 0.055;
    const lineReleaseRate = abruptRelease ? 0.46 : fadingRelease ? 0.38 : 0.42;

    for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex += 1) {
      const row = this.rows[rowIndex];
      const lineActivation = this.lineActivationAt(frame.audio.timestamp, rowIndex, liveSoundPresence);
      const currentLineEnergy = this.lineEnergies[rowIndex] ?? 0;
      const lineTarget = clamp01(soundPresence * lineActivation);
      const lineRiseRate = 0.42 + frame.audio.transient * 0.08 + frame.audio.rhythm * 0.025;
      const lineEnergy = smoothValue(currentLineEnergy, lineTarget, lineTarget > currentLineEnergy ? lineRiseRate : lineReleaseRate);
      const lineActive = lineTarget > 0.04;
      const lineWasActive = this.lineWasActive[rowIndex] ?? false;
      const currentCycleIndex = Math.floor(frame.audio.timestamp / this.cycleDuration);
      const sameCycle = lineActive && lineWasActive && this.lineActiveCycleIndexes[rowIndex] === currentCycleIndex;

      this.lineEnergies[rowIndex] = lineEnergy;
      this.lineWasActive[rowIndex] = lineActive;
      if (lineActive) {
        this.lineActiveCycleIndexes[rowIndex] = currentCycleIndex;
      }

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const point = row[columnIndex];
        const pointIndex = rowIndex * row.length + columnIndex;
        const near = 1 - point.depth;
        const frequencyEnergy = this.frequencyEnergyAt(point.frequencyRatio, frame.audio);
        const lineLiftScale = (lineEnergy + detailedPresence * 0.8) * 1.56;
        const topographyHit = this.softLimit(frequencyEnergy * lineLiftScale * (0.72 + heightLevel * 0.92 + frame.audio.transient * 0.16) * (0.9 + near * 0.1) * this.topographyHeightScale);
        const cycleTopographyTarget = this.cycleTopographyTargetFor(pointIndex, topographyHit, lineEnergy, lineActive, sameCycle);
        const topographyRiseRate = 0.034 + lineEnergy * 0.15 + detailedPresence * 0.16 + frame.audio.transient * 0.012 + frame.audio.rhythm * 0.012;
        point.x = point.baseX;
        point.y = point.baseY;
        point.z = point.baseZ;
        point.topographyLift = this.easeTopographyLift(point.topographyLift, cycleTopographyTarget, topographyRiseRate, liftReleaseRate, lineEnergy, lineActive);
        point.lineEnergy = lineEnergy;
      }
    }

    this.previousSoundPresence = rawSoundPresence;
  }

  private generatePoints(options: JoyFieldOptions): JoyPointState[] {
    const points: JoyPointState[] = [];
    const rows = options.rings * 2 + 1;
    const columns = options.dotsPerRing * 2;
    const planeDimensions = visualPlaneDimensions(options.radius);

    for (let row = 0; row < rows; row += 1) {
      const rowRatio = rows === 1 ? 0 : row / (rows - 1);
      const baseY = (rowRatio - 0.5) * planeDimensions.height;
      const baseZ = (1 - rowRatio) * planeDimensions.depth;

      for (let column = 0; column < columns; column += 1) {
        const columnRatio = columns === 1 ? 0 : column / (columns - 1);
        const baseX = (columnRatio - 0.5) * planeDimensions.width;
        points.push({
          id: `${row}-${column}`,
          baseX,
          baseY,
          baseZ,
          frequencyRatio: columnRatio,
          x: baseX,
          y: baseY,
          z: baseZ,
          ringIndex: row,
          depth: 1 - rowRatio,
          topographyLift: 0,
          lineEnergy: 0,
        });
      }
    }

    return points;
  }

  private lineActivationAt(timestamp: number, rowIndex: number, soundPresence: number): number {
    if (soundPresence < 0.018) {
      return 0;
    }

    const focus = this.cycleFocusAt(timestamp, rowIndex);

    return focus < 0.01 ? 0 : this.smoothStep(0.01, 0.42, focus);
  }

  private cycleFocusAt(timestamp: number, rowIndex: number): number {
    const rowCount = this.rows.length;
    const focusPosition = ((timestamp % this.cycleDuration) / this.cycleDuration) * rowCount;
    const directDistance = Math.abs(rowIndex - focusPosition);
    const loopDistance = Math.min(directDistance, rowCount - directDistance);
    const focusRadius = 1.68;

    return loopDistance >= focusRadius ? 0 : Math.pow(1 - loopDistance / focusRadius, 2.15);
  }

  private frequencyEnergyAt(frequencyRatio: number, audio: AudioFeatures): number {
    const directRatio = clamp01(frequencyRatio);
    const bandWindow = this.topographyBandWindow(directRatio);
    const low = audio.lowBand * (this.bellCurve(directRatio, 0.22, 0.2) + this.bellCurve(directRatio, 0.38, 0.18) * 0.24);
    const mid = audio.midBand * this.bellCurve(directRatio, 0.5, 0.24);
    const high = audio.highBand * (this.bellCurve(directRatio, 0.82, 0.2) + this.bellCurve(directRatio, 0.68, 0.18) * 0.12);
    const brightness = audio.brightness * this.bellCurve(directRatio, 0.78, 0.22) * 0.18;
    const spectrum = this.spectrumEnergyAt(frequencyRatio, audio.frequencyBins);
    const broadEnergy = low + mid + high + brightness;
    const detailedSpectrum = spectrum * 1.72 + Math.sqrt(spectrum) * 7.4 + (spectrum > 0 ? Math.pow(spectrum, 0.22) * 0.085 : 0);
    const volumeScale = 0.54 + audio.smoothedRms * 0.78 + audio.transient * 0.2 + Math.sqrt(this.spectrumPresence(audio.frequencyBins)) * 0.34;
    const midLineEqualizer = 0.24 + this.bellCurve(directRatio, 0.58, 0.28) * 1.5 + this.bellCurve(directRatio, 0.68, 0.16) * 0.12;

    return this.softLimit(Math.pow((broadEnergy * 0.72 + detailedSpectrum) * volumeScale * midLineEqualizer, 1.42) * bandWindow);
  }

  private spectrumEnergyAt(frequencyRatio: number, bins: number[]): number {
    if (bins.length === 0) {
      return 0;
    }

    const averageEnergy = bins.reduce((sum, value) => sum + clamp01(value), 0) / bins.length;

    const position = clamp01(frequencyRatio) * (bins.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(bins.length - 1, lowerIndex + 1);
    const blend = position - lowerIndex;
    const lower = clamp01(bins[lowerIndex] ?? 0);
    const upper = clamp01(bins[upperIndex] ?? lower);
    const interpolated = lower + (upper - lower) * blend;
    const previous = clamp01(bins[Math.max(0, lowerIndex - 1)] ?? lower);
    const next = clamp01(bins[Math.min(bins.length - 1, upperIndex + 1)] ?? upper);
    const neighborhood = (previous + lower + upper + next) / 4;
    const localPeak = Math.max(0, interpolated - averageEnergy * 1.22);
    const localShoulder = Math.max(0, neighborhood - averageEnergy * 1.08);

    return clamp01(localPeak * 0.9 + localShoulder * 0.18);
  }

  private bellCurve(value: number, center: number, width: number): number {
    const distance = (value - center) / width;

    return Math.exp(-distance * distance);
  }

  private softLimit(value: number): number {
    return clamp01(1 - Math.exp(-Math.max(0, value)));
  }

  private topographyBandWindow(spectrumRatio: number): number {
    const directRatio = clamp01(spectrumRatio);
    const edgeDistance = Math.min(directRatio, 1 - directRatio);
    const edgeFade = this.smoothStep(0.1, 0.5, edgeDistance);
    const leftShift = 0.42 + this.smoothStep(0.16, 0.58, directRatio) * 0.58;

    return edgeFade * leftShift;
  }

  private spectrumPresence(bins: number[]): number {
    if (bins.length === 0) {
      return 0;
    }

    let maxEnergy = 0;
    let energySum = 0;

    for (const value of bins) {
      const energy = clamp01(value);

      maxEnergy = Math.max(maxEnergy, energy);
      energySum += energy;
    }

    return clamp01(maxEnergy * 0.84 + (energySum / bins.length) * 0.16);
  }

  private smoothStep(edge0: number, edge1: number, value: number): number {
    const amount = clamp01((value - edge0) / (edge1 - edge0));

    return amount * amount * (3 - 2 * amount);
  }

  private cycleTopographyTargetFor(pointIndex: number, target: number, lineEnergy: number, lineActive: boolean, sameCycle: boolean): number {
    if (!lineActive) {
      return this.cycleTopographyTargets[pointIndex] ?? 0;
    }

    if (!sameCycle) {
      this.cycleTopographyTargets[pointIndex] = target;

      return target;
    }

    const currentCycleTarget = this.cycleTopographyTargets[pointIndex] ?? 0;

    if (target > currentCycleTarget) {
      this.cycleTopographyTargets[pointIndex] = clamp01(currentCycleTarget + target * (0.14 + lineEnergy * 0.12));
    }

    return this.cycleTopographyTargets[pointIndex] ?? 0;
  }

  private easeTopographyLift(current: number, target: number, riseRate: number, releaseRate: number, lineEnergy: number, lineActive: boolean): number {
    if (!lineActive) {
      return current;
    }

    if (target > current) {
      return smoothValue(current, target, riseRate);
    }

    const rewriteRate = Math.min(0.3, Math.max(0.08, releaseRate * (1.35 + lineEnergy * 1.8)));

    return smoothValue(current, target, rewriteRate);
  }

  private groupRows(points: JoyPointState[]): JoyPointState[][] {
    const rows: JoyPointState[][] = [];

    for (const point of points) {
      rows[point.ringIndex] ??= [];
      rows[point.ringIndex].push(point);
    }

    return rows;
  }
}