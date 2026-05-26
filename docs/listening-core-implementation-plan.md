# DOT And JOY Implementation Plan

> This plan reflects the current prototype direction. It intentionally retires older orb, radar, square-panel, and drawn-ripple ideas.

**Goal:** Maintain and evolve a compact browser-based microphone-reactive listening core for an AI meeting/listening service.

**Architecture:** Keep microphone capture, Web Audio analysis, speech-state inference, mocked speaker state, future intelligence adapters, and canvas rendering in separate modules. The renderer consumes typed frames and should not import future diarization, STT, LLM, or TTS SDKs.

**Tech Stack:** Vite, TypeScript, Web Audio API, Canvas 2D, Vitest, and browser verification.

## Phase 1: Prototype Foundation

- [x] Build a Vite + TypeScript app.
- [x] Add `dev`, `build`, `preview`, and `test` scripts.
- [x] Implement browser microphone start/stop with graceful denied/error states.
- [x] Keep the app local and backend-free.
- [x] Keep the first screen as the usable prototype, not a landing page.

Expected result: local app boots at a dev URL and the user can start or stop microphone access.

## Phase 2: Audio And Speech Signals

- [x] Compute RMS, smoothed RMS, rolling noise floor, frequency bands, spectral centroid, brightness, transient score, rhythm, rough pitch proxy, and voice texture.
- [x] Derive `idle`, `listening`, `activeSpeech`, `pauseAfterSpeech`, and `highEnergySpeech` from adaptive local audio signals.
- [x] Store recent speech events without making the renderer own speech logic.
- [x] Cover pure audio math and speech transitions with tests.

Expected result: visual behavior can respond to speech-like cadence, emphasis, silence, and fading without real VAD.

## Phase 3: Mock Speaker Layer

- [x] Define anonymous speaker frames and signatures.
- [x] Simulate speaker A/B/C and overlap for visual testing.
- [x] Keep speaker simulation clearly separate from real diarization or identity.
- [x] Cover mock speaker behavior with tests.

Expected result: the prototype can explore turn-taking and overlap visuals without claiming real speaker recognition.

## Phase 4: DOT Visual Direction

- [x] Generate a stable dot plane with deterministic model tests.
- [x] Keep the distant/back rows near full width so DOT does not collapse into a perspective square.
- [x] Contain the plane with a soft circular falloff rather than a visible panel, orb, or aperture.
- [x] Drive motion through dot lift, opacity, brightness, radius, jitter, and internal pressure.
- [x] Avoid drawn beams, rings, or radar-style ripples as the primary response.
- [x] Tune release memory so abrupt endings rebound faster and faded endings settle smoothly.
- [ ] Continue tuning drop/recovery motion once the desired motion-blur behavior is fully specified.

Expected result: DOT feels like an endless listening plane directly on black.

## Phase 5: JOY Visual Direction

- [x] Render topographic contour lines as an alternate mode.
- [x] Increase contour line strength so JOY reads clearly on black.
- [x] Draw black support beneath contours as mountain-body occlusion, not centered outlines.
- [x] Keep nearer rows occluding rows behind them.
- [ ] Continue tuning row spacing, depth, and speaker accent layers after voice testing.

Expected result: JOY feels like a digital mountain range shaped by voice.

## Phase 6: Minimal UI

- [x] Remove visible headline/marketing copy from the main surface.
- [x] Keep the visual directly on a fully black background.
- [x] Replace mode select with a single DOT/JOY pill.
- [x] Make any click inside the DOT/JOY pill toggle modes.
- [x] Remove bottom status text for mic state, speech state, and simulated speaker labels.
- [x] Keep debug metrics behind the Metrics button.
- [ ] Revisit whether speaker/overlap controls should be hidden behind a secondary drawer once visual tuning stabilizes.

Expected result: controls are functional but do not compete with the listening core.

## Phase 7: Future Adapter Boundary

- [x] Document future VAD, diarization, speaker ID, STT, conversation intelligence, and TTS as adapters.
- [ ] Implement or refresh `src/intelligence/IntelligenceSource.ts` if future work needs a concrete adapter interface.
- [ ] Keep named speaker identification behind explicit consent and enrollment.
- [ ] Keep TTS as an output surface, not part of the listening renderer.

Expected result: future intelligence can replace mocks without rewriting DOT or JOY.

## Phase 8: Verification

- [x] Run `npm run test` after behavior/model changes.
- [x] Run `npm run build` after TypeScript or renderer changes.
- [x] Use browser checks for visual mode toggling and removed status UI.
- [ ] Re-test live microphone response in Chrome after each significant visual tuning pass.
- [ ] Re-test mobile sizing after major layout changes.

Expected result: tests, build, and browser behavior support each visual direction before more tuning begins.

## Current Good Ideas To Protect

- Direct black background.
- Quiet controls.
- DOT as an endless field with circular fade, not a contained square object.
- JOY as contour terrain with y-axis occlusion.
- Audio-driven dot/line motion rather than explanatory UI.
- Long-lived visual memory that responds differently to abrupt endings and fading endings.
- Anonymous, consent-aware future speaker handling.
- Typed boundaries between visual listening, speech intelligence, and output systems.

## Avoid Reintroducing

- Spherical canvas styling.
- Visible aperture/rim overlays.
- Drawn radar rings or beams.
- Square panel framing for DOT.
- Bottom status labels in the main experience.
- p5/WEBGL as a goal rather than historical inspiration.
- Real diarization/STT/TTS as MVP acceptance criteria.