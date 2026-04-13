/**
 * Procedural Box Generator — World-Space Only
 * 
 * All walls are axis-aligned with no rotation. Wall orientation is achieved
 * by setting the correct size dimensions rather than rotating.
 * 
 * Coordinate convention (Three.js native):
 *   X = left/right (Red)
 *   Y = up/down (Green)  
 *   Z = front/back (Blue)
 * 
 * @param {Object} meta - { type: 'procedural-box', w: width(X), h: height(Y), d: depth(Z), t: thickness, joint: 'butt-A'|'butt-B'|'miter' }
 * @returns {Array} Array of 4 objects: [{ role, size: [x,y,z], position: [x,y,z] }, ...]
 */
export const calculateProceduralBoxWalls = (meta) => {
    const { w, h, d, t, joint } = meta;

    // Center height: boxes sit on the floor (Y=0), so center Y = h/2
    const centerY = h / 2;

    // Front/Back walls: span the X axis (width), stand along Y (height), thin along Z (thickness)
    // Right/Left walls: thin along X (thickness), stand along Y (height), span the Z axis (depth)

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
        // All pieces are full length
        frontBackW = w;
        rightLeftD = d;
    }

    return [
        {
            role: 'Front',
            size: [frontBackW, h, t],       // wide along X, tall along Y, thin along Z
            position: [0, centerY, posFrontZ]
        },
        {
            role: 'Back',
            size: [frontBackW, h, t],
            position: [0, centerY, posBackZ]
        },
        {
            role: 'Right',
            size: [t, h, rightLeftD],        // thin along X, tall along Y, deep along Z
            position: [posRightX, centerY, 0]
        },
        {
            role: 'Left',
            size: [t, h, rightLeftD],
            position: [posLeftX, centerY, 0]
        }
    ];
};
