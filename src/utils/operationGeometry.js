import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";

const BOX_EDGE_INDICES = [
  [0, 1],
  [1, 3],
  [3, 2],
  [2, 0],
  [4, 5],
  [5, 7],
  [7, 6],
  [6, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

function createBoxVertices(halfWidth, halfHeight, halfDepth) {
  return [
    new THREE.Vector3(-halfWidth, -halfHeight, -halfDepth),
    new THREE.Vector3(halfWidth, -halfHeight, -halfDepth),
    new THREE.Vector3(-halfWidth, halfHeight, -halfDepth),
    new THREE.Vector3(halfWidth, halfHeight, -halfDepth),
    new THREE.Vector3(-halfWidth, -halfHeight, halfDepth),
    new THREE.Vector3(halfWidth, -halfHeight, halfDepth),
    new THREE.Vector3(-halfWidth, halfHeight, halfDepth),
    new THREE.Vector3(halfWidth, halfHeight, halfDepth),
  ];
}

function makeBoxContainmentCheck(halfSizes, eps) {
  const [halfWidth, halfHeight, halfDepth] = halfSizes;

  return (point) =>
    point.x >= -halfWidth - eps &&
    point.x <= halfWidth + eps &&
    point.y >= -halfHeight - eps &&
    point.y <= halfHeight + eps &&
    point.z >= -halfDepth - eps &&
    point.z <= halfDepth + eps;
}

function collectEdgeFaceIntersectionPoints({
  edgeVertices,
  transformStart,
  transformEnd,
  faceHalfSizes,
  eps,
  projectIntersection = (point) => point,
}) {
  const axes = ["x", "y", "z"];
  const points = [];

  BOX_EDGE_INDICES.forEach(([startIndex, endIndex]) => {
    const start = transformStart(edgeVertices[startIndex].clone());
    const end = transformEnd(edgeVertices[endIndex].clone());

    for (let axisIndex = 0; axisIndex < 3; axisIndex += 1) {
      const axis = axes[axisIndex];
      const limit = faceHalfSizes[axisIndex];

      [-limit, limit].forEach((planeCoordinate) => {
        const startValue = start[axis];
        const endValue = end[axis];

        if (
          (startValue < planeCoordinate - 1e-5 &&
            endValue > planeCoordinate + 1e-5) ||
          (startValue > planeCoordinate + 1e-5 &&
            endValue < planeCoordinate - 1e-5)
        ) {
          const t = (planeCoordinate - startValue) / (endValue - startValue);
          const point = start.clone().lerp(end, t);

          const otherAxisIndex1 = (axisIndex + 1) % 3;
          const otherAxisIndex2 = (axisIndex + 2) % 3;
          const otherLimit1 = faceHalfSizes[otherAxisIndex1];
          const otherLimit2 = faceHalfSizes[otherAxisIndex2];
          const otherValue1 = point[axes[otherAxisIndex1]];
          const otherValue2 = point[axes[otherAxisIndex2]];

          if (
            otherValue1 >= -otherLimit1 - eps &&
            otherValue1 <= otherLimit1 + eps &&
            otherValue2 >= -otherLimit2 - eps &&
            otherValue2 <= otherLimit2 + eps
          ) {
            points.push(projectIntersection(point));
          }
        }
      });
    }
  });

  return points;
}

function getBoundsFromPoints(points) {
  if (points.length === 0) {
    return null;
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    },
  );
}

export function getBoardGeometryMatrix(board) {
  const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), "YXZ");
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...board.position),
    new THREE.Quaternion().setFromEuler(euler),
    new THREE.Vector3(1, 1, 1),
  );

  if (board.pivot) {
    matrix.multiply(
      new THREE.Matrix4().makeTranslation(
        -board.pivot[0],
        -board.pivot[1],
        -board.pivot[2],
      ),
    );
  }

  return matrix;
}

export function getBoardObb(board) {
  const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), "YXZ");
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  const position = new THREE.Vector3(...board.position);

  let matrix = new THREE.Matrix4();
  if (board.pivot) {
    const pivotPos = new THREE.Vector3(...board.pivot);
    const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(
      quaternion,
    );
    const invPivotMatrix = new THREE.Matrix4().makeTranslation(
      -pivotPos.x,
      -pivotPos.y,
      -pivotPos.z,
    );
    const translationMatrix = new THREE.Matrix4().makeTranslation(
      position.x,
      position.y,
      position.z,
    );
    matrix
      .multiply(translationMatrix)
      .multiply(rotationMatrix)
      .multiply(invPivotMatrix);
  } else {
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
  }

  const obb = new OBB();
  obb.halfSize.set(
    Math.max(0, board.size[0] / 2),
    Math.max(0, board.size[1] / 2),
    Math.max(0, board.size[2] / 2),
  );
  obb.applyMatrix4(matrix);
  return obb;
}

