export type VisualHeightDisplacement = {
  y: number;
  z: number;
};

export type VisualPlaneDimensions = {
  width: number;
  height: number;
  depth: number;
};

const planeDepth = 82;
export const visualViewportScale = 0.3;

export const visualPlaneDimensions = (radius: number): VisualPlaneDimensions => {
  const height = radius * 1.6;

  return {
    width: Math.hypot(height, planeDepth),
    height,
    depth: planeDepth,
  };
};

export const visualHeightDisplacement = (height: number, radius: number): VisualHeightDisplacement => {
  const dimensions = visualPlaneDimensions(radius);

  return {
    y: -height,
    z: -height * (dimensions.height / dimensions.depth),
  };
};