import { WOOD_CATALOGUE, PAINT_PALETTE } from './materialCatalogue';

export function getMaterialIntentCatalog() {
  const woods = Object.entries(WOOD_CATALOGUE).map(([id, spec]) => ({
    id,
    label: spec.label.toLowerCase(),
    type: 'wood',
  }));

  const paints = PAINT_PALETTE.map(({ hex, label }) => ({
    hex,
    label: label.toLowerCase(),
    type: 'color',
  }));

  return [...woods, ...paints].sort((a, b) => b.label.length - a.label.length);
}

export function findMaterialIntent(lower, catalog = getMaterialIntentCatalog()) {
  return catalog.find((material) => lower.includes(material.label)) || null;
}

export function toMaterialPayload(materialIntent) {
  if (!materialIntent) return null;

  if (materialIntent.type === 'color') {
    return { type: 'color', hex: materialIntent.hex };
  }

  return { type: 'wood', id: materialIntent.id };
}

export function formatMaterialLabel(label) {
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function materialPayloadFromGeminiAction(action) {
  return action.materialType === 'color'
    ? { type: 'color', hex: action.value }
    : { type: 'wood', id: action.value };
}
