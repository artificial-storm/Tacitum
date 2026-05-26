export type SpeakerVisualSignature = {
  ringIndex: number;
  phaseOffset: number;
  rotationDirection: 1 | -1;
  dotDensity: number;
  pulseShape: 'round' | 'narrow' | 'double' | 'halo';
  strokeWeight: number;
  accent: string;
};

export type SpeakerState = {
  speakerId: string;
  speakerLabel: string;
  confidence: number;
  voiceEnergy: number;
  speaking: boolean;
  overlap: boolean;
  lastSpokeAt: number;
  speakerColor?: string;
  visualSignature: SpeakerVisualSignature;
  speakerEmbedding?: number[];
};

export type SpeakerFrame = {
  timestamp: number;
  activeSpeakerId: string | null;
  speakers: SpeakerState[];
  overlap: boolean;
};

export type SpeakerMode = 'cycle' | 'speaker-a' | 'speaker-b' | 'speaker-c';