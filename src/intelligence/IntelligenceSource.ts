import type { IntelligenceFrame } from '../types/intelligence';

export type IntelligenceFrameListener = (frame: IntelligenceFrame) => void;

export interface IntelligenceSource {
  start(): Promise<void> | void;
  stop(): void;
  subscribe(listener: IntelligenceFrameListener): () => void;
}