import type { AudioFeatures } from '../types/audio';
import type { SpeechActivityFrame } from '../types/speech';
import type { SpeakerFrame } from '../types/speakers';

export class DebugPanel {
  constructor(private readonly root: HTMLElement) {}

  update(audio: AudioFeatures, speech: SpeechActivityFrame, speaker: SpeakerFrame, visible: boolean): void {
    this.root.hidden = !visible;

    if (!visible) {
      return;
    }

    this.root.innerHTML = `
      <dl class="debug-grid">
        <div><dt>RMS</dt><dd>${audio.rms.toFixed(3)}</dd></div>
        <div><dt>Low</dt><dd>${audio.lowBand.toFixed(3)}</dd></div>
        <div><dt>Mid</dt><dd>${audio.midBand.toFixed(3)}</dd></div>
        <div><dt>High</dt><dd>${audio.highBand.toFixed(3)}</dd></div>
        <div><dt>Brightness</dt><dd>${audio.brightness.toFixed(3)}</dd></div>
        <div><dt>Centroid</dt><dd>${audio.spectralCentroid.toFixed(3)}</dd></div>
        <div><dt>Transient</dt><dd>${audio.transient.toFixed(3)}</dd></div>
        <div><dt>Noise</dt><dd>${audio.noiseFloor.toFixed(3)}</dd></div>
        <div><dt>State</dt><dd>${speech.state}</dd></div>
        <div><dt>Speaker</dt><dd>${speaker.activeSpeakerId ?? 'none'}</dd></div>
      </dl>
    `;
  }
}