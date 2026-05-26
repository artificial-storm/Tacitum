import type { SpeakerVisualSignature } from '../types/speakers';

export const speakerVisualSignatures: Record<string, SpeakerVisualSignature> = {
  'speaker-a': {
    ringIndex: 1,
    phaseOffset: 0,
    rotationDirection: 1,
    dotDensity: 1,
    pulseShape: 'round',
    strokeWeight: 1,
    accent: '#d8f7ff',
  },
  'speaker-b': {
    ringIndex: 2,
    phaseOffset: Math.PI * 0.42,
    rotationDirection: -1,
    dotDensity: 0.9,
    pulseShape: 'narrow',
    strokeWeight: 0.9,
    accent: '#f1ead0',
  },
  'speaker-c': {
    ringIndex: 3,
    phaseOffset: Math.PI * 0.78,
    rotationDirection: 1,
    dotDensity: 0.75,
    pulseShape: 'halo',
    strokeWeight: 0.8,
    accent: '#d9ddff',
  },
};

export const speakerIds = Object.keys(speakerVisualSignatures) as Array<keyof typeof speakerVisualSignatures>;