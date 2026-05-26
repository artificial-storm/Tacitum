import type { SpeakerState } from '../types/speakers';
import { speakerIds, speakerVisualSignatures } from './visualSignatures';

export const createDefaultSpeakers = (): SpeakerState[] => {
  return speakerIds.map((speakerId, index) => ({
    speakerId,
    speakerLabel: `Speaker ${String.fromCharCode(65 + index)}`,
    confidence: 0,
    voiceEnergy: 0,
    speaking: false,
    overlap: false,
    lastSpokeAt: 0,
    speakerColor: speakerVisualSignatures[speakerId].accent,
    visualSignature: speakerVisualSignatures[speakerId],
  }));
};