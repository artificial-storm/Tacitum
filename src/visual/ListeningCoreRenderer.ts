import type { AudioFeatures } from '../types/audio';
import type { SpeechActivityFrame } from '../types/speech';
import type { SpeakerFrame } from '../types/speakers';
import { applyVisualSensitivity } from './AudioSensitivity';
import { DotFieldModel } from './DotFieldModel';
import { JoyFieldModel } from './JoyFieldModel';
import { topographyRidgeHeight as computeTopographyRidgeHeight } from './TopographyRenderMath';
import { VisualCamera, type VisualCameraMotionMode } from './VisualCamera';
import { visualHeightDisplacement, visualViewportScale } from './VisualGeometry';
import { cameraZoomRange, rippleHeightRange, rippleSpeedRange, sensitivityRange, tailDampingRange } from './visualControlDefaults';
import { visualTokens } from './visualTokens';

export type ListeningCoreFrame = {
  audio: AudioFeatures;
  speech: SpeechActivityFrame;
  speaker: SpeakerFrame;
};

export type VisualMode = 'depthPlane' | 'topography';

type PlanePoint = {
  baseX: number;
  baseY: number;
  baseZ: number;
  depth: number;
};

type PlanePivot = {
  x: number;
  y: number;
  z: number;
};

export class ListeningCoreRenderer {
  private readonly context2d: CanvasRenderingContext2D;
  private readonly dotModel = new DotFieldModel({ rings: 16, dotsPerRing: 26, radius: 180 });
  private readonly joyModel = new JoyFieldModel({ rings: 16, dotsPerRing: 26, radius: 180 });
  private readonly dotPivot = this.planePivotFor(this.dotModel.dots);
  private readonly joyPivot = this.planePivotFor(this.joyModel.dots);
  private readonly camera = new VisualCamera();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private mode: VisualMode = 'depthPlane';
  private width = 0;
  private height = 0;
  private devicePixelRatio = 1;
  private initialized = false;
  private lastResizeCheck = 0;
  private sensitivity: number = sensitivityRange.default;
  private rippleHeightScale: number = rippleHeightRange.default;
  private activePointerId: number | null = null;
  private pinchDistance: number | null = null;
  private readonly touchPoints = new Map<number, { x: number; y: number }>();
  private rippleSpeed: number = rippleSpeedRange.default;
  private tailDamping: number = tailDampingRange.default;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context2d = canvas.getContext('2d');

    if (!context2d) {
      throw new Error('Canvas 2D is not available.');
    }

