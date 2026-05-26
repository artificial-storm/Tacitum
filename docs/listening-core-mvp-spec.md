# DOT And JOY Listening Core Spec

Date: 2026-05-18
Status: Prototype direction and future target

## Goal

Build a polished browser prototype of a microphone-reactive listening core for an AI meeting/listening service. The first prototype is visual and local: it reads live microphone input, derives lightweight speech-like signals with Web Audio, and renders a restrained black-and-white listening surface that feels calm, intelligent, and product-ready.

This prototype is not a transcript, diarization, coaching, or TTS product. Those systems can arrive later through typed adapters. The visual core should stay useful before any heavy speech intelligence exists.

## Current Direction

The prototype has two visual modes:

- `DOT`: an endless-feeling depth plane of dots on a completely black background. The grid should not read as a square panel or a separate object. It is contained by a soft circular falloff, with the back rows keeping width so the plane feels like it continues beyond the visible field.
- `JOY`: a digital mountain-range/topography mode. Lines should be strong enough to read at rest. Black belongs underneath the contours as occluding mountain body, not as a visible outline around each line.

The mode switch is a single DOT/JOY pill. Any click inside the pill toggles the mode. The surrounding UI stays quiet: mic start/stop, optional speaker simulation controls, overlap, and metrics. Bottom status text such as mic state, speech state, or simulated speaker labels should not be visible in the main surface.

## Product Principles

- The visual should feel like active listening, not like a music visualizer.
- Silence should feel intentional and alive, not broken or empty.
- Motion should be carried by the dots or contours themselves, not by obvious radar rings, beams, or interface chrome.
- The background should be directly black. Avoid decorative panels, spherical canvas treatment, visible frames, gradients, blobs, or landing-page composition.
- The system can imply attention, cadence, pressure, memory, and turn-taking, but it must not imply real identity, transcript understanding, or coaching in v1.
- Recording/listening products need visible trust cues and consent-aware language in future product contexts. Do not hide the fact that audio capture is active.
- Prefer anonymous speaker energy and visual signatures until named speaker identification has explicit enrollment and consent.

## What To Preserve

These are the good ideas worth carrying forward:

- A black field with restrained white/gray marks and rare cyan/amber/blue accents.
- A direct, minimal listening object that can sit inside a serious product UI.
- Audio features beyond volume: RMS, smoothed energy, low/mid/high bands, spectral centroid/brightness, transient score, rhythm, rough pitch movement, and voice texture.
- Adaptive speech-state inference from local browser audio for prototype behavior.
- Long-lived visual memory: abrupt sound endings can rebound quickly, while fading audio settles smoothly.
- Future-ready typed contracts for speech activity, speakers, transcripts, and conversation signals.
- Mock speaker behavior only as a way to test visual grammar, not as a claim of real voice identification.
- A framework-agnostic renderer that can later be wrapped by a product UI.

## Ideas To Retire

Do not use these as future anchors:

- Dot orb, sphere, radar, aperture, or circular device metaphors.
- Square-contained panel language for DOT.
- Drawn ripple rings or beams as the main DOT response.
- Concentric speaker rings as the primary future model.
- p5/WEBGL nostalgia as a technical goal. The old sketch can remain background inspiration, but Canvas 2D is the current implementation path.
- Visible mic/speech/speaker status labels under the visual core.
- UI that explains the visual or competes with it.
- Bright multicolor speaker coding, equalizer bars, waveform tunnels, or DJ visualizer patterns.

## DOT Motion Model

DOT should feel like a responsive field of points, not a diagram.

- The distant/back rows keep near-full width. Depth is mostly communicated through vertical compression, lift, opacity, size, and fading.
- The field fades at the perimeter with a soft circular falloff. It should feel endless and contained at the same time.
- Audio energy lifts, sharpens, brightens, and bumps dots locally.
- Speech-like onsets create internal pressure through dot movement, not drawn rings.
- Low frequencies create slower depth swell.
- Mid frequencies drive speech pressure and dot lift.
- High frequencies create crisp shimmer and small transient motion.
- Abrupt endings damp internal ripple memory quickly so the field can bounce back.
- Fading endings preserve longer resonance and smoother settling.
- Idle can be nearly invisible, but it should not look like a broken canvas.

## JOY Motion Model

