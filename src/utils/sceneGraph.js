import * as THREE from 'three';

/**
 * Compute the cumulative world-space transformation matrix for a board or group
 * by walking up the parent chain.
 * @param {string} id - The ID of the board or group
 * @param {boolean} isBoard - Whether the starting node is a board (true) or group (false)
 * @param {Array} boards - The boards array
 * @param {Object} groups - The groups object
 * @returns {THREE.Matrix4} The composed world-space matrix
 */
export const getGlobalMatrix = (id, isBoard, boards, groups) => {
    let mat = new THREE.Matrix4();
    let cur = id;
    let isB = isBoard;
    while (cur) {
        let p = [0, 0, 0], r = [0, 0, 0], parentId = null;
        if (isB) {
            const b = boards.find(x => x.id.toString() === cur);
            if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; parentId = b.parentId; }
            isB = false;
        } else {
            const g = groups[cur];
            if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; parentId = g.parentId; }
        }
        mat.premultiply(new THREE.Matrix4().compose(
            new THREE.Vector3(...p),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')),
            new THREE.Vector3(1, 1, 1)
        ));
        cur = parentId;
    }
    return mat;
};

/**
 * Compute the cumulative rotation-only matrix for a group's parent chain.
 * Used to convert global-space directions into local-space.
 * @param {string} parentId - The parent group ID to start from
 * @param {Object} groups - The groups object
 * @returns {THREE.Matrix4} The composed rotation matrix
 */
export const getParentRotMatrix = (parentId, groups) => {
    let mat = new THREE.Matrix4();
    let cur = parentId;
    while (cur) {
        const g = groups[cur];
        if (g) {
            mat.premultiply(new THREE.Matrix4().makeRotationFromEuler(
                new THREE.Euler(...(g.rotation || [0, 0, 0]), 'XYZ')
            ));
            cur = g.parentId;
        } else {
            cur = null;
        }
    }
    return mat;
};

/**
 * Compute an axis-aligned bounding box (AABB) in world space for a list of boards.
 * @param {Array} boardList - The specific boards to compute the AABB for
 * @param {Array} allBoards - The full boards array (needed for matrix traversal)
 * @param {Object} groups - The groups object
 * @returns {{ minX, maxX, minY, maxY, minZ, maxZ }}
 */
export const computeWorldAABB = (boardList, allBoards, groups) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    boardList.forEach(b => {
        const mat = getGlobalMatrix(b.id.toString(), true, allBoards, groups);
        const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
        const corners = [
            new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d),
            new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d),
            new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
        ];
        corners.forEach(v => {
            v.applyMatrix4(mat);
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
            if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
        });
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
 * Compute an AABB for an entire group in the *local coordinate space* of that group.
 * Useful for virtual dimensioning or constraint targeting on assemblies.
 */
export const calculateGroupLocalAABB = (groupId, boards, groups) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let found = false;

    const groupMatGlobal = getGlobalMatrix(groupId, false, boards, groups);
    const invGroupMatGlobal = groupMatGlobal.clone().invert();

    const traverseBounds = (pId) => {
        boards.filter(b => b.parentId === pId).forEach(b => {
             found = true;
             const bMat = getGlobalMatrix(b.id.toString(), true, boards, groups);
             const relMat = new THREE.Matrix4().multiplyMatrices(invGroupMatGlobal, bMat);
             
             const w = b.size[0]/2, h = b.size[1]/2, d = b.size[2]/2;
             const corners = [
                 new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
                 new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
             ];
             corners.forEach(v => {
                 v.applyMatrix4(relMat);
                 if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
                 if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
                 if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
             });
        });
        Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverseBounds(k));
    };

    traverseBounds(groupId);

    if (!found) return null;
    
    return {
        width: Math.abs(maxX - minX),
        height: Math.abs(maxY - minY),
        depth: Math.abs(maxZ - minZ),
        centerX: (maxX + minX) / 2,
        centerY: (maxY + minY) / 2,
        centerZ: (maxZ + minZ) / 2,
        minX, maxX, minY, maxY, minZ, maxZ
    };
};

