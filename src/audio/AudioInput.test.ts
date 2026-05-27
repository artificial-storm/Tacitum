import { afterEach, describe, expect, test, vi } from 'vitest';
import { AudioInput } from './AudioInput';

const sourceNode = {
  disconnect: vi.fn(),
};

const audioContext = {
  close: vi.fn(),
  createMediaStreamSource: vi.fn((_stream: MediaStream) => sourceNode as unknown as MediaStreamAudioSourceNode),
};

class MockAudioContext {
  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    return audioContext.createMediaStreamSource(stream);
  }

  close(): Promise<void> {
    audioContext.close();
    return Promise.resolve();
  }
}

const mediaStream = (audioTrackCount: number): MediaStream => ({
  getAudioTracks: () => Array.from({ length: audioTrackCount }, () => ({ stop: vi.fn() })) as unknown as MediaStreamTrack[],
  getTracks: () => Array.from({ length: audioTrackCount }, () => ({ stop: vi.fn() })) as unknown as MediaStreamTrack[],
}) as MediaStream;

describe('AudioInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('starts from shared tab audio through display media', async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue(mediaStream(1));
    const getUserMedia = vi.fn();

    vi.stubGlobal('window', { AudioContext: MockAudioContext });
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia, getUserMedia } });

    const input = new AudioInput();

    await input.start('tabAudio');

    expect(getDisplayMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(input.status).toBe('active');
  });

  test('requests raw microphone audio without browser speech filtering', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(mediaStream(1));

    vi.stubGlobal('window', { AudioContext: MockAudioContext });
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn(), getUserMedia } });

    const input = new AudioInput();

    await input.start('microphone');

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });
    expect(input.status).toBe('active');
  });

  test('rejects display media when no audio track is shared', async () => {
    vi.stubGlobal('window', { AudioContext: MockAudioContext });
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(mediaStream(0)), getUserMedia: vi.fn() } });

    const input = new AudioInput();

    await input.start('tabAudio');

    expect(input.status).toBe('error');
    expect(input.errorMessage).toBe('No shared tab audio was found.');
  });
});