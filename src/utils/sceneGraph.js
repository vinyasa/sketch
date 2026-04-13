/**
 * Scene Graph Utilities — World-Space Only
 * 
 * All boards exist in a single flat world coordinate system.
 * No parent-chain matrix walking. No rotation composition.
 * Groups are purely organizational containers.
 */

/**
 * Compute an axis-aligned bounding box (AABB) in world space for a list of boards.
 * Since all boards are axis-aligned with no rotation, this is trivial arithmetic.
 * @param {Array} boardList - The boards to compute the AABB for
 * @returns {{ minX, maxX, minY, maxY, minZ, maxZ }}
 */
export const computeWorldAABB = (boardList) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    boardList.forEach(b => {
        const px = b.position[0], py = b.position[1], pz = b.position[2];
        const hx = b.size[0] / 2, hy = b.size[1] / 2, hz = b.size[2] / 2;

        if (px - hx < minX) minX = px - hx;
        if (px + hx > maxX) maxX = px + hx;
        if (py - hy < minY) minY = py - hy;
        if (py + hy > maxY) maxY = py + hy;
        if (pz - hz < minZ) minZ = pz - hz;
        if (pz + hz > maxZ) maxZ = pz + hz;
    });

    return { minX, maxX, minY, maxY, minZ, maxZ };
};

/**
 * Recursively collect all boards that are children (direct or nested) of a given parent.
 * @param {string} parentId - The parent group ID
 * @param {Array} boards - The boards array
 * @param {Object} groups - The groups object
 * @returns {Array} All descendant boards
 */
export const collectChildBoards = (parentId, boards, groups) => {
    const result = [];
    const traverse = (pId) => {
        boards.filter(b => b.parentId === pId).forEach(b => result.push(b));
        Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
    };
    traverse(parentId);
    return result;
};

/**
 * Compute an AABB for an entire group by collecting all descendant boards.
 * Since groups have no transform, this is just the world AABB of all children.
 * @param {string} groupId - The group ID
 * @param {Array} boards - The boards array
 * @param {Object} groups - The groups object
 * @returns {{ width, height, depth, centerX, centerY, centerZ, minX, maxX, minY, maxY, minZ, maxZ } | null}
 */
export const calculateGroupAABB = (groupId, boards, groups) => {
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length === 0) return null;

    const aabb = computeWorldAABB(childBoards);

    return {
        width: Math.abs(aabb.maxX - aabb.minX),
        height: Math.abs(aabb.maxY - aabb.minY),
        depth: Math.abs(aabb.maxZ - aabb.minZ),
        centerX: (aabb.maxX + aabb.minX) / 2,
        centerY: (aabb.maxY + aabb.minY) / 2,
        centerZ: (aabb.maxZ + aabb.minZ) / 2,
        ...aabb
    };
};
