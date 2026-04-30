import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

export const createOperationSlice = (set, get) => ({
  // ─── Boolean Subtraction ─────────────────────────────────────────────────

  /**
   * Subtract one board's shape from another (snapshot approach).
   * The cutter's geometry (size, shape) and the relative transform between
   * target and cutter are frozen at apply-time so the operation is self-contained.
   *
   * @param {string|number} targetBoardId — board that receives the cut
   * @param {string|number} cutterBoardId — board whose shape is carved out
   */
  applySubtraction: (targetBoardId, cutterBoardId) => {
    const {
      boards,
      pushHistory,
      setBoards,
      showToast
    } = get();
    const targetBoard = boards.find(b => b.id.toString() === targetBoardId.toString());
    const cutterBoard = boards.find(b => b.id.toString() === cutterBoardId.toString());
    if (!targetBoard || !cutterBoard) return;

    // ── Compute relative transform (cutter in target's local space) ───
    const getGeoMatrix = (b) => {
        const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...b.position), new THREE.Quaternion().setFromEuler(euler), new THREE.Vector3(1, 1, 1));
        if (b.pivot) {
             matrix.multiply(new THREE.Matrix4().makeTranslation(-b.pivot[0], -b.pivot[1], -b.pivot[2]));
        }
        return matrix;
    };
    
    const Wt = getGeoMatrix(targetBoard);
    const Wc = getGeoMatrix(cutterBoard);

    // ── Validate overlap (using oriented bounding boxes) ──────────────
    const getOBB = (b) => {
        const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
        const quaternion = new THREE.Quaternion().setFromEuler(euler);
        const position = new THREE.Vector3(...b.position);
        
        let matrix = new THREE.Matrix4();
        if (b.pivot) {
             const pivotPos = new THREE.Vector3(...b.pivot);
             const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
             const invPivotMatrix = new THREE.Matrix4().makeTranslation(-pivotPos.x, -pivotPos.y, -pivotPos.z);
             const translationMatrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
             matrix.multiply(translationMatrix).multiply(rotationMatrix).multiply(invPivotMatrix);
        } else {
             matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
        }

        const obb = new OBB(); // ensure OBB is imported or available
        obb.halfSize.set(
            Math.max(0, b.size[0]/2), 
            Math.max(0, b.size[1]/2), 
            Math.max(0, b.size[2]/2)
        );
        obb.applyMatrix4(matrix);
        return obb;
    };

    const obbA = getOBB(targetBoard);
    const obbB = getOBB(cutterBoard);

    if (!obbA.intersectsOBB(obbB)) {
      showToast('⚠ Boards must overlap to apply a boolean subtraction');
      return;
    }
    const relativeMatrix = Wt.clone().invert().multiply(Wc);

    // ── Build the operation (frozen snapshot) ─────────────────────────
    const op = {
      id: Date.now(),
      type: 'subtract',
      cutterName: cutterBoard.name,
      cutterId: cutterBoard.id.toString(),
      cutterSize: [...cutterBoard.size],
      cutterShape: cutterBoard.shape || 'box',
      cutterTaper: cutterBoard.taper || null,
      cutterCylinder: cutterBoard.cylinder || null,
      relativeMatrix: relativeMatrix.elements.slice() // 16-element Float64 array
    };
    pushHistory();
    setBoards(prev => prev.map(b => {
      if (b.id.toString() === targetBoard.id.toString()) {
        return {
          ...b,
          operations: [...(b.operations || []), op]
        };
      }
      // Auto-hide the cutter board
      if (b.id.toString() === cutterBoard.id.toString()) {
        return {
          ...b,
          visible: false
        };
      }
      return b;
    }));
    showToast(`🔪 Subtracted "${cutterBoard.name}" from "${targetBoard.name}"`);
  },
  // ─── Automated Rabbet Joint ──────────────────────────────────────────────

  /**
   * Apply a rabbet joint between two overlapping perpendicular boards.
   * Config "A-over-B": boardA stays full size, boardB shrinks.
   *
   * Geometry rules (derived for any orientation):
   *   thinA = A's thickness axis,  thicknessA = A.size[thinA]
   *   thinB = B's thickness axis,  thicknessB = B.size[thinB]
   *   sharedAxis = the remaining axis (neither thinA nor thinB)
   *
   *   A (over) gets a dado on the face of its thin axis that faces toward B:
   *     width  = thicknessB / 2      (half of B's thickness)
   *     depth  = thicknessA / 2      (half of A's own thickness)
   *     offset = -[ A.size[thinB]/2 - thicknessB/2 ]
   *
   *   B (under) shrinks by thicknessA/2 along thinA, shifts toward A by thicknessA/4.
   *   B gets a dado on the face of its thin axis that faces toward A:
   *     width  = thicknessA / 2      (half of A's thickness)
   *     depth  = thicknessB / 2      (half of B's own thickness)
   *     offset = -[ B.size[thinA]/2 - thicknessA/2 ]   (using B's NEW shrunken size along thinA)
   */
  applyEdgeJoint: (boardAId, boardBId, type = 'rabbet', skipHistory = false, skipToast = false, skipOverlapCheck = false, isAutomated = false) => {
    const {
      boards,
      pushHistory,
      setBoards,
      showToast
    } = get();
    const boardA = boards.find(b => b.id.toString() === boardAId.toString());
    const boardB = boards.find(b => b.id.toString() === boardBId.toString());
    if (!boardA || !boardB) return;

    // ── Helpers ───────────────────────────────────────────────────────
    const bbOf = b => [0, 1, 2].map(i => ({
      min: b.position[i] - b.size[i] / 2,
      max: b.position[i] + b.size[i] / 2
    }));
    const thinAxisOf = b => b.size.indexOf(Math.min(...b.size));
    const FACE_LABELS = {
      'x+': 'right',
      'x-': 'left',
      'y+': 'top',
      'y-': 'bottom',
      'z+': 'front',
      'z-': 'back'
    };
    const AXIS_NAMES = ['x', 'y', 'z'];

    // ── 3-way Corner Conflict Detection ───────────────────────────────
    if (!isAutomated && (type === 'butt' || type === 'rabbet' || type === 'miter')) {
      const thinA = thinAxisOf(boardA);
      const thinB = thinAxisOf(boardB);
      let tbBoard = null;
      let sideBoard = null;
      let tbId = null;
      let sideId = null;
      if (thinA === 1 && (thinB === 0 || thinB === 2)) {
        tbBoard = boardA;
        sideBoard = boardB;
        tbId = boardAId;
        sideId = boardBId;
      } else if (thinB === 1 && (thinA === 0 || thinA === 2)) {
        tbBoard = boardB;
        sideBoard = boardA;
        tbId = boardBId;
        sideId = boardAId;
      }
      if (tbBoard && sideBoard) {
        // Find other side boards in the same group that touch the tbBoard
        const otherSides = boards.filter(b => b.parentId === tbBoard.parentId && b.id !== sideBoard.id && b.id !== tbBoard.id && (thinAxisOf(b) === 0 || thinAxisOf(b) === 2) && [0, 1, 2].every(i => Math.min(bbOf(b)[i].max, bbOf(tbBoard)[i].max) - Math.max(bbOf(b)[i].min, bbOf(tbBoard)[i].min) > -0.05));
        if (otherSides.length > 0) {
          const {
            setConfirmDialog
          } = get();
          setConfirmDialog({
            title: 'Joint Cascade',
            message: `You are changing the joint between ${tbBoard.name} and ${sideBoard.name}. Do you want to apply this same joint to the other ${otherSides.length} touching side(s)?`,
            confirmText: 'Yes, cascade',
            confirmColor: '#34c759',
            confirmBg: 'rgba(52, 199, 89, 0.15)',
            confirmBorder: 'rgba(52, 199, 89, 0.3)',
            titleColor: '#64b4ff',
            onConfirm: () => {
              setConfirmDialog(null);
              // Apply to current pair
              get().applyEdgeJoint(boardAId, boardBId, type, skipHistory, skipToast, skipOverlapCheck, true);

              // Apply to others, maintaining the same A-over-B relationship
              otherSides.forEach((otherSide, idx) => {
                setTimeout(() => {
                  if (tbBoard.id === boardA.id) {
                    get().applyEdgeJoint(tbBoard.id, otherSide.id, type, true, true, skipOverlapCheck, true);
                  } else {
                    get().applyEdgeJoint(otherSide.id, tbBoard.id, type, true, true, skipOverlapCheck, true);
                  }
                }, (idx + 1) * 20);
              });
            },
            onCancel: () => {
              setConfirmDialog(null);
              // Just apply to the current pair
              get().applyEdgeJoint(boardAId, boardBId, type, skipHistory, skipToast, skipOverlapCheck, true);
            }
          });
          return; // Stop execution, wait for user confirmation
        }
      }
    }

    // ── Validate perpendicular ────────────────────────────────────────
    const thinA = thinAxisOf(boardA);
    const thinB = thinAxisOf(boardB);
    if (thinA === thinB) {
      if (!skipToast) showToast('⚠ Boards must be perpendicular (different thin axes)');
      return;
    }
    const thicknessA = boardA.size[thinA];
    const thicknessB = boardB.size[thinB];

    // ── Check for existing edge joint between these two boards ────────────
    if (boardA.edgeJoints?.find(j => j.partnerId === boardB.id.toString()) || boardB.edgeJoints?.find(j => j.partnerId === boardA.id.toString())) {
      if (!skipToast) showToast('⚠ An edge joint already exists between these boards. Remove it first.');
      return;
    }

    // ── Geometry computation ──────────────────────────────────────────
    const sharedAxis = [0, 1, 2].find(i => i !== thinA && i !== thinB);
    const sharedAxisLabel = AXIS_NAMES[sharedAxis];

    // signA: direction from A toward B along A's thin axis
    const signA = boardB.position[thinA] > boardA.position[thinA] ? 1 : -1;
    // signB: direction from B toward A along B's thin axis
    const signB = boardA.position[thinB] > boardB.position[thinB] ? 1 : -1;

    // ── Base State Resolution (Geometric Butt) ────────────────────────
    // A is the OVER board. It should span to B's outer face in B's thin axis.
    // B is the UNDER board. It should be trimmed to A's inner face in A's thin axis.

    let A_inner_in_B = boardA.position[thinB] - signB * (boardA.size[thinB] / 2);
    let A_outer_in_B = boardA.position[thinB] + signB * (boardA.size[thinB] / 2);
    const B_outer_in_B = boardB.position[thinB] - signB * (thicknessB / 2);

    // Extend A's outer face to cover B if A is currently short.
    if (signB === 1) {
      if (B_outer_in_B < A_inner_in_B) A_inner_in_B = B_outer_in_B;
    } else {
      if (B_outer_in_B > A_inner_in_B) A_inner_in_B = B_outer_in_B;
    }
    const baseASize = [...boardA.size];
    const baseAPos = [...boardA.position];
    baseASize[thinB] = Math.max(0.1, Math.abs(A_outer_in_B - A_inner_in_B));
    baseAPos[thinB] = (A_outer_in_B + A_inner_in_B) / 2;
    const A_inner_in_A = boardA.position[thinA] + signA * (thicknessA / 2);
    const B_outer_in_A = boardB.position[thinA] + signA * (boardB.size[thinA] / 2);

    // Trim/extend B to precisely touch A's inner face.
    const baseBSize = [...boardB.size];
    const baseBPos = [...boardB.position];
    baseBSize[thinA] = Math.max(0.1, Math.abs(A_inner_in_A - B_outer_in_A));
    baseBPos[thinA] = (A_inner_in_A + B_outer_in_A) / 2;

    // A's dado face: on A's thin axis, facing toward B
    const faceA = FACE_LABELS[AXIS_NAMES[thinA] + (signA > 0 ? '+' : '-')];
    // B's dado face: on B's thin axis, facing toward A
    const faceB = FACE_LABELS[AXIS_NAMES[thinB] + (signB > 0 ? '+' : '-')];

    // ── Apply Joint Extension from Base State ─────────────────────────
    let extension = 0;
    if (type === 'rabbet' || type === 'single-rabbet') extension = thicknessA / 2;
    if (type === 'miter') extension = thicknessA;
    const newBSize = [...baseBSize];
    const newBPos = [...baseBPos];
    newBSize[thinA] += extension;
    newBPos[thinA] -= signA * (extension / 2);

    // We store the negative extension so that removeEdgeJoint mathematically shrinks B back to base state.
    const shrinkAmount = -extension;

    // ── Correct existing edge-joint dados on B ──────────────────────
    // The total shift of B's center includes both the base state resolution AND the extension shift.
    const totalCenterShiftB = newBPos[thinA] - boardB.position[thinA];
    const FACE_INFO = {
      top: {
        faceAxes: [0, 2]
      },
      bottom: {
        faceAxes: [0, 2]
      },
      front: {
        faceAxes: [0, 1]
      },
      back: {
        faceAxes: [0, 1]
      },
      right: {
        faceAxes: [1, 2]
      },
      left: {
        faceAxes: [1, 2]
      }
    };
    const AXIS_IDX = {
      x: 0,
      y: 1,
      z: 2
    };
    const correctedBOps = (boardB.operations || []).map(op => {
      if (op.source !== 'edge-joint') return op;
      const fi = FACE_INFO[op.face];
      if (!fi) return op;
      const dirIdx = AXIS_IDX[op.direction];
      const widthAxis = fi.faceAxes[0] === dirIdx ? fi.faceAxes[1] : fi.faceAxes[0];
      if (widthAxis !== thinA) return op;
      return {
        ...op,
        offset: op.offset - totalCenterShiftB
      };
    });

    // ── A's dado (over board) ─────────────────────────────────────────
    // Face: faceA (on A's thin-axis face toward B)
    const isSingleRabbet = type === 'single-rabbet';
    const dadoAWidth = isSingleRabbet ? thicknessB : thicknessB / 2;
    const dadoADepth = thicknessA / 2;
    const offsetA = isSingleRabbet ? -signB * (baseASize[thinB] / 2 - thicknessB / 2) : -signB * (baseASize[thinB] / 2 - thicknessB / 4);
    const dadoA = {
      id: Date.now(),
      type: 'dado',
      face: faceA,
      direction: sharedAxisLabel,
      width: dadoAWidth,
      depth: dadoADepth,
      offset: offsetA,
      length: 0,
      lengthOffset: 0,
      source: 'edge-joint',
      partnerId: boardB.id.toString()
    };

    // ── B's dado (under board, after shrink) ──────────────────────────
    // Face: faceB (on B's thin-axis face toward A)
    // Width:  thicknessA / 2
    // Depth:  thicknessB / 2
    // Offset: newBSize[thinA]/2 - thicknessA/4
    const dadoBWidth = thicknessA / 2;
    const dadoBDepth = thicknessB / 2;
    const offsetB = -signA * (newBSize[thinA] / 2 - thicknessA / 4);
    const dadoB = {
      id: Date.now() + 1,
      type: 'dado',
      face: faceB,
      direction: sharedAxisLabel,
      width: dadoBWidth,
      depth: dadoBDepth,
      offset: offsetB,
      length: 0,
      lengthOffset: 0,
      source: 'edge-joint',
      partnerId: boardA.id.toString()
    };
    let opA = null,
      opB = null;
    if (type === 'miter') {
      opA = {
        id: Date.now(),
        type: 'miter',
        face: AXIS_NAMES[thinB] + (signB > 0 ? '-' : '+'),
        fenceEdge: AXIS_NAMES[sharedAxis] + '-',
        angle: 0,
        bevel: signA > 0 ? 45 : -45,
        source: 'edge-joint',
        partnerId: boardB.id.toString()
      };
      opB = {
        id: Date.now() + 1,
        type: 'miter',
        face: AXIS_NAMES[thinA] + (signA > 0 ? '-' : '+'),
        fenceEdge: AXIS_NAMES[sharedAxis] + '-',
        angle: 0,
        bevel: signB > 0 ? 45 : -45,
        source: 'edge-joint',
        partnerId: boardA.id.toString()
      };
    } else if (type === 'single-rabbet') {
      opA = dadoA;
      opB = null;
    } else {
      opA = dadoA;
      opB = dadoB;
    }

    // Joint metadata stored on both boards for toggle/remove support
    const meta = {
      type,
      partnerId: null,
      // set per-board below
      overBoardId: boardA.id.toString(),
      shrinkAxis: thinA,
      shrinkAmount,
      thicknessA,
      thicknessB,
      signA,
      signB
    };
    const centerShiftA = baseAPos[thinB] - boardA.position[thinB];
    const correctedAOps = (boardA.operations || []).map(op => {
      if (op.source !== 'edge-joint') return op;
      const fi = FACE_INFO[op.face];
      if (!fi) return op;
      const dirIdx = AXIS_IDX[op.direction];
      const widthAxis = fi.faceAxes[0] === dirIdx ? fi.faceAxes[1] : fi.faceAxes[0];
      if (widthAxis !== thinB) return op;
      return {
        ...op,
        offset: op.offset - centerShiftA
      };
    });
    if (!skipHistory) pushHistory();
    setBoards(prev => prev.map(b => {
      if (b.id.toString() === boardA.id.toString()) {
        const newOps = type === 'butt' || !opA ? correctedAOps : [...correctedAOps, opA];
        return {
          ...b,
          size: baseASize,
          position: baseAPos,
          operations: newOps,
          edgeJoints: [...(b.edgeJoints || []), {
            ...meta,
            partnerId: boardB.id.toString()
          }]
        };
      }
      if (b.id.toString() === boardB.id.toString()) {
        const newOps = type === 'butt' || !opB ? correctedBOps : [...correctedBOps, opB];
        return {
          ...b,
          size: newBSize,
          position: newBPos,
          operations: newOps,
          edgeJoints: [...(b.edgeJoints || []), {
            ...meta,
            partnerId: boardA.id.toString()
          }]
        };
      }
      return b;
    }));
    if (!skipToast) {
      const jointName = type === 'butt' ? 'Butt' : 'Rabbet';
      showToast(`🔗 ${jointName} joint applied: "${boardA.name}" over "${boardB.name}"`);
    }
  },
  /**
   * Toggle (flip) an existing rabbet joint.
   * The previously "over" board becomes "under" (shrinks) and vice versa.
   * Strategy: remove the current joint, then re-apply with swapped roles.
   */
  toggleEdgeJoint: (boardId, partnerId) => {
    const {
      boards,
      pushHistory,
      setBoards,
      showToast
    } = get();
    const board = boards.find(b => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(j => j.partnerId === partnerId.toString());
    if (!joint) return;
    const partner = boards.find(b => b.id.toString() === joint.partnerId);
    if (!partner) return;
    const {
      overBoardId,
      shrinkAxis,
      shrinkAmount,
      signA
    } = joint;
    const currentOver = boards.find(b => b.id.toString() === overBoardId);
    const currentUnder = currentOver.id === board.id ? partner : board;
    if (!currentOver || !currentUnder) return;

    // ── 1. Restore the under board to its original size ───────────────
    const restoredUnderSize = [...currentUnder.size];
    const restoredUnderPos = [...currentUnder.position];
    restoredUnderSize[shrinkAxis] += shrinkAmount;
    const underSignA = joint.signA; // Fix: use joint, not currentUnder.edgeJoint
    restoredUnderPos[shrinkAxis] -= underSignA * (shrinkAmount / 2);

    // ── 2. Remove old rabbet dados from both ──────────────────────────
    const stripRabbetDados = (ops, pid) => (ops || []).filter(op => !(op.source === 'edge-joint' && op.partnerId === pid));

    // ── 3. Apply restored state (strip dados, restore sizes) ──────────
    pushHistory();
    setBoards(prev => prev.map(b => {
      if (b.id.toString() === currentUnder.id.toString()) {
        const cleaned = {
          ...b,
          size: restoredUnderSize,
          position: restoredUnderPos,
          operations: stripRabbetDados(b.operations, currentOver.id.toString()),
          edgeJoints: (b.edgeJoints || []).filter(j => j.partnerId !== currentOver.id.toString())
        };
        return cleaned;
      }
      if (b.id.toString() === currentOver.id.toString()) {
        const cleaned = {
          ...b,
          operations: stripRabbetDados(b.operations, currentUnder.id.toString()),
          edgeJoints: (b.edgeJoints || []).filter(j => j.partnerId !== currentUnder.id.toString())
        };
        return cleaned;
      }
      return b;
    }));

    // ── 4. Re-apply with swapped roles (former under is now over) ─────
    // Use setTimeout to let state update, then call applyEdgeJoint
    setTimeout(() => {
      get().applyEdgeJoint(currentUnder.id, currentOver.id, joint.type || 'rabbet');
    }, 0);
  },
  /**
   * Switch an existing edge joint to a different type (e.g., rabbet to butt).
   */
  switchEdgeJointType: (boardId, partnerId, newType) => {
    const {
      boards,
      removeEdgeJoint,
      applyEdgeJoint
    } = get();
    const board = boards.find(b => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(j => j.partnerId === partnerId.toString());
    if (!joint) return;
    const overBoardId = joint.overBoardId;
    const underBoardId = overBoardId === board.id.toString() ? joint.partnerId : board.id.toString();
    removeEdgeJoint(boardId, partnerId, true, true);
    setTimeout(() => {
      get().applyEdgeJoint(overBoardId, underBoardId, newType);
    }, 0);
  },
  /**
   * Remove a rabbet joint — restore the under board's size and remove
   * rabbet-tagged dados from both boards.
   */
  removeEdgeJoint: (boardId, partnerId, skipHistory = false, skipToast = false) => {
    const {
      boards,
      pushHistory,
      setBoards,
      showToast
    } = get();
    const board = boards.find(b => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(j => j.partnerId === partnerId.toString());
    if (!joint) return;
    const partner = boards.find(b => b.id.toString() === joint.partnerId);
    if (!partner) return;
    const {
      overBoardId,
      shrinkAxis,
      shrinkAmount,
      signA
    } = joint;
    const underBoard = boards.find(b => b.id.toString() !== overBoardId && (b.id.toString() === board.id.toString() || b.id.toString() === partner.id.toString()));
    const stripRabbetDados = (ops, pid) => (ops || []).filter(op => !(op.source === 'edge-joint' && op.partnerId === pid));
    if (!skipHistory) pushHistory();
    setBoards(prev => prev.map(b => {
      const isBoard = b.id.toString() === board.id.toString();
      const isPartner = b.id.toString() === partner.id.toString();
      if (!isBoard && !isPartner) return b;
      const pid = isBoard ? partner.id.toString() : board.id.toString();
      const cleaned = {
        ...b,
        operations: stripRabbetDados(b.operations, pid),
        edgeJoints: (b.edgeJoints || []).filter(j => j.partnerId !== pid)
      };

      // Restore under board's size
      if (underBoard && b.id.toString() === underBoard.id.toString()) {
        cleaned.size = [...b.size];
        cleaned.position = [...b.position];
        cleaned.size[shrinkAxis] += shrinkAmount;
        cleaned.position[shrinkAxis] -= signA * (shrinkAmount / 2);
      }
      return cleaned;
    }));
    if (!skipToast) showToast(`🔗 Edge joint removed between "${board.name}" and "${partner.name}"`);
  },
  /**
   * Apply edge joints to all overlapping pairs among the selected boards.
   */
  applyBulkEdgeJoints: (boardIds, type = 'rabbet', sideOverTop = true) => {
    const {
      removeBulkEdgeJoints,
      pushHistory
    } = get();

    // Push a single history state for the entire bulk operation
    pushHistory();

    // 1. Remove existing edge joints among these boards silently
    removeBulkEdgeJoints(boardIds, true, true);

    // Use a slight timeout so the removes can flush through state
    setTimeout(() => {
      const {
        boards: latestBoards
      } = get();
      const selBoards = boardIds.map(id => latestBoards.find(b => b.id.toString() === id.toString())).filter(Boolean);

      // Helpers
      const bbOf = b => [0, 1, 2].map(i => ({
        min: b.position[i] - b.size[i] / 2,
        max: b.position[i] + b.size[i] / 2
      }));
      const touches = (ba, bb) => [0, 1, 2].every(i => Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) > -0.05);
      const thinAxisOf = b => b.size.indexOf(Math.min(...b.size));
      let jointCount = 0;

      // Find pairs
      for (let i = 0; i < selBoards.length; i++) {
        for (let j = i + 1; j < selBoards.length; j++) {
          const bA = selBoards[i];
          const bB = selBoards[j];
          const thinA = thinAxisOf(bA);
          const thinB = thinAxisOf(bB);
          if (thinA === thinB) continue; // must be perpendicular
          if (!touches(bbOf(bA), bbOf(bB))) continue; // must touch

          let overBoardId = bA.id;
          let underBoardId = bB.id;
          const isSideA = thinA === 0 || thinA === 2; // X or Z
          const isTopB = thinB === 1; // Y
          const isSideB = thinB === 0 || thinB === 2;
          const isTopA = thinA === 1;
          if (sideOverTop) {
            if (isSideA && isTopB) {
              overBoardId = bA.id;
              underBoardId = bB.id;
            } else if (isSideB && isTopA) {
              overBoardId = bB.id;
              underBoardId = bA.id;
            }
          } else {
            if (isTopA && isSideB) {
              overBoardId = bA.id;
              underBoardId = bB.id;
            } else if (isTopB && isSideA) {
              overBoardId = bB.id;
              underBoardId = bA.id;
            }
          }

          // Delay each slightly to avoid state contention
          setTimeout(() => {
            get().applyEdgeJoint(overBoardId, underBoardId, type, true, true, true);
          }, jointCount * 10);
          jointCount++;
        }
      }
      if (jointCount > 0) {
        setTimeout(() => {
          const jointName = type === 'butt' ? 'Butt' : type === 'miter' ? 'Miter' : 'Rabbet';
          get().showToast(`🔗 Applied ${jointCount} ${jointName} joints to selection`);
        }, jointCount * 10 + 50);
      }
    }, 10);
  },
  /**
   * Apply a specialized box panel joint (sit-on, full-inset, or rabbeted-inset)
   * between a top/bottom board and 4 sides.
   */
  applyBoxPanelJoint: (topBottomId, sidesIds, type) => {
    const {
      applyEdgeJoint,
      pushHistory
    } = get();
    pushHistory();

    // Use a slight timeout to allow history push to settle
    setTimeout(() => {
      if (type === 'sit-on') {
        // Top/bottom sits fully on sides: Top/bottom is over (full size), sides are under (shrink)
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(topBottomId, sideId, 'butt', true, true, true);
          }, idx * 15);
        });
      } else if (type === 'full-inset') {
        // Sandwiched: Sides are over (full size), top/bottom is under (shrink)
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(sideId, topBottomId, 'butt', true, true, true);
          }, idx * 15);
        });
      } else if (type === 'rabbeted-inset') {
        // Sides are over (full size), top/bottom is under (shrink). Both get dado/rabbet cuts
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(sideId, topBottomId, 'rabbet', true, true, true);
          }, idx * 15);
        });
      }
      setTimeout(() => {
        get().showToast(`🔗 Applied ${type} joints to box panel`);
      }, sidesIds.length * 15 + 50);
    }, 10);
  },
  /**
   * Toggles a geometric butt joint between two touching boards.
   * It detects which one is trimmed against the other, extends the trimmed one, and trims the full-length one.
   */
  toggleGeometricJoint: (idA, idB) => {
    const {
      boards,
      setBoards,
      pushHistory
    } = get();
    const bA = boards.find(b => b.id.toString() === idA.toString());
    const bB = boards.find(b => b.id.toString() === idB.toString());
    if (!bA || !bB) return;
    const bbOf = b => [0, 1, 2].map(i => ({
      min: b.position[i] - b.size[i] / 2,
      max: b.position[i] + b.size[i] / 2
    }));
    const thinAxis = b => b.size.indexOf(Math.min(...b.size));
    const ba = bbOf(bA);
    const bb = bbOf(bB);
    const axisA = thinAxis(bA);
    const axisB = thinAxis(bB);
    if (axisA === axisB) return; // Must be perpendicular

    // Determine who is trimmed against who.
    // If A is trimmed against B, A's extent along B's thin axis will touch B's inner face.
    let aTrimmedAgainstB = false;
    let aTrimDir = 0; // 1 if A touches B's min, -1 if A touches B's max
    if (Math.abs(ba[axisB].max - bb[axisB].min) < 0.06) {
      aTrimmedAgainstB = true;
      aTrimDir = 1;
    } else if (Math.abs(ba[axisB].min - bb[axisB].max) < 0.06) {
      aTrimmedAgainstB = true;
      aTrimDir = -1;
    }
    let bTrimmedAgainstA = false;
    let bTrimDir = 0;
    if (Math.abs(bb[axisA].max - ba[axisA].min) < 0.06) {
      bTrimmedAgainstA = true;
      bTrimDir = 1;
    } else if (Math.abs(bb[axisA].min - ba[axisA].max) < 0.06) {
      bTrimmedAgainstA = true;
      bTrimDir = -1;
    }
    if (!aTrimmedAgainstB && !bTrimmedAgainstA) {
      // They might be fully overlapping (Miter)
      const overlaps = [0, 1, 2].every(i => Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) > 0.01);
      if (overlaps) {
        // Force A to be trimmed against B as a starting point
        aTrimmedAgainstB = true;
        // Since they overlap, ba[axisB] overlaps bb[axisB].
        // We'll trim A so it touches B's nearest inner face.
        const distToMin = Math.abs(ba[axisB].max - bb[axisB].min);
        const distToMax = Math.abs(ba[axisB].min - bb[axisB].max);
        aTrimDir = distToMin < distToMax ? 1 : -1;
        // Wait, if they overlap, we don't extend A, we just trim A.
        // But the logic below assumes we extend the trimmed one and trim the full one.
        // If it's a miter, let's just trim A.
        pushHistory();
        let newA = {
          ...bA,
          size: [...bA.size],
          position: [...bA.position]
        };
        if (aTrimDir === 1) {
          const nMax = bb[axisB].min;
          newA.size[axisB] = Math.max(0.1, nMax - ba[axisB].min);
          newA.position[axisB] = (ba[axisB].min + nMax) / 2;
        } else {
          const nMin = bb[axisB].max;
          newA.size[axisB] = Math.max(0.1, ba[axisB].max - nMin);
          newA.position[axisB] = (nMin + ba[axisB].max) / 2;
        }
        setBoards(prev => prev.map(b => b.id === newA.id ? newA : b));
        return;
      }
      return; // Neither is trimmed, and they don't overlap, do nothing.
    }
    pushHistory();
    let newA = {
      ...bA,
      size: [...bA.size],
      position: [...bA.position]
    };
    let newB = {
      ...bB,
      size: [...bB.size],
      position: [...bB.position]
    };
    if (aTrimmedAgainstB) {
      // A is trimmed against B.
      // 1. Extend A to run full length (add B's thickness to A)
      const thiccB = bB.size[axisB];
      newA.size[axisB] += thiccB;
      newA.position[axisB] += aTrimDir === 1 ? thiccB / 2 : -thiccB / 2;

      // 2. Trim B against A (subtract A's thickness from B)
      // Where should B be trimmed? It should touch A's inner face.
      const newBa = bbOf(newA);
      const thiccA = newA.size[axisA];
      // Find which face of A B touches (min or max along axisA)
      if (bb[axisA].min < newBa[axisA].min) {
        // B is on the 'min' side of A
        const nMax = newBa[axisA].min;
        newB.size[axisA] = Math.max(0.1, nMax - bb[axisA].min);
        newB.position[axisA] = (bb[axisA].min + nMax) / 2;
      } else {
        // B is on the 'max' side of A
        const nMin = newBa[axisA].max;
        newB.size[axisA] = Math.max(0.1, bb[axisA].max - nMin);
        newB.position[axisA] = (nMin + bb[axisA].max) / 2;
      }
    } else {
      // B is trimmed against A.
      // 1. Extend B
      const thiccA = bA.size[axisA];
      newB.size[axisA] += thiccA;
      newB.position[axisA] += bTrimDir === 1 ? thiccA / 2 : -thiccA / 2;

      // 2. Trim A against B
      const newBb = bbOf(newB);
      const thiccB = newB.size[axisB];
      if (ba[axisB].min < newBb[axisB].min) {
        const nMax = newBb[axisB].min;
        newA.size[axisB] = Math.max(0.1, nMax - ba[axisB].min);
        newA.position[axisB] = (ba[axisB].min + nMax) / 2;
      } else {
        const nMin = newBb[axisB].max;
        newA.size[axisB] = Math.max(0.1, ba[axisB].max - nMin);
        newA.position[axisB] = (nMin + ba[axisB].max) / 2;
      }
    }
    setBoards(prev => prev.map(b => b.id === newA.id ? newA : b.id === newB.id ? newB : b));
  },
  /**
   * Remove all edge joints between overlapping pairs in the selection.
   */
  removeBulkEdgeJoints: (boardIds, skipHistory = false, skipToast = false) => {
    const {
      removeEdgeJoint,
      pushHistory
    } = get();
    if (!skipHistory) pushHistory();
    let removedCount = 0;
    // Collect edges to remove (pairs of IDs)
    const toRemovePairs = new Set();
    boardIds.forEach(id => {
      const b = get().boards.find(b => b.id.toString() === id.toString());
      if (b?.edgeJoints) {
        b.edgeJoints.forEach(j => {
          if (boardIds.includes(j.partnerId)) {
            // Create a stable pair key like "minId_maxId" to avoid double removing
            const pId = j.partnerId;
            const pairKey = [id.toString(), pId.toString()].sort().join('_');
            toRemovePairs.add(pairKey);
          }
        });
      }
    });
    toRemovePairs.forEach(pairKey => {
      const [idA, idB] = pairKey.split('_');
      removeEdgeJoint(idA, idB, true, true);
      removedCount++;
    });
    if (removedCount > 0 && !skipToast) {
      get().showToast(`🔗 Removed ${removedCount} edge joints from selection`);
    }
    return removedCount;
  }
});