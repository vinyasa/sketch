import { computeWorldAABB, collectChildBoards } from '../sceneGraph';
import { parseNum } from '../units';

export function generateBox(cfg, boards, groups) {
  const W = parseNum(cfg.width, 18);
  const H = parseNum(cfg.height, 12);
  const D = parseNum(cfg.depth, 12);
  const tTB = parseNum(cfg.thicknessTB, 0.5);
  const tSide = parseNum(cfg.thicknessSide, 0.5);
  const tFront = parseNum(cfg.thicknessFront, 0.5);
  const tBack = parseNum(cfg.thicknessBack, 0.5);
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Box ' + Math.floor(Math.random() * 1000);

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
    childBoards.forEach(b => {
      oldIdMap[b.name] = b.id;
    });
  }
  const coreH = H - 2 * tTB;
  const coreD = D - tFront - tBack;
  let panelDefs = [{
    name: 'Bottom',
    size: [W, tTB, D],
    position: [W / 2, tTB / 2, D / 2]
  }, {
    name: 'Top',
    size: [W, tTB, D],
    position: [W / 2, H - tTB / 2, D / 2]
  }, {
    name: 'Left Side',
    size: [tSide, coreH, coreD],
    position: [tSide / 2, H / 2, D / 2]
  }, {
    name: 'Right Side',
    size: [tSide, coreH, coreD],
    position: [W - tSide / 2, H / 2, D / 2]
  }, {
    name: 'Back',
    size: [W, coreH, tBack],
    position: [W / 2, H / 2, tBack / 2]
  }, {
    name: 'Front',
    size: [W, coreH, tFront],
    position: [W / 2, H / 2, D - tFront / 2]
  }];
  const baseId = Date.now();
  const newBoards = panelDefs.map((pd, i) => {
    const assignedId = oldIdMap[pd.name] || baseId + i;
    return {
      id: assignedId,
      name: pd.name,
      parentId: groupId,
      size: pd.size,
      position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
      material: 'Plywood',
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
