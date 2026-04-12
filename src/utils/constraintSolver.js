import * as THREE from 'three';
import { getGlobalMatrix } from './sceneGraph';

/**
 * Solve a Flush or Glue alignment constraint, returning the new position
 * for the source board, or null if the target is not found.
 * @param {Object} sourceBoard - The board being constrained
 * @param {Object} constraintObj - The constraint definition { type, sourceFace, targetId, targetFace }
 * @param {Array} currentBoards - The current boards array
 * @param {Object} currentGroups - The current groups object
 * @returns {{ position: [x, y, z] } | null}
 */
export const solveAlignmentConstraint = (sourceBoard, constraintObj, currentBoards, currentGroups) => {
    const tBoard = currentBoards.find(b => b.id.toString() === constraintObj.targetId.toString());
    if (!tBoard) return null;

    const getLocalData = (board, face) => {
        let norm = new THREE.Vector3();
        let pos = new THREE.Vector3();
        const sign = face[1] === '+' ? 1 : -1;
        const w = board.size[0] / 2, h = board.size[1] / 2, d = board.size[2] / 2;
        if (face[0] === 'x') { norm.set(sign, 0, 0); pos.set(w * sign, 0, 0); }
        if (face[0] === 'y') { norm.set(0, sign, 0); pos.set(0, h * sign, 0); }
        if (face[0] === 'z') { norm.set(0, 0, sign); pos.set(0, 0, d * sign); }
        return { norm, pos };
    };

    const tLocal = getLocalData(tBoard, constraintObj.targetFace);
    const sLocal = getLocalData(sourceBoard, constraintObj.sourceFace);

    const tMat = getGlobalMatrix(tBoard.id.toString(), true, currentBoards, currentGroups);
    const sMat = getGlobalMatrix(sourceBoard.id.toString(), true, currentBoards, currentGroups);

    const tGlobalPos = tLocal.pos.applyMatrix4(tMat);
    const tGlobalNorm = tLocal.norm.applyMatrix4(new THREE.Matrix4().extractRotation(tMat)).normalize();

    const sGlobalPos = sLocal.pos.applyMatrix4(sMat);

    const targetNormal = constraintObj.type === 'Flush' ? tGlobalNorm : tGlobalNorm.clone().negate();

    const dist = new THREE.Vector3().subVectors(tGlobalPos, sGlobalPos).dot(targetNormal);
    const vShiftGlobal = targetNormal.clone().multiplyScalar(dist);

    const sCenterGlobal = new THREE.Vector3(0, 0, 0).applyMatrix4(sMat);
    sCenterGlobal.add(vShiftGlobal);

    const parentMat = getGlobalMatrix(sourceBoard.parentId, false, currentBoards, currentGroups);
    const parentMatInvert = parentMat.clone().invert();

    const newLocalPos = sCenterGlobal.applyMatrix4(parentMatInvert);

    return { position: [newLocalPos.x, newLocalPos.y, newLocalPos.z] };
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
