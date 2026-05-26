import { describe, expect, test } from 'vitest';
import type { SpeechActivityFrame } from '../types/speech';
import { MockSpeakerEngine } from './MockSpeakerEngine';

const speech = (timestamp: number, intensity: number, overlap = false): SpeechActivityFrame => ({
  timestamp,
  state: intensity > 0.8 ? 'highEnergySpeech' : 'activeSpeech',
  confidence: intensity,
  speakingIntensity: intensity,
  speechStart: false,
  speechEnd: false,
  longPause: false,
  possibleOverlap: overlap,
});

describe('MockSpeakerEngine', () => {
  test('returns three anonymous speaker states', () => {
    const engine = new MockSpeakerEngine();
    const frame = engine.update(speech(0, 0.6), 'cycle', false);

    expect(frame.speakers).toHaveLength(3);
    expect(frame.activeSpeakerId).toBe('speaker-a');
  });

  test('follows selected speaker mode', () => {
    const engine = new MockSpeakerEngine();
    const frame = engine.update(speech(100, 0.7), 'speaker-c', false);

    expect(frame.activeSpeakerId).toBe('speaker-c');
    expect(frame.speakers.find((speaker) => speaker.speakerId === 'speaker-c')?.voiceEnergy).toBeGreaterThan(0.6);
  });

  test('can simulate overlap while preserving active speaker contract', () => {
    const engine = new MockSpeakerEngine();
    const frame = engine.update(speech(2400, 0.7, true), 'cycle', true);
    const speaking = frame.speakers.filter((speaker) => speaker.speaking);

    expect(frame.overlap).toBe(true);
    expect(speaking.length).toBeGreaterThanOrEqual(2);
  });
});