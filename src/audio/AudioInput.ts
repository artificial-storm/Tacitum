export type AudioInputStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

type WebkitAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export class AudioInput {
  status: AudioInputStatus = 'idle';
  errorMessage = '';
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    if (this.status === 'active' || this.status === 'requesting') {
      return;
    }

    const AudioContextConstructor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;

    if (!navigator.mediaDevices?.getUserMedia || !AudioContextConstructor) {
      this.status = 'error';
      this.errorMessage = 'Microphone input is not available in this browser.';
      return;
    }

    this.status = 'requesting';
    this.errorMessage = '';

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      this.audioContext = new AudioContextConstructor();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.status = 'active';
    } catch (error) {
      this.status = this.isPermissionError(error) ? 'denied' : 'error';
      this.errorMessage = this.status === 'denied' ? 'Microphone permission was denied.' : 'Could not start microphone input.';
      this.stop();
    }
  }

  stop(): void {
    this.sourceNode?.disconnect();
    this.sourceNode = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    void this.audioContext?.close();
    this.audioContext = null;

    if (this.status === 'active' || this.status === 'requesting') {
      this.status = 'idle';
    }
  }

  getContext(): AudioContext | null {
    return this.audioContext;
  }

  getSourceNode(): MediaStreamAudioSourceNode | null {
    return this.sourceNode;
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  private isPermissionError(error: unknown): boolean {
    return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
  }
}