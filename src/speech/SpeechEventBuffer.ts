import type { SpeechActivityFrame } from '../types/speech';

export type SpeechEvent = {
  timestamp: number;
  type: 'start' | 'end' | 'longPause';
  intensity: number;
};

export class SpeechEventBuffer {
  private events: SpeechEvent[] = [];

  constructor(private readonly ttlMs = 2400) {}

  push(frame: SpeechActivityFrame): SpeechEvent[] {
    if (frame.speechStart) {
      this.events.push({ timestamp: frame.timestamp, type: 'start', intensity: frame.speakingIntensity });
    }

    if (frame.speechEnd) {
      this.events.push({ timestamp: frame.timestamp, type: 'end', intensity: frame.confidence });
    }

    if (frame.longPause) {
      this.events.push({ timestamp: frame.timestamp, type: 'longPause', intensity: frame.confidence });
    }

    this.expire(frame.timestamp);
    return this.getEvents();
  }

  getEvents(): SpeechEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  private expire(now: number): void {
    this.events = this.events.filter((event) => now - event.timestamp <= this.ttlMs);
  }
}