export function getRelativeBoardMatrix(targetBoard, cutterBoard) {
  const targetMatrix = getBoardGeometryMatrix(targetBoard);
  const cutterMatrix = getBoardGeometryMatrix(cutterBoard);
  return targetMatrix.clone().invert().multiply(cutterMatrix);
}

export function getSubtractionIntersectionBounds(
  targetBoard,
  cutterBoard,
  relativeMatrix,
  eps = 0.05,
) {
  const targetHalfSizes = targetBoard.size.map((value) => value / 2);
  const cutterHalfSizes = cutterBoard.size.map((value) => value / 2);
  const relativeMatrixInverse = relativeMatrix.clone().invert();

  const insideTarget = makeBoxContainmentCheck(targetHalfSizes, eps);
  const insideCutter = makeBoxContainmentCheck(cutterHalfSizes, eps);

  const cutterVertices = createBoxVertices(...cutterHalfSizes);
  const targetVertices = createBoxVertices(...targetHalfSizes);

  const intersectionPoints = [];

  cutterVertices.forEach((vertex) => {
    const transformedVertex = vertex.clone().applyMatrix4(relativeMatrix);
    if (insideTarget(transformedVertex)) {
      intersectionPoints.push(transformedVertex);
    }
  });

  targetVertices.forEach((vertex) => {
    const vertexInCutterSpace = vertex
      .clone()
      .applyMatrix4(relativeMatrixInverse);
    if (insideCutter(vertexInCutterSpace)) {
      intersectionPoints.push(vertex.clone());
    }
  });

  intersectionPoints.push(
    ...collectEdgeFaceIntersectionPoints({
      edgeVertices: cutterVertices,
      transformStart: (point) => point.applyMatrix4(relativeMatrix),
      transformEnd: (point) => point.applyMatrix4(relativeMatrix),
      faceHalfSizes: targetHalfSizes,
      eps,
    }),
  );

  intersectionPoints.push(
    ...collectEdgeFaceIntersectionPoints({
      edgeVertices: targetVertices,
      transformStart: (point) => point.applyMatrix4(relativeMatrixInverse),
      transformEnd: (point) => point.applyMatrix4(relativeMatrixInverse),
      faceHalfSizes: cutterHalfSizes,
      eps,
      projectIntersection: (point) =>
        point.clone().applyMatrix4(relativeMatrix),
    }),
  );

  const pointBounds = getBoundsFromPoints(intersectionPoints);
  if (pointBounds) {
    return pointBounds;
  }

  const fallbackBounds = getBoundsFromPoints(
    cutterVertices.map((vertex) => vertex.clone().applyMatrix4(relativeMatrix)),
  );

  return fallbackBounds;
}

