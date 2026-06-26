import { propagateMove } from "../utils/constraintSolver";
import { resolveTargetIds } from "../utils/workspaceTargets";
import { COMMAND_TYPES } from "./types";

function resolveCommandTargetIds(target, get) {
  const state = get();
  const { boards, groups, selectedItemIds } = state;
  return resolveTargetIds(target, boards, groups, selectedItemIds);
}

function executeMove(command, get) {
  const targetIds = resolveCommandTargetIds(command.target, get);
  if (!targetIds.length) return false;

  const delta = parseFloat(command.delta) || 0;
  if (delta === 0) return false;

  let axisIndex = 1;
  if (command.axis === "x") axisIndex = 0;
  if (command.axis === "z") axisIndex = 2;

  const deltaVec = [0, 0, 0];
  deltaVec[axisIndex] = delta;
  const moveMap = propagateMove(targetIds, deltaVec, get().constraints);
  if (moveMap.size === 0) return false;

  get().setBoards((prev) =>
    prev.map((board) => {
      const d = moveMap.get(board.id.toString());
      if (!d) return board;
      return {
        ...board,
        position: [
          board.position[0] + d[0],
          board.position[1] + d[1],
          board.position[2] + d[2],
        ],
      };
    }),
  );

  return true;
}

function executeResize(command, get) {
  const targetIds = resolveCommandTargetIds(command.target, get);
  if (!targetIds.length) return false;

  const delta = parseFloat(command.delta) || 0;
  if (delta === 0) return false;

  get().setBoards((prev) =>
    prev.map((board) => {
      if (!targetIds.includes(board.id.toString())) return board;

      const dims = [
        { idx: 0, val: board.size[0] },
        { idx: 1, val: board.size[1] },
        { idx: 2, val: board.size[2] },
      ].sort((a, b) => b.val - a.val);

      let targetIndex = 2;
      if (command.dimension === "height") targetIndex = 1;
      else if (command.dimension === "length") targetIndex = dims[0].idx;
      else if (command.dimension === "width") targetIndex = dims[1].idx;
      else if (command.dimension === "thickness") targetIndex = dims[2].idx;

      const newSize = [...board.size];
      newSize[targetIndex] = Math.max(0.1, newSize[targetIndex] + delta);

      return {
        ...board,
        size: newSize,
      };
    }),
  );

  return true;
}

function executeRotate(command, get) {
  const targetIds = resolveCommandTargetIds(command.target, get);
  if (!targetIds.length) return false;

  get().setBoards((prev) =>
    prev.map((board) => {
      if (!targetIds.includes(board.id.toString())) return board;

      if (command.reset) {
        const oldPivot = board.pivot || [0, 0, 0];
        return {
          ...board,
          orientation: [0, 0, 0],
          pivot: undefined,
          position: [
            board.position[0] - oldPivot[0],
            board.position[1] - oldPivot[1],
            board.position[2] - oldPivot[2],
          ],
        };
      }

      let pivotUpdate = {};
      let positionUpdate = {};

      if (command.pivot && command.pivot !== "center") {
        const hx = board.size[0] / 2;
        const hy = board.size[1] / 2;
        const hz = board.size[2] / 2;
        const pivotMap = {
          top: [0, hy, 0],
          bottom: [0, -hy, 0],
          front: [0, 0, hz],
          back: [0, 0, -hz],
          right: [hx, 0, 0],
          left: [-hx, 0, 0],
          "bottom-left-front": [-hx, -hy, hz],
          "bottom-right-front": [hx, -hy, hz],
          "bottom-left-back": [-hx, -hy, -hz],
          "bottom-right-back": [hx, -hy, -hz],
          "top-left-front": [-hx, hy, hz],
          "top-right-front": [hx, hy, hz],
          "top-left-back": [-hx, hy, -hz],
          "top-right-back": [hx, hy, -hz],
        };
        const resolved = pivotMap[command.pivot];
        if (resolved) {
          const oldPivot = board.pivot || [0, 0, 0];
          const dx = resolved[0] - oldPivot[0];
          const dy = resolved[1] - oldPivot[1];
          const dz = resolved[2] - oldPivot[2];
          const [rx, ry, rz] = board.orientation || [0, 0, 0];
          let wx = dx;
          let wy = dy;
          let wz = dz;
          if (rx !== 0 || ry !== 0 || rz !== 0) {
            const ca = Math.cos(rx);
            const sb = Math.sin(rx);
            const cc = Math.cos(ry);
            const sd = Math.sin(ry);
            const ce = Math.cos(rz);
            const sf = Math.sin(rz);
            wx =
              (cc * ce + sd * sf * sb) * dx +
              (sd * sb * ce - cc * sf) * dy +
              ca * sd * dz;
            wy = ca * sf * dx + ca * ce * dy - sb * dz;
            wz =
              (cc * sf * sb - sd * ce) * dx +
              (sd * sf + cc * ce * sb) * dy +
              ca * cc * dz;
          }
          pivotUpdate = { pivot: [...resolved] };
          positionUpdate = {
            position: [
              board.position[0] + wx,
              board.position[1] + wy,
              board.position[2] + wz,
            ],
          };
        }
      }

      const orientation = [...(board.orientation || [0, 0, 0])];
      let axis = 1;
      if (command.axis === "x") axis = 0;
      if (command.axis === "z") axis = 2;

      if (command.flip) {
        orientation[axis] = orientation[axis] === 0 ? Math.PI : 0;
      } else {
        orientation[axis] += (parseFloat(command.degrees) * Math.PI) / 180;
      }

      return {
        ...board,
        orientation,
        ...pivotUpdate,
        ...positionUpdate,
      };
    }),
  );

  return true;
}

function executeMaterial(command, get) {
  const targetIds = resolveCommandTargetIds(command.target, get);
  if (!targetIds.length && command.target?.scope !== "all") return false;

  get().setBoards((prev) =>
    prev.map((board) => {
      if (
        command.target?.scope === "all" ||
        targetIds.includes(board.id.toString())
      ) {
        return {
          ...board,
          material: command.material,
        };
      }
      return board;
    }),
  );

  return true;
}

export function executeCommand(command, get) {
  switch (command.type) {
    case COMMAND_TYPES.MOVE:
      return executeMove(command, get);
    case COMMAND_TYPES.RESIZE:
      return executeResize(command, get);
    case COMMAND_TYPES.ROTATE:
      return executeRotate(command, get);
    case COMMAND_TYPES.MATERIAL:
      return executeMaterial(command, get);
    default:
      return false;
  }
}

export function executeCommands(commands, get) {
  let processed = 0;
  for (const command of commands) {
    if (executeCommand(command, get)) processed += 1;
  }
  return processed;
}
