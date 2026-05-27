import { AudioAnalyzer } from '../audio/AudioAnalyzer';
import { AudioInput } from '../audio/AudioInput';
import { SpeechEventBuffer } from '../speech/SpeechEventBuffer';
import { SpeechStateMachine } from '../speech/SpeechStateMachine';
import { MockSpeakerEngine } from '../speakers/MockSpeakerEngine';
import { silentAudioFeatures } from '../types/audio';
import { idleSpeechFrame } from '../types/speech';
import type { SpeakerFrame } from '../types/speakers';
import { ListeningCoreRenderer, type VisualMode } from '../visual/ListeningCoreRenderer';
import { applyVisualSensitivity } from '../visual/AudioSensitivity';
import type { VisualCameraMotionMode } from '../visual/VisualCamera';
import {
  overlapDelayRange,
  rippleHeightRange,
  rippleSpeedRange,
  sensitivityRange,
  tailDampingRange,
  visualModeLiftDefaults,
} from '../visual/visualControlDefaults';

type PersistedControls = {
  panelOpen: boolean;
  sensitivity: number;
  liftByMode: Record<VisualMode, number>;
  rippleSpeed: number;
  motionMode: VisualCameraMotionMode;
};

const controlsStorageKey = 'tacitum.controls.v1';
const legacyControlsStorageKey = 'tacitum1.controls.v1';

export class App {
  private readonly audioInput = new AudioInput();
  private readonly speechMachine = new SpeechStateMachine();
  private readonly eventBuffer = new SpeechEventBuffer();
  private readonly speakerEngine = new MockSpeakerEngine();
  private audioAnalyzer: AudioAnalyzer | null = null;
  private renderer: ListeningCoreRenderer | null = null;
  private animationFrame = 0;
  private visualMode: VisualMode = 'depthPlane';
  private sensitivity: number = sensitivityRange.default;
  private readonly liftByMode: Record<VisualMode, number> = { ...visualModeLiftDefaults };
  private panelOpen = false;
  private rippleSpeed: number = rippleSpeedRange.default;
  private motionMode: VisualCameraMotionMode = 'fixed';

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.restoreControls();

    this.root.innerHTML = `
      <main class="prototype-shell">
        <section class="core-stage" aria-label="Tacitum microphone visualizer">
          <canvas class="core-canvas" aria-label="Microphone-reactive listening visualizer"></canvas>
        </section>
        <section class="control-surface" aria-label="Prototype controls">
          <div class="compact-menu">
            <button class="primary-action" id="mic-toggle" type="button">Start mic</button>
            <button class="visual-toggle" id="visual-toggle" type="button" aria-label="Toggle visualizer mode" aria-pressed="false" data-current-mode="depthPlane">
              <span class="toggle-option is-active" data-visual-mode="depthPlane">DOT</span>
              <span class="toggle-option" data-visual-mode="topography">JOY</span>
            </button>
            <div class="mode-control">
              <button class="visual-toggle motion-toggle" id="motion-toggle" type="button" aria-label="Toggle motion mode" aria-pressed="${this.motionMode === 'auto'}" data-current-motion="${this.motionMode}">
                <span class="toggle-option${this.motionMode === 'fixed' ? ' is-active' : ''}" data-motion-mode="fixed">Fixed</span>
                <span class="toggle-option${this.motionMode === 'auto' ? ' is-active' : ''}" data-motion-mode="auto">Auto</span>
              </button>
            </div>
            <button class="panel-toggle" id="panel-toggle" type="button" aria-label="Toggle control panel" aria-expanded="${this.panelOpen}">
              <svg class="panel-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M21.2 13.3v-2.6l-2-.4a7.8 7.8 0 0 0-.5-1.2l1.2-1.7-1.8-1.8-1.7 1.2a7.8 7.8 0 0 0-1.2-.5l-.4-2h-2.6l-.4 2a7.8 7.8 0 0 0-1.2.5L7 5.6 5.2 7.4l1.2 1.7a7.8 7.8 0 0 0-.5 1.2l-2 .4v2.6l2 .4a7.8 7.8 0 0 0 .5 1.2l-1.2 1.7L7 18.4l1.7-1.2a7.8 7.8 0 0 0 1.2.5l.4 2h2.6l.4-2a7.8 7.8 0 0 0 1.2-.5l1.7 1.2 1.8-1.8-1.2-1.7a7.8 7.8 0 0 0 .5-1.2l2-.4ZM12 15.1A3.1 3.1 0 1 1 12 9a3.1 3.1 0 0 1 0 6.2Z" />
              </svg>
            </button>
          </div>
          <div class="advanced-menu${this.panelOpen ? ' is-open' : ''}" id="advanced-menu" aria-hidden="${!this.panelOpen}">
            <label class="range-control" for="sensitivity-control">
              <span>Sens</span>
              <input id="sensitivity-control" type="range" min="${sensitivityRange.min}" max="${sensitivityRange.max}" step="${sensitivityRange.step}" value="${this.sensitivity}" />
            </label>
            <label class="range-control" for="ripple-height-control">
              <span>Lift</span>
              <input id="ripple-height-control" type="range" min="${rippleHeightRange.min}" max="${rippleHeightRange.max}" step="${rippleHeightRange.step}" value="${this.liftByMode[this.visualMode]}" />
              <output id="ripple-height-value" for="ripple-height-control">${this.liftByMode[this.visualMode].toFixed(2)}x</output>
            </label>
            <label class="range-control" for="ripple-speed-control">
              <span>Speed</span>
              <input id="ripple-speed-control" type="range" min="${rippleSpeedRange.min}" max="${rippleSpeedRange.max}" step="${rippleSpeedRange.step}" value="${this.rippleSpeed}" />
              <output id="ripple-speed-value" for="ripple-speed-control">${this.rippleSpeed.toFixed(2)}x</output>
            </label>
          </div>
          <div class="error-text" id="error-text" role="status"></div>
        </section>
      </main>
    `;

