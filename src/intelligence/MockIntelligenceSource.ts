import type { IntelligenceFrame } from '../types/intelligence';
import type { IntelligenceFrameListener, IntelligenceSource } from './IntelligenceSource';

export class MockIntelligenceSource implements IntelligenceSource {
  private listeners = new Set<IntelligenceFrameListener>();

  start(): void {}

  stop(): void {
    this.listeners.clear();
  }

  subscribe(listener: IntelligenceFrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(frame: IntelligenceFrame): void {
    this.listeners.forEach((listener) => listener(frame));
  }
}