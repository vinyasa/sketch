import { computeWorldAABB, collectChildBoards } from '../sceneGraph';
import { parseNum } from '../units';

export function generateShelving(cfg, boards, groups, defaultMaterial) {
  const parseIntSafe = (val, def) => { const n = parseInt(val, 10); return isNaN(n) ? def : n; };
  
  const W = parseNum(cfg.width, 30);
  const H = parseNum(cfg.height, 48);
  const D = parseNum(cfg.depth, 11);
  const t = parseNum(cfg.thickness, 0.75);
  const count = parseIntSafe(cfg.count, 3);
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Shelving Unit ' + Math.floor(Math.random() * 1000);
  const { editGroupId, ...savedParams } = cfg;
  
  let offset = [
    parseNum(cfg.offsetX, 0),
    parseNum(cfg.offsetY, 0),
    parseNum(cfg.offsetZ, 0)
  ];

  let cabinetGroupId = cfg.cabinetGroupId;
  let boxGroupId = cfg.boxGroupId;
  if (!cabinetGroupId && !boxGroupId && isEditing) {
    const parentId = groups[groupId]?.parentId;
    if (parentId && groups[parentId]?.meta?.builder === 'cabinet') {
      cabinetGroupId = parentId;
    } else if (parentId && groups[parentId]?.meta?.builder === 'box') {
      boxGroupId = parentId;
    }
  }

  let rootParent = 'Workspace';
  if (cabinetGroupId && groups[cabinetGroupId]) {
    const cabParams = groups[cabinetGroupId].meta?.params || {};
    const tSide = parseNum(cabParams.thicknessSide, 0.75);
    const tTB = parseNum(cabParams.thicknessTB, 0.75);
    const tBack = parseNum(cabParams.thicknessBack, 0.25);
    const cabBoards = collectChildBoards(cabinetGroupId, boards, groups);
    if (cabBoards.length > 0) {
      const cabAABB = computeWorldAABB(cabBoards);
      offset[0] = cabAABB.minX + tSide;
      offset[1] = cabAABB.minY + tTB;
      offset[2] = cabAABB.minZ + tBack;
    }
    rootParent = cabinetGroupId;
  } else if (boxGroupId && groups[boxGroupId]) {
    const boxParams = groups[boxGroupId].meta?.params || {};
    const tSide = parseNum(boxParams.thicknessSide, 0.5);
    const tTB = parseNum(boxParams.thicknessTB, 0.5);
    const tBack = parseNum(boxParams.thicknessBack, 0.5);
    const boxBoards = collectChildBoards(boxGroupId, boards, groups);
    if (boxBoards.length > 0) {
      const boxAABB = computeWorldAABB(boxBoards);
      offset[0] = boxAABB.minX + tSide;
      offset[1] = boxAABB.minY + tTB;
      offset[2] = boxAABB.minZ + tBack;
    }
    rootParent = boxGroupId;
  } else if (isEditing) {
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      offset = [aabb.minX, aabb.minY, aabb.minZ];
    }
    rootParent = groups[groupId]?.parentId || 'Workspace';
  }

  const oldIdMap = {};
  if (isEditing) {
    const childBoards = collectChildBoards(groupId, boards, groups);
    childBoards.forEach((b, i) => { oldIdMap[i] = b.id; });
  }

  const newBoards = [];
  const baseId = Date.now();
  
  const availableHeight = H - (count * t);
  const gap = availableHeight / (count + 1);

  for (let i = 0; i < count; i++) {
      const yCenter = gap * (i + 1) + t * i + (t / 2);
      const assignedId = oldIdMap[i] || baseId + i;
      
      newBoards.push({
          id: assignedId,
          name: `Shelf ${i + 1}`,
          parentId: groupId,
          size: [W, t, D],
          position: [W / 2 + offset[0], yCenter + offset[1], D / 2 + offset[2]],
          material: defaultMaterial,
          joint: 'None',
          shape: 'box',
          operations: [],
          edgeJoints: []
      });
  }

  return {
    groupId,
    savedParams,
    newBoards,
    isEditing,
    rootParent,
    cabinetGroupId,
    boxGroupId
  };
}