export function getSubtractionSplitPlan(
  targetBoard,
  intersectionBounds,
  eps = 0.05,
) {
  const targetHw = targetBoard.size[0] / 2;
  const targetHh = targetBoard.size[1] / 2;
  const targetHd = targetBoard.size[2] / 2;
  const { minX, maxX, minY, maxY, minZ, maxZ } = intersectionBounds;

  const coversX = minX <= -targetHw + eps && maxX >= targetHw - eps;
  const coversY = minY <= -targetHh + eps && maxY >= targetHh - eps;
  const coversZ = minZ <= -targetHd + eps && maxZ >= targetHd - eps;

  let splitAxis = null;
  let cutMin = 0;
  let cutMax = 0;

  if (coversY && coversZ && minX > -targetHw + eps && maxX < targetHw - eps) {
    splitAxis = "x";
    cutMin = minX;
    cutMax = maxX;
  } else if (
    coversX &&
    coversZ &&
    minY > -targetHh + eps &&
    maxY < targetHh - eps
  ) {
    splitAxis = "y";
    cutMin = minY;
    cutMax = maxY;
  } else if (
    coversX &&
    coversY &&
    minZ > -targetHd + eps &&
    maxZ < targetHd - eps
  ) {
    splitAxis = "z";
    cutMin = minZ;
    cutMax = maxZ;
  }

  if (!splitAxis) {
    return null;
  }

  let size1 = null;
  let size2 = null;
  let part1LocalCenter = null;
  let part2LocalCenter = null;

  if (splitAxis === "x") {
    const width1 = cutMax + targetHw;
    const width2 = targetHw - cutMin;
    if (width1 > 0.05 && width2 > 0.05) {
      size1 = [width1, targetBoard.size[1], targetBoard.size[2]];
      size2 = [width2, targetBoard.size[1], targetBoard.size[2]];
      part1LocalCenter = [(-targetHw + cutMax) / 2, 0, 0];
      part2LocalCenter = [(cutMin + targetHw) / 2, 0, 0];
    }
  } else if (splitAxis === "y") {
    const height1 = cutMax + targetHh;
    const height2 = targetHh - cutMin;
    if (height1 > 0.05 && height2 > 0.05) {
      size1 = [targetBoard.size[0], height1, targetBoard.size[2]];
      size2 = [targetBoard.size[0], height2, targetBoard.size[2]];
      part1LocalCenter = [0, (-targetHh + cutMax) / 2, 0];
      part2LocalCenter = [0, (cutMin + targetHh) / 2, 0];
    }
  } else if (splitAxis === "z") {
    const depth1 = cutMax + targetHd;
    const depth2 = targetHd - cutMin;
    if (depth1 > 0.05 && depth2 > 0.05) {
      size1 = [targetBoard.size[0], targetBoard.size[1], depth1];
      size2 = [targetBoard.size[0], targetBoard.size[1], depth2];
      part1LocalCenter = [0, 0, (-targetHd + cutMax) / 2];
      part2LocalCenter = [0, 0, (cutMin + targetHd) / 2];
    }
  }

  if (!size1 || !size2) {
    return null;
  }

  return {
    splitAxis,
    cutMin,
    cutMax,
    size1,
    size2,
    part1LocalCenter,
    part2LocalCenter,
  };
}

export function buildSplitSubtractionOperations({
  splitAxis,
  part1LocalCenter,
  part2LocalCenter,
  relativeMatrix,
  cutterBoard,
  targetBoard,
  baseOperation,
  operationIdFactory = (offset) => Date.now() + offset,
}) {
  const splitVector = new THREE.Vector3();
  if (splitAxis === "x") splitVector.set(1, 0, 0);
  else if (splitAxis === "y") splitVector.set(0, 1, 0);
  else if (splitAxis === "z") splitVector.set(0, 0, 1);

  const relativeMatrixInverse = relativeMatrix.clone().invert();
  const splitVectorInCutterSpace = splitVector
    .clone()
    .transformDirection(relativeMatrixInverse);

  let cutterAxisIdx = 0;
  let maxComponent = Math.abs(splitVectorInCutterSpace.x);
  if (Math.abs(splitVectorInCutterSpace.y) > maxComponent) {
    cutterAxisIdx = 1;
    maxComponent = Math.abs(splitVectorInCutterSpace.y);
  }
  if (Math.abs(splitVectorInCutterSpace.z) > maxComponent) {
    cutterAxisIdx = 2;
  }

  const part1InCutterSpace = new THREE.Vector3(
    ...part1LocalCenter,
  ).applyMatrix4(relativeMatrixInverse);
  const part2InCutterSpace = new THREE.Vector3(
    ...part2LocalCenter,
  ).applyMatrix4(relativeMatrixInverse);

  const part1Value = part1InCutterSpace.getComponent(cutterAxisIdx);
  const part2Value = part2InCutterSpace.getComponent(cutterAxisIdx);

  const shiftSign1 = part1Value < part2Value ? 1 : -1;
  const shiftSign2 = part1Value < part2Value ? -1 : 1;

  const cutterAxisSize = cutterBoard.size[cutterAxisIdx];
  const extendedLength = Math.max(...targetBoard.size) * 2 + 20;

  const shiftVec1 = new THREE.Vector3();
  shiftVec1.setComponent(
    cutterAxisIdx,
    shiftSign1 * (-cutterAxisSize / 2 + extendedLength / 2),
  );
  const shiftVec2 = new THREE.Vector3();
  shiftVec2.setComponent(
    cutterAxisIdx,
    shiftSign2 * (-cutterAxisSize / 2 + extendedLength / 2),
  );

  const cutterSize1 = [...cutterBoard.size];
  cutterSize1[cutterAxisIdx] = extendedLength;
  const cutterSize2 = [...cutterBoard.size];
  cutterSize2[cutterAxisIdx] = extendedLength;

  const matrix1 = new THREE.Matrix4()
    .makeTranslation(
      -part1LocalCenter[0],
      -part1LocalCenter[1],
      -part1LocalCenter[2],
    )
    .multiply(relativeMatrix)
    .multiply(
      new THREE.Matrix4().makeTranslation(
        shiftVec1.x,
        shiftVec1.y,
        shiftVec1.z,
      ),
    );

  const matrix2 = new THREE.Matrix4()
    .makeTranslation(
      -part2LocalCenter[0],
      -part2LocalCenter[1],
      -part2LocalCenter[2],
    )
    .multiply(relativeMatrix)
    .multiply(
      new THREE.Matrix4().makeTranslation(
        shiftVec2.x,
        shiftVec2.y,
        shiftVec2.z,
      ),
    );

  return {
    cutterAxisIdx,
    cutterSize1,
    cutterSize2,
    operation1: {
      ...baseOperation,
      id: operationIdFactory(1),
      cutterSize: cutterSize1,
      relativeMatrix: matrix1.elements.slice(),
    },
    operation2: {
      ...baseOperation,
      id: operationIdFactory(2),
      cutterSize: cutterSize2,
      relativeMatrix: matrix2.elements.slice(),
    },
  };
}

