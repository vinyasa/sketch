import { computeWorldAABB } from './sceneGraph';

export function applyGeminiLegacyAction(action, context) {
  const {
    boards,
    defaultMaterial,
    targetIds,
  } = context;

  switch (action.type) {
    case 'addTop': {
      const targets = boards;
      if (!targets.length) return null;
      const aabb = computeWorldAABB(targets);
      const thickness = 0.75;
      const newId = Date.now();
      const newBoard = {
        id: newId,
        name: 'Table Top',
        parentId: 'Workspace',
        size: [
          Math.max(24, Math.abs(aabb.maxX - aabb.minX)),
          thickness,
          Math.max(16, Math.abs(aabb.maxZ - aabb.minZ)),
        ],
        position: [
          (aabb.minX + aabb.maxX) / 2,
          aabb.maxY + thickness / 2,
          (aabb.minZ + aabb.maxZ) / 2,
        ],
        material: defaultMaterial,
        joint: 'None',
        operations: [],
      };

      return {
        addedBoards: [newBoard],
        selectedItemIds: [newId.toString()],
      };
    }

    case 'clone': {
      if (!targetIds.length) return null;
      const count = parseInt(action.count) || 1;
      let axisIndex = 1;
      if (action.axis === 'x') axisIndex = 0;
      if (action.axis === 'z') axisIndex = 2;
      const gap = parseFloat(action.gap) || 0;
      const sourceBoards = boards.filter((board) =>
        targetIds.includes(board.id.toString()),
      );
      const addedBoards = [];

      sourceBoards.forEach((board, sourceIndex) => {
        let currentPos = [...board.position];
        for (let i = 1; i <= count; i += 1) {
          currentPos[axisIndex] += board.size[axisIndex] + gap;
          addedBoards.push({
            ...board,
            id: Date.now() + sourceIndex * 1000 + i,
            name: `${board.name} (Clone ${i})`,
            position: [...currentPos],
            operations: [],
          });
        }
      });

      if (!addedBoards.length) return null;

      return {
        addedBoards,
        selectedItemIds: addedBoards.map((board) => board.id.toString()),
      };
    }

    case 'addShelf': {
      const targetBoards = targetIds.length > 0
        ? boards.filter((board) => targetIds.includes(board.id.toString()))
        : boards;
      if (!targetBoards.length) return null;

      const parentId = targetBoards[0].parentId || 'Workspace';
      const aabb = computeWorldAABB(targetBoards);
      const thickness = 0.75;
      let effMinY = aabb.minY;
      let effMaxY = aabb.maxY;

      if (action.relativeBounds) {
        if (action.relativeBounds.bottom) {
          if (action.relativeBounds.bottom.toLowerCase() === 'floor') {
            effMinY = 0;
          } else if (action.relativeBounds.bottom !== 'bottom') {
            const botName = action.relativeBounds.bottom.toLowerCase();
            const botBoard = boards.find((board) =>
              board.name?.toLowerCase().includes(botName),
            );
            if (botBoard) {
              const botAabb = computeWorldAABB([botBoard]);
              effMinY = botAabb.maxY;
            }
          }
        }

        if (action.relativeBounds.top) {
          if (action.relativeBounds.top !== 'top') {
            const topName = action.relativeBounds.top.toLowerCase();
            const topBoard = boards.find((board) =>
              board.name?.toLowerCase().includes(topName),
            );
            if (topBoard) {
              const topAabb = computeWorldAABB([topBoard]);
              effMaxY = topAabb.minY;
            }
          }
        }
      }

      let newY = (effMinY + effMaxY) / 2;
      if (action.position === 'bottom') {
        newY = effMinY + thickness / 2;
      } else if (action.position === 'top') {
        newY = effMaxY - thickness / 2;
      } else if (
        typeof action.position === 'string' &&
        action.position.includes('%')
      ) {
        const pct = parseFloat(action.position) / 100;
        newY = effMinY + (effMaxY - effMinY) * pct;
      } else if (
        typeof action.position === 'string' &&
        action.position.includes('/')
      ) {
        const [num, den] = action.position.split('/');
        const pct = parseFloat(num) / parseFloat(den);
        newY = effMinY + (effMaxY - effMinY) * pct;
      } else if (typeof action.position === 'number') {
        newY = action.position;
      }

      const newX = (aabb.minX + aabb.maxX) / 2;
      const newZ = (aabb.minZ + aabb.maxZ) / 2;
      const count = parseInt(action.count) || 1;
      const width = Math.abs(aabb.maxX - aabb.minX);
      const depth = Math.abs(aabb.maxZ - aabb.minZ);
      const addedBoards = [];

      if (count > 1) {
        const span = effMaxY - effMinY;
        const interval = span / (count + 1);
        for (let i = 1; i <= count; i += 1) {
          addedBoards.push({
            id: Date.now() + i,
            name: `Shelf ${i}`,
            parentId,
            size: [width, thickness, depth],
            position: [newX, effMinY + interval * i, newZ],
            material: defaultMaterial,
            joint: 'None',
            operations: [],
          });
        }
      } else {
        addedBoards.push({
          id: Date.now(),
          name: 'Shelf',
          parentId,
          size: [width, thickness, depth],
          position: [newX, newY, newZ],
          material: defaultMaterial,
          joint: 'None',
          operations: [],
        });
      }

      return {
        addedBoards,
        selectedItemIds: addedBoards.map((board) => board.id.toString()),
      };
    }

    default:
      return null;
  }
}
