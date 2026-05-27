import { describe, expect, test, vi } from 'vitest';
import { AudioAnalyzer } from './AudioAnalyzer';

const makeAnalyser = (): AnalyserNode => ({
  fftSize: 0,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0,
  minDecibels: -100,
  maxDecibels: -30,
  getFloatTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
  disconnect: vi.fn(),
}) as unknown as AnalyserNode;

describe('AudioAnalyzer', () => {
  test('configures frequency analysis with enough headroom for loud input', () => {
    const analyser = makeAnalyser();
    const audioContext = {
      createAnalyser: vi.fn(() => analyser),
      sampleRate: 48000,
    } as unknown as AudioContext;
    const sourceNode = {
      connect: vi.fn(),
    } as unknown as MediaStreamAudioSourceNode;

    new AudioAnalyzer(audioContext, sourceNode);

    expect(analyser.fftSize).toBe(2048);
    expect(analyser.minDecibels).toBe(-96);
    expect(analyser.maxDecibels).toBe(-8);
    expect(analyser.smoothingTimeConstant).toBe(0.48);
    expect(sourceNode.connect).toHaveBeenCalledWith(analyser);
  });
});