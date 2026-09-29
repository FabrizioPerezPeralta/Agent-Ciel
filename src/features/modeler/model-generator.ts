import {
  createFeature,
  type ModelGenerationProvider,
  type ModelSpec,
  type PrimitiveShape,
} from "./model.types";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function positiveDimension(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shapeFromPrompt(prompt: string): PrimitiveShape {
  const normalized = normalize(prompt);
  if (/\b(toro|arandela)\b/.test(normalized)) return "torus";
  if (/\b(capsula|muneco|cilindro con extremos redondos)\b/.test(normalized)) return "capsule";
  if (/\b(cono|punta)\b/.test(normalized)) return "cone";
  if (/\b(esfera|bola)\b/.test(normalized)) return "sphere";
  if (/\b(ovalo|elipse|elipsoide)\b/.test(normalized)) return "ellipsoid";
  if (/\b(cilindro|tubo)\b/.test(normalized)) return "cylinder";
  return "box";
}

export class BasicPromptProvider implements ModelGenerationProvider {
  readonly id = "basic-local";

  async generate(prompt: string, _currentModel: ModelSpec): Promise<ModelSpec> {
    const normalized = normalize(prompt);
    const feature = createFeature(shapeFromPrompt(prompt));
    const triplet = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)/);
    if (triplet) {
      feature.width = positiveDimension(triplet[1]) ?? feature.width;
      feature.depth = positiveDimension(triplet[2]) ?? feature.depth;
      feature.height = positiveDimension(triplet[3]) ?? feature.height;
    }

    const labelled = (labels: string) => {
      const match = normalized.match(new RegExp(`(?:${labels})\\s*(?:de\\s*)?(\\d+(?:[.,]\\d+)?)`));
      return positiveDimension(match?.[1]);
    };
    feature.width = labelled("ancho|diametro") ?? feature.width;
    feature.depth = labelled("fondo|profundidad|largo|grosor") ?? feature.depth;
    feature.height = labelled("alto|altura") ?? feature.height;

    if (feature.shape === "sphere" || feature.shape === "capsule") {
      const measurement = normalized.match(/\b(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:mm|milimetros?)\b/);
      const diameter = positiveDimension(measurement?.[1]) ?? feature.width;
      feature.width = diameter;
      feature.depth = diameter;
      if (feature.shape === "sphere") feature.height = diameter;
    } else if (feature.shape === "cylinder") {
      feature.depth = feature.width;
    }

    return {
      name: prompt.trim().replace(/\s+/g, " ").slice(0, 80) || "Pieza",
      features: [feature],
    };
  }
}

export const basicPromptProvider = new BasicPromptProvider();
