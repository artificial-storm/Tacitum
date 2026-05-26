import { describe, expect, test } from 'vitest';
import { VisualCamera } from './VisualCamera';

describe('VisualCamera', () => {
  test('keeps viewport placement fixed while rotating in one shared state', () => {
    const camera = new VisualCamera();

    camera.startDrag(100, 100);
    camera.dragTo(140, 70);
    camera.endDrag();

    const state = camera.getState();

    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
    expect(state.yaw).toBeLessThan(0);
    expect(state.pitch).toBeLessThan(0);
  });

  test('projects points differently after rotation with camera-owned depth scale', () => {
    const camera = new VisualCamera();
    const before = camera.projectPoint({ x: 40, y: 20, z: 30 });

    camera.startDrag(100, 100);
    camera.dragTo(160, 130);

    const after = camera.projectPoint({ x: 40, y: 20, z: 30 });

    expect(after.x).not.toBeCloseTo(before.x, 4);
    expect(after.y).not.toBeCloseTo(before.y, 4);
    expect(before.depthScale).not.toBe(1);
    expect(after.depthScale).not.toBe(1);
  });

  test('makes farther points smaller without changing the pivot position', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: 0, z: 41 };
    const far = camera.projectPoint({ x: 80, y: 0, z: 82 }, pivot);
    const near = camera.projectPoint({ x: 80, y: 0, z: 0 }, pivot);
    const projectedPivot = camera.projectPoint(pivot, pivot);

    expect(far.depthScale).toBeLessThan(1);
    expect(near.depthScale).toBeGreaterThan(1);
    expect(Math.abs(far.x)).toBeLessThan(Math.abs(near.x));
    expect(projectedPivot.x).toBeCloseTo(0, 4);
    expect(projectedPivot.y).toBeCloseTo(0, 4);
  });

  test('uses enough perspective for a rotated plane to read with depth', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: 0, z: 41 };
    const backLeft = camera.projectPoint({ x: -120, y: -80, z: 82 }, pivot);
    const frontRight = camera.projectPoint({ x: 120, y: 80, z: 0 }, pivot);

    expect(frontRight.depthScale - backLeft.depthScale).toBeGreaterThan(0.12);
  });

  test('inverts rotation so dragging feels like pulling the plane front', () => {
    const camera = new VisualCamera();

    camera.startDrag(100, 100);
    camera.dragTo(160, 130);

    const state = camera.getState();

    expect(state.yaw).toBeLessThan(0);
    expect(state.pitch).toBeGreaterThan(0);
  });

  test('rotates around an explicit plane-center pivot', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: 0, z: 41 };

    camera.startDrag(100, 100);
    camera.dragTo(180, 70);

    const projectedPivot = camera.projectPoint(pivot, pivot);
    const projectedFarPoint = camera.projectPoint({ x: 0, y: 0, z: 82 }, pivot);

    expect(projectedPivot.x).toBeCloseTo(0, 4);
    expect(projectedPivot.y).toBeCloseTo(0, 4);
    expect(projectedFarPoint.x).not.toBeCloseTo(projectedPivot.x, 4);
  });

  test('keeps a centered pivot visually locked during rotation', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: -1.4, z: 41 };
    const before = camera.projectPoint(pivot, pivot);

    camera.startDrag(120, 120);
    camera.dragTo(260, 40);

    const after = camera.projectPoint(pivot, pivot);

    expect(before.x).toBeCloseTo(0, 4);
    expect(before.y).toBeCloseTo(0, 4);
    expect(after.x).toBeCloseTo(0, 4);
    expect(after.y).toBeCloseTo(0, 4);
  });

  test('keeps the midpoint of a centered line pinned during perspective rotation', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: -1.4, z: 41 };

    camera.startDrag(120, 120);
    camera.dragTo(280, 70);

    const left = camera.projectPoint({ x: -90, y: pivot.y, z: pivot.z }, pivot);
    const right = camera.projectPoint({ x: 90, y: pivot.y, z: pivot.z }, pivot);
    const midpoint = (left.x + right.x) / 2;

    expect(Math.abs(midpoint)).toBeLessThan(8);
  });

  test('projects rotated plane edges as straight lines without clipping the perspective scale', () => {
    const camera = new VisualCamera();
    const pivot = { x: 0, y: 0, z: 41 };

    camera.startDrag(120, 120);
    camera.dragTo(320, 40);

    const top = camera.projectPoint({ x: 210, y: -144, z: 82 }, pivot);
    const middle = camera.projectPoint({ x: 210, y: 0, z: 41 }, pivot);
    const bottom = camera.projectPoint({ x: 210, y: 144, z: 0 }, pivot);
    const projectedArea = Math.abs((middle.x - top.x) * (bottom.y - top.y) - (middle.y - top.y) * (bottom.x - top.x));
    const projectedLength = Math.hypot(bottom.x - top.x, bottom.y - top.y);

    expect(projectedArea / projectedLength).toBeLessThan(0.5);
  });

  test('continues rotating after release and eases the spin down', () => {
    const camera = new VisualCamera();

    camera.startDrag(100, 100);
    camera.dragTo(180, 140);
    camera.endDrag();

    const released = camera.getState();
    camera.update(1000);
    const afterFirstFrame = camera.getState();
    camera.update(1016);
    const afterSecondFrame = camera.getState();

    const firstYawStep = afterFirstFrame.yaw - released.yaw;
    const secondYawStep = afterSecondFrame.yaw - afterFirstFrame.yaw;

    expect(firstYawStep).toBeLessThan(0);
    expect(Math.abs(secondYawStep)).toBeLessThan(Math.abs(firstYawStep));
  });
});