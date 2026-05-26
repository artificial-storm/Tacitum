export type AudioFeatures = {
  timestamp: number;
  rms: number;
  smoothedRms: number;
  noiseFloor: number;
  transient: number;
  spectralCentroid: number;
  brightness: number;
  frequencyBins: number[];
  lowBand: number;
  midBand: number;
  highBand: number;
  rhythm: number;
  roughPitch: number | null;
  voiceTexture: number;
};

export const silentAudioFeatures = (timestamp: number): AudioFeatures => ({
  timestamp,
  rms: 0,
  smoothedRms: 0,
  noiseFloor: 0.02,
  transient: 0,
  spectralCentroid: 0,
  brightness: 0,
  frequencyBins: Array.from({ length: 32 }, () => 0),
  lowBand: 0,
  midBand: 0,
  highBand: 0,
  rhythm: 0,
  roughPitch: null,
  voiceTexture: 0,
});