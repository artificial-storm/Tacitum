export type AudioInputStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';
export type AudioInputSource = 'microphone' | 'tabAudio';

type WebkitAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export class AudioInput {
  status: AudioInputStatus = 'idle';
  errorMessage = '';
  source: AudioInputSource = 'microphone';
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  async start(source: AudioInputSource = 'microphone'): Promise<void> {
    if (this.status === 'active' || this.status === 'requesting') {
      return;
    }

    const AudioContextConstructor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;

    if (!navigator.mediaDevices || !AudioContextConstructor) {
      this.status = 'error';
      this.errorMessage = 'Audio input is not available in this browser.';
      return;
    }

    if (source === 'microphone' && !navigator.mediaDevices.getUserMedia) {
      this.status = 'error';
      this.errorMessage = 'Microphone input is not available in this browser.';
      return;
    }

    if (source === 'tabAudio' && !navigator.mediaDevices.getDisplayMedia) {
      this.status = 'error';
      this.errorMessage = 'Tab audio sharing is not available in this browser.';
      return;
    }

    this.status = 'requesting';
    this.errorMessage = '';
    this.source = source;

    try {
      this.stream = source === 'tabAudio'
        ? await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
        : await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        });

      if (this.stream.getAudioTracks().length === 0) {
        this.status = 'error';
        this.errorMessage = source === 'tabAudio' ? 'No shared tab audio was found.' : 'No microphone audio track was found.';
        this.stop();
        return;
      }

      this.audioContext = new AudioContextConstructor();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.status = 'active';
    } catch (error) {
      this.status = this.isPermissionError(error) ? 'denied' : 'error';
      this.errorMessage = this.status === 'denied'
        ? `${source === 'tabAudio' ? 'Tab audio sharing' : 'Microphone'} permission was denied.`
        : `Could not start ${source === 'tabAudio' ? 'tab audio sharing' : 'microphone input'}.`;
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