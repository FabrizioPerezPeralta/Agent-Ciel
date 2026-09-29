export type PrimitiveShape =
  | "box"
  | "cylinder"
  | "sphere"
  | "ellipsoid"
  | "cone"
  | "torus"
  | "capsule";

export type BooleanOperation = "union" | "subtract" | "intersect";

export type ModelFeature = {
  id: string;
  shape: PrimitiveShape;
  operation: BooleanOperation;
  width: number;
  depth: number;
  height: number;
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

export type ModelSpec = {
  name: string;
  features: ModelFeature[];
};

export interface ModelGenerationProvider {
  readonly id: string;
  generate(prompt: string, currentModel: ModelSpec): Promise<ModelSpec>;
}

export function createFeature(
  shape: PrimitiveShape,
  operation: BooleanOperation = "union",
): ModelFeature {
  const defaults = shape === "sphere" || shape === "ellipsoid" || shape === "capsule"
    ? { width: 20, depth: 20, height: 20 }
    : shape === "cone"
      ? { width: 20, depth: 0, height: 30 }
      : shape === "torus"
        ? { width: 30, depth: 6, height: 6 }
        : shape === "cylinder"
          ? { width: 20, depth: 20, height: 30 }
          : { width: 30, depth: 20, height: 10 };

  return {
    id: crypto.randomUUID(),
    shape,
    operation,
    ...defaults,
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
}

export const defaultModel: ModelSpec = {
  name: "Pieza sin título",
  features: [createFeature("box")],
};
