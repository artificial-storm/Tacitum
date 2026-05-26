import type { SpeechActivityFrame } from '../types/speech';
import type { SpeakerFrame, SpeakerMode, SpeakerState } from '../types/speakers';
import { createDefaultSpeakers } from './SpeakerState';

export class MockSpeakerEngine {
  private speakers = createDefaultSpeakers();

  update(speech: SpeechActivityFrame, mode: SpeakerMode = 'cycle', overlapEnabled = false): SpeakerFrame {
    const activeSpeakerId = this.resolveActiveSpeaker(speech, mode);
    const overlap = overlapEnabled && activeSpeakerId !== null && (speech.possibleOverlap || speech.speakingIntensity > 0.45);
    const secondarySpeakerId = overlap ? this.nextSpeakerId(activeSpeakerId) : null;

    this.speakers = this.speakers.map((speaker) => this.updateSpeaker(speaker, speech, activeSpeakerId, secondarySpeakerId));

    return {
      timestamp: speech.timestamp,
      activeSpeakerId,
      speakers: this.speakers,
      overlap,
    };
  }

  reset(): void {
    this.speakers = createDefaultSpeakers();
  }

  private resolveActiveSpeaker(speech: SpeechActivityFrame, mode: SpeakerMode): string | null {
    if (speech.state !== 'activeSpeech' && speech.state !== 'highEnergySpeech') {
      return null;
    }

    if (mode !== 'cycle') {
      return mode;
    }

    const activeIndex = Math.floor(speech.timestamp / 3600) % this.speakers.length;
    return this.speakers[activeIndex].speakerId;
  }

  private nextSpeakerId(activeSpeakerId: string): string {
    const activeIndex = this.speakers.findIndex((speaker) => speaker.speakerId === activeSpeakerId);
    const nextIndex = (activeIndex + 1) % this.speakers.length;
    return this.speakers[nextIndex].speakerId;
  }

  private updateSpeaker(
    speaker: SpeakerState,
    speech: SpeechActivityFrame,
    activeSpeakerId: string | null,
    secondarySpeakerId: string | null,
  ): SpeakerState {
    const isActive = speaker.speakerId === activeSpeakerId;
    const isSecondary = speaker.speakerId === secondarySpeakerId;
    const voiceEnergy = isActive ? speech.speakingIntensity : isSecondary ? speech.speakingIntensity * 0.65 : speaker.voiceEnergy * 0.82;
    const speaking = isActive || isSecondary;

    return {
      ...speaker,
      confidence: speaking ? speech.confidence : speaker.confidence * 0.86,
      voiceEnergy,
      speaking,
      overlap: isSecondary,
      lastSpokeAt: speaking ? speech.timestamp : speaker.lastSpokeAt,
    };
  }
}