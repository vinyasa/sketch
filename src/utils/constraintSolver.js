/**
 * Constraint Solver — World-Space Only
 * 
 * All boards are axis-aligned in world space with no rotation.
 * Face positions are computed by simple arithmetic on position ± half-size.
 */
import { calculateGroupAABB } from './sceneGraph';

/**
 * Compute the world-space position of a face on a board.
 * @param {Object} board - The board object
 * @param {string} faceStr - 'x+', 'x-', 'y+', 'y-', 'z+', 'z-'
 * @returns {{ pos: number, axis: number, sign: number }}
 */
const getFaceWorldPosition = (board, faceStr) => {
    const axisChar = faceStr[0];
    const sign = faceStr[1] === '+' ? 1 : -1;
    const axisIndex = axisChar === 'x' ? 0 : axisChar === 'y' ? 1 : 2;
    const pos = board.position[axisIndex] + (board.size[axisIndex] / 2) * sign;
    return { pos, axis: axisIndex, sign };
};

/**
 * Solve a Flush or Glue alignment constraint, returning the new position
 * for the source board, or null if the target is not found.
 * 
 * With no rotation, this is simple 1D arithmetic along the face normal axis:
 * - Flush: source face aligns to the same plane as target face
 * - Glue: source face touches and is coplanar with target face (opposite normals)
 * 
 * @param {Object} sourceBoard - The board being constrained
 * @param {Object} constraintObj - { type, sourceFace, targetId, targetFace }
 * @param {Array} currentBoards - All boards
 * @param {Object} currentGroups - All groups
 * @returns {{ position: [x, y, z] } | null}
 */
export const solveAlignmentConstraint = (sourceBoard, constraintObj, currentBoards, currentGroups) => {
    let tBoard = currentBoards.find(b => b.id.toString() === constraintObj.targetId.toString());

    // If target is a group, create a virtual board from its AABB
    if (!tBoard && currentGroups[constraintObj.targetId]) {
        const aabb = calculateGroupAABB(constraintObj.targetId, currentBoards, currentGroups);
        if (aabb) {
            tBoard = {
                id: constraintObj.targetId,
                isVirtualGroupBound: true,
                size: [aabb.width, aabb.height, aabb.depth],
                position: [aabb.centerX, aabb.centerY, aabb.centerZ]
            };
        }
    }

    if (!tBoard) return null;

    const tFace = getFaceWorldPosition(tBoard, constraintObj.targetFace);
    const sFace = getFaceWorldPosition(sourceBoard, constraintObj.sourceFace);

    // For Flush: source face plane should equal target face plane
    // For Glue: source face should touch target face (faces pointing at each other)
    const targetFacePos = tFace.pos;
    const sourceFaceOffset = (sourceBoard.size[sFace.axis] / 2) * sFace.sign;

    let newPosition = [...sourceBoard.position];

    if (constraintObj.type === 'Flush') {
        // Flush: source face aligns to same plane as target face
        // sourceFace pos = newPos[axis] + sourceFaceOffset = targetFacePos
        newPosition[sFace.axis] = targetFacePos - sourceFaceOffset;
    } else {
        // Glue: the two faces touch (opposite normals, same plane)
        // sourceFace pos = newPos[axis] + sourceFaceOffset = targetFacePos
        newPosition[sFace.axis] = targetFacePos - sourceFaceOffset;
    }

    return { position: newPosition };
};

/**
 * Find all board IDs that are connected to the selected set via active constraints.
 * Uses a flood-fill algorithm to walk the constraint graph bidirectionally.
 * @param {string[]} selectedItemIds - The initially selected board IDs
 * @param {Array} boards - The boards array
 * @returns {Set<string>} All connected board IDs (including the originally selected ones)
 */
export const getConstraintConnectedSet = (selectedItemIds, boards) => {
    let movingIds = new Set(selectedItemIds);
    let added = true;
    while (added) {
        added = false;
        boards.forEach(b => {
            if (b.constraints && b.constraints.some(c => c.enabled !== false && movingIds.has(c.targetId.toString()))) {
                if (!movingIds.has(b.id.toString())) { movingIds.add(b.id.toString()); added = true; }
            }
            if (movingIds.has(b.id.toString()) && b.constraints) {
                b.constraints.forEach(c => {
                    if (c.enabled !== false && !movingIds.has(c.targetId.toString())) { movingIds.add(c.targetId.toString()); added = true; }
                });
            }
        });
    }
    return movingIds;
};
