/**
 * Calculates the exact dimensions and positions of the 4 walls of a procedural box
 * based on its dimensions and chosen joint strategy.
 * 
 * @param {Object} meta Formatted as: { type: 'procedural-box', w: 24, h: 8, d: 16, t: 0.75, joint: 'butt-A' }
 * @returns {Array} Array of 4 objects representing the layout: [{ role: 'front', size, position }, ...]
 */
export const calculateProceduralBoxWalls = (meta) => {
    const { w, h, d, t, joint } = meta;

    const posY = h / 2;

    const posFrontZ = (d / 2) - (t / 2);
    const posBackZ = -(d / 2) + (t / 2);
    const posRightX = (w / 2) - (t / 2);
    const posLeftX = -(w / 2) + (t / 2);

    let frontBackW = w;
    let rightLeftD = d;

    if (joint === 'butt-A') {
        // Front and Back are full width. Sides are sandwiched.
        rightLeftD = d - (2 * t);
    } else if (joint === 'butt-B') {
        // Sides are full depth. Front and back are sandwiched.
        frontBackW = w - (2 * t);
    } else if (joint === 'miter') {
        // All pieces are full length and overlap at the corners
        frontBackW = w;
        rightLeftD = d;
    }

    return [
        {
            role: 'Front',
            size: [frontBackW, h, t],
            position: [0, posY, posFrontZ],
            rotation: [0, 0, 0]
        },
        {
            role: 'Back',
            size: [frontBackW, h, t],
            position: [0, posY, posBackZ],
            rotation: [0, 0, 0]
        },
        {
            role: 'Right',
            size: [rightLeftD, h, t], // Use pure width/height face
            position: [posRightX, posY, 0],
            rotation: [0, -Math.PI / 2, 0] // Rotate to face outward along X
        },
        {
            role: 'Left',
            size: [rightLeftD, h, t], // Use pure width/height face
            position: [posLeftX, posY, 0],
            rotation: [0, Math.PI / 2, 0] // Rotate to face outward along X
        }
    ];
};
