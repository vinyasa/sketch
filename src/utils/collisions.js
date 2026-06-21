import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

export function getOverlappingBoards(boards) {
    if (!boards || boards.length < 2) return { pairs: [], overlappingIds: [] };

    // We consider all physical boards, even if hidden by group, because geometry still exists.
    const obbs = boards.filter(b => b.shape !== 'plane').map(b => {
        const rot = b.orientation || b.rotation || [0, 0, 0];
        const euler = new THREE.Euler(
            rot[0],
            rot[1],
            rot[2],
            'YXZ'
        );
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        const position = new THREE.Vector3(...b.position);
        
        let matrix = new THREE.Matrix4();
        
        if (b.pivot) {
             const pivotPos = new THREE.Vector3(...b.pivot);
             const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
             const invPivotMatrix = new THREE.Matrix4().makeTranslation(-pivotPos.x, -pivotPos.y, -pivotPos.z);
             const translationMatrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
             
             matrix.multiply(translationMatrix)
                   .multiply(rotationMatrix)
                   .multiply(invPivotMatrix);
        } else {
             matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
        }

        const obb = new OBB();
        // Shrink the OBB by epsilon to prevent perfectly flush boards from triggering overlap
        const epsilon = 0.001;
        obb.halfSize.set(
            Math.max(0, b.size[0]/2 - epsilon), 
            Math.max(0, b.size[1]/2 - epsilon), 
            Math.max(0, b.size[2]/2 - epsilon)
        );
        obb.applyMatrix4(matrix);

        return { id: b.id.toString(), obb, board: b };
    });

    const pairs = [];
    const overlappingIds = new Set();

    for (let i = 0; i < obbs.length; i++) {
        for (let j = i + 1; j < obbs.length; j++) {
            const b1 = obbs[i];
            const b2 = obbs[j];

            // Ignore if they have an active edge joint relationship
            if (b1.board.edgeJoints?.some(j => j.partnerId === b2.id)) continue;
            if (b2.board.edgeJoints?.some(j => j.partnerId === b1.id)) continue;

            // Ignore if either board is a visual joint fastener (dowel, Domino, tenon, pocket plug, or wood screw)
            const isB1Fastener = b1.board.meta?.isFastenerElement ||
                                 b1.board.name?.includes('Dowel') ||
                                 b1.board.name?.includes('Domino') ||
                                 b1.board.name?.includes('Tenon') ||
                                 b1.board.name?.includes('Plug') ||
                                 b1.board.name?.includes('Screw');
            const isB2Fastener = b2.board.meta?.isFastenerElement ||
                                 b2.board.name?.includes('Dowel') ||
                                 b2.board.name?.includes('Domino') ||
                                 b2.board.name?.includes('Tenon') ||
                                 b2.board.name?.includes('Plug') ||
                                 b2.board.name?.includes('Screw');
            if (isB1Fastener || isB2Fastener) continue;

            // Ignore if there is a subtraction relationship between them
            const hasSubtract = 
                b1.board.operations?.some(op => op.type === 'subtract' && op.cutterId === b2.id) ||
                b2.board.operations?.some(op => op.type === 'subtract' && op.cutterId === b1.id);
            if (hasSubtract) continue;

            // Ignore if they share the same parent group (disabled to allow collision warnings inside cabinet/carcass groups)
            // if (b1.board.parentId && b1.board.parentId === b2.board.parentId) continue;

            // Ignore if they are partners in an edge joint or joint operation (e.g. rabbet/dado mating faces)
            const isPartner = 
                b1.board.edgeJoints?.some(j => j.partnerId?.toString() === b2.id.toString()) ||
                b2.board.edgeJoints?.some(j => j.partnerId?.toString() === b1.id.toString()) ||
                b1.board.operations?.some(op => op.partnerId?.toString() === b2.id.toString()) ||
                b2.board.operations?.some(op => op.partnerId?.toString() === b1.id.toString());
            if (isPartner) continue;

            // Ignore if they are part of a parent-child relationship (e.g. drawer side and drawer face if implemented that way)
            // But standard boards don't have parent-child physically, so this is fine.

            if (b1.obb.intersectsOBB(b2.obb)) {
                pairs.push([b1.id, b2.id]);
                overlappingIds.add(b1.id);
                overlappingIds.add(b2.id);
            }
        }
    }

    return { pairs, overlappingIds: Array.from(overlappingIds) };
}
