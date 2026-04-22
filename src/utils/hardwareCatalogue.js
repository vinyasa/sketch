/**
 * Built-in hardware catalogue.
 * Users can also import custom .glb/.gltf files which get added at runtime.
 */

export const HARDWARE_CATALOGUE = [
    {
        id: 'euro-hinge',
        label: 'Euro Hinge (35mm)',
        modelUrl: '/sketch/models/euro-hinge.gltf',
        category: 'Hinges',
        icon: '🔩',
        description: 'Concealed cup hinge for frameless cabinets',
        defaultFace: 'left',
    },
    {
        id: 'butt-hinge',
        label: 'Butt Hinge (3")',
        modelUrl: '/sketch/models/butt-hinge.gltf',
        category: 'Hinges',
        icon: '📎',
        description: 'Traditional surface-mount butt hinge',
        defaultFace: 'left',
    },
    {
        id: 'bar-pull',
        label: 'Bar Pull (5")',
        modelUrl: '/sketch/models/bar-pull.gltf',
        category: 'Pulls',
        icon: '🪝',
        description: 'Modern stainless bar pull handle',
        defaultFace: 'front',
    },
    {
        id: 'round-knob',
        label: 'Round Knob',
        modelUrl: '/sketch/models/round-knob.gltf',
        category: 'Knobs',
        icon: '⚪',
        description: 'Classic brass round knob',
        defaultFace: 'front',
    },
    {
        id: 'drawer-slide',
        label: 'Drawer Slide (18")',
        modelUrl: '/sketch/models/drawer-slide.gltf',
        category: 'Slides',
        icon: '↔️',
        description: 'Ball-bearing side-mount drawer slide',
        defaultFace: 'left',
    },
];

/** Group catalogue items by category */
export function getHardwareByCategory() {
    const cats = {};
    for (const item of HARDWARE_CATALOGUE) {
        (cats[item.category] ??= []).push(item);
    }
    return cats;
}

/** Face-to-local-transform mapping for hardware placement */
const FACE_TRANSFORMS = {
    front:  { normal: [0, 0, 1],  up: [0, 1, 0], rotation: [0, 0, 0] },
    back:   { normal: [0, 0, -1], up: [0, 1, 0], rotation: [0, Math.PI, 0] },
    left:   { normal: [-1, 0, 0], up: [0, 1, 0], rotation: [0, -Math.PI / 2, 0] },
    right:  { normal: [1, 0, 0],  up: [0, 1, 0], rotation: [0, Math.PI / 2, 0] },
    top:    { normal: [0, 1, 0],  up: [0, 0, -1], rotation: [-Math.PI / 2, 0, 0] },
    bottom: { normal: [0, -1, 0], up: [0, 0, 1],  rotation: [Math.PI / 2, 0, 0] },
};

/**
 * Compute the local position for a hardware attachment on a board face.
 * @param {number[]} boardSize - [x, y, z] board dimensions
 * @param {string} face - 'front'|'back'|'left'|'right'|'top'|'bottom'
 * @param {number[]} offset - [alongX, alongY, standoff] in face-local coords
 * @returns {{ position: number[], rotation: number[] }}
 */
export function computeHardwareTransform(boardSize, face, offset = [0, 0, 0]) {
    const ft = FACE_TRANSFORMS[face] || FACE_TRANSFORMS.front;
    const [hx, hy, hz] = [boardSize[0] / 2, boardSize[1] / 2, boardSize[2] / 2];

    // Base position: center of the face + standoff along normal
    const standoff = offset[2] || 0;
    let pos;
    switch (face) {
        case 'front':  pos = [offset[0], offset[1], hz + standoff]; break;
        case 'back':   pos = [offset[0], offset[1], -hz - standoff]; break;
        case 'left':   pos = [-hx - standoff, offset[1], offset[0]]; break;
        case 'right':  pos = [hx + standoff, offset[1], offset[0]]; break;
        case 'top':    pos = [offset[0], hy + standoff, offset[1]]; break;
        case 'bottom': pos = [offset[0], -hy - standoff, offset[1]]; break;
        default:       pos = [offset[0], offset[1], hz + standoff];
    }

    return { position: pos, rotation: ft.rotation };
}
