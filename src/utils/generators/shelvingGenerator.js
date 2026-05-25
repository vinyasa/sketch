import { computeWorldAABB, collectChildBoards } from '../sceneGraph';

export function generateShelving(cfg, boards, groups, defaultMaterial) {
  const parseNum = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };
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
  const oldIdMap = {};
  if (isEditing) {
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      offset = [aabb.minX, aabb.minY, aabb.minZ];
    }
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
    isEditing
  };
}