JOY should feel like a quiet digital mountain range reacting to voice.

- Lines must be thick and bright enough to read on black.
- Black support is drawn beneath each contour in the y axis, like terrain occlusion.
- Front lines occlude lines behind them. Farther rows should not peek through underneath closer rows.
- Speech energy raises ridges and creates contour variation.
- High frequencies add controlled texture, not noisy scribble.
- Speaker accents can appear as subtle elevated layers, but color remains secondary.

## Speech State Logic

The prototype derives simple local states from browser audio analysis:

- `idle`: mic not started or permission not granted.
- `listening`: mic active, low signal, waiting for speech.
- `activeSpeech`: speech-like energy over threshold with cadence and mid-band energy.
- `pauseAfterSpeech`: signal drops after recent speech.
- `highEnergySpeech`: active speech with high energy, strong transients, or sustained emphasis.

Thresholds should remain adaptive:

- Maintain a rolling noise floor.
- Start speech when RMS rises above noise floor and mid-band energy is present.
- End speech after a short window below threshold.
- Treat long pauses as settling cues.
- Treat emphasis as visual intensity, not chaos.

## Architecture

Use a small browser stack with strict boundaries:

- Vite + TypeScript for the prototype shell.
- Web Audio API for microphone capture and analysis.
- Canvas 2D for the renderer.
- Vitest for pure model/state tests.
- Browser verification for layout, canvas rendering, and interaction behavior.

Recommended boundaries:

- `src/audio/AudioInput.ts`: microphone permission, stream lifecycle, audio context lifecycle.
- `src/audio/AudioAnalyzer.ts`: analyser node, RMS, bands, centroid, pitch proxy, transients, rolling history.
- `src/speech/SpeechStateMachine.ts`: converts audio features into speech states and speech events.
- `src/speech/SpeechEventBuffer.ts`: recent speech event history.
- `src/speakers/MockSpeakerEngine.ts`: simulated speaker activity and overlap only.
- `src/visual/DotFieldModel.ts`: stable dot generation and per-dot state.
- `src/visual/ListeningCoreRenderer.ts`: canvas draw loop and visual mapping for DOT and JOY.
- `src/app/App.ts`: minimal UI shell, controls, state wiring.
- `src/intelligence/IntelligenceSource.ts`: future adapter boundary.

## Future Intelligence Boundaries

Future systems should feed typed frames into the visual core. The renderer should never import SDKs for diarization, STT, LLMs, or TTS.

- VAD can replace or augment `SpeechActivityFrame` generation.
- Diarization can emit anonymous `SpeakerFrame` data.
- Speaker ID can attach names only after explicit enrollment and consent.
- STT can emit `TranscriptEvent` objects.
- Conversation intelligence can emit `ConversationSignal` objects.
- TTS remains an output layer, separate from listening visualization.

## Acceptance Criteria

Functional:

- Browser microphone start/stop works and handles denied permission gracefully.
- Visual reacts live to microphone input without a backend service.
- DOT and JOY can be toggled from any point in the single mode pill.
- No bottom status text appears in the main experience.
- Mock speaker and overlap controls remain optional visual-testing tools.
- Rendering, audio analysis, speech state, speaker state, and future intelligence contracts stay separate.

Visual:

- DOT reads as an endless dot plane contained by circular fade, not a square panel.
- DOT motion stays in dot behavior, not drawn beams or obvious ripple rings.
- JOY reads as a digital mountain range with proper front-row occlusion.
- The design stays black, restrained, atmospheric, and product-ready.
- It does not read as a generic music visualizer.
- Speaker distinction is not dependent on loud colors.

Technical:

- Uses Web Audio for RMS, bands, brightness, and transients.
- Uses adaptive thresholds or rolling noise floor for speech states.
- Maintains a stable animation loop near 60 fps on a modern laptop.
- Tests cover pure audio math, speech state, mock speakers, and dot field behavior.
- No real diarization, STT, LLM, or TTS is required for v1.

## Open Questions For Later

- Should the visual core become a reusable embeddable component before adding transcript intelligence?
- What trust/consent affordance should appear when this is used in a real recording product?
- Should future speaker signatures stay anonymous by default even after diarization exists?
- Should transcript intelligence live around the visual core or in a separate review surface?
- How much ambient memory should the visual retain after speech before it becomes distracting?