export type VisualCameraState = {
  offsetX: number;
  offsetY: number;
  pitch: number;
  yaw: number;
};

export type VisualCameraPoint = {
  x: number;
  y: number;
  z: number;
};

export type ProjectedVisualPoint = {
  x: number;
  y: number;
  z: number;
  depthScale: number;
};

export class VisualCamera {
  private readonly perspectiveDistance = 620;
  private readonly state: VisualCameraState = {
    offsetX: 0,
    offsetY: 0,
    pitch: 0,
    yaw: 0,
  };
  private previousDragX = 0;
  private previousDragY = 0;
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private lastUpdateTimestamp: number | null = null;
  private dragging = false;

  startDrag(clientX: number, clientY: number): void {
    this.previousDragX = clientX;
    this.previousDragY = clientY;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.lastUpdateTimestamp = null;
    this.dragging = true;
  }

  dragTo(clientX: number, clientY: number): void {
    if (!this.dragging) {
      return;
    }

    const deltaX = clientX - this.previousDragX;
    const deltaY = clientY - this.previousDragY;

    this.previousDragX = clientX;
    this.previousDragY = clientY;
    this.yawVelocity = -deltaX * 0.0056 * 0.52;
    this.pitchVelocity = deltaY * 0.0056 * 0.52;
    this.rotateBy(-deltaX * 0.0056, deltaY * 0.0056);
  }

  endDrag(): void {
    this.dragging = false;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  getState(): VisualCameraState {
    return { ...this.state };
  }

  update(timestamp: number): void {
    if (this.dragging) {
      this.lastUpdateTimestamp = timestamp;
      return;
    }

    if (Math.abs(this.yawVelocity) < 0.0001 && Math.abs(this.pitchVelocity) < 0.0001) {
      this.lastUpdateTimestamp = timestamp;
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
      return;
    }

    const elapsed = this.lastUpdateTimestamp === null ? 16.67 : timestamp - this.lastUpdateTimestamp;
    const frameScale = this.clamp(elapsed / 16.67, 0.25, 3);
    const damping = Math.pow(0.9, frameScale);

    this.lastUpdateTimestamp = timestamp;
    this.rotateBy(this.yawVelocity * frameScale, this.pitchVelocity * frameScale);
    this.yawVelocity *= damping;
    this.pitchVelocity *= damping;
  }

  projectPoint(point: VisualCameraPoint, pivot: VisualCameraPoint = { x: 0, y: 0, z: 0 }): ProjectedVisualPoint {
    const pitchCosine = Math.cos(this.state.pitch);
    const pitchSine = Math.sin(this.state.pitch);
    const yawCosine = Math.cos(this.state.yaw);
    const yawSine = Math.sin(this.state.yaw);
    const localX = point.x - pivot.x;
    const localY = point.y - pivot.y;
    const localZ = point.z - pivot.z;
    const pitchedY = localY * pitchCosine - localZ * pitchSine;
    const pitchedZ = localY * pitchSine + localZ * pitchCosine;
    const rotatedX = localX * yawCosine + pitchedZ * yawSine;
    const rotatedZ = -localX * yawSine + pitchedZ * yawCosine;
    const depthScale = this.clamp(this.perspectiveDistance / Math.max(140, this.perspectiveDistance + rotatedZ), 0.45, 2.25);

    return {
      x: rotatedX * depthScale,
      y: pitchedY * depthScale,
      z: rotatedZ,
      depthScale,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private rotateBy(yawDelta: number, pitchDelta: number): void {
    this.state.yaw = this.clamp(this.state.yaw + yawDelta, -1.2, 1.2);
    this.state.pitch = this.clamp(this.state.pitch + pitchDelta, -1.05, 1.05);
  }
}