import { describe, expect, test } from 'vitest';
import type { AudioFeatures } from '../types/audio';
import { SpeechStateMachine } from './SpeechStateMachine';

const frame = (timestamp: number, rms: number, midBand = rms, transient = 0.05): AudioFeatures => ({
  timestamp,
  rms,
  smoothedRms: rms,
  noiseFloor: 0.02,
  transient,
  spectralCentroid: 0.35,
  brightness: 0.35,
  frequencyBins: Array.from({ length: 16 }, () => 0),
  lowBand: rms * 0.5,
  midBand,
  highBand: rms * 0.25,
  rhythm: 0.2,
  roughPitch: null,
  voiceTexture: 0.3,
});

describe('SpeechStateMachine', () => {
  test('moves from listening to active speech with a speech start event', () => {
    const machine = new SpeechStateMachine();
    machine.update(frame(0, 0.01));

    const speech = machine.update(frame(120, 0.14, 0.18));

    expect(speech.state).toBe('activeSpeech');
    expect(speech.speechStart).toBe(true);
    expect(speech.confidence).toBeGreaterThan(0.5);
  });

  test('moves to pause after recent speech falls below threshold', () => {
    const machine = new SpeechStateMachine();
    machine.update(frame(0, 0.16, 0.18));

    const pause = machine.update(frame(650, 0.015, 0.01));

    expect(pause.state).toBe('pauseAfterSpeech');
    expect(pause.speechEnd).toBe(true);
  });

  test('marks long pauses after speech has settled', () => {
    const machine = new SpeechStateMachine();
    machine.update(frame(0, 0.16, 0.18));
    machine.update(frame(650, 0.015, 0.01));

    const longPause = machine.update(frame(2300, 0.012, 0.01));

    expect(longPause.longPause).toBe(true);
    expect(longPause.state).toBe('listening');
  });

  test('detects high energy speech from intensity and transient emphasis', () => {
    const machine = new SpeechStateMachine();

    const intense = machine.update(frame(100, 0.34, 0.38, 0.85));

    expect(intense.state).toBe('highEnergySpeech');
    expect(intense.speakingIntensity).toBeGreaterThan(0.8);
  });
});