export function buildSplitBoards({
  targetBoard,
  targetWorldMatrix,
  splitAxis,
  size1,
  size2,
  part1LocalCenter,
  part2LocalCenter,
  boardId1,
  boardId2,
  operation1,
  operation2,
}) {
  const position1 = new THREE.Vector3(...part1LocalCenter).applyMatrix4(
    targetWorldMatrix,
  );
  const position2 = new THREE.Vector3(...part2LocalCenter).applyMatrix4(
    targetWorldMatrix,
  );

  const inheritedOperations = targetBoard.operations || [];

  const board1 = {
    ...targetBoard,
    id: boardId1,
    name: `${targetBoard.name} (Part 1)`,
    size: size1,
    position: [position1.x, position1.y, position1.z],
    operations: [
      ...inheritedOperations
        .map((operation) =>
          filterOperationsForPiece(
            operation,
            1,
            splitAxis,
            part1LocalCenter,
            part2LocalCenter,
            size1,
            size2,
            targetBoard,
          ),
        )
        .filter(Boolean),
      operation1,
    ],
  };

  const board2 = {
    ...targetBoard,
    id: boardId2,
    name: `${targetBoard.name} (Part 2)`,
    size: size2,
    position: [position2.x, position2.y, position2.z],
    operations: [
      ...inheritedOperations
        .map((operation) =>
          filterOperationsForPiece(
            operation,
            2,
            splitAxis,
            part1LocalCenter,
            part2LocalCenter,
            size1,
            size2,
            targetBoard,
          ),
        )
        .filter(Boolean),
      operation2,
    ],
  };

  return { board1, board2 };
}

