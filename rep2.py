import os

file_path = 'd:/Antigravity Dev/Sketch/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

solver_logic = """
    const getGlobalMatrix = (id, isBoard, currentBoards = boards, currentGroups = groups) => {
        let mat = new THREE.Matrix4();
        let cur = id; let isB = isBoard;
        while (cur) {
            let p = [0, 0, 0], r = [0, 0, 0], parentId = null;
            if (isB) {
                const b = currentBoards.find(x => x.id.toString() === cur);
                if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; parentId = b.parentId; }
                isB = false;
            } else {
                const g = currentGroups[cur];
                if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; parentId = g.parentId; }
            }
            mat.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1)));
            cur = parentId;
        }
        return mat;
    };

    const solveAlignmentConstraint = (sourceBoard, constraintObj, currentBoards) => {
        const tBoard = currentBoards.find(b => b.id.toString() === constraintObj.targetId.toString());
        if (!tBoard) return null;

        const getLocalData = (board, face) => {
            let norm = new THREE.Vector3();
            let pos = new THREE.Vector3();
            const sign = face[1] === '+' ? 1 : -1;
            const w = board.size[0]/2, h = board.size[1]/2, d = board.size[2]/2;
            if (face[0] === 'x') { norm.set(sign, 0, 0); pos.set(w * sign, 0, 0); }
            if (face[0] === 'y') { norm.set(0, sign, 0); pos.set(0, h * sign, 0); }
            if (face[0] === 'z') { norm.set(0, 0, sign); pos.set(0, 0, d * sign); }
            return { norm, pos };
        };

        const tLocal = getLocalData(tBoard, constraintObj.targetFace);
        const sLocal = getLocalData(sourceBoard, constraintObj.sourceFace);

        const tMat = getGlobalMatrix(tBoard.id.toString(), true, currentBoards);
        const sMat = getGlobalMatrix(sourceBoard.id.toString(), true, currentBoards);

        const tGlobalPos = tLocal.pos.applyMatrix4(tMat);
        const tGlobalNorm = tLocal.norm.applyMatrix4(new THREE.Matrix4().extractRotation(tMat)).normalize();

        const sGlobalPos = sLocal.pos.applyMatrix4(sMat);
        const sGlobalNorm = sLocal.norm.applyMatrix4(new THREE.Matrix4().extractRotation(sMat)).normalize();

        const targetNormal = constraintObj.type === 'Flush' ? tGlobalNorm : tGlobalNorm.clone().negate();
        
        let deltaQ = new THREE.Quaternion().setFromUnitVectors(sGlobalNorm, targetNormal);
        
        // Anti-parallel safeguard (setFromUnitVectors fails if exactly opposite)
        if (sGlobalNorm.clone().add(targetNormal).length() < 0.001) {
            let axis = Math.abs(sGlobalNorm.x) > 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
            deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
        }

        const sGlobalQ = new THREE.Quaternion().setFromRotationMatrix(sMat);
        const finalGlobalQ = deltaQ.clone().multiply(sGlobalQ);

        const parentMat = getGlobalMatrix(sourceBoard.parentId, false, currentBoards);
        const parentMatInvert = parentMat.clone().invert();
        
        const finalLocalQ = finalGlobalQ.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(parentMatInvert));
        const newLocalEuler = new THREE.Euler().setFromQuaternion(finalLocalQ, 'XYZ');

        const tempLocalMat = new THREE.Matrix4().compose(
            new THREE.Vector3(...sourceBoard.position), 
            finalLocalQ, 
            new THREE.Vector3(1,1,1)
        );
        const tempGlobalMat = parentMat.clone().multiply(tempLocalMat);
        const sGlobalPosRotated = sLocal.pos.clone().applyMatrix4(tempGlobalMat);
        
        const dist = new THREE.Vector3().subVectors(tGlobalPos, sGlobalPosRotated).dot(targetNormal);
        const vShiftGlobal = targetNormal.clone().multiplyScalar(dist);

        const sCenterGlobal = new THREE.Vector3(0,0,0).applyMatrix4(tempGlobalMat);
        sCenterGlobal.add(vShiftGlobal);

        const newLocalPos = sCenterGlobal.applyMatrix4(parentMatInvert);

        return { position: [newLocalPos.x, newLocalPos.y, newLocalPos.z], rotation: [newLocalEuler.x, newLocalEuler.y, newLocalEuler.z] };
    };
"""

target_insertion = "    const toggleSelection = (id, isMulti, faceStr = null) => {"
if solver_logic not in content:
    content = content.replace(target_insertion, solver_logic + "\n" + target_insertion)

old_step_2 = """            } else if (constraintTargetMode.step === 2) {
                if (strId === constraintTargetMode.sourceId) return;
                pushHistory();
                setBoards(prev => prev.map(b => b.id.toString() === constraintTargetMode.sourceId ? {
                    ...b,
                    constraints: [...(b.constraints || []), { type: constraintTargetMode.type, sourceFace: constraintTargetMode.sourceFace, targetId: strId, targetFace: faceStr }]
                } : b));
                setConstraintTargetMode(null);
            }"""

new_step_2 = """            } else if (constraintTargetMode.step === 2) {
                if (strId === constraintTargetMode.sourceId) return;
                pushHistory();
                
                const newConstraint = { type: constraintTargetMode.type, sourceFace: constraintTargetMode.sourceFace, targetId: strId, targetFace: faceStr };
                
                setBoards(prev => prev.map(b => {
                    if (b.id.toString() === constraintTargetMode.sourceId) {
                        let finalTransforms = {};
                        if (constraintTargetMode.type === 'Flush' || constraintTargetMode.type === 'Glue') {
                            const result = solveAlignmentConstraint(b, newConstraint, prev);
                            if (result) finalTransforms = result;
                        }
                        return {
                            ...b,
                            ...finalTransforms,
                            constraints: [...(b.constraints || []), newConstraint]
                        };
                    }
                    return b;
                }));
                setConstraintTargetMode(null);
            }"""

content = content.replace(old_step_2, new_step_2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied solver logic")