    const canvas = this.requiredElement<HTMLCanvasElement>('.core-canvas');
    this.renderer = new ListeningCoreRenderer(canvas);
    this.renderer.setSensitivity(this.sensitivity);
    this.renderer.setDotFlowControls(this.rippleSpeed, overlapDelayRange.default, tailDampingRange.default);
    this.renderer.setCameraMotionMode(this.motionMode);
    this.syncLiftControl();
    this.syncAdvancedControls();
    this.bindControls();
    this.tick(performance.now());
  }

  private bindControls(): void {
    this.requiredElement<HTMLButtonElement>('#mic-toggle').addEventListener('click', () => {
      void this.toggleMicrophone();
    });

    this.requiredElement<HTMLButtonElement>('#visual-toggle').addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      this.toggleVisualMode();
    });

    this.requiredElement<HTMLButtonElement>('#visual-toggle').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      this.toggleVisualMode();
    });

    this.requiredElement<HTMLButtonElement>('#panel-toggle').addEventListener('click', () => {
      this.panelOpen = !this.panelOpen;
      this.syncAdvancedControls();
      this.persistControls();
    });

    this.requiredElement<HTMLButtonElement>('#motion-toggle').addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      this.toggleMotionMode();
    });

    this.requiredElement<HTMLButtonElement>('#motion-toggle').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      this.toggleMotionMode();
    });

    this.requiredElement<HTMLInputElement>('#sensitivity-control').addEventListener('input', (event) => {
      this.sensitivity = Number((event.currentTarget as HTMLInputElement).value);
      this.renderer?.setSensitivity(this.sensitivity);
      this.persistControls();
    });

    this.requiredElement<HTMLInputElement>('#ripple-height-control').addEventListener('input', (event) => {
      const value = Number((event.currentTarget as HTMLInputElement).value);

      this.liftByMode[this.visualMode] = value;
      this.renderer?.setRippleHeightScale(value);
      this.requiredElement<HTMLOutputElement>('#ripple-height-value').value = `${value.toFixed(2)}x`;
      this.persistControls();
    });

    this.requiredElement<HTMLInputElement>('#ripple-speed-control').addEventListener('input', (event) => {
      this.rippleSpeed = Number((event.currentTarget as HTMLInputElement).value);
      this.renderer?.setDotFlowControls(this.rippleSpeed, overlapDelayRange.default, tailDampingRange.default);
      this.requiredElement<HTMLOutputElement>('#ripple-speed-value').value = `${this.rippleSpeed.toFixed(2)}x`;
      this.persistControls();
    });
  }

  private async toggleMicrophone(): Promise<void> {
    if (this.audioInput.status === 'active') {
      this.stopMicrophone();
      return;
    }

    await this.audioInput.start();

    if (!this.audioInput.isActive()) {
      this.updateStaticStatus();
      return;
    }

    const audioContext = this.audioInput.getContext();
    const sourceNode = this.audioInput.getSourceNode();

    if (!audioContext || !sourceNode) {
      this.updateStaticStatus();
      return;
    }

    this.audioAnalyzer?.dispose();
    this.audioAnalyzer = new AudioAnalyzer(audioContext, sourceNode);
    this.speechMachine.reset();
    this.speakerEngine.reset();
    this.eventBuffer.clear();
    this.updateStaticStatus();
  }

  private updateVisualToggle(): void {
    this.requiredElement<HTMLButtonElement>('#visual-toggle').setAttribute('aria-pressed', String(this.visualMode === 'topography'));
    this.requiredElement<HTMLButtonElement>('#visual-toggle').dataset.currentMode = this.visualMode;
    this.root.querySelectorAll<HTMLElement>('[data-visual-mode]').forEach((option) => {
      option.classList.toggle('is-active', option.dataset.visualMode === this.visualMode);
    });
  }

  private toggleVisualMode(): void {
    this.visualMode = this.visualMode === 'depthPlane' ? 'topography' : 'depthPlane';
    this.renderer?.setMode(this.visualMode);
    this.syncLiftControl();
    this.updateVisualToggle();
    this.persistControls();
  }

  private toggleMotionMode(): void {
    this.motionMode = this.motionMode === 'fixed' ? 'auto' : 'fixed';
    this.renderer?.setCameraMotionMode(this.motionMode);
    this.updateMotionToggle();
    this.persistControls();
  }

  private syncLiftControl(): void {
    const value = this.liftByMode[this.visualMode];
    const liftControl = this.requiredElement<HTMLInputElement>('#ripple-height-control');

    liftControl.value = String(value);
    this.renderer?.setRippleHeightScale(value);
    this.requiredElement<HTMLOutputElement>('#ripple-height-value').value = `${value.toFixed(2)}x`;
  }

  private syncAdvancedControls(): void {
    const advancedMenu = this.requiredElement<HTMLDivElement>('#advanced-menu');
    const panelToggle = this.requiredElement<HTMLButtonElement>('#panel-toggle');

    advancedMenu.classList.toggle('is-open', this.panelOpen);
    advancedMenu.setAttribute('aria-hidden', String(!this.panelOpen));
    panelToggle.setAttribute('aria-expanded', String(this.panelOpen));
    this.updateMotionToggle();
    this.requiredElement<HTMLOutputElement>('#ripple-speed-value').value = `${this.rippleSpeed.toFixed(2)}x`;
  }

  private updateMotionToggle(): void {
    const motionToggle = this.requiredElement<HTMLButtonElement>('#motion-toggle');

    motionToggle.setAttribute('aria-pressed', String(this.motionMode === 'auto'));
    motionToggle.dataset.currentMotion = this.motionMode;
    this.root.querySelectorAll<HTMLElement>('[data-motion-mode]').forEach((option) => {
      option.classList.toggle('is-active', option.dataset.motionMode === this.motionMode);
    });
  }

  private restoreControls(): void {
    try {
      const rawState = window.localStorage.getItem(controlsStorageKey) ?? window.localStorage.getItem(legacyControlsStorageKey);

      if (!rawState) {
        return;
      }

      const state = JSON.parse(rawState) as Partial<PersistedControls>;

      this.panelOpen = state.panelOpen ?? this.panelOpen;
      this.sensitivity = typeof state.sensitivity === 'number'
        ? Math.min(sensitivityRange.max, Math.max(sensitivityRange.min, state.sensitivity))
        : this.sensitivity;
      this.rippleSpeed = typeof state.rippleSpeed === 'number'
        ? Math.min(rippleSpeedRange.max, Math.max(rippleSpeedRange.min, state.rippleSpeed))
        : this.rippleSpeed;
      this.motionMode = state.motionMode === 'auto' ? 'auto' : 'fixed';

      if (state.liftByMode?.depthPlane !== undefined) {
        this.liftByMode.depthPlane = Math.min(rippleHeightRange.max, Math.max(rippleHeightRange.min, state.liftByMode.depthPlane));
      }

      if (state.liftByMode?.topography !== undefined) {
        this.liftByMode.topography = Math.min(rippleHeightRange.max, Math.max(rippleHeightRange.min, state.liftByMode.topography));
      }

      if (window.localStorage.getItem(controlsStorageKey) === null) {
        this.persistControls();
        window.localStorage.removeItem(legacyControlsStorageKey);
      }
    } catch {
      window.localStorage.removeItem(controlsStorageKey);
      window.localStorage.removeItem(legacyControlsStorageKey);
    }
  }

  private persistControls(): void {
    const state: PersistedControls = {
      panelOpen: this.panelOpen,
      sensitivity: this.sensitivity,
      liftByMode: { ...this.liftByMode },
      rippleSpeed: this.rippleSpeed,
      motionMode: this.motionMode,
    };

    window.localStorage.setItem(controlsStorageKey, JSON.stringify(state));
  }

  private stopMicrophone(): void {
    this.audioAnalyzer?.dispose();
    this.audioAnalyzer = null;
    this.audioInput.stop();
    this.speechMachine.reset();
    this.speakerEngine.reset();
    this.eventBuffer.clear();
    this.updateStaticStatus();
  }

  private tick(timestamp: number): void {
    const audio = this.audioAnalyzer?.getFeatures(timestamp) ?? silentAudioFeatures(timestamp);
    const speechAudio = this.audioAnalyzer ? this.visualSensitivityAudio(audio) : audio;
    const speech = this.audioAnalyzer ? this.speechMachine.update(speechAudio, this.audioInput.isActive()) : idleSpeechFrame(timestamp);
    this.eventBuffer.push(speech);
    const speaker = this.audioAnalyzer
      ? this.speakerEngine.update(speech, 'cycle', false)
      : this.emptySpeakerFrame(timestamp);

    this.renderer?.render({ audio, speech, speaker });
    this.updateStatus();
    this.animationFrame = window.requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
  }

  private visualSensitivityAudio(audio: ReturnType<AudioAnalyzer['getFeatures']>): ReturnType<AudioAnalyzer['getFeatures']> {
    return applyVisualSensitivity({
      audio,
      speech: idleSpeechFrame(audio.timestamp),
      speaker: this.emptySpeakerFrame(audio.timestamp),
    }, this.sensitivity).audio;
  }

  private updateStatus(): void {
    const micToggle = this.requiredElement<HTMLButtonElement>('#mic-toggle');
    const isActive = this.audioInput.isActive();

    micToggle.textContent = isActive ? 'Stop mic' : 'Start mic';
    micToggle.classList.toggle('is-active', isActive);
    micToggle.setAttribute('aria-pressed', String(isActive));
    this.requiredElement('#error-text').textContent = this.audioInput.errorMessage;
  }

  private updateStaticStatus(): void {
    this.updateStatus();
  }

  private emptySpeakerFrame(timestamp: number): SpeakerFrame {
    return {
      timestamp,
      activeSpeakerId: null,
      speakers: [],
      overlap: false,
    };
  }

  private requiredElement<ElementType extends HTMLElement = HTMLElement>(selector: string): ElementType {
    const element = this.root.querySelector<ElementType>(selector);

    if (!element) {
      window.cancelAnimationFrame(this.animationFrame);
      throw new Error(`Missing app element: ${selector}`);
    }

    return element;
  }
}