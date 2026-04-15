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

/** World-space position of a face center on a (non-rotated) board. */
export const getFaceWorldPos = (board, faceStr) => {
    const axis = faceToAxis(faceStr);
    const sign = faceStr[1] === '+' ? 1 : -1;
    const pos = [...board.position];
    pos[axis] += (board.size[axis] / 2) * sign;
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

    // Rule: no exact duplicate
    const isDupe = existing.some(c =>
        c.enabled !== false &&
        ((c.boardAId === boardAId && c.boardBId === boardBId) ||
         (c.boardAId === boardBId && c.boardBId === boardAId)) &&
        c.type === type
    );
    if (isDupe) return `A ${type} constraint between these two boards already exists.`;

    if (type === 'Flush') {
        const newAxis = faceToAxis(proposed.faceA);

        // Rule: a board may only have one Flush per axis
        const conflictForA = existing.find(c =>
            c.enabled !== false && c.type === 'Flush' && c.axis === newAxis &&
            (c.boardAId === boardAId || c.boardBId === boardAId)
        );
        if (conflictForA) {
            const partnerId = conflictForA.boardAId === boardAId ? conflictForA.boardBId : conflictForA.boardAId;
            const partner = boards.find(b => b.id.toString() === partnerId);
            return `Conflict: Board A already has a Flush on the ${['X','Y','Z'][newAxis]} axis with "${partner?.name ?? partnerId}".`;
        }

        const conflictForB = existing.find(c =>
            c.enabled !== false && c.type === 'Flush' && c.axis === newAxis &&
            (c.boardAId === boardBId || c.boardBId === boardBId)
        );
        if (conflictForB) {
            const partnerId = conflictForB.boardAId === boardBId ? conflictForB.boardBId : conflictForB.boardAId;
            const partner = boards.find(b => b.id.toString() === partnerId);
            return `Conflict: Board B already has a Flush on the ${['X','Y','Z'][newAxis]} axis with "${partner?.name ?? partnerId}".`;
        }
    }

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

    // ── Flush: per-axis propagation from the entire glue set ─────────────────
    for (let axis = 0; axis < 3; axis++) {
        if (delta[axis] === 0) continue;

        // Collect all boards that are flush-connected to any member of glueSet on this axis
        const flushSet = new Set(glueSet);
        glueSet.forEach(id => {
            getFlushConnectedSet(id, axis, constraints).forEach(fid => flushSet.add(fid));
        });

        // Only apply flush delta to boards that aren't already moving.
        // Boards already in result (primary movers + glue partners) have the full
        // delta; adding again would double-count and cause the "half as far" bug.
        flushSet.forEach(id => {
            if (result.has(id)) return;  // already covered — don't double-add
            result.set(id, [0, 0, 0]);
            result.get(id)[axis] = delta[axis];
        });
    }

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
    const axis = faceToAxis(faceA);
    const signA = faceA[1] === '+' ? 1 : -1;
    const signB = faceB[1] === '+' ? 1 : -1;

    // Target plane: boardB's faceB world position
    const targetPlane = boardB.position[axis] + (boardB.size[axis] / 2) * signB;

    // boardA's faceA offset from its center
    const offsetA = (boardA.size[axis] / 2) * signA;

    // New center for boardA: targetPlane = boardA.position[axis] + offsetA
    const newPos = [...boardA.position];
    newPos[axis] = targetPlane - offsetA;
    return newPos;
};
