import createElement from 'lucide/dist/esm/createElement.mjs';
import Settings from 'lucide/dist/esm/icons/settings.mjs';
import { AudioAnalyzer } from '../audio/AudioAnalyzer';
import { AudioInput, type AudioInputSource } from '../audio/AudioInput';
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
  cameraZoomRange,
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
  audioSource: AudioInputSource;
  cameraZoom: number;
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
  private audioSource: AudioInputSource = 'microphone';
  private cameraZoom: number = cameraZoomRange.default;

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
            <label class="range-control" for="camera-zoom-control">
              <span>Zoom</span>
              <input id="camera-zoom-control" type="range" min="${cameraZoomRange.min}" max="${cameraZoomRange.max}" step="${cameraZoomRange.step}" value="${this.cameraZoom}" />
              <output id="camera-zoom-value" for="camera-zoom-control">${this.cameraZoom.toFixed(2)}x</output>
            </label>
            <div class="mode-control source-control" aria-label="Audio source">
              <button class="visual-toggle source-toggle" id="source-toggle" type="button" aria-label="Toggle audio source" aria-pressed="${this.audioSource === 'tabAudio'}" data-current-source="${this.audioSource}">
                <span class="toggle-option${this.audioSource === 'microphone' ? ' is-active' : ''}" data-audio-source="microphone">Mic</span>
                <span class="toggle-option${this.audioSource === 'tabAudio' ? ' is-active' : ''}" data-audio-source="tabAudio">Tab audio</span>
              </button>
            </div>
          </div>
          <div class="error-text" id="error-text" role="status"></div>
        </section>
      </main>
    `;

    this.mountSettingsIcon();

    const canvas = this.requiredElement<HTMLCanvasElement>('.core-canvas');
    this.renderer = new ListeningCoreRenderer(canvas);
    this.renderer.setSensitivity(this.sensitivity);
    this.renderer.setVisualSpeed(this.rippleSpeed, tailDampingRange.default);
    this.renderer.setCameraMotionMode(this.motionMode);
    this.renderer.setCameraZoom(this.cameraZoom);
    this.syncLiftControl();
    this.syncAdvancedControls();
    this.bindControls();
    this.tick(performance.now());
  }

  private bindControls(): void {
    this.requiredElement<HTMLButtonElement>('#mic-toggle').addEventListener('click', () => {
      void this.toggleAudioInput();
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
      this.renderer?.setVisualSpeed(this.rippleSpeed, tailDampingRange.default);
      this.requiredElement<HTMLOutputElement>('#ripple-speed-value').value = `${this.rippleSpeed.toFixed(2)}x`;
      this.persistControls();
    });

    this.requiredElement<HTMLInputElement>('#camera-zoom-control').addEventListener('input', (event) => {
      this.cameraZoom = Number((event.currentTarget as HTMLInputElement).value);
      this.renderer?.setCameraZoom(this.cameraZoom);
      this.requiredElement<HTMLOutputElement>('#camera-zoom-value').value = `${this.cameraZoom.toFixed(2)}x`;
      this.persistControls();
    });

    this.requiredElement<HTMLButtonElement>('#source-toggle').addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      void this.toggleAudioSource();
    });

    this.requiredElement<HTMLButtonElement>('#source-toggle').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      void this.toggleAudioSource();
    });
  }

  private mountSettingsIcon(): void {
    const panelToggle = this.requiredElement<HTMLButtonElement>('#panel-toggle');
    const icon = createElement(Settings, {
      class: 'panel-toggle-icon',
      'aria-hidden': 'true',
      focusable: 'false',
    });

    panelToggle.replaceChildren(icon);
  }

  private async toggleAudioInput(): Promise<void> {
    if (this.audioInput.status === 'active') {
      this.stopAudioInput();
      return;
    }

    await this.audioInput.start(this.audioSource);

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

  private async toggleAudioSource(): Promise<void> {
    const wasActive = this.audioInput.isActive();

    if (wasActive) {
      this.stopAudioInput();
    }

    this.audioSource = this.audioSource === 'microphone' ? 'tabAudio' : 'microphone';
    this.updateAudioSourceToggle();
    this.updateStaticStatus();
    this.persistControls();

    if (wasActive) {
      await this.toggleAudioInput();
    }
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
    this.updateAudioSourceToggle();
    this.requiredElement<HTMLOutputElement>('#ripple-speed-value').value = `${this.rippleSpeed.toFixed(2)}x`;
    this.requiredElement<HTMLOutputElement>('#camera-zoom-value').value = `${this.cameraZoom.toFixed(2)}x`;
  }

  private updateAudioSourceToggle(): void {
    const sourceToggle = this.requiredElement<HTMLButtonElement>('#source-toggle');

    sourceToggle.setAttribute('aria-pressed', String(this.audioSource === 'tabAudio'));
    sourceToggle.dataset.currentSource = this.audioSource;
    this.root.querySelectorAll<HTMLElement>('[data-audio-source]').forEach((option) => {
      option.classList.toggle('is-active', option.dataset.audioSource === this.audioSource);
    });
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
      this.audioSource = state.audioSource === 'tabAudio' ? 'tabAudio' : 'microphone';
      this.cameraZoom = typeof state.cameraZoom === 'number'
        ? Math.min(cameraZoomRange.max, Math.max(cameraZoomRange.min, state.cameraZoom))
        : this.cameraZoom;

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
      audioSource: this.audioSource,
      cameraZoom: this.cameraZoom,
    };

    window.localStorage.setItem(controlsStorageKey, JSON.stringify(state));
  }

  private stopAudioInput(): void {
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

    micToggle.textContent = isActive
      ? 'Stop audio'
      : this.audioSource === 'tabAudio' ? 'Share tab audio' : 'Start mic';
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