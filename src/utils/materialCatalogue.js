/**
 * materialCatalogue.js
 *
 * Single source of truth for all material definitions:
 *   - WOOD_CATALOGUE  — 12 species with grain parameters
 *   - PAINT_PALETTE   — 16 named paint swatches
 *   - WOOD_TEXTURE_URLS — pre-computed SVG data-URLs for useTexture()
 *   - normalizeMaterial(mat) — accepts string OR descriptor, returns descriptor
 *   - getMaterialDisplayColor(mat) — returns a CSS hex for swatches / thumbnails
 */

// ─── Wood species catalogue ───────────────────────────────────────────────────
// grainColor  : base fill (what most of the surface looks like)
// baseFreq    : feTurbulence baseFrequency "x y" — x=cross-grain, y=along-grain
// fineFreq    : second pass for pores / medullary rays
// grainAlpha  : darkness of the grain lines (0–1)
// seed        : unique turbulence seed per species for visual distinction
// roughness   : Three.js MeshStandardMaterial roughness (0–1)
export const WOOD_CATALOGUE = {
    'pine':      { label: 'Pine',      grainColor: '#fdf5d6', baseFreq: '0.004 0.30', fineFreq: '0.015 0.60', grainAlpha: 0.20, seed: 2,  roughness: 0.85 },
    'white-oak': { label: 'White Oak', grainColor: '#eddcb5', baseFreq: '0.003 0.22', fineFreq: '0.018 0.50', grainAlpha: 0.22, seed: 5,  roughness: 0.80 },
    'red-oak':   { label: 'Red Oak',   grainColor: '#e7bd95', baseFreq: '0.003 0.20', fineFreq: '0.016 0.48', grainAlpha: 0.21, seed: 8,  roughness: 0.80 },
    'walnut':    { label: 'Walnut',    grainColor: '#a6876c', baseFreq: '0.002 0.18', fineFreq: '0.012 0.45', grainAlpha: 0.25, seed: 11, roughness: 0.75 },
    'cherry':    { label: 'Cherry',    grainColor: '#e5a894', baseFreq: '0.003 0.22', fineFreq: '0.014 0.52', grainAlpha: 0.18, seed: 3,  roughness: 0.78 },
    'maple':     { label: 'Maple',     grainColor: '#fffefa', baseFreq: '0.006 0.32', fineFreq: '0.020 0.65', grainAlpha: 0.06, seed: 7,  roughness: 0.82 },
    'mahogany':  { label: 'Mahogany',  grainColor: '#c57e68', baseFreq: '0.002 0.16', fineFreq: '0.010 0.42', grainAlpha: 0.24, seed: 14, roughness: 0.72 },
    'ash':       { label: 'Ash',       grainColor: '#f1e8d1', baseFreq: '0.004 0.28', fineFreq: '0.016 0.55', grainAlpha: 0.20, seed: 9,  roughness: 0.83 },
    'birch':     { label: 'Birch',     grainColor: '#ffffff', baseFreq: '0.005 0.35', fineFreq: '0.022 0.68', grainAlpha: 0.05, seed: 6,  roughness: 0.84 },
    'ebony':     { label: 'Ebony',     grainColor: '#5a4f45', baseFreq: '0.002 0.15', fineFreq: '0.008 0.38', grainAlpha: 0.28, seed: 17, roughness: 0.60 },
    'teak':      { label: 'Teak',      grainColor: '#cba774', baseFreq: '0.003 0.20', fineFreq: '0.012 0.48', grainAlpha: 0.24, seed: 4,  roughness: 0.70 },
    'cedar':     { label: 'Cedar',     grainColor: '#ebbcab', baseFreq: '0.004 0.26', fineFreq: '0.014 0.52', grainAlpha: 0.20, seed: 12, roughness: 0.82 },
};

// ─── Paint palette ────────────────────────────────────────────────────────────
export const PAINT_PALETTE = [
    { label: 'Cloud White',   hex: '#f5f0e8' },
    { label: 'Linen',         hex: '#e8dcc8' },
    { label: 'Warm Cream',    hex: '#f0e0b0' },
    { label: 'Honey',         hex: '#d4a840' },
    { label: 'Sage',          hex: '#8aaa80' },
    { label: 'Forest',        hex: '#4a7c59' },
    { label: 'Slate Blue',    hex: '#5a7898' },
    { label: 'Navy',          hex: '#1a3a5c' },
    { label: 'Charcoal',      hex: '#3a3a3a' },
    { label: 'Jet Black',     hex: '#111111' },
    { label: 'Barn Red',      hex: '#8b2020' },
    { label: 'Terracotta',    hex: '#c05a40' },
    { label: 'Dusty Rose',    hex: '#c09088' },
    { label: 'Muted Purple',  hex: '#7868a0' },
    { label: 'Gunmetal',      hex: '#4a5060' },
    { label: 'Antique White', hex: '#faebd7' },
];

// ─── SVG texture generation ───────────────────────────────────────────────────
function _buildWoodSvg(spec) {
    const seed = spec.seed ?? 3;
    const alpha = spec.grainAlpha ?? 0.55;
    const fineFreq = spec.fineFreq ?? '0.015 0.5';
    const fineAlpha = spec.fineAlpha ?? (alpha * 0.4);

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +

        // ── Base colour ──────────────────────────────────────────────────────
        `<rect width="100%" height="100%" fill="${spec.grainColor}"/>` +

        // ── Primary grain: turbulence → sharp sweeping grain lines ───────────
        // Low X freq = wide grain spans; Y freq controls cross-grain variation.
        `<filter id="a">` +
        `<feTurbulence type="turbulence" baseFrequency="${spec.baseFreq}" numOctaves="5" seed="${seed}" result="n"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${alpha} 0" in="n"/>` +
        `</filter>` +
        `<rect width="100%" height="100%" filter="url(#a)"/>` +

        // ── Fine detail: fractalNoise → pores, rays, slight figure ───────────
        `<filter id="b">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${fineFreq}" numOctaves="3" seed="${seed + 2}" result="n"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${fineAlpha} 0" in="n"/>` +
        `</filter>` +
        `<rect width="100%" height="100%" filter="url(#b)"/>` +

        `</svg>`
    );
}

/**
 * Pre-computed at module load time — stable object reference safe for useTexture().
 * Keys match WOOD_CATALOGUE keys exactly.
 */
export const WOOD_TEXTURE_URLS = Object.fromEntries(
    Object.entries(WOOD_CATALOGUE).map(([id, spec]) => [
        id,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(_buildWoodSvg(spec))}`
    ])
);

// ─── Material descriptor helpers ──────────────────────────────────────────────

/**
 * Normalize any material value to a descriptor object.
 * Accepts:
 *   - null / undefined         → { type:'wood', id:'pine' }
 *   - 'pine' (legacy string)   → { type:'wood', id:'pine' }
 *   - { type:'wood', id:'...' } → unchanged
 *   - { type:'color', hex:'#...' } → unchanged
 */
export function normalizeMaterial(mat) {
    if (!mat) return { type: 'wood', id: 'pine' };
    if (typeof mat === 'string') return { type: 'wood', id: mat };
    return mat;
}

/**
 * Return a CSS hex colour for a swatch, thumbnail, or fallback.
 * Always returns a string usable as a CSS colour.
 */
export function getMaterialDisplayColor(mat) {
    const desc = normalizeMaterial(mat);
    if (desc.type === 'color') return desc.hex;
    return WOOD_CATALOGUE[desc.id]?.grainColor ?? '#f4e4c1';
}
