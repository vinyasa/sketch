import * as THREE from "three";
import {
  buildSplitBoards,
  buildSplitSubtractionOperations,
  filterOperationsForPiece,
  getBoardGeometryMatrix,
  getBoardObb,
  getRelativeBoardMatrix,
  getSubtractionIntersectionBounds,
  getSubtractionSplitPlan,
} from "../../utils/operationGeometry";

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
    const { boards, pushHistory, setBoards, showToast } = get();
    const targetBoard = boards.find(
      (b) => b.id.toString() === targetBoardId.toString(),
    );
    const cutterBoard = boards.find(
      (b) => b.id.toString() === cutterBoardId.toString(),
    );
    if (!targetBoard || !cutterBoard) return;

    // ── Compute relative transform (cutter in target's local space) ───
    const Wt = getBoardGeometryMatrix(targetBoard);

    // ── Validate overlap (using oriented bounding boxes) ──────────────
    const obbA = getBoardObb(targetBoard);
    const obbB = getBoardObb(cutterBoard);

    if (!obbA.intersectsOBB(obbB)) {
      showToast("⚠ Boards must overlap to apply a boolean subtraction");
      return;
    }
    const relativeMatrix = getRelativeBoardMatrix(targetBoard, cutterBoard);

    // ── Build the operation (frozen snapshot) ─────────────────────────
    const op = {
      id: Date.now(),
      type: "subtract",
      cutterName: cutterBoard.name,
      cutterId: cutterBoard.id.toString(),
      cutterSize: [...cutterBoard.size],
      cutterShape: cutterBoard.shape || "box",
      cutterTaper: cutterBoard.taper || null,
      cutterCylinder: cutterBoard.cylinder || null,
      relativeMatrix: relativeMatrix.elements.slice(), // 16-element Float64 array
    };

    // ── Check if the subtraction splits the board using precise OBB-OBB intersection ──
    const targetHw = targetBoard.size[0] / 2;
    const targetHh = targetBoard.size[1] / 2;
    const targetHd = targetBoard.size[2] / 2;
    const eps = 0.05; // 3/64" tolerance

    const { minX, maxX, minY, maxY, minZ, maxZ } =
      getSubtractionIntersectionBounds(
        targetBoard,
        cutterBoard,
        relativeMatrix,
        eps,
      );

    const splitPlan = getSubtractionSplitPlan(
      targetBoard,
      { minX, maxX, minY, maxY, minZ, maxZ },
      eps,
    );

    if (splitPlan) {
      const {
        splitAxis,
        size1,
        size2,
        part1LocalCenter: P1_local,
        part2LocalCenter: P2_local,
      } = splitPlan;
      const id1 = Date.now().toString() + "_1";
      const id2 = Date.now().toString() + "_2";

      const { operation1: op1, operation2: op2 } =
        buildSplitSubtractionOperations({
          splitAxis,
          part1LocalCenter: P1_local,
          part2LocalCenter: P2_local,
          relativeMatrix,
          cutterBoard,
          targetBoard,
          baseOperation: op,
        });

      const { board1: newBoard1, board2: newBoard2 } = buildSplitBoards({
        targetBoard,
        targetWorldMatrix: Wt,
        splitAxis,
        size1,
        size2,
        part1LocalCenter: P1_local,
        part2LocalCenter: P2_local,
        boardId1: id1,
        boardId2: id2,
        operation1: op1,
        operation2: op2,
      });

      // ── Audit constraints on the original split board ─────────────
      const constraints = get().constraints || {};
      let newConstraints = { ...constraints };

      Object.entries(constraints).forEach(([cId, c]) => {
        const involvesOriginal =
          c.boardAId?.toString() === targetBoard.id.toString() ||
          c.boardBId?.toString() === targetBoard.id.toString();
        if (!involvesOriginal) return;

        // Remove the original constraint
        delete newConstraints[cId];

        if (c.type === "Flush") {
          const isA = c.boardAId?.toString() === targetBoard.id.toString();
          const targetFace = isA ? c.faceA : c.faceB;

          // Check if the flush face is along the split axis
          const isFaceOnSplitAxis = targetFace.startsWith(splitAxis);

          if (!isFaceOnSplitAxis) {
            // Rule 1: Perpendicular face — keep on both new pieces!
            const flush1Id = `flush_split_1_${cId}_${Date.now()}`;
            newConstraints[flush1Id] = {
              ...c,
              boardAId: isA ? id1 : c.boardAId,
              boardBId: isA ? c.boardBId : id1,
            };

            const flush2Id = `flush_split_2_${cId}_${Date.now()}`;
            newConstraints[flush2Id] = {
              ...c,
              boardAId: isA ? id2 : c.boardAId,
              boardBId: isA ? c.boardBId : id2,
            };
          } else {
            // Rule 2: Parallel face — keep only on the piece that occupies that outer face
            const isNegativeFace = targetFace.endsWith("-");
            if (isNegativeFace) {
              // Keep only on Part 1 (negative/left/bottom/back piece)
              const flush1Id = `flush_split_1_${cId}_${Date.now()}`;
              newConstraints[flush1Id] = {
                ...c,
                boardAId: isA ? id1 : c.boardAId,
                boardBId: isA ? c.boardBId : id1,
              };
            } else {
              // Keep only on Part 2 (positive/right/top/front piece)
              const flush2Id = `flush_split_2_${cId}_${Date.now()}`;
              newConstraints[flush2Id] = {
                ...c,
                boardAId: isA ? id2 : c.boardAId,
                boardBId: isA ? c.boardBId : id2,
              };
            }
          }
          return;
        }

        if (c.type === "Glue") {
          const isA = c.boardAId?.toString() === targetBoard.id.toString();
          const partnerId = isA ? c.boardBId : c.boardAId;
          const partnerBoard = boards.find(
            (bd) => bd.id.toString() === partnerId.toString(),
          );
          if (!partnerBoard) return;

          // Recalculate rigid offsets for Part 1
          const glue1Id = `glue_split_1_${cId}_${Date.now()}`;
          const offset1 = isA
            ? [
                partnerBoard.position[0] - pos1.x,
                partnerBoard.position[1] - pos1.y,
                partnerBoard.position[2] - pos1.z,
              ]
            : [
                pos1.x - partnerBoard.position[0],
                pos1.y - partnerBoard.position[1],
                pos1.z - partnerBoard.position[2],
              ];
          newConstraints[glue1Id] = {
            ...c,
            boardAId: isA ? id1 : partnerId,
            boardBId: isA ? partnerId : id1,
            offset: offset1,
          };

          // Recalculate rigid offsets for Part 2
          const glue2Id = `glue_split_2_${cId}_${Date.now()}`;
          const offset2 = isA
            ? [
                partnerBoard.position[0] - pos2.x,
                partnerBoard.position[1] - pos2.y,
                partnerBoard.position[2] - pos2.z,
              ]
            : [
                pos2.x - partnerBoard.position[0],
                pos2.y - partnerBoard.position[1],
                pos2.z - partnerBoard.position[2],
              ];
          newConstraints[glue2Id] = {
            ...c,
            boardAId: isA ? id2 : partnerId,
            boardBId: isA ? partnerId : id2,
            offset: offset2,
          };
        }
      });

      pushHistory();

      // Update boards list (hide the cutter, delete original target, insert Part 1 & 2)
      const nextBoards = boards
        .filter((b) => b.id.toString() !== targetBoard.id.toString())
        .map((b) => {
          if (b.id.toString() === cutterBoard.id.toString()) {
            return { ...b, visible: false };
          }
          return b;
        });
      nextBoards.push(newBoard1, newBoard2);

      set({
        boards: nextBoards,
        constraints: newConstraints,
        selectedItemIds: [id1, id2],
      });

      // Auto-show the cutter board after 2 seconds
      setTimeout(() => {
        const latestBoards = get().boards;
        if (
          latestBoards.some(
            (b) => b.id.toString() === cutterBoard.id.toString(),
          )
        ) {
          setBoards((prev) =>
            prev.map((b) => {
              if (b.id.toString() === cutterBoard.id.toString()) {
                return { ...b, visible: true };
              }
              return b;
            }),
          );
        }
      }, 2000);

      showToast(
        `🔪 Subtracted and split "${targetBoard.name}" into "${newBoard1.name}" and "${newBoard2.name}"`,
      );
      return;
    }

    // ── Standard Subtraction (no split) ──────────────────────────────
    pushHistory();
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id.toString() === targetBoard.id.toString()) {
          return {
            ...b,
            operations: [...(b.operations || []), op],
          };
        }
        if (b.id.toString() === cutterBoard.id.toString()) {
          return {
            ...b,
            visible: false,
          };
        }
        return b;
      }),
    );

    // Auto-show the cutter board after 2 seconds
    setTimeout(() => {
      const latestBoards = get().boards;
      if (
        latestBoards.some((b) => b.id.toString() === cutterBoard.id.toString())
      ) {
        setBoards((prev) =>
          prev.map((b) => {
            if (b.id.toString() === cutterBoard.id.toString()) {
              return { ...b, visible: true };
            }
            return b;
          }),
        );
      }
    }, 2000);

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
  applyEdgeJoint: (
    boardAId,
    boardBId,
    type = "rabbet",
    skipHistory = false,
    skipToast = false,
    skipOverlapCheck = false,
    isAutomated = false,
  ) => {
    const { boards, pushHistory, setBoards, showToast } = get();
    const boardA = boards.find((b) => b.id.toString() === boardAId.toString());
    const boardB = boards.find((b) => b.id.toString() === boardBId.toString());
    if (!boardA || !boardB) return;

    // ── Helpers ───────────────────────────────────────────────────────
    const bbOf = (b) =>
      [0, 1, 2].map((i) => ({
        min: b.position[i] - b.size[i] / 2,
        max: b.position[i] + b.size[i] / 2,
      }));
    const thinAxisOf = (b) => b.size.indexOf(Math.min(...b.size));
    const FACE_LABELS = {
      "x+": "right",
      "x-": "left",
      "y+": "top",
      "y-": "bottom",
      "z+": "front",
      "z-": "back",
    };
    const AXIS_NAMES = ["x", "y", "z"];

    // ── 3-way Corner Conflict Detection ───────────────────────────────
    if (
      !isAutomated &&
      (type === "butt" || type === "rabbet" || type === "miter")
    ) {
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
        const otherSides = boards.filter(
          (b) =>
            b.parentId === tbBoard.parentId &&
            b.id !== sideBoard.id &&
            b.id !== tbBoard.id &&
            (thinAxisOf(b) === 0 || thinAxisOf(b) === 2) &&
            [0, 1, 2].every(
              (i) =>
                Math.min(bbOf(b)[i].max, bbOf(tbBoard)[i].max) -
                  Math.max(bbOf(b)[i].min, bbOf(tbBoard)[i].min) >
                -0.05,
            ),
        );
        if (otherSides.length > 0) {
          const { setConfirmDialog } = get();
          setConfirmDialog({
            title: "Joint Cascade",
            message: `You are changing the joint between ${tbBoard.name} and ${sideBoard.name}. Do you want to apply this same joint to the other ${otherSides.length} touching side(s)?`,
            confirmText: "Yes, cascade",
            confirmColor: "#34c759",
            confirmBg: "rgba(52, 199, 89, 0.15)",
            confirmBorder: "rgba(52, 199, 89, 0.3)",
            titleColor: "#64b4ff",
            onConfirm: () => {
              setConfirmDialog(null);
              // Apply to current pair
              get().applyEdgeJoint(
                boardAId,
                boardBId,
                type,
                skipHistory,
                skipToast,
                skipOverlapCheck,
                true,
              );

              // Apply to others, maintaining the same A-over-B relationship
              otherSides.forEach((otherSide, idx) => {
                setTimeout(
                  () => {
                    if (tbBoard.id === boardA.id) {
                      get().applyEdgeJoint(
                        tbBoard.id,
                        otherSide.id,
                        type,
                        true,
                        true,
                        skipOverlapCheck,
                        true,
                      );
                    } else {
                      get().applyEdgeJoint(
                        otherSide.id,
                        tbBoard.id,
                        type,
                        true,
                        true,
                        skipOverlapCheck,
                        true,
                      );
                    }
                  },
                  (idx + 1) * 20,
                );
              });
            },
            onCancel: () => {
              setConfirmDialog(null);
              // Just apply to the current pair
              get().applyEdgeJoint(
                boardAId,
                boardBId,
                type,
                skipHistory,
                skipToast,
                skipOverlapCheck,
                true,
              );
            },
          });
          return; // Stop execution, wait for user confirmation
        }
      }
    }

    // ── Validate perpendicular ────────────────────────────────────────
    const thinA = thinAxisOf(boardA);
    const thinB = thinAxisOf(boardB);
    if (thinA === thinB) {
      if (!skipToast)
        showToast("⚠ Boards must be perpendicular (different thin axes)");
      return;
    }
    const thicknessA = boardA.size[thinA];
    const thicknessB = boardB.size[thinB];

    // ── Check for existing edge joint between these two boards ────────────
    if (
      boardA.edgeJoints?.find((j) => j.partnerId === boardB.id.toString()) ||
      boardB.edgeJoints?.find((j) => j.partnerId === boardA.id.toString())
    ) {
      if (!skipToast)
        showToast(
          "⚠ An edge joint already exists between these boards. Remove it first.",
        );
      return;
    }

    // ── Geometry computation ──────────────────────────────────────────
    const sharedAxis = [0, 1, 2].find((i) => i !== thinA && i !== thinB);
    const sharedAxisLabel = AXIS_NAMES[sharedAxis];

    // signA: direction from A toward B along A's thin axis
    const signA = boardB.position[thinA] > boardA.position[thinA] ? 1 : -1;
    // signB: direction from B toward A along B's thin axis
    const signB = boardA.position[thinB] > boardB.position[thinB] ? 1 : -1;

    // ── Base State Resolution (Geometric Butt) ────────────────────────
    // A is the OVER board. It should span to B's outer face in B's thin axis.
    // B is the UNDER board. It should be trimmed to A's inner face in A's thin axis.

    let A_inner_in_B =
      boardA.position[thinB] - signB * (boardA.size[thinB] / 2);
    let A_outer_in_B =
      boardA.position[thinB] + signB * (boardA.size[thinB] / 2);
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
    const B_outer_in_A =
      boardB.position[thinA] + signA * (boardB.size[thinA] / 2);

    // Trim/extend B to precisely touch A's inner face.
    const baseBSize = [...boardB.size];
    const baseBPos = [...boardB.position];
    baseBSize[thinA] = Math.max(0.1, Math.abs(A_inner_in_A - B_outer_in_A));
    baseBPos[thinA] = (A_inner_in_A + B_outer_in_A) / 2;

    // A's dado face: on A's thin axis, facing toward B
    const faceA = FACE_LABELS[AXIS_NAMES[thinA] + (signA > 0 ? "+" : "-")];
    // B's dado face: on B's thin axis, facing toward A
    const faceB = FACE_LABELS[AXIS_NAMES[thinB] + (signB > 0 ? "+" : "-")];

    // ── Apply Joint Extension from Base State ─────────────────────────
    let extension = 0;
    if (type === "rabbet" || type === "single-rabbet")
      extension = thicknessA / 2;
    if (type === "miter") extension = thicknessA;
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
        faceAxes: [0, 2],
      },
      bottom: {
        faceAxes: [0, 2],
      },
      front: {
        faceAxes: [0, 1],
      },
      back: {
        faceAxes: [0, 1],
      },
      right: {
        faceAxes: [1, 2],
      },
      left: {
        faceAxes: [1, 2],
      },
    };
    const AXIS_IDX = {
      x: 0,
      y: 1,
      z: 2,
    };
    const correctedBOps = (boardB.operations || []).map((op) => {
      if (op.source !== "edge-joint") return op;
      const fi = FACE_INFO[op.face];
      if (!fi) return op;
      const dirIdx = AXIS_IDX[op.direction];
      const widthAxis =
        fi.faceAxes[0] === dirIdx ? fi.faceAxes[1] : fi.faceAxes[0];
      if (widthAxis !== thinA) return op;
      return {
        ...op,
        offset: op.offset - totalCenterShiftB,
      };
    });

    // ── A's dado (over board) ─────────────────────────────────────────
    // Face: faceA (on A's thin-axis face toward B)
    const isSingleRabbet = type === "single-rabbet";
    const dadoAWidth = isSingleRabbet ? thicknessB : thicknessB / 2;
    const dadoADepth = thicknessA / 2;
    const offsetA = isSingleRabbet
      ? -signB * (baseASize[thinB] / 2 - thicknessB / 2)
      : -signB * (baseASize[thinB] / 2 - thicknessB / 4);
    const dadoA = {
      id: Date.now(),
      type: "dado",
      face: faceA,
      direction: sharedAxisLabel,
      width: dadoAWidth,
      depth: dadoADepth,
      offset: offsetA,
      length: 0,
      lengthOffset: 0,
      source: "edge-joint",
      partnerId: boardB.id.toString(),
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
      type: "dado",
      face: faceB,
      direction: sharedAxisLabel,
      width: dadoBWidth,
      depth: dadoBDepth,
      offset: offsetB,
      length: 0,
      lengthOffset: 0,
      source: "edge-joint",
      partnerId: boardA.id.toString(),
    };
    let opA = null,
      opB = null;
    if (type === "miter") {
      opA = {
        id: Date.now(),
        type: "miter",
        face: AXIS_NAMES[thinB] + (signB > 0 ? "-" : "+"),
        fenceEdge: AXIS_NAMES[sharedAxis] + "-",
        angle: 0,
        bevel: signA > 0 ? 45 : -45,
        source: "edge-joint",
        partnerId: boardB.id.toString(),
      };
      opB = {
        id: Date.now() + 1,
        type: "miter",
        face: AXIS_NAMES[thinA] + (signA > 0 ? "-" : "+"),
        fenceEdge: AXIS_NAMES[sharedAxis] + "-",
        angle: 0,
        bevel: signB > 0 ? 45 : -45,
        source: "edge-joint",
        partnerId: boardA.id.toString(),
      };
    } else if (type === "single-rabbet") {
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
      signB,
    };
    const centerShiftA = baseAPos[thinB] - boardA.position[thinB];
    const correctedAOps = (boardA.operations || []).map((op) => {
      if (op.source !== "edge-joint") return op;
      const fi = FACE_INFO[op.face];
      if (!fi) return op;
      const dirIdx = AXIS_IDX[op.direction];
      const widthAxis =
        fi.faceAxes[0] === dirIdx ? fi.faceAxes[1] : fi.faceAxes[0];
      if (widthAxis !== thinB) return op;
      return {
        ...op,
        offset: op.offset - centerShiftA,
      };
    });
    if (!skipHistory) pushHistory();
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id.toString() === boardA.id.toString()) {
          const newOps =
            type === "butt" || !opA ? correctedAOps : [...correctedAOps, opA];
          return {
            ...b,
            size: baseASize,
            position: baseAPos,
            operations: newOps,
            edgeJoints: [
              ...(b.edgeJoints || []),
              {
                ...meta,
                partnerId: boardB.id.toString(),
              },
            ],
          };
        }
        if (b.id.toString() === boardB.id.toString()) {
          const newOps =
            type === "butt" || !opB ? correctedBOps : [...correctedBOps, opB];
          return {
            ...b,
            size: newBSize,
            position: newBPos,
            operations: newOps,
            edgeJoints: [
              ...(b.edgeJoints || []),
              {
                ...meta,
                partnerId: boardA.id.toString(),
              },
            ],
          };
        }
        return b;
      }),
    );
    if (!skipToast) {
      const jointName = type === "butt" ? "Butt" : "Rabbet";
      showToast(
        `🔗 ${jointName} joint applied: "${boardA.name}" over "${boardB.name}"`,
      );
    }
  },
  /**
   * Toggle (flip) an existing rabbet joint.
   * The previously "over" board becomes "under" (shrinks) and vice versa.
   * Strategy: remove the current joint, then re-apply with swapped roles.
   */
  toggleEdgeJoint: (boardId, partnerId) => {
    const { boards, pushHistory, setBoards, showToast } = get();
    const board = boards.find((b) => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(
      (j) => j.partnerId === partnerId.toString(),
    );
    if (!joint) return;
    const partner = boards.find((b) => b.id.toString() === joint.partnerId);
    if (!partner) return;
    const { overBoardId, shrinkAxis, shrinkAmount, signA } = joint;
    const currentOver = boards.find((b) => b.id.toString() === overBoardId);
    const currentUnder = currentOver.id === board.id ? partner : board;
    if (!currentOver || !currentUnder) return;

    // ── 1. Restore the under board to its original size ───────────────
    const restoredUnderSize = [...currentUnder.size];
    const restoredUnderPos = [...currentUnder.position];
    restoredUnderSize[shrinkAxis] += shrinkAmount;
    const underSignA = joint.signA; // Fix: use joint, not currentUnder.edgeJoint
    restoredUnderPos[shrinkAxis] -= underSignA * (shrinkAmount / 2);

    // ── 2. Remove old rabbet dados from both ──────────────────────────
    const stripRabbetDados = (ops, pid) =>
      (ops || []).filter(
        (op) => !(op.source === "edge-joint" && op.partnerId === pid),
      );

    // ── 3. Apply restored state (strip dados, restore sizes) ──────────
    pushHistory();
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id.toString() === currentUnder.id.toString()) {
          const cleaned = {
            ...b,
            size: restoredUnderSize,
            position: restoredUnderPos,
            operations: stripRabbetDados(
              b.operations,
              currentOver.id.toString(),
            ),
            edgeJoints: (b.edgeJoints || []).filter(
              (j) => j.partnerId !== currentOver.id.toString(),
            ),
          };
          return cleaned;
        }
        if (b.id.toString() === currentOver.id.toString()) {
          const cleaned = {
            ...b,
            operations: stripRabbetDados(
              b.operations,
              currentUnder.id.toString(),
            ),
            edgeJoints: (b.edgeJoints || []).filter(
              (j) => j.partnerId !== currentUnder.id.toString(),
            ),
          };
          return cleaned;
        }
        return b;
      }),
    );

    // ── 4. Re-apply with swapped roles (former under is now over) ─────
    // Use setTimeout to let state update, then call applyEdgeJoint
    setTimeout(() => {
      get().applyEdgeJoint(
        currentUnder.id,
        currentOver.id,
        joint.type || "rabbet",
      );
    }, 0);
  },
  /**
   * Switch an existing edge joint to a different type (e.g., rabbet to butt).
   */
  switchEdgeJointType: (boardId, partnerId, newType) => {
    const { boards, removeEdgeJoint, applyEdgeJoint } = get();
    const board = boards.find((b) => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(
      (j) => j.partnerId === partnerId.toString(),
    );
    if (!joint) return;
    const overBoardId = joint.overBoardId;
    const underBoardId =
      overBoardId === board.id.toString()
        ? joint.partnerId
        : board.id.toString();
    removeEdgeJoint(boardId, partnerId, true, true);
    setTimeout(() => {
      get().applyEdgeJoint(overBoardId, underBoardId, newType);
    }, 0);
  },
  /**
   * Remove a rabbet joint — restore the under board's size and remove
   * rabbet-tagged dados from both boards.
   */
  removeEdgeJoint: (
    boardId,
    partnerId,
    skipHistory = false,
    skipToast = false,
  ) => {
    const { boards, pushHistory, setBoards, showToast } = get();
    const board = boards.find((b) => b.id.toString() === boardId.toString());
    const joint = board?.edgeJoints?.find(
      (j) => j.partnerId === partnerId.toString(),
    );
    if (!joint) return;
    const partner = boards.find((b) => b.id.toString() === joint.partnerId);
    if (!partner) return;
    const { overBoardId, shrinkAxis, shrinkAmount, signA } = joint;
    const underBoard = boards.find(
      (b) =>
        b.id.toString() !== overBoardId &&
        (b.id.toString() === board.id.toString() ||
          b.id.toString() === partner.id.toString()),
    );
    const stripRabbetDados = (ops, pid) =>
      (ops || []).filter(
        (op) => !(op.source === "edge-joint" && op.partnerId === pid),
      );
    if (!skipHistory) pushHistory();
    setBoards((prev) =>
      prev.map((b) => {
        const isBoard = b.id.toString() === board.id.toString();
        const isPartner = b.id.toString() === partner.id.toString();
        if (!isBoard && !isPartner) return b;
        const pid = isBoard ? partner.id.toString() : board.id.toString();
        const cleaned = {
          ...b,
          operations: stripRabbetDados(b.operations, pid),
          edgeJoints: (b.edgeJoints || []).filter((j) => j.partnerId !== pid),
        };

        // Restore under board's size
        if (underBoard && b.id.toString() === underBoard.id.toString()) {
          cleaned.size = [...b.size];
          cleaned.position = [...b.position];
          cleaned.size[shrinkAxis] += shrinkAmount;
          cleaned.position[shrinkAxis] -= signA * (shrinkAmount / 2);
        }
        return cleaned;
      }),
    );
    if (!skipToast)
      showToast(
        `🔗 Edge joint removed between "${board.name}" and "${partner.name}"`,
      );
  },
  /**
   * Apply edge joints to all overlapping pairs among the selected boards.
   */
  applyBulkEdgeJoints: (boardIds, type = "rabbet", sideOverTop = true) => {
    const { removeBulkEdgeJoints, pushHistory } = get();

    // Push a single history state for the entire bulk operation
    pushHistory();

    // 1. Remove existing edge joints among these boards silently
    removeBulkEdgeJoints(boardIds, true, true);

    // Use a slight timeout so the removes can flush through state
    setTimeout(() => {
      const { boards: latestBoards } = get();
      const selBoards = boardIds
        .map((id) =>
          latestBoards.find((b) => b.id.toString() === id.toString()),
        )
        .filter((b) => b && b.shape !== "plane");

      // Helpers
      const bbOf = (b) =>
        [0, 1, 2].map((i) => ({
          min: b.position[i] - b.size[i] / 2,
          max: b.position[i] + b.size[i] / 2,
        }));
      const touches = (ba, bb) =>
        [0, 1, 2].every(
          (i) =>
            Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) >
            -0.05,
        );
      const thinAxisOf = (b) => b.size.indexOf(Math.min(...b.size));
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
            get().applyEdgeJoint(
              overBoardId,
              underBoardId,
              type,
              true,
              true,
              true,
            );
          }, jointCount * 10);
          jointCount++;
        }
      }
      if (jointCount > 0) {
        setTimeout(
          () => {
            const jointName =
              type === "butt" ? "Butt" : type === "miter" ? "Miter" : "Rabbet";
            get().showToast(
              `🔗 Applied ${jointCount} ${jointName} joints to selection`,
            );
          },
          jointCount * 10 + 50,
        );
      }
    }, 10);
  },
  /**
   * Apply a specialized box panel joint (sit-on, full-inset, or rabbeted-inset)
   * between a top/bottom board and 4 sides.
   */
  applyBoxPanelJoint: (topBottomId, sidesIds, type) => {
    const { applyEdgeJoint, pushHistory } = get();
    pushHistory();

    // Use a slight timeout to allow history push to settle
    setTimeout(() => {
      if (type === "sit-on") {
        // Top/bottom sits fully on sides: Top/bottom is over (full size), sides are under (shrink)
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(topBottomId, sideId, "butt", true, true, true);
          }, idx * 15);
        });
      } else if (type === "full-inset") {
        // Sandwiched: Sides are over (full size), top/bottom is under (shrink)
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(sideId, topBottomId, "butt", true, true, true);
          }, idx * 15);
        });
      } else if (type === "rabbeted-inset") {
        // Sides are over (full size), top/bottom is under (shrink). Both get dado/rabbet cuts
        sidesIds.forEach((sideId, idx) => {
          setTimeout(() => {
            applyEdgeJoint(sideId, topBottomId, "rabbet", true, true, true);
          }, idx * 15);
        });
      }
      setTimeout(
        () => {
          get().showToast(`🔗 Applied ${type} joints to box panel`);
        },
        sidesIds.length * 15 + 50,
      );
    }, 10);
  },
  /**
   * Toggles a geometric butt joint between two touching boards.
   * It detects which one is trimmed against the other, extends the trimmed one, and trims the full-length one.
   */
  toggleGeometricJoint: (idA, idB) => {
    const { boards, setBoards, pushHistory } = get();
    const bA = boards.find((b) => b.id.toString() === idA.toString());
    const bB = boards.find((b) => b.id.toString() === idB.toString());
    if (!bA || !bB) return;
    const bbOf = (b) =>
      [0, 1, 2].map((i) => ({
        min: b.position[i] - b.size[i] / 2,
        max: b.position[i] + b.size[i] / 2,
      }));
    const thinAxis = (b) => b.size.indexOf(Math.min(...b.size));
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
      const overlaps = [0, 1, 2].every(
        (i) =>
          Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) >
          0.01,
      );
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
          position: [...bA.position],
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
        setBoards((prev) => prev.map((b) => (b.id === newA.id ? newA : b)));
        return;
      }
      return; // Neither is trimmed, and they don't overlap, do nothing.
    }
    pushHistory();
    let newA = {
      ...bA,
      size: [...bA.size],
      position: [...bA.position],
    };
    let newB = {
      ...bB,
      size: [...bB.size],
      position: [...bB.position],
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
    setBoards((prev) =>
      prev.map((b) => (b.id === newA.id ? newA : b.id === newB.id ? newB : b)),
    );
  },
  /**
   * Remove all edge joints between overlapping pairs in the selection.
   */
  removeBulkEdgeJoints: (boardIds, skipHistory = false, skipToast = false) => {
    const { removeEdgeJoint, pushHistory } = get();
    if (!skipHistory) pushHistory();
    let removedCount = 0;
    // Collect edges to remove (pairs of IDs)
    const toRemovePairs = new Set();
    boardIds.forEach((id) => {
      const b = get().boards.find((b) => b.id.toString() === id.toString());
      if (b?.edgeJoints) {
        b.edgeJoints.forEach((j) => {
          if (boardIds.includes(j.partnerId)) {
            // Create a stable pair key like "minId_maxId" to avoid double removing
            const pId = j.partnerId;
            const pairKey = [id.toString(), pId.toString()].sort().join("_");
            toRemovePairs.add(pairKey);
          }
        });
      }
    });
    toRemovePairs.forEach((pairKey) => {
      const [idA, idB] = pairKey.split("_");
      removeEdgeJoint(idA, idB, true, true);
      removedCount++;
    });
    if (removedCount > 0 && !skipToast) {
      get().showToast(`🔗 Removed ${removedCount} edge joints from selection`);
    }
    return removedCount;
  },
  definePlaneActive: false,
  definePlaneFeatures: [],
  setDefinePlaneActive: (active) =>
    set({ definePlaneActive: active, definePlaneFeatures: [] }),
  addDefinePlaneFeature: (feature) => {
    const { definePlaneFeatures } = get();
    const isSameFeature = (f1, f2) => {
      if (f1.type !== f2.type) return false;
      if (f1.type === "point") {
        return (
          Math.abs(f1.pos[0] - f2.pos[0]) < 0.01 &&
          Math.abs(f1.pos[1] - f2.pos[1]) < 0.01 &&
          Math.abs(f1.pos[2] - f2.pos[2]) < 0.01
        );
      }
      if (f1.type === "edge") {
        return (
          (Math.abs(f1.start[0] - f2.start[0]) < 0.01 &&
            Math.abs(f1.start[1] - f2.start[1]) < 0.01 &&
            Math.abs(f1.start[2] - f2.start[2]) < 0.01 &&
            Math.abs(f1.end[0] - f2.end[0]) < 0.01 &&
            Math.abs(f1.end[1] - f2.end[1]) < 0.01 &&
            Math.abs(f1.end[2] - f2.end[2]) < 0.01) ||
          (Math.abs(f1.start[0] - f2.end[0]) < 0.01 &&
            Math.abs(f1.start[1] - f2.end[1]) < 0.01 &&
            Math.abs(f1.start[2] - f2.end[2]) < 0.01 &&
            Math.abs(f1.end[0] - f2.start[0]) < 0.01 &&
            Math.abs(f1.end[1] - f2.start[1]) < 0.01 &&
            Math.abs(f1.end[2] - f2.start[2]) < 0.01)
        );
      }
      return false;
    };

    const existsIndex = definePlaneFeatures.findIndex((f) =>
      isSameFeature(f, feature),
    );
    if (existsIndex > -1) {
      set({
        definePlaneFeatures: definePlaneFeatures.filter(
          (_, i) => i !== existsIndex,
        ),
      });
      return;
    }

    let currentPointsCount = 0;
    definePlaneFeatures.forEach((f) => {
      currentPointsCount += f.type === "edge" ? 2 : 1;
    });

    const incomingCount = feature.type === "edge" ? 2 : 1;
    if (currentPointsCount + incomingCount === 3) {
      const finalFeatures = [...definePlaneFeatures, feature];
      const pts = [];
      finalFeatures.forEach((f) => {
        if (f.type === "point") pts.push(new THREE.Vector3(...f.pos));
        if (f.type === "edge") {
          pts.push(new THREE.Vector3(...f.start));
          pts.push(new THREE.Vector3(...f.end));
        }
      });

      const p0 = pts[0];
      const p1 = pts[1];
      const p2 = pts[2];

      const centroid = new THREE.Vector3()
        .add(p0)
        .add(p1)
        .add(p2)
        .multiplyScalar(1 / 3);
      const v1 = new THREE.Vector3().subVectors(p1, p0);
      const v2 = new THREE.Vector3().subVectors(p2, p0);
      const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

      if (normal.lengthSq() < 0.0001) {
        get().showToast(
          "⚠ Selected points are collinear. Cannot define a plane.",
        );
        return;
      }

      const localX = new THREE.Vector3().subVectors(p1, p0).normalize();
      const v3 = new THREE.Vector3().subVectors(p2, p0);
      const localZ = new THREE.Vector3().crossVectors(localX, v3).normalize();
      const localY = new THREE.Vector3()
        .crossVectors(localZ, localX)
        .normalize();

      const matrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);
      const euler = new THREE.Euler().setFromRotationMatrix(matrix, "YXZ");

      const planeId = "plane_" + Date.now();
      const newPlane = {
        id: planeId,
        name:
          "Plane " +
          (get().boards.filter((b) => b.shape === "plane").length + 1),
        shape: "plane",
        position: [centroid.x, centroid.y, centroid.z],
        orientation: [euler.x, euler.y, euler.z],
        points: pts.map((p) => p.toArray()),
        normal: normal.toArray(),
        centroid: centroid.toArray(),
        parentId: "Workspace",
        visible: true,
        operations: [],
      };

      const { boards, pushHistory, setBoards } = get();
      pushHistory();
      setBoards([...boards, newPlane]);
      set({
        selectedItemIds: [planeId],
        definePlaneActive: false,
        definePlaneFeatures: [],
      });
      get().showToast(`✓ Established and selected "${newPlane.name}"`);
    } else if (currentPointsCount + incomingCount < 3) {
      set({ definePlaneFeatures: [...definePlaneFeatures, feature] });
    } else {
      get().showToast(
        "Cannot select feature: defining a plane requires exactly 3 points.",
      );
    }
  },
  clearDefinePlaneFeatures: () => set({ definePlaneFeatures: [] }),
  createSlabFromPlane: (
    planeCentroid,
    planeNormal,
    planePoints,
    width,
    height,
    thickness,
    name,
    thicknessDirection = "up",
    planeIdToDelete = null,
  ) => {
    const { boards, pushHistory, setBoards, showToast, defaultMaterial } =
      get();

    if (planePoints.length < 3) return;

    const p0 = new THREE.Vector3(...planePoints[0]);
    const p1 = new THREE.Vector3(...planePoints[1]);
    const p2 = new THREE.Vector3(...planePoints[2]);

    const centroid = new THREE.Vector3(...planeCentroid);

    const localX = new THREE.Vector3().subVectors(p1, p0).normalize();
    const v2 = new THREE.Vector3().subVectors(p2, p0);
    const localZ = new THREE.Vector3().crossVectors(localX, v2).normalize();
    const localY = new THREE.Vector3().crossVectors(localZ, localX).normalize();

    // Shift centroid based on thickness direction along plane normal (localZ)
    let shiftAmount = 0;
    if (thicknessDirection === "up") {
      shiftAmount = thickness / 2;
    } else if (thicknessDirection === "down") {
      shiftAmount = -thickness / 2;
    }
    const shiftedCentroid = centroid
      .clone()
      .addScaledVector(localZ, shiftAmount);

    const matrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);
    const euler = new THREE.Euler().setFromRotationMatrix(matrix, "YXZ");

    const newBoard = {
      id: "slab_" + Date.now(),
      name: name || "Slab Plane",
      size: [width, height, thickness],
      position: [shiftedCentroid.x, shiftedCentroid.y, shiftedCentroid.z],
      orientation: [euler.x, euler.y, euler.z],
      parentId: "Workspace",
      material: defaultMaterial || "pine",
      visible: true,
      operations: [],
    };

    pushHistory();
    let nextBoards = [...boards];
    if (planeIdToDelete) {
      nextBoards = nextBoards.filter(
        (b) => b.id.toString() !== planeIdToDelete.toString(),
      );
    }
    setBoards([...nextBoards, newBoard]);
    set({ selectedItemIds: [newBoard.id.toString()] });
    showToast(`Created slab board "${newBoard.name}"`);

    set({ definePlaneActive: false, definePlaneFeatures: [] });
  },
  cutBoardWithPlane: (targetBoardIds, planeCentroid, planeNormal) => {
    const { boards, pushHistory, setBoards, showToast, constraints } = get();

    const normal = new THREE.Vector3(...planeNormal).normalize();
    const centroid = new THREE.Vector3(...planeCentroid);

    let nextBoards = [...boards];
    let newConstraints = { ...constraints };
    let didCutAny = false;

    const targetBoards = boards.filter((b) =>
      targetBoardIds.includes(b.id.toString()),
    );

    const getWorldCorners = (b) => {
      const hw = b.size[0] / 2;
      const hh = b.size[1] / 2;
      const hd = b.size[2] / 2;
      const localCorners = [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(hw, hh, hd),
      ];
      if (b.pivot) {
        const pivotVec = new THREE.Vector3(...b.pivot);
        localCorners.forEach((c) => c.sub(pivotVec));
      }
      const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), "YXZ");
      const pos = new THREE.Vector3(...b.position);

      return localCorners.map((c) => {
        c.applyEuler(euler);
        c.add(pos);
        return c;
      });
    };

    const getBoardWorldMatrix = (b) => {
      const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), "YXZ");
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...b.position),
        new THREE.Quaternion().setFromEuler(euler),
        new THREE.Vector3(1, 1, 1),
      );
      if (b.pivot) {
        matrix.multiply(
          new THREE.Matrix4().makeTranslation(
            -b.pivot[0],
            -b.pivot[1],
            -b.pivot[2],
          ),
        );
      }
      return matrix;
    };

    const L = 500;

    const w = normal.clone().normalize();
    let u =
      Math.abs(w.x) < 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
    u.cross(w).normalize();
    const v = new THREE.Vector3().crossVectors(w, u).normalize();
    const cutterRotMatrix = new THREE.Matrix4().makeBasis(u, v, w);

    const boardsToRemove = [];
    const boardsToAdd = [];

    targetBoards.forEach((b) => {
      const corners = getWorldCorners(b);
      let numPos = 0;
      let numNeg = 0;

      corners.forEach((c) => {
        const dist = new THREE.Vector3().subVectors(c, centroid).dot(normal);
        if (dist > 0.001) numPos++;
        else if (dist < -0.001) numNeg++;
      });

      if (numPos === 0 || numNeg === 0) {
        return;
      }

      didCutAny = true;
      boardsToRemove.push(b.id.toString());

      const id1 = b.id.toString() + "_part1_" + Date.now();
      const id2 = b.id.toString() + "_part2_" + Date.now();

      const cutterPos1 = centroid.clone().addScaledVector(normal, L / 2);
      const Wc1 = new THREE.Matrix4().compose(
        cutterPos1,
        new THREE.Quaternion().setFromRotationMatrix(cutterRotMatrix),
        new THREE.Vector3(1, 1, 1),
      );
      const Wb = getBoardWorldMatrix(b);
      const relativeMatrix1 = Wb.clone().invert().multiply(Wc1);

      const op1 = {
        id: Date.now() + 10 + Math.random(),
        type: "subtract",
        cutterName: "Plane Cut (Positive Face)",
        cutterId: "plane-cutter-pos-" + Date.now(),
        cutterSize: [L, L, L],
        cutterShape: "box",
        relativeMatrix: relativeMatrix1.elements.slice(),
      };

      const newBoard1 = {
        ...b,
        id: id1,
        name: `${b.name} (Part 1)`,
        operations: [...(b.operations || []), op1],
      };

      const cutterPos2 = centroid.clone().addScaledVector(normal, -L / 2);
      const Wc2 = new THREE.Matrix4().compose(
        cutterPos2,
        new THREE.Quaternion().setFromRotationMatrix(cutterRotMatrix),
        new THREE.Vector3(1, 1, 1),
      );
      const relativeMatrix2 = Wb.clone().invert().multiply(Wc2);

      const op2 = {
        id: Date.now() + 20 + Math.random(),
        type: "subtract",
        cutterName: "Plane Cut (Negative Face)",
        cutterId: "plane-cutter-neg-" + Date.now(),
        cutterSize: [L, L, L],
        cutterShape: "box",
        relativeMatrix: relativeMatrix2.elements.slice(),
      };

      const newBoard2 = {
        ...b,
        id: id2,
        name: `${b.name} (Part 2)`,
        operations: [...(b.operations || []), op2],
      };

      boardsToAdd.push(newBoard1, newBoard2);

      Object.entries(newConstraints).forEach(([cId, c]) => {
        const involvesOriginal =
          c.boardAId?.toString() === b.id.toString() ||
          c.boardBId?.toString() === b.id.toString();
        if (!involvesOriginal) return;

        delete newConstraints[cId];

        if (c.type === "Flush") {
          const isA = c.boardAId?.toString() === b.id.toString();
          const flush1Id = `flush_plane_1_${cId}_${Date.now()}`;
          newConstraints[flush1Id] = {
            ...c,
            boardAId: isA ? id1 : c.boardAId,
            boardBId: isA ? c.boardBId : id1,
          };

          const flush2Id = `flush_plane_2_${cId}_${Date.now()}`;
          newConstraints[flush2Id] = {
            ...c,
            boardAId: isA ? id2 : c.boardAId,
            boardBId: isA ? c.boardBId : id2,
          };
        }

        if (c.type === "Glue") {
          const isA = c.boardAId?.toString() === b.id.toString();
          const partnerId = isA ? c.boardBId : c.boardAId;
          const partnerBoard = boards.find(
            (bd) => bd.id.toString() === partnerId.toString(),
          );
          if (partnerBoard) {
            const glue1Id = `glue_plane_1_${cId}_${Date.now()}`;
            const offset1 = isA
              ? [
                  partnerBoard.position[0] - b.position[0],
                  partnerBoard.position[1] - b.position[1],
                  partnerBoard.position[2] - b.position[2],
                ]
              : [
                  b.position[0] - partnerBoard.position[0],
                  b.position[1] - partnerBoard.position[1],
                  b.position[2] - partnerBoard.position[2],
                ];
            newConstraints[glue1Id] = {
              ...c,
              boardAId: isA ? id1 : partnerId,
              boardBId: isA ? partnerId : id1,
              offset: offset1,
            };

            const glue2Id = `glue_plane_2_${cId}_${Date.now()}`;
            const offset2 = isA
              ? [
                  partnerBoard.position[0] - b.position[0],
                  partnerBoard.position[1] - b.position[1],
                  partnerBoard.position[2] - b.position[2],
                ]
              : [
                  b.position[0] - partnerBoard.position[0],
                  b.position[1] - partnerBoard.position[1],
                  b.position[2] - partnerBoard.position[2],
                ];
            newConstraints[glue2Id] = {
              ...c,
              boardAId: isA ? id2 : partnerId,
              boardBId: isA ? partnerId : id2,
              offset: offset2,
            };
          }
        }
      });
    });

    if (!didCutAny) {
      showToast("⚠ The plane does not intersect the selected board(s).");
      return;
    }

    pushHistory();

    nextBoards = nextBoards.filter(
      (b) => !boardsToRemove.includes(b.id.toString()),
    );
    nextBoards.push(...boardsToAdd);

    set({
      boards: nextBoards,
      constraints: newConstraints,
      selectedItemIds: boardsToAdd.map((b) => b.id.toString()),
      definePlaneActive: false,
      definePlaneFeatures: [],
    });

    showToast(`🔪 Split board(s) using the defined plane.`);
  },
});
