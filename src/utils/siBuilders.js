import { calculateProceduralBoxWalls } from './procedural';
import { computeWorldAABB } from './sceneGraph';

export function createSimpleLeg({ id, defaultMaterial }) {
  return {
    id,
    name: 'New Leg',
    parentId: 'Workspace',
    size: [1.5, 12, 1.5],
    position: [0, 6, 0],
    material: defaultMaterial,
    joint: 'Butt 1',
    operations: [],
  };
}

export function createTopBoard({ id, targets, defaultMaterial }) {
  if (!targets.length) return null;

  const aabb = computeWorldAABB(targets);
  let width = Math.abs(aabb.maxX - aabb.minX);
  let depth = Math.abs(aabb.maxZ - aabb.minZ);
  const thickness = 0.75;
  if (width < 3) width = Math.max(width, 24);
  if (depth < 3) depth = Math.max(depth, 16);

  return {
    board: {
      id,
      name: 'Table Top',
      parentId: targets[0]?.parentId || 'Workspace',
      size: [width, thickness, depth],
      position: [
        (aabb.minX + aabb.maxX) / 2,
        aabb.maxY + thickness / 2,
        (aabb.minZ + aabb.maxZ) / 2,
      ],
      material: defaultMaterial,
      joint: 'None',
      operations: [],
    },
    y: aabb.maxY + thickness / 2,
  };
}

export function createCubeAssembly({ groupId, defaultMaterial, idBase }) {
  const side = 12;
  const thickness = 0.75;
  const half = side / 2;
  const panelDefs = [
    { name: 'Bottom', size: [side, thickness, side], position: [0, thickness / 2, 0] },
    { name: 'Top', size: [side, thickness, side], position: [0, side - thickness / 2, 0] },
    { name: 'Front', size: [side, side, thickness], position: [0, half, half - thickness / 2] },
    { name: 'Back', size: [side, side, thickness], position: [0, half, -(half - thickness / 2)] },
    { name: 'Left', size: [thickness, side, side], position: [-(half - thickness / 2), half, 0] },
    { name: 'Right', size: [thickness, side, side], position: [half - thickness / 2, half, 0] },
  ];

  return {
    group: {
      [groupId]: {
        parentId: 'Workspace',
        isExpanded: true,
        visible: true,
      },
    },
    boards: panelDefs.map((panel, index) => ({
      id: idBase + index,
      name: panel.name,
      size: panel.size,
      position: panel.position,
      parentId: groupId,
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: [],
    })),
  };
}

export function createProceduralBoxAssembly({
  groupId,
  defaultMaterial,
  width,
  depth,
  height,
  idBase,
}) {
  const proceduralMeta = {
    type: 'procedural-box',
    w: width,
    h: height,
    d: depth,
    t: 0.75,
    joint: 'butt-A',
  };

  const wallsData = calculateProceduralBoxWalls(proceduralMeta);

  return {
    group: {
      [groupId]: {
        parentId: 'Workspace',
        isExpanded: true,
        visible: true,
        meta: proceduralMeta,
      },
    },
    boards: wallsData.map((wall, index) => ({
      id: idBase + index,
      name: `${wall.role} Wall`,
      parentId: groupId,
      size: wall.size,
      position: wall.position,
      material: defaultMaterial,
      joint: 'None',
      operations: [],
    })),
    meta: proceduralMeta,
  };
}
