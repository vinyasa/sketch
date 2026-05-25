import { computeWorldAABB, collectChildBoards } from '../sceneGraph';

export function generateFaceFrame(cfg, boards, groups, defaultMaterial) {
  const parseNum = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };
  const W = parseNum(cfg.width, 24);
  const H = parseNum(cfg.height, 30);
  const t = parseNum(cfg.thickness, 0.75);
  const wStile = parseNum(cfg.stileWidth, 1.5);
  const wRail = parseNum(cfg.railWidth, 1.5);
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Face Frame ' + Math.floor(Math.random() * 1000);
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
    childBoards.forEach(b => { oldIdMap[b.name] = b.id; });
  }

  const railW = W - (2 * wStile);
  const midZ = t / 2;
  const panelDefs = [
    {
      name: 'Left Stile',
      size: [wStile, H, t],
      position: [wStile / 2, H / 2, midZ]
    },
    {
      name: 'Right Stile',
      size: [wStile, H, t],
      position: [W - wStile / 2, H / 2, midZ]
    },
    {
      name: 'Top Rail',
      size: [railW, wRail, t],
      position: [W / 2, H - wRail / 2, midZ]
    },
    {
      name: 'Bottom Rail',
      size: [railW, wRail, t],
      position: [W / 2, wRail / 2, midZ]
    }
  ];

  const baseId = Date.now();
  const newBoards = panelDefs.map((pd, i) => {
    const assignedId = oldIdMap[pd.name] || baseId + i;
    return {
      id: assignedId,
      name: pd.name,
      parentId: groupId,
      size: pd.size,
      position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: [],
      edgeJoints: []
    };
  });

  return {
    groupId,
    savedParams,
    newBoards,
    isEditing
  };
}
