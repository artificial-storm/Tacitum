import { describe, expect, test } from 'vitest';
import { visualHeightDisplacement, visualPlaneDimensions, visualViewportScale } from './VisualGeometry';

describe('VisualGeometry', () => {
  test('moves height along the plane normal instead of a front-view diagonal', () => {
    const radius = 180;
    const planeHeight = radius * 1.6;
    const planeDepth = 82;
    const displacement = visualHeightDisplacement(48, radius);
    const rowAxisDot = displacement.y * planeHeight + displacement.z * -planeDepth;

    expect(Math.abs(rowAxisDot)).toBeLessThan(0.001);
    expect(displacement.y).toBeLessThan(0);
    expect(displacement.z).toBeLessThan(0);
    expect(Math.abs(displacement.z)).toBeGreaterThan(Math.abs(displacement.y) * 2.4);
  });

  test('uses a square visual plane and 75 percent viewport scale', () => {
    const dimensions = visualPlaneDimensions(180);

    expect(dimensions.width).toBeCloseTo(Math.hypot(dimensions.height, dimensions.depth), 4);
    expect(visualViewportScale).toBeCloseTo(0.3, 4);
  });
});