/**
 * lightingPresets.js
 *
 * Named lighting configurations for the Sketch app.
 * Each entry in `lights[]` maps 1-to-1 to a Three.js / R3F light component.
 *
 * Light fields:
 *   id           – unique string key
 *   type         – 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot' | 'rectarea'
 *   name         – human-readable label
 *   enabled      – boolean
 *   color        – CSS hex string  (all types)
 *   intensity    – number 0–3
 *   position     – [x,y,z]          (directional / point / spot / rectarea)
 *   target       – [x,y,z]          (directional / spot)
 *   castShadow   – boolean           (directional / spot only — point is too expensive)
 *   shadowMapSize– 512 | 1024 | 2048 (when castShadow is true)
 *   angle        – radians 0–PI/2   (spot)
 *   penumbra     – 0–1              (spot)
 *   decay        – 1–2              (point / spot)
 *   groundColor  – CSS hex          (hemisphere)
 *   width/height – number           (rectarea)
 */

export const PRESETS = {
    studio: {
        label: 'Studio',
        shadows: false,
        lights: [
            {
                id: 'ambient',
                type: 'ambient',
                name: 'Ambient Fill',
                enabled: true,
                color: '#ffffff',
                intensity: 0.35,
            },
            {
                id: 'key',
                type: 'directional',
                name: 'Key Light',
                enabled: true,
                color: '#fff5e0',
                intensity: 1.4,
                position: [20, 30, 20],
                target: [0, 0, 0],
                castShadow: false,
                shadowMapSize: 1024,
            },
            {
                id: 'fill',
                type: 'directional',
                name: 'Fill Light',
                enabled: true,
                color: '#c5d8ff',
                intensity: 0.5,
                position: [-15, 20, -10],
                target: [0, 0, 0],
                castShadow: false,
                shadowMapSize: 1024,
            },
        ],
    },

    workshop: {
        label: 'Workshop',
        shadows: true,
        lights: [
            {
                id: 'hemi',
                type: 'hemisphere',
                name: 'Sky/Ground',
                enabled: true,
                color: '#e8f0ff',
                groundColor: '#3a2a1a',
                intensity: 0.45,
            },
            {
                id: 'overhead1',
                type: 'directional',
                name: 'Overhead A',
                enabled: true,
                color: '#fffaf0',
                intensity: 1.2,
                position: [10, 40, 5],
                target: [0, 0, 0],
                castShadow: true,
                shadowMapSize: 1024,
            },
            {
                id: 'overhead2',
                type: 'directional',
                name: 'Overhead B',
                enabled: true,
                color: '#fffaf0',
                intensity: 0.8,
                position: [-10, 35, -5],
                target: [0, 0, 0],
                castShadow: false,
                shadowMapSize: 1024,
            },
        ],
    },

    outdoor: {
        label: 'Outdoor',
        shadows: true,
        lights: [
            {
                id: 'hemi',
                type: 'hemisphere',
                name: 'Sky',
                enabled: true,
                color: '#87ceeb',
                groundColor: '#4a3728',
                intensity: 0.6,
            },
            {
                id: 'sun',
                type: 'directional',
                name: 'Sun',
                enabled: true,
                color: '#fff0cc',
                intensity: 2.0,
                position: [30, 50, 20],
                target: [0, 0, 0],
                castShadow: true,
                shadowMapSize: 1024,
            },
        ],
    },

    dramatic: {
        label: 'Dramatic',
        shadows: true,
        lights: [
            {
                id: 'ambient',
                type: 'ambient',
                name: 'Ambient',
                enabled: true,
                color: '#111111',
                intensity: 0.08,
            },
            {
                id: 'spot',
                type: 'spot',
                name: 'Spotlight',
                enabled: true,
                color: '#fff8ee',
                intensity: 3.0,
                position: [12, 40, 12],
                target: [0, 6, 0],
                castShadow: true,
                shadowMapSize: 1024,
                angle: 0.42,
                penumbra: 0.35,
                decay: 1.5,
            },
        ],
    },

    flat: {
        label: 'Flat / Technical',
        shadows: false,
        lights: [
            {
                id: 'ambient',
                type: 'ambient',
                name: 'Ambient',
                enabled: true,
                color: '#ffffff',
                intensity: 0.85,
            },
            {
                id: 'fill',
                type: 'directional',
                name: 'Soft Fill',
                enabled: true,
                color: '#ffffff',
                intensity: 0.4,
                position: [0, 20, 0],
                target: [0, 0, 0],
                castShadow: false,
                shadowMapSize: 1024,
            },
        ],
    },
};

export const PRESET_KEYS = Object.keys(PRESETS);

/** Returns a deep clone of a preset (safe to mutate) */
export const clonePreset = (key) => JSON.parse(JSON.stringify(PRESETS[key]));

/** Default on first load */
export const DEFAULT_LIGHTING = {
    presetKey: 'studio',
    shadows: false,
    lights: clonePreset('studio').lights,
};
