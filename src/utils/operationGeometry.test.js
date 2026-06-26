import { describe, expect, it } from "vitest";
import {
  buildSplitBoards,
  buildSplitSubtractionOperations,
  filterOperationsForPiece,
  getBoardGeometryMatrix,
  getBoardObb,
  getRelativeBoardMatrix,
  getSubtractionIntersectionBounds,
  getSubtractionSplitPlan,
  redistributeSplitConstraints,
} from "./operationGeometry";

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    orientation: overrides.orientation ?? [0, 0, 0],
    pivot: overrides.pivot,
    ...overrides,
  };
}

describe("operationGeometry", () => {
  it("builds a geometry matrix for an unrotated board", () => {
    const matrix = getBoardGeometryMatrix(makeBoard({ position: [1, 2, 3] }));
    expect(matrix.elements[12]).toBeCloseTo(1);
    expect(matrix.elements[13]).toBeCloseTo(2);
    expect(matrix.elements[14]).toBeCloseTo(3);
  });

  it("builds an OBB with the expected half-size", () => {
    const obb = getBoardObb(makeBoard({ size: [10, 4, 2] }));
    expect(obb.halfSize.x).toBeCloseTo(5);
    expect(obb.halfSize.y).toBeCloseTo(2);
    expect(obb.halfSize.z).toBeCloseTo(1);
  });

  it("computes the cutter transform relative to the target board", () => {
    const relative = getRelativeBoardMatrix(
      makeBoard({ position: [0, 0, 0] }),
      makeBoard({ position: [5, 0, 0] }),
    );
    expect(relative.elements[12]).toBeCloseTo(5);
  });

  it("computes subtraction intersection bounds for an axis-aligned centered cut", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const cutterBoard = makeBoard({ size: [2, 6, 6], position: [0, 0, 0] });
    const relativeMatrix = getRelativeBoardMatrix(targetBoard, cutterBoard);

    const bounds = getSubtractionIntersectionBounds(
      targetBoard,
      cutterBoard,
      relativeMatrix,
    );

    expect(bounds.minX).toBeCloseTo(-1);
    expect(bounds.maxX).toBeCloseTo(1);
    expect(bounds.minY).toBeCloseTo(-2);
    expect(bounds.maxY).toBeCloseTo(2);
    expect(bounds.minZ).toBeCloseTo(-2);
    expect(bounds.maxZ).toBeCloseTo(2);
  });

  it("computes subtraction intersection bounds for an offset cut", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const cutterBoard = makeBoard({ size: [2, 6, 6], position: [2, 0, 0] });
    const relativeMatrix = getRelativeBoardMatrix(targetBoard, cutterBoard);

    const bounds = getSubtractionIntersectionBounds(
      targetBoard,
      cutterBoard,
      relativeMatrix,
    );

    expect(bounds.minX).toBeCloseTo(1);
    expect(bounds.maxX).toBeCloseTo(3);
    expect(bounds.minY).toBeCloseTo(-2);
    expect(bounds.maxY).toBeCloseTo(2);
    expect(bounds.minZ).toBeCloseTo(-2);
    expect(bounds.maxZ).toBeCloseTo(2);
  });

  it("creates a split plan when the subtraction spans the full height and depth", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const plan = getSubtractionSplitPlan(targetBoard, {
      minX: -1,
      maxX: 1,
      minY: -2,
      maxY: 2,
      minZ: -2,
      maxZ: 2,
    });

    expect(plan).toEqual({
      splitAxis: "x",
      cutMin: -1,
      cutMax: 1,
      size1: [6, 4, 4],
      size2: [6, 4, 4],
      part1LocalCenter: [-2, 0, 0],
      part2LocalCenter: [2, 0, 0],
    });
  });

  it("returns null when the subtraction does not fully span two axes", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const plan = getSubtractionSplitPlan(targetBoard, {
      minX: -1,
      maxX: 1,
      minY: -1,
      maxY: 1,
      minZ: -2,
      maxZ: 2,
    });

    expect(plan).toBeNull();
  });

  it("builds extended split subtraction operations for an x-axis split", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const cutterBoard = makeBoard({ size: [2, 6, 6], position: [0, 0, 0] });
    const relativeMatrix = getRelativeBoardMatrix(targetBoard, cutterBoard);

    const result = buildSplitSubtractionOperations({
      splitAxis: "x",
      part1LocalCenter: [-2, 0, 0],
      part2LocalCenter: [2, 0, 0],
      relativeMatrix,
      cutterBoard,
      targetBoard,
      baseOperation: { id: 100, type: "subtract" },
      operationIdFactory: (offset) => 100 + offset,
    });

    expect(result.cutterAxisIdx).toBe(0);
    expect(result.cutterSize1).toEqual([40, 6, 6]);
    expect(result.cutterSize2).toEqual([40, 6, 6]);
    expect(result.operation1.id).toBe(101);
    expect(result.operation2.id).toBe(102);
    expect(result.operation1.relativeMatrix[12]).toBeCloseTo(21);
    expect(result.operation2.relativeMatrix[12]).toBeCloseTo(-21);
  });

  it("uses the dominant cutter-space axis when the relative transform is rotated", () => {
    const targetBoard = makeBoard({ size: [10, 4, 4], position: [0, 0, 0] });
    const cutterBoard = makeBoard({
      size: [2, 6, 8],
      position: [0, 0, 0],
      orientation: [0, 0, Math.PI / 2],
    });
    const relativeMatrix = getRelativeBoardMatrix(targetBoard, cutterBoard);

    const result = buildSplitSubtractionOperations({
      splitAxis: "x",
      part1LocalCenter: [-2, 0, 0],
      part2LocalCenter: [2, 0, 0],
      relativeMatrix,
      cutterBoard,
      targetBoard,
      baseOperation: { id: 200, type: "subtract" },
      operationIdFactory: (offset) => 200 + offset,
    });

    expect(result.cutterAxisIdx).toBe(1);
    expect(result.cutterSize1).toEqual([2, 40, 8]);
    expect(result.cutterSize2).toEqual([2, 40, 8]);
  });

  it("shifts subtract operations into the local space of the split piece", () => {
    const relativeMatrix = getRelativeBoardMatrix(
      makeBoard({ position: [0, 0, 0] }),
      makeBoard({ position: [5, 0, 0] }),
    );

    const result = filterOperationsForPiece(
      { type: "subtract", relativeMatrix: relativeMatrix.elements.slice() },
      1,
      "x",
      [-2, 0, 0],
      [2, 0, 0],
      [6, 4, 4],
      [6, 4, 4],
      makeBoard({ size: [10, 4, 4], position: [0, 0, 0] }),
    );

    expect(result.relativeMatrix[12]).toBeCloseTo(7);
  });

  it("drops miter operations that belong only to the opposite split face", () => {
    const result = filterOperationsForPiece(
      { type: "miter", face: "x+" },
      1,
      "x",
      [-2, 0, 0],
      [2, 0, 0],
      [6, 4, 4],
      [6, 4, 4],
      makeBoard({ size: [10, 4, 4], position: [0, 0, 0] }),
    );

    expect(result).toBeNull();
  });

  it("adjusts dado offsets when the split happens along the offset axis", () => {
    const result = filterOperationsForPiece(
      { type: "dado", face: "top", direction: "z", offset: 3 },
      1,
      "x",
      [-2, 0, 0],
      [2, 0, 0],
      [6, 4, 4],
      [6, 4, 4],
      makeBoard({ size: [10, 4, 4], position: [0, 0, 0] }),
    );

    expect(result.offset).toBe(5);
  });

  it("builds split boards with transformed positions and inherited operations", () => {
    const targetBoard = makeBoard({
      id: "target",
      name: "Shelf",
      size: [10, 4, 4],
      position: [10, 0, 0],
      operations: [
        { type: "miter", face: "x-" },
        { type: "miter", face: "x+" },
      ],
    });

    const result = buildSplitBoards({
      targetBoard,
      targetWorldMatrix: getBoardGeometryMatrix(targetBoard),
      splitAxis: "x",
      size1: [6, 4, 4],
      size2: [6, 4, 4],
      part1LocalCenter: [-2, 0, 0],
      part2LocalCenter: [2, 0, 0],
      boardId1: "b1",
      boardId2: "b2",
      operation1: { type: "subtract", id: 1 },
      operation2: { type: "subtract", id: 2 },
    });

    expect(result.board1.name).toBe("Shelf (Part 1)");
    expect(result.board2.name).toBe("Shelf (Part 2)");
    expect(result.board1.position).toEqual([8, 0, 0]);
    expect(result.board2.position).toEqual([12, 0, 0]);
    expect(result.board1.operations).toEqual([
      { type: "miter", face: "x-" },
      { type: "subtract", id: 1 },
    ]);
    expect(result.board2.operations).toEqual([
      { type: "miter", face: "x+" },
      { type: "subtract", id: 2 },
    ]);
  });

  it("duplicates perpendicular flush constraints onto both split boards", () => {
    const targetBoard = makeBoard({ id: "target", position: [10, 0, 0] });
    const newBoard1 = makeBoard({ id: "b1", position: [8, 0, 0] });
    const newBoard2 = makeBoard({ id: "b2", position: [12, 0, 0] });
    const constraints = {
      c1: {
        type: "Flush",
        boardAId: "target",
        boardBId: "other",
        faceA: "y+",
        faceB: "y-",
      },
    };

    const result = redistributeSplitConstraints({
      constraints,
      targetBoard,
      newBoard1,
      newBoard2,
      splitAxis: "x",
      boards: [targetBoard, newBoard1, newBoard2],
      idFactory: (prefix, constraintId) => `${prefix}_${constraintId}`,
    });

    expect(result).toEqual({
      flush_split_1_c1: {
        type: "Flush",
        boardAId: "b1",
        boardBId: "other",
        faceA: "y+",
        faceB: "y-",
      },
      flush_split_2_c1: {
        type: "Flush",
        boardAId: "b2",
        boardBId: "other",
        faceA: "y+",
        faceB: "y-",
      },
    });
  });

  it("keeps split-axis flush constraints only on the matching outer piece", () => {
    const targetBoard = makeBoard({ id: "target", position: [10, 0, 0] });
    const newBoard1 = makeBoard({ id: "b1", position: [8, 0, 0] });
    const newBoard2 = makeBoard({ id: "b2", position: [12, 0, 0] });
    const constraints = {
      c1: {
        type: "Flush",
        boardAId: "target",
        boardBId: "other",
        faceA: "x-",
        faceB: "x+",
      },
    };

    const result = redistributeSplitConstraints({
      constraints,
      targetBoard,
      newBoard1,
      newBoard2,
      splitAxis: "x",
      boards: [targetBoard, newBoard1, newBoard2],
      idFactory: (prefix, constraintId) => `${prefix}_${constraintId}`,
    });

    expect(result).toEqual({
      flush_split_1_c1: {
        type: "Flush",
        boardAId: "b1",
        boardBId: "other",
        faceA: "x-",
        faceB: "x+",
      },
    });
  });

  it("recomputes glue offsets for both split boards", () => {
    const targetBoard = makeBoard({ id: "target", position: [10, 0, 0] });
    const newBoard1 = makeBoard({ id: "b1", position: [8, 0, 0] });
    const newBoard2 = makeBoard({ id: "b2", position: [12, 0, 0] });
    const partnerBoard = makeBoard({ id: "other", position: [20, 5, 0] });
    const constraints = {
      c1: {
        type: "Glue",
        boardAId: "target",
        boardBId: "other",
        offset: [0, 0, 0],
      },
    };

    const result = redistributeSplitConstraints({
      constraints,
      targetBoard,
      newBoard1,
      newBoard2,
      splitAxis: "x",
      boards: [targetBoard, newBoard1, newBoard2, partnerBoard],
      idFactory: (prefix, constraintId) => `${prefix}_${constraintId}`,
    });

    expect(result).toEqual({
      glue_split_1_c1: {
        type: "Glue",
        boardAId: "b1",
        boardBId: "other",
        offset: [12, 5, 0],
      },
      glue_split_2_c1: {
        type: "Glue",
        boardAId: "b2",
        boardBId: "other",
        offset: [8, 5, 0],
      },
    });
  });
});