export function redistributeSplitConstraints({
  constraints,
  targetBoard,
  newBoard1,
  newBoard2,
  splitAxis,
  boards,
  idFactory = (prefix, constraintId) =>
    `${prefix}_${constraintId}_${Date.now()}`,
}) {
  const nextConstraints = { ...constraints };

  Object.entries(constraints).forEach(([constraintId, constraint]) => {
    const involvesOriginal =
      constraint.boardAId?.toString() === targetBoard.id.toString() ||
      constraint.boardBId?.toString() === targetBoard.id.toString();
    if (!involvesOriginal) return;

    delete nextConstraints[constraintId];

    if (constraint.type === "Flush") {
      const isA = constraint.boardAId?.toString() === targetBoard.id.toString();
      const targetFace = isA ? constraint.faceA : constraint.faceB;
      const isFaceOnSplitAxis = targetFace.startsWith(splitAxis);

      if (!isFaceOnSplitAxis) {
        nextConstraints[idFactory("flush_split_1", constraintId)] = {
          ...constraint,
          boardAId: isA ? newBoard1.id : constraint.boardAId,
          boardBId: isA ? constraint.boardBId : newBoard1.id,
        };
        nextConstraints[idFactory("flush_split_2", constraintId)] = {
          ...constraint,
          boardAId: isA ? newBoard2.id : constraint.boardAId,
          boardBId: isA ? constraint.boardBId : newBoard2.id,
        };
      } else {
        const isNegativeFace = targetFace.endsWith("-");
        if (isNegativeFace) {
          nextConstraints[idFactory("flush_split_1", constraintId)] = {
            ...constraint,
            boardAId: isA ? newBoard1.id : constraint.boardAId,
            boardBId: isA ? constraint.boardBId : newBoard1.id,
          };
        } else {
          nextConstraints[idFactory("flush_split_2", constraintId)] = {
            ...constraint,
            boardAId: isA ? newBoard2.id : constraint.boardAId,
            boardBId: isA ? constraint.boardBId : newBoard2.id,
          };
        }
      }
      return;
    }

    if (constraint.type === "Glue") {
      const isA = constraint.boardAId?.toString() === targetBoard.id.toString();
      const partnerId = isA ? constraint.boardBId : constraint.boardAId;
      const partnerBoard = boards.find(
        (board) => board.id.toString() === partnerId.toString(),
      );
      if (!partnerBoard) return;

      const offset1 = isA
        ? [
            partnerBoard.position[0] - newBoard1.position[0],
            partnerBoard.position[1] - newBoard1.position[1],
            partnerBoard.position[2] - newBoard1.position[2],
          ]
        : [
            newBoard1.position[0] - partnerBoard.position[0],
            newBoard1.position[1] - partnerBoard.position[1],
            newBoard1.position[2] - partnerBoard.position[2],
          ];
      nextConstraints[idFactory("glue_split_1", constraintId)] = {
        ...constraint,
        boardAId: isA ? newBoard1.id : partnerId,
        boardBId: isA ? partnerId : newBoard1.id,
        offset: offset1,
      };

      const offset2 = isA
        ? [
            partnerBoard.position[0] - newBoard2.position[0],
            partnerBoard.position[1] - newBoard2.position[1],
            partnerBoard.position[2] - newBoard2.position[2],
          ]
        : [
            newBoard2.position[0] - partnerBoard.position[0],
            newBoard2.position[1] - partnerBoard.position[1],
            newBoard2.position[2] - partnerBoard.position[2],
          ];
      nextConstraints[idFactory("glue_split_2", constraintId)] = {
        ...constraint,
        boardAId: isA ? newBoard2.id : partnerId,
        boardBId: isA ? partnerId : newBoard2.id,
        offset: offset2,
      };
    }
  });

  return nextConstraints;
}

export function filterOperationsForPiece(
  operation,
  pieceIdx,
  splitAxis,
  part1LocalCenter,
  part2LocalCenter,
  size1,
  size2,
  targetBoard,
) {
  if (operation.type === "subtract") {
    const shift = pieceIdx === 1 ? part1LocalCenter : part2LocalCenter;
    const matrix = new THREE.Matrix4().fromArray(operation.relativeMatrix);
    const shiftedMatrix = new THREE.Matrix4()
      .makeTranslation(-shift[0], -shift[1], -shift[2])
      .multiply(matrix);
    return {
      ...operation,
      relativeMatrix: shiftedMatrix.elements.slice(),
    };
  }

  if (operation.type === "miter") {
    const face = operation.face || "x+";
    if (face.startsWith(splitAxis)) {
      const isNegative = face.endsWith("-");
      if (isNegative && pieceIdx === 2) return null;
      if (!isNegative && pieceIdx === 1) return null;
    }
  }

  if (operation.type === "dado") {
    const face = operation.face || "top";
    const faceAxis = {
      top: "y",
      bottom: "y",
      front: "z",
      back: "z",
      left: "x",
      right: "x",
    }[face];

    if (faceAxis === splitAxis) {
      const isNegative = ["left", "bottom", "back"].includes(face);
      if (isNegative && pieceIdx === 2) return null;
      if (!isNegative && pieceIdx === 1) return null;
    }

    const channelDir = operation.direction || "x";
    const faceAxes = {
      top: ["x", "z"],
      bottom: ["x", "z"],
      front: ["x", "y"],
      back: ["x", "y"],
      right: ["y", "z"],
      left: ["y", "z"],
    }[face] || ["x", "z"];

    const offsetAxis = faceAxes[0] === channelDir ? faceAxes[1] : faceAxes[0];
    if (offsetAxis === splitAxis) {
      const shift =
        pieceIdx === 1
          ? part1LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2]
          : part2LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2];
      return {
        ...operation,
        offset: operation.offset - shift,
      };
    }
  }

  if (operation.type === "pocket-holes") {
    const face = operation.face || "bottom";
    const faceAxis = {
      top: "y",
      bottom: "y",
      front: "z",
      back: "z",
      left: "x",
      right: "x",
    }[face];

    if (faceAxis === splitAxis) {
      const isNegative = ["left", "bottom", "back"].includes(face);
      if (isNegative && pieceIdx === 2) return null;
      if (!isNegative && pieceIdx === 1) return null;
    }

    const edge = operation.edge || "left";
    const edgeAxis = {
      top: "y",
      bottom: "y",
      front: "z",
      back: "z",
      left: "x",
      right: "x",
    }[edge];
    if (edgeAxis === splitAxis) {
      const isNegativeEdge = ["left", "bottom", "back"].includes(edge);
      if (isNegativeEdge && pieceIdx === 2) return null;
      if (!isNegativeEdge && pieceIdx === 1) return null;
    }
  }

  if (operation.type === "dowel-holes") {
    const face = operation.face || "top";
    const faceAxis = {
      top: "y",
      bottom: "y",
      front: "z",
      back: "z",
      left: "x",
      right: "x",
    }[face];

    if (faceAxis === splitAxis) {
      const isNegative = ["left", "bottom", "back"].includes(face);
      if (isNegative && pieceIdx === 2) return null;
      if (!isNegative && pieceIdx === 1) return null;
    }
  }

  if (operation.type === "edge-profile") {
    const edge = operation.edge || "y+z+";
    if (edge.includes(splitAxis)) {
      const idx = edge.indexOf(splitAxis);
      if (idx !== -1 && idx + 1 < edge.length) {
        const sign = edge[idx + 1];
        if (sign === "-" && pieceIdx === 2) return null;
        if (sign === "+" && pieceIdx === 1) return null;
      }
    }
  }

  if (operation.type === "cove") {
    const edge = operation.edge || "top";
    const edgeAxis = { top: "y", bottom: "y", left: "x", right: "x" }[edge];
    if (edgeAxis === splitAxis) {
      const isNegative = ["left", "bottom"].includes(edge);
      if (isNegative && pieceIdx === 2) return null;
      if (!isNegative && pieceIdx === 1) return null;
    }
  }

  if (operation.type === "hole") {
    if (operation.face !== undefined) {
      const face = operation.face || "top";
      const faceAxis = {
        top: "y",
        bottom: "y",
        front: "z",
        back: "z",
        left: "x",
        right: "x",
      }[face];

      if (faceAxis === splitAxis) {
        const isNegative = ["left", "bottom", "back"].includes(face);
        if (isNegative && pieceIdx === 2) return null;
        if (!isNegative && pieceIdx === 1) return null;
      }

      const faceAxes = {
        top: [0, 2],
        bottom: [0, 2],
        front: [0, 1],
        back: [0, 1],
        right: [1, 2],
        left: [1, 2],
      }[face] || [0, 2];

      const fa0 = faceAxes[0];
      const fa1 = faceAxes[1];
      const spanFaceAxisIdx =
        targetBoard.size[fa0] >= targetBoard.size[fa1] ? fa0 : fa1;
      const thicknessFaceAxisIdx = spanFaceAxisIdx === fa0 ? fa1 : fa0;

      const axesNames = ["x", "y", "z"];
      const spanAxis = axesNames[spanFaceAxisIdx];
      const thicknessAxis = axesNames[thicknessFaceAxisIdx];

      const shift =
        pieceIdx === 1
          ? part1LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2]
          : part2LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2];

      if (spanAxis === splitAxis) {
        return {
          ...operation,
          offset: (operation.offset ?? 0) - shift,
        };
      }
      if (thicknessAxis === splitAxis) {
        return {
          ...operation,
          offsetY: (operation.offsetY ?? 0) - shift,
        };
      }
      return operation;
    }

    const holeAxis = operation.axis || "y";
    let axisX = "x";
    let axisY = "z";
    if (holeAxis === "x") {
      axisX = "z";
      axisY = "y";
    } else if (holeAxis === "y") {
      axisX = "x";
      axisY = "z";
    } else {
      axisX = "x";
      axisY = "y";
    }

    const shift =
      pieceIdx === 1
        ? part1LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2]
        : part2LocalCenter[splitAxis === "x" ? 0 : splitAxis === "y" ? 1 : 2];

    if (axisX === splitAxis) {
      return {
        ...operation,
        offsetX: operation.offsetX - shift,
      };
    }
    if (axisY === splitAxis) {
      return {
        ...operation,
        offsetY: operation.offsetY - shift,
      };
    }
  }

  return operation;
}
