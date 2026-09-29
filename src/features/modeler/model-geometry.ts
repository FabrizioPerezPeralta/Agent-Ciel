import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import {
  ADDITION,
  Brush,
  Evaluator,
  INTERSECTION,
  SUBTRACTION,
} from "three-bvh-csg";
import type { BooleanOperation, ModelFeature, ModelSpec } from "./model.types";

const booleanOperations = {
  union: ADDITION,
  subtract: SUBTRACTION,
  intersect: INTERSECTION,
} satisfies Record<BooleanOperation, typeof ADDITION>;

function createFeatureGeometry(feature: ModelFeature): BufferGeometry {
  switch (feature.shape) {
    case "box":
      return new BoxGeometry(feature.width, feature.height, feature.depth);
    case "cylinder":
      return new CylinderGeometry(feature.width / 2, feature.width / 2, feature.height, 48);
    case "sphere":
      return new SphereGeometry(feature.width / 2, 48, 32);
    case "ellipsoid": {
      const geometry = new SphereGeometry(1, 48, 32);
      geometry.scale(feature.width / 2, feature.height / 2, feature.depth / 2);
      return geometry;
    }
    case "cone":
      return new CylinderGeometry(feature.depth / 2, feature.width / 2, feature.height, 48);
    case "torus": {
      const geometry = new TorusGeometry((feature.width - feature.depth) / 2, feature.depth / 2, 16, 64);
      geometry.rotateX(Math.PI / 2);
      return geometry;
    }
    case "capsule": {
      const radius = feature.width / 2;
      return new CapsuleGeometry(radius, feature.height - feature.width, 12, 32);
    }
  }
}

function createBrush(feature: ModelFeature) {
  const brush = new Brush(createFeatureGeometry(feature));
  brush.position.set(feature.x, feature.y, feature.z);
  brush.rotation.set(
    (feature.rotationX * Math.PI) / 180,
    (feature.rotationY * Math.PI) / 180,
    (feature.rotationZ * Math.PI) / 180,
  );
  brush.updateMatrixWorld(true);
  return brush;
}

function disposeBrush(brush: Brush) {
  brush.disposeCacheData();
  brush.geometry.dispose();
}

export function buildModelGeometry(model: ModelSpec): BufferGeometry {
  if (model.features.length === 0) {
    throw new Error("Agrega al menos una forma para construir el modelo.");
  }
  if (model.features[0].operation !== "union") {
    throw new Error("La primera forma debe ser la base del modelo.");
  }

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  let result = createBrush(model.features[0]);

  try {
    for (const feature of model.features.slice(1)) {
      const operand = createBrush(feature);
      try {
        const next = evaluator.evaluate(result, operand, booleanOperations[feature.operation]);
        disposeBrush(result);
        result = next;
        if (!result.geometry.getAttribute("position")?.count) {
          throw new Error("La operación dejó el modelo vacío. Cambia la posición o el tipo de operación.");
        }
      } finally {
        disposeBrush(operand);
      }
    }

    result.geometry.computeBoundingBox();
    if (!result.geometry.boundingBox || result.geometry.boundingBox.isEmpty()) {
      throw new Error("No se pudo calcular el volumen del modelo.");
    }
    const geometry = result.geometry;
    result.disposeCacheData();
    return geometry;
  } catch (error) {
    disposeBrush(result);
    throw error;
  }
}

export function exportModelAsStl(model: ModelSpec) {
  const geometry = buildModelGeometry(model);
  if (!geometry.boundingBox) {
    geometry.dispose();
    throw new Error("No se pudo calcular el tamaño del modelo para exportar.");
  }

  const orientedGeometry = geometry.clone();
  geometry.dispose();
  orientedGeometry.rotateX(Math.PI / 2);
  orientedGeometry.computeBoundingBox();
  const orientedBounds = orientedGeometry.boundingBox;
  if (!orientedBounds) {
    orientedGeometry.dispose();
    throw new Error("No se pudo orientar el modelo para imprimir.");
  }
  orientedGeometry.translate(0, 0, -orientedBounds.min.z);
  const mesh = new Mesh(orientedGeometry);
  let data: string | DataView;
  try {
    data = new STLExporter().parse(mesh, { binary: true });
  } finally {
    orientedGeometry.dispose();
  }

  if (typeof data === "string") {
    throw new Error("El exportador no pudo generar un STL binario.");
  }

  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  return new Blob([buffer], { type: "model/stl" });
}
