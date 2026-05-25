import { computeWorldAABB, collectChildBoards } from '../sceneGraph';

export function generateShakerDoor(cfg, boards, groups, defaultMaterial) {
  const parseNum = (val, def) => {
    if (val === undefined || val === null || val === '') return def;
    const n = parseFloat(val);
    return isNaN(n) ? def : n;
  };
  const W = parseNum(cfg.width, 18);
  const H = parseNum(cfg.height, 30);
  const tFrame = parseNum(cfg.thicknessFrame, 0.75);
  const tPanel = parseNum(cfg.thicknessPanel, 0.25);
  const wStile = parseNum(cfg.widthStileRail, 2);
  const grooveD = parseNum(cfg.grooveDepth, 0.375);
  const grooveW = parseNum(cfg.grooveWidth, 0.25);
  const clear = parseNum(cfg.panelClearance, 0.125);
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Shaker Door ' + Math.floor(Math.random() * 1000);
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

  const panelW = W - 2 * wStile + 2 * grooveD - clear;
  const panelH = H - 2 * wStile + 2 * grooveD - clear;
  const railTotalW = W - 2 * wStile + 2 * grooveD;
  const midZ = tFrame / 2;
  const baseId = Date.now();
  const tenonCutDepth = (tFrame - grooveW) / 2;
  const tenonOffsetLeft = -(railTotalW / 2) + grooveD / 2;
  const tenonOffsetRight = railTotalW / 2 - grooveD / 2;

  const makeTenons = idBase => [{
    id: idBase + 1,
    type: 'dado',
    face: 'front',
    direction: 'y',
    width: grooveD,
    depth: tenonCutDepth,
    offset: tenonOffsetLeft,
    length: 0,
    lengthOffset: 0,
    source: 'shaker'
  }, {
    id: idBase + 2,
    type: 'dado',
    face: 'front',
    direction: 'y',
    width: grooveD,
    depth: tenonCutDepth,
    offset: tenonOffsetRight,
    length: 0,
    lengthOffset: 0,
    source: 'shaker'
  }, {
    id: idBase + 3,
    type: 'dado',
    face: 'back',
    direction: 'y',
    width: grooveD,
    depth: tenonCutDepth,
    offset: tenonOffsetLeft,
    length: 0,
    lengthOffset: 0,
    source: 'shaker'
  }, {
    id: idBase + 4,
    type: 'dado',
    face: 'back',
    direction: 'y',
    width: grooveD,
    depth: tenonCutDepth,
    offset: tenonOffsetRight,
    length: 0,
    lengthOffset: 0,
    source: 'shaker'
  }];

  const panelDefs = [{
    name: 'Left Stile',
    size: [wStile, H, tFrame],
    position: [wStile / 2, H / 2, midZ],
    operations: [{
      id: baseId + 10,
      type: 'dado',
      face: 'right',
      direction: 'y',
      width: grooveW,
      depth: grooveD,
      offset: 0,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }]
  }, {
    name: 'Right Stile',
    size: [wStile, H, tFrame],
    position: [W - wStile / 2, H / 2, midZ],
    operations: [{
      id: baseId + 20,
      type: 'dado',
      face: 'left',
      direction: 'y',
      width: grooveW,
      depth: grooveD,
      offset: 0,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }]
  }, {
    name: 'Top Rail',
    size: [railTotalW, wStile, tFrame],
    position: [W / 2, H - wStile / 2, midZ],
    operations: [{
      id: baseId + 30,
      type: 'dado',
      face: 'bottom',
      direction: 'x',
      width: grooveW,
      depth: grooveD,
      offset: 0,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }, ...makeTenons(baseId + 30)]
  }, {
    name: 'Bottom Rail',
    size: [railTotalW, wStile, tFrame],
    position: [W / 2, wStile / 2, midZ],
    operations: [{
      id: baseId + 40,
      type: 'dado',
      face: 'top',
      direction: 'x',
      width: grooveW,
      depth: grooveD,
      offset: 0,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }, ...makeTenons(baseId + 40)]
  }, {
    name: 'Panel',
    size: [panelW, panelH, tPanel],
    position: [W / 2, H / 2, midZ],
    operations: []
  }];

  const newBoards = panelDefs.map((pd, i) => {
    const assignedId = oldIdMap[pd.name] || baseId + 100 + i;
    return {
      id: assignedId,
      name: pd.name,
      parentId: groupId,
      size: pd.size,
      position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: pd.operations,
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
