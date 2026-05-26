import type { AudioFeatures } from './audio';
import type { SpeechActivityFrame } from './speech';
import type { SpeakerFrame } from './speakers';

export type TranscriptEvent = {
  id: string;
  speakerId: string | null;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isFinal: boolean;
  keywords?: string[];
  intent?: 'question' | 'decision' | 'actionItem' | 'topicShift' | 'unknown';
};

export type ConversationSignal = {
  timestamp: number;
  type: 'turnStart' | 'turnEnd' | 'interruption' | 'energyShift' | 'quietParticipant' | 'summaryMoment';
  speakerId?: string;
  confidence: number;
  payload?: Record<string, unknown>;
};

export type IntelligenceFrame = {
  audio: AudioFeatures;
  speech: SpeechActivityFrame;
  speakers: SpeakerFrame;
  transcriptEvents: TranscriptEvent[];
  conversationSignals: ConversationSignal[];
};