import { computeWorldAABB, collectChildBoards } from '../sceneGraph';

export function generateTableTop(cfg, boards, groups, defaultMaterial) {
  const parseNum = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };
  const newGroups = {};
  
  const boardWidth = parseNum(cfg.boardWidth, 5.5);
  const thickness = parseNum(cfg.thickness, 1.0);
  const widthOverhang = parseNum(cfg.widthOverhang, 2.0);
  const depthOverhang = parseNum(cfg.depthOverhang, 2.0);
  const tenonSpacing = parseNum(cfg.tenonSpacing, 10.0);
  const jointType = cfg.jointType || 'loose-tenon'; // 'loose-tenon' or 'butt'

  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Table Top ' + Math.floor(Math.random() * 1000);
  const { editGroupId, ...savedParams } = cfg;

  // 1. Scan for any table base in the workspace to snap onto
  let baseWidth = 48;
  let baseDepth = 30;
  let baseMaxY = 29;
  let baseMinX = 0;
  let baseMinZ = 0;
  let hasBase = false;
  let baseGroupId = null;

  // Find any active base group
  baseGroupId = Object.keys(groups).find(gid => groups[gid].meta?.builder === 'table-base');
  if (baseGroupId) {
    const baseBoards = collectChildBoards(baseGroupId, boards, groups);
    if (baseBoards.length > 0) {
      const aabb = computeWorldAABB(baseBoards);
      baseWidth = aabb.maxX - aabb.minX;
      baseDepth = aabb.maxZ - aabb.minZ;
      baseMaxY = aabb.maxY;
      baseMinX = aabb.minX;
      baseMinZ = aabb.minZ;
      hasBase = true;
    }
  }

  // 2. Set overall layout dimensions & offsets
  let W;
  let D;
  let offset = [0, 0, 0];

  if (hasBase) {
    W = baseWidth + 2 * widthOverhang;
    D = baseDepth + 2 * depthOverhang;
    offset = [
      baseMinX - widthOverhang,
      baseMaxY,
      baseMinZ - depthOverhang
    ];
  } else {
    W = parseNum(cfg.width, 52);
    D = parseNum(cfg.depth, 34);
    offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 29),
      parseNum(cfg.offsetZ, 0)
    ];
  }

  // Preserve positions for editing
  const oldIdMap = {};
  if (isEditing) {
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      offset = [aabb.minX, aabb.minY, aabb.minZ];
      W = aabb.maxX - aabb.minX;
      D = aabb.maxZ - aabb.minZ;
    }
    childBoards.forEach(b => {
      oldIdMap[b.name] = b.id;
    });
  }

  const baseId = Date.now();
  let idCounter = 0;
  const getNextId = (name) => {
    return oldIdMap[name] || (baseId + idCounter++);
  };

  const newBoards = [];

  // Calculate slat geometry
  const slatLength = W;
  const slatCount = Math.max(1, Math.round(D / boardWidth));
  const adjSlatZ = D / slatCount;
  const dynamicTenonCount = Math.max(1, Math.floor(slatLength / tenonSpacing));

  // 3. Generate Slats (Left-to-Right boards running along length)
  const slatBoards = [];
  for (let j = 0; j < slatCount; j++) {
    const zCenter = adjSlatZ * j + adjSlatZ / 2;
    const xCenter = slatLength / 2;
    const yCenter = thickness / 2;
    const slatName = `Top Slat ${j + 1}`;

    slatBoards.push({
      id: getNextId(slatName),
      name: slatName,
      parentId: groupId,
      size: [slatLength, thickness, adjSlatZ],
      position: [xCenter + offset[0], yCenter + offset[1], zCenter + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: [],
      edgeJoints: []
    });
  }
  newBoards.push(...slatBoards);

  // 4. Establish Edge Joints between boards (loose-tenon or dowels)
  let jointGroupId = null;
  if (jointType === 'loose-tenon' || jointType === 'dowels') {
    const isDomino = jointType === 'loose-tenon';
    jointGroupId = 'Joint Fasteners ' + Math.floor(Math.random() * 1000);
    newGroups[jointGroupId] = {
      parentId: groupId,
      isExpanded: false,
      visible: true,
      name: isDomino ? 'Loose Tenons (Dominoes)' : 'Dowel Pins'
    };

    // Edge-to-edge joints between adjacent slats
    for (let j = 0; j < slatBoards.length - 1; j++) {
      const bA = slatBoards[j];
      const bB = slatBoards[j + 1];

      const jointMeta = {
        type: jointType,
        overBoardId: bA.id.toString(),
        partnerId: bB.id.toString(),
        tenonCount: dynamicTenonCount,
        thicknessA: thickness,
        thicknessB: thickness,
        shrinkAxis: 1 // Y axis
      };

      bA.edgeJoints.push(jointMeta);
      bB.edgeJoints.push({
        ...jointMeta,
        partnerId: bA.id.toString()
      });

      // Visually add joint hole markers to slats
      // We carve loose tenon/dowel holes along the shared edges (Z face)
      const mortiseRadius = isDomino ? 0.15625 : 0.1875; // 5/16" (8mm) domino or 3/8" dowel
      const mortiseDepth = 1.0;

      const margin = Math.min(2.0, bA.size[0] / 4); // 2 inches from each end (or 1/4 of length for tiny boards)
      const span = bA.size[0] - 2 * margin;

      for (let k = 0; k < dynamicTenonCount; k++) {
        let xOffset = 0;
        if (dynamicTenonCount > 1) {
          xOffset = -bA.size[0] / 2 + margin + k * (span / (dynamicTenonCount - 1));
        } else {
          xOffset = 0; // centered if only 1
        }

        if (isDomino) {
          // Board A front edge (Z+) mortise
          bA.operations.push({
            id: baseId + 3000 + bA.id + k,
            type: 'dado',
            face: 'front',
            direction: 'x',
            width: 0.3125, // 5/16" thick domino
            length: 1.25,  // 1-1/4" wide domino
            depth: mortiseDepth,
            offset: 0, // Centered vertically in thickness (Y)
            lengthOffset: xOffset, // Spaced horizontally along length (X)
            source: 'procedural-joint'
          });

          // Board B back edge (Z-) mortise
          bB.operations.push({
            id: baseId + 4000 + bB.id + k,
            type: 'dado',
            face: 'back',
            direction: 'x',
            width: 0.3125,
            length: 1.25,
            depth: mortiseDepth,
            offset: 0, // Centered vertically in thickness (Y)
            lengthOffset: xOffset, // Spaced horizontally along length (X)
            source: 'procedural-joint'
          });
        } else {
          // Board A front edge (Z+) mortise
          bA.operations.push({
            id: baseId + 3000 + bA.id + k,
            type: 'hole',
            face: 'front',
            axis: 'z',
            radius: mortiseRadius,
            depth: mortiseDepth,
            offset: xOffset,
            offsetY: 0,
            source: 'procedural-joint'
          });

          // Board B back edge (Z-) mortise
          bB.operations.push({
            id: baseId + 4000 + bB.id + k,
            type: 'hole',
            face: 'back',
            axis: 'z',
            radius: mortiseRadius,
            depth: mortiseDepth,
            offset: xOffset,
            offsetY: 0,
            source: 'procedural-joint'
          });
        }

        // Add visual physical fastener centered in the seam
        const seamZ = (bA.position[2] + bB.position[2]) / 2;
        const fastenerName = isDomino ? `Domino j${j + 1}_k${k + 1}` : `Dowel j${j + 1}_k${k + 1}`;
        if (isDomino) {
          newBoards.push({
            id: baseId + 13000 + j * 100 + k,
            name: fastenerName,
            parentId: jointGroupId,
            size: [1.25, 0.3125, 2.0], // Width, thickness, length
            position: [bA.position[0] + xOffset, bA.position[1], seamZ],
            material: defaultMaterial,
            joint: 'None',
            shape: 'box',
            operations: [],
            edgeJoints: []
          });
        } else {
          newBoards.push({
            id: baseId + 13000 + j * 100 + k,
            name: fastenerName,
            parentId: jointGroupId,
            size: [0.375, 0.375, 2.0],
            position: [bA.position[0] + xOffset, bA.position[1], seamZ],
            material: defaultMaterial,
            joint: 'None',
            shape: 'cylinder',
            cylinder: {
              radius: 0.1875,
              axis: 'z'
            },
            operations: [],
            edgeJoints: []
          });
        }
      }
    }
  }

  // 5. Generic safety double-check: If no other board face is touching this face, do not drill holes
  newBoards.forEach(board => {
    if (board.operations) {
      board.operations = board.operations.filter(op => {
        if (op.source === 'procedural-joint') {
          return isFaceTouchingAny(board, op.face, newBoards);
        }
        return true;
      });
    }
  });

  return {
    groupId,
    savedParams,
    newBoards,
    newGroups,
    isEditing,
    hasBase,
    baseGroupId
  };
}

function isFaceTouchingAny(board, face, allBoards) {
  const bMinX = board.position[0] - board.size[0] / 2;
  const bMaxX = board.position[0] + board.size[0] / 2;
  const bMinY = board.position[1] - board.size[1] / 2;
  const bMaxY = board.position[1] + board.size[1] / 2;
  const bMinZ = board.position[2] - board.size[2] / 2;
  const bMaxZ = board.position[2] + board.size[2] / 2;

  for (const other of allBoards) {
    if (other.id === board.id) continue;

    const oMinX = other.position[0] - other.size[0] / 2;
    const oMaxX = other.position[0] + other.size[0] / 2;
    const oMinY = other.position[1] - other.size[1] / 2;
    const oMaxY = other.position[1] + other.size[1] / 2;
    const oMinZ = other.position[2] - other.size[2] / 2;
    const oMaxZ = other.position[2] + other.size[2] / 2;

    // Check overlap in the other two dimensions
    const xOverlap = Math.max(bMinX, oMinX) < Math.min(bMaxX, oMaxX) - 0.01;
    const yOverlap = Math.max(bMinY, oMinY) < Math.min(bMaxY, oMaxY) - 0.01;
    const zOverlap = Math.max(bMinZ, oMinZ) < Math.min(bMaxZ, oMaxZ) - 0.01;

    if (face === 'left') {
      if (Math.abs(oMaxX - bMinX) < 0.05 && yOverlap && zOverlap) return true;
    } else if (face === 'right') {
      if (Math.abs(oMinX - bMaxX) < 0.05 && yOverlap && zOverlap) return true;
    } else if (face === 'front') {
      if (Math.abs(oMinZ - bMaxZ) < 0.05 && xOverlap && yOverlap) return true;
    } else if (face === 'back') {
      if (Math.abs(oMaxZ - bMinZ) < 0.05 && xOverlap && yOverlap) return true;
    }
  }
  return false;
}