    this.context2d = context2d;
    this.canvas.dataset.mode = this.mode;
    this.dotModel.setFlowControls(this.rippleSpeed, this.tailDamping);
    this.bindCameraControls();
    this.resize();
  }

  setMode(mode: VisualMode): void {
    if (mode === this.mode) {
      return;
    }

    this.mode = mode;
    this.canvas.dataset.mode = mode;
    this.initialized = false;
  }

  setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.min(sensitivityRange.max, Math.max(0.45, sensitivity));
  }

  setRippleHeightScale(scale: number): void {
    this.rippleHeightScale = Math.min(rippleHeightRange.max, Math.max(rippleHeightRange.min, scale));
    this.dotModel.setRippleHeightScale(this.rippleHeightScale);
    this.joyModel.setTopographyHeightScale(this.rippleHeightScale);
  }

  setDotFlowControls(speed: number, tailDamping: number): void {
    this.rippleSpeed = Math.min(rippleSpeedRange.max, Math.max(rippleSpeedRange.min, speed));
    this.tailDamping = Math.min(tailDampingRange.max, Math.max(tailDampingRange.min, tailDamping));
    this.dotModel.setFlowControls(this.rippleSpeed, this.tailDamping);
  }

  setCameraMotionMode(mode: VisualCameraMotionMode): void {
    this.camera.setMotionMode(mode);
  }

  setCameraZoom(zoom: number): void {
    this.camera.setZoom(Math.min(cameraZoomRange.max, Math.max(cameraZoomRange.min, zoom)));
  }

  render(frame: ListeningCoreFrame): void {
    this.resize(frame.audio.timestamp);
    const adjustedFrame = this.applySensitivity(this.reducedMotion.matches ? this.reduceMotion(frame) : frame);

    if (this.mode === 'topography') {
      this.joyModel.update(adjustedFrame);
    } else {
      this.dotModel.update(adjustedFrame);
    }

    this.context2d.save();
    this.drawBackground();
    this.camera.update(adjustedFrame.audio.timestamp);
    const cameraState = this.camera.getState();

    this.context2d.translate(
      this.width / 2 + cameraState.offsetX * this.devicePixelRatio,
      this.height / 2 + cameraState.offsetY * this.devicePixelRatio,
    );

    const renderRadius = Math.min(this.width, this.height) * visualViewportScale;
    const activeRadius = this.mode === 'topography' ? this.joyModel.options.radius : this.dotModel.options.radius;
    const scale = renderRadius / activeRadius * cameraState.zoom;
    this.context2d.scale(scale, scale);

    if (this.mode === 'topography') {
      this.drawTopography(adjustedFrame);
    } else {
      this.drawDepthDots(adjustedFrame);
    }

    this.context2d.restore();
  }

  private resize(timestamp = performance.now()): void {
    if (timestamp - this.lastResizeCheck < 250 && this.width > 0 && this.height > 0) {
      return;
    }

    this.lastResizeCheck = timestamp;
    const bounds = this.canvas.getBoundingClientRect();
    const nextRatio = Math.min(1.5, window.devicePixelRatio || 1);
    const nextWidth = Math.max(320, Math.floor(bounds.width * nextRatio));
    const nextHeight = Math.max(320, Math.floor(bounds.height * nextRatio));

    if (nextWidth === this.width && nextHeight === this.height && nextRatio === this.devicePixelRatio) {
      return;
    }

    this.width = nextWidth;
    this.height = nextHeight;
    this.devicePixelRatio = nextRatio;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.initialized = false;
  }

  private drawBackground(): void {
    if (!this.initialized) {
      this.context2d.fillStyle = visualTokens.background;
      this.context2d.fillRect(0, 0, this.width, this.height);
      this.initialized = true;
    }

    this.context2d.fillStyle = visualTokens.background;
    this.context2d.fillRect(0, 0, this.width, this.height);
  }

  private drawDepthDots(frame: ListeningCoreFrame): void {
    const primarySpeaker = frame.speaker.speakers.find((speaker) => speaker.speakerId === frame.speaker.activeSpeakerId && speaker.speaking);

    for (const dot of this.dotModel.dots) {
      const voiceEnergy = primarySpeaker?.voiceEnergy ?? 0;
      const accent = primarySpeaker ? this.hexToRgb(primarySpeaker.visualSignature.accent) : null;
      const near = 1 - dot.depth;
      const distanceFade = 0.98 + near * 0.04;
      const idleOpacity = 0.32 + near * 0.06;
      const opacity = Math.min(0.96, (idleOpacity + dot.opacity * 1.08 + voiceEnergy * 0.08) * distanceFade);
      const color = accent
        ? `rgba(${accent.red}, ${accent.green}, ${accent.blue}, ${opacity})`
        : `rgba(247, 244, 236, ${opacity})`;

      if (opacity < 0.004) {
        continue;
      }

      this.context2d.beginPath();
      this.context2d.fillStyle = color;
      const projected = this.camera.projectPoint({ x: dot.x, y: dot.y, z: dot.z }, this.dotPivot);
      const radius = Math.max(0.34, dot.radius * (0.62 + Math.pow(near, 1.45) * 1.12 + dot.lift * 0.2) * projected.depthScale);

      this.context2d.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      this.context2d.fill();
    }

    this.context2d.shadowBlur = 0;
  }

  private drawTopography(frame: ListeningCoreFrame): void {
    this.drawTopographyLayer(frame, null, 0, 1, 0);
  }

  private drawTopographyLayer(frame: ListeningCoreFrame, accentHex: string | null, verticalOffset: number, layerEnergy: number, phaseOffset: number): void {
    for (let rowIndex = 0; rowIndex < this.joyModel.rows.length; rowIndex += 1) {
      const row = this.joyModel.rows[rowIndex];
      const rowRatio = rowIndex / Math.max(1, this.joyModel.rows.length - 1);
      const lineEnergy = row[0]?.lineEnergy ?? 0;
      const baseAlpha = 0.3 + rowRatio * 0.07;
      const lineAlpha = accentHex ? Math.min(0.66, layerEnergy * (0.16 + rowRatio * 0.22)) : Math.min(0.72, baseAlpha);
      const accent = accentHex ? this.hexToRgb(accentHex) : null;

      const points: Array<{ x: number; y: number }> = [];
      let rowDepthScale = 1;

      for (let index = 0; index < row.length; index += 1) {
        const dot = row[index];
        const ridge = this.topographyRidgeHeight(dot.frequencyRatio, rowIndex, rowRatio, dot.topographyLift, lineEnergy, frame, phaseOffset);
        const ridgeOffset = visualHeightDisplacement(ridge, this.joyModel.options.radius);
        const projected = this.camera.projectPoint({ x: dot.x, y: dot.y + ridgeOffset.y + verticalOffset, z: dot.z + ridgeOffset.z }, this.joyPivot);

        rowDepthScale += projected.depthScale;
        points.push({ x: projected.x, y: projected.y });
      }

      const rowScale = row.length === 0 ? 1 : rowDepthScale / (row.length + 1);
      const bottomProjection = this.camera.projectPoint({ x: this.joyPivot.x, y: this.joyModel.options.radius * 1.05 + verticalOffset, z: row[0]?.z ?? this.joyPivot.z }, this.joyPivot);
      const occlusionPath = this.buildSmoothPath(points, bottomProjection.y);
      this.context2d.fillStyle = visualTokens.background;
      this.context2d.fill(occlusionPath);

      const linePath = this.buildSmoothPath(points);
      const lineColor = accent ?? { red: 247, green: 244, blue: 236 };
      this.context2d.strokeStyle = `rgba(${lineColor.red}, ${lineColor.green}, ${lineColor.blue}, ${lineAlpha})`;
      this.context2d.lineWidth = (accentHex ? 1.3 + layerEnergy * 0.54 : 1.08 + rowRatio * 0.22) * rowScale;
      this.context2d.lineJoin = 'round';
      this.context2d.lineCap = 'round';
      this.context2d.shadowBlur = 0;
      this.context2d.stroke(linePath);
    }

    this.context2d.shadowBlur = 0;
  }

  private buildSmoothPath(points: Array<{ x: number; y: number }>, bottomY?: number): Path2D {
    const path = new Path2D();

    if (points.length === 0) {
      return path;
    }

    path.moveTo(points[0].x, points[0].y);

    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const nextAfter = points[Math.min(points.length - 1, index + 2)];
      const controlOneX = current.x + (next.x - previous.x) / 6;
      const controlOneY = current.y + (next.y - previous.y) / 6;
      const controlTwoX = next.x - (nextAfter.x - current.x) / 6;
      const controlTwoY = next.y - (nextAfter.y - current.y) / 6;

      path.bezierCurveTo(controlOneX, controlOneY, controlTwoX, controlTwoY, next.x, next.y);
    }

    const last = points[points.length - 1];

    if (bottomY !== undefined) {
      path.lineTo(last.x, bottomY);
      path.lineTo(points[0].x, bottomY);
      path.closePath();
    }

    return path;
  }

  private topographyRidgeHeight(frequencyRatio: number, rowIndex: number, rowRatio: number, lift: number, lineEnergy: number, frame: ListeningCoreFrame, phaseOffset: number): number {
    return computeTopographyRidgeHeight({
      frequencyRatio,
      rowIndex,
      rowRatio,
      lift,
      lineEnergy,
      audio: frame.audio,
      phaseOffset,
      heightScale: this.rippleHeightScale,
    });
  }

  private planePivotFor(points: PlanePoint[]): PlanePivot {
    const bounds = points.reduce((currentBounds, point) => {
      return {
        minX: Math.min(currentBounds.minX, point.baseX),
        maxX: Math.max(currentBounds.maxX, point.baseX),
        minY: Math.min(currentBounds.minY, point.baseY),
        maxY: Math.max(currentBounds.maxY, point.baseY),
        minZ: Math.min(currentBounds.minZ, point.baseZ),
        maxZ: Math.max(currentBounds.maxZ, point.baseZ),
      };
    }, {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    });

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    };
  }

  private bindCameraControls(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      if (event.pointerType !== 'mouse') {
        this.touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (this.touchPoints.size === 2) {
        this.releaseDrag();
        this.pinchDistance = this.currentPinchDistance();
        event.preventDefault();
        return;
      }

      this.activePointerId = event.pointerId;
      this.camera.startDrag(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add('is-dragging');
      event.preventDefault();
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (this.touchPoints.has(event.pointerId)) {
        this.touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (this.touchPoints.size === 2) {
        const nextDistance = this.currentPinchDistance();

        if (this.pinchDistance !== null) {
          this.camera.adjustZoom(this.clamp((nextDistance - this.pinchDistance) / 240, -0.07, 0.07));
        }

        this.pinchDistance = nextDistance;
        event.preventDefault();
        return;
      }

      if (event.pointerId !== this.activePointerId || !this.camera.isDragging()) {
        return;
      }

      this.camera.dragTo(event.clientX, event.clientY);
      event.preventDefault();
    });

    const endDrag = (event: PointerEvent): void => {
      this.touchPoints.delete(event.pointerId);

      if (this.touchPoints.size < 2) {
        this.pinchDistance = null;
      }

      if (event.pointerId !== this.activePointerId) {
        return;
      }

      this.releaseDrag();
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('wheel', (event) => {
      this.camera.adjustZoom(this.clamp(-event.deltaY * 0.0012, -0.08, 0.08));
      event.preventDefault();
    }, { passive: false });
  }

  private currentPinchDistance(): number {
    const [first, second] = [...this.touchPoints.values()];

    if (!first || !second) {
      return 0;
    }

    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private releaseDrag(): void {
    this.camera.endDrag();
    this.activePointerId = null;
    this.canvas.classList.remove('is-dragging');
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private applySensitivity(frame: ListeningCoreFrame): ListeningCoreFrame {
    return applyVisualSensitivity(frame, this.sensitivity);
  }

  private reduceMotion(frame: ListeningCoreFrame): ListeningCoreFrame {
    return {
      ...frame,
      audio: {
        ...frame.audio,
        transient: frame.audio.transient * 0.35,
        rhythm: frame.audio.rhythm * 0.2,
      },
      speech: {
        ...frame.speech,
        speechStart: false,
      },
    };
  }

  private hexToRgb(hex: string): { red: number; green: number; blue: number } {
    const normalized = hex.replace('#', '');
    return {
      red: Number.parseInt(normalized.slice(0, 2), 16),
      green: Number.parseInt(normalized.slice(2, 4), 16),
      blue: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }
}