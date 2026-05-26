import { Box3, Euler, Matrix4, Vector3, Quaternion } from 'three';

/**
 * Constraint Solver — Central Index Edition
 *
 * Constraints live in the store as `constraints: { [uuid]: {...} }`.
 * Boards carry no constraints array.
 *
 * Constraint types:
 *   Flush — locks 1 axis (the face normal). Partner follows on that axis only.
 *   Glue  — locks all 3 axes. Partner follows every movement as a rigid unit.
 *
 * Axis convention: 0=X (Red), 1=Y (Green), 2=Z (Blue)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a face string to its axis index. */
export const faceToAxis = (faceStr) => {
    if (!faceStr) return null;
    const c = faceStr[0];
    return c === 'x' ? 0 : c === 'y' ? 1 : 2;
};

/**
 * Compute the true world-space AABB of a board, accounting for its orientation.
 * For unoriented boards this is just position ± size/2 per axis.
 * For oriented boards we transform all 8 corners and recompute the enclosing box.
 *
 * @param {Object} board  — { position, size, orientation? }
 * @returns {THREE.Box3}
 */
export const getRotatedBoardAABB = (board) => {
    const [px, py, pz] = board.position;
    const [sx, sy, sz] = board.size;

    // Local box centred at origin
    const box = new Box3(
        new Vector3(-sx / 2, -sy / 2, -sz / 2),
        new Vector3( sx / 2,  sy / 2,  sz / 2)
    );

    const [rx, ry, rz] = board.orientation || [0, 0, 0];
    const piv = board.pivot || [0, 0, 0];
    const hasPivot = piv[0] !== 0 || piv[1] !== 0 || piv[2] !== 0;

    if (rx === 0 && ry === 0 && rz === 0) {
        // Fast path — just translate, accounting for pivot shifting the center
        box.translate(new Vector3(px - piv[0], py - piv[1], pz - piv[2]));
        return box;
    }

    // Build orientation + translation matrix using Three.js YXZ Euler order and pivot offset
    const matrix = new Matrix4();
    const euler = new Euler(rx, ry, rz, 'YXZ');
    const quaternion = new Quaternion().setFromEuler(euler);
    const position = new Vector3(px, py, pz);

    if (hasPivot) {
        const pivotPos = new Vector3(...piv);
        const rotationMatrix = new Matrix4().makeRotationFromQuaternion(quaternion);
        const invPivotMatrix = new Matrix4().makeTranslation(-pivotPos.x, -pivotPos.y, -pivotPos.z);
        const translationMatrix = new Matrix4().makeTranslation(position.x, position.y, position.z);
        
        matrix.multiply(translationMatrix)
              .multiply(rotationMatrix)
              .multiply(invPivotMatrix);
    } else {
        matrix.compose(position, quaternion, new Vector3(1, 1, 1));
    }

    // applyMatrix4 transforms all 8 corners and recomputes the enclosing AABB
    box.applyMatrix4(matrix);
    return box;
};

/**
 * World-space position of a face centre on a board.
 * For oriented boards the face position is the AABB extremal extent on that axis
 * (the furthest point the board reaches in that direction), which is the
 * geometrically correct attachment point for Flush/Glue constraint lines.
 */
export const getFaceWorldPos = (board, faceStr) => {
    const axis = faceToAxis(faceStr);
    const sign = faceStr[1] === '+' ? 1 : -1;

    const [rx, ry, rz] = board.orientation || [0, 0, 0];
    if (rx !== 0 || ry !== 0 || rz !== 0) {
        const aabb  = getRotatedBoardAABB(board);
        const pos = [...board.position];
        pos[axis] = sign === 1 ? aabb.max.getComponent(axis) : aabb.min.getComponent(axis);
        return pos;
    }

    // Fast path for unrotated boards
    const pos = [...board.position];
    const piv = board.pivot || [0, 0, 0];
    pos[axis] += (board.size[axis] / 2) * sign - piv[axis];
    return pos;
};

// ─── Conflict Detection ───────────────────────────────────────────────────────

/**
 * Check whether adding a new constraint would conflict with existing ones.
 *
 * @param {{ type, boardAId, boardBId, faceA?, faceB? }} proposed
 * @param {Object} constraints  — current central constraints map
 * @param {Array}  boards       — current boards array
 * @returns {string|null} Error message, or null if no conflict.
 */
export const checkConstraintConflict = (proposed, constraints, boards) => {
    const { type, boardAId, boardBId } = proposed;

    // Rule: no self-constraint
    if (boardAId === boardBId) return 'A board cannot be constrained to itself.';

    const existing = Object.values(constraints);

    // Rule: no exact duplicate (for Flush, only duplicate on the same axis)
    const isDupe = existing.some(c =>
        c.enabled !== false &&
        ((c.boardAId === boardAId && c.boardBId === boardBId) ||
         (c.boardAId === boardBId && c.boardBId === boardAId)) &&
        c.type === type &&
        (type !== 'Flush' || c.axis === proposed.axis)
    );
    if (isDupe) return `A ${type} constraint between these two boards on this axis already exists.`;

    if (type === 'Glue') {
        // Note: no single-glue-per-board restriction. A board may be glued to
        // many others (e.g. a table top glued to four legs). The only invalid
        // case is a duplicate pair, which is already caught above.
    }

    return null;
};

// ─── Connected Sets ───────────────────────────────────────────────────────────

/**
 * Get all board IDs that are Flush-connected to `boardId` on a specific axis.
 * Traverses transitively (A flush B, B flush C → all three are connected).
 *
 * @param {string} boardId
 * @param {number} axis — 0, 1, or 2
 * @param {Object} constraints
 * @returns {Set<string>}
 */
export const getFlushConnectedSet = (boardId, axis, constraints) => {
    const visited = new Set([boardId]);
    const queue = [boardId];
    while (queue.length) {
        const cur = queue.shift();
        Object.values(constraints).forEach(c => {
            if (c.type !== 'Flush' || c.enabled === false || c.axis !== axis) return;
            const partner = c.boardAId === cur ? c.boardBId
                          : c.boardBId === cur ? c.boardAId
                          : null;
            if (partner && !visited.has(partner)) {
                visited.add(partner);
                queue.push(partner);
            }
        });
    }
    return visited;
};

/**
 * Get all board IDs that are Glue-connected to `boardId`.
 *
 * @param {string} boardId
 * @param {Object} constraints
 * @returns {Set<string>}
 */
export const getGlueConnectedSet = (boardId, constraints) => {
    const visited = new Set([boardId]);
    const queue = [boardId];
    while (queue.length) {
        const cur = queue.shift();
        Object.values(constraints).forEach(c => {
            if (c.type !== 'Glue' || c.enabled === false) return;
            const partner = c.boardAId === cur ? c.boardBId
                          : c.boardBId === cur ? c.boardAId
                          : null;
            if (partner && !visited.has(partner)) {
                visited.add(partner);
                queue.push(partner);
            }
        });
    }
    return visited;
};

// ─── Propagation ──────────────────────────────────────────────────────────────

/**
 * Given a set of boards that are moving by delta[0..2], compute the full set
 * of board IDs that must also move, and by how much on each axis.
 *
 * Returns a Map<boardId, [dx, dy, dz]> for every board that needs to move
 * (including the originally moving boards themselves).
 *
 * @param {string[]} movingIds — IDs of boards being directly moved
 * @param {number[]} delta     — [dx, dy, dz]
 * @param {Object}   constraints
 * @returns {Map<string, number[]>}
 */
export const propagateMove = (movingIds, delta, constraints) => {
    // result map: boardId → [dx, dy, dz]
    const result = new Map();

    const initSet = new Set(movingIds.map(String));

    // ── Glue: union all glue-connected sets ──────────────────────────────────
    // Any board glued to a moving board moves by the full delta vector.
    const glueSet = new Set(initSet);
    initSet.forEach(id => {
        getGlueConnectedSet(id, constraints).forEach(gid => glueSet.add(gid));
    });

    // Assign full delta to all glue-connected boards
    glueSet.forEach(id => {
        result.set(id, [...delta]);
    });

    return result;
};

// ─── Initial Position Solve (used when creating a Flush constraint) ───────────

/**
 * Snap boardA so that faceA is coplanar with faceB on boardB.
 * Returns the new position for boardA, or null if boards not found.
 *
 * @param {Object} boardA
 * @param {string} faceA
 * @param {Object} boardB
 * @param {string} faceB
 * @returns {number[]|null} New [x,y,z] position for boardA
 */
export const solveFlushSnap = (boardA, faceA, boardB, faceB) => {
    const axis  = faceToAxis(faceA);
    const signA = faceA[1] === '+' ? 1 : -1;
    const signB = faceB[1] === '+' ? 1 : -1;

    // ── Target plane: where boardB's faceB sits in world space ──────────────
    const [rbx, rby, rbz] = boardB.orientation || [0, 0, 0];
    let targetPlane;
    if (rbx !== 0 || rby !== 0 || rbz !== 0) {
        const aabbB = getRotatedBoardAABB(boardB);
        targetPlane = signB === 1
            ? aabbB.max.getComponent(axis)
            : aabbB.min.getComponent(axis);
    } else {
        targetPlane = boardB.position[axis] + (boardB.size[axis] / 2) * signB;
    }

    // ── Half-extent of boardA's face from its centre ─────────────────────────
    const [rax, ray, raz] = boardA.orientation || [0, 0, 0];
    let halfExtentA;
    if (rax !== 0 || ray !== 0 || raz !== 0) {
        const aabbA = getRotatedBoardAABB(boardA);
        // Distance from boardA's centre to its AABB face on this axis
        halfExtentA = signA === 1
            ? aabbA.max.getComponent(axis) - boardA.position[axis]
            : boardA.position[axis] - aabbA.min.getComponent(axis);
    } else {
        halfExtentA = boardA.size[axis] / 2;
    }

    // New centre for boardA so that its AABB face lands on targetPlane
    const newPos = [...boardA.position];
    newPos[axis] = targetPlane - halfExtentA * signA;
    return newPos;
};
