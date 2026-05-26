export type SpeechState = 'idle' | 'listening' | 'activeSpeech' | 'pauseAfterSpeech' | 'highEnergySpeech';

export type SpeechActivityFrame = {
  timestamp: number;
  state: SpeechState;
  confidence: number;
  speakingIntensity: number;
  speechStart: boolean;
  speechEnd: boolean;
  longPause: boolean;
  possibleOverlap: boolean;
};

export const idleSpeechFrame = (timestamp: number): SpeechActivityFrame => ({
  timestamp,
  state: 'idle',
  confidence: 0,
  speakingIntensity: 0,
  speechStart: false,
  speechEnd: false,
  longPause: false,
  possibleOverlap: false,
});