# Future Speech Intelligence Adapters

V1 is a browser-local visual prototype. It does not perform real VAD, diarization, speaker identification, STT, conversation analysis, coaching, storage, sharing, or TTS.

The listening core should continue to render typed frames. Future intelligence systems can replace the local mock sources, but DOT and JOY should not import SDKs or know where the intelligence came from.

## Adapter Contracts

- VAD emits or improves `SpeechActivityFrame`.
- Diarization emits anonymous `SpeakerFrame` and `SpeakerState` data.
- Speaker ID may attach names only after explicit enrollment and consent.
- STT emits `TranscriptEvent`.
- Conversation intelligence emits `ConversationSignal`.
- TTS remains an output adapter and should not be coupled to the listening-core renderer.

## Trust And Consent Principles

- Future recording products need clear affordances that audio capture is active.
- Named speaker identity should never be inferred silently.
- Transcript, summary, and coaching features should be presented outside the visual core unless a future design explicitly chooses otherwise.
- The visual core can show attention, energy, overlap, cadence, and memory. It should not imply it understands words or identifies people in v1.

## Integration Rule

The renderer receives visual-ready frames only:

```ts
type IntelligenceFrame = {
  audio: AudioFeatures;
  speech: SpeechActivityFrame;
  speaker: SpeakerFrame;
  transcript?: TranscriptEvent[];
  signals?: ConversationSignal[];
};
```

Adapters may run locally, in a worker, or in a backend later. The renderer should not change for those deployment choices.