import type { AudioFeatures } from '../types/audio';
import { bandEnergy, clamp01, computeRms, smoothValue, spectralCentroid, transientScore, zeroCrossingPitchProxy } from './math';

type EnergySample = {
  timestamp: number;
  value: number;
};

export class AudioAnalyzer {
  private readonly analyser: AnalyserNode;
  private readonly timeData: Float32Array<ArrayBuffer>;
  private readonly frequencyData: Uint8Array<ArrayBuffer>;
  private smoothedRms = 0;
  private previousEnergy = 0;
  private rhythm = 0;
  private history: EnergySample[] = [];

  constructor(
    private readonly audioContext: AudioContext,
    sourceNode: MediaStreamAudioSourceNode,
  ) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.62;
    this.timeData = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    sourceNode.connect(this.analyser);
  }

  getFeatures(timestamp = performance.now()): AudioFeatures {
    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    const rms = clamp01(computeRms(this.timeData));
    this.smoothedRms = smoothValue(this.smoothedRms, rms, 0.18);
    const lowBand = bandEnergy(this.frequencyData, 2, Math.floor(this.frequencyData.length * 0.08));
    const midBand = bandEnergy(this.frequencyData, Math.floor(this.frequencyData.length * 0.08), Math.floor(this.frequencyData.length * 0.32));
    const highBand = bandEnergy(this.frequencyData, Math.floor(this.frequencyData.length * 0.32), Math.floor(this.frequencyData.length * 0.68));
    const centroid = spectralCentroid(this.frequencyData);
    const brightness = clamp01(centroid * 0.9 + highBand * 0.45);
    const transient = transientScore(this.smoothedRms + midBand * 0.25, this.previousEnergy);
    const frequencyBins = this.frequencyProfile();

    this.previousEnergy = this.smoothedRms + midBand * 0.25;
    this.rhythm = smoothValue(this.rhythm, transient > 0.12 ? 1 : 0, transient > 0.12 ? 0.16 : 0.04);
    this.recordHistory(timestamp, this.smoothedRms);

    return {
      timestamp,
      rms,
      smoothedRms: this.smoothedRms,
      noiseFloor: this.noiseFloor(),
      transient,
      spectralCentroid: centroid,
      brightness,
      frequencyBins,
      lowBand,
      midBand,
      highBand,
      rhythm: this.rhythm,
      roughPitch: zeroCrossingPitchProxy(this.timeData, this.audioContext.sampleRate),
      voiceTexture: clamp01(Math.abs(midBand - highBand) + transient * 0.35),
    };
  }

  dispose(): void {
    this.analyser.disconnect();
  }

  private recordHistory(timestamp: number, value: number): void {
    this.history.push({ timestamp, value });
    this.history = this.history.filter((sample) => timestamp - sample.timestamp <= 5000);
  }

  private noiseFloor(): number {
    if (this.history.length < 4) {
      return 0.02;
    }

    const sorted = [...this.history].sort((left, right) => left.value - right.value);
    const lowIndex = Math.floor(sorted.length * 0.18);
    return Math.max(0.008, sorted[lowIndex]?.value ?? 0.02);
  }

  private frequencyProfile(): number[] {
    const binCount = 32;
    const minBin = 2;
    const maxBin = Math.max(minBin + binCount, Math.floor(this.frequencyData.length * 0.72));

    return Array.from({ length: binCount }, (_, index) => {
      const startRatio = index / binCount;
      const endRatio = (index + 1) / binCount;
      const start = minBin + Math.pow(startRatio, 1.45) * (maxBin - minBin);
      const end = minBin + Math.pow(endRatio, 1.45) * (maxBin - minBin);

      return bandEnergy(this.frequencyData, start, Math.max(start + 1, end));
    });
  }
}