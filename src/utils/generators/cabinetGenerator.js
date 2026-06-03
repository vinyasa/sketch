import { computeWorldAABB, collectChildBoards } from '../sceneGraph';
import { parseNum } from '../units';

export function generateCabinet(cfg, boards, groups) {
  const W = parseNum(cfg.width, 24);
  const H = parseNum(cfg.height, 30);
  const D = parseNum(cfg.depth, 14);
  const tTB = parseNum(cfg.thicknessTB, 0.75);
  const tSide = parseNum(cfg.thicknessSide, 0.75);
  const tFront = parseNum(cfg.thicknessFront, 0.75);
  const tBack = parseNum(cfg.thicknessBack, 0.25);
  const backStyle = cfg.backStyle ?? 'flat';
  const coreD = backStyle === 'flat' ? D - tBack : D;
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Cabinet ' + Math.floor(Math.random() * 1000);

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

  const coreMidZ = backStyle === 'flat' ? tBack + coreD / 2 : coreD / 2;
  let backSize, backPos;
  if (backStyle === 'flat') {
    backSize = [W, H, tBack];
    backPos = [W / 2, H / 2, tBack / 2];
  } else {
    backSize = [W - tSide, H - tTB, tBack];
    backPos = [W / 2, H / 2, tBack / 2];
  }
  let panelDefs = [{
    name: 'Bottom',
    size: [W - 2 * tSide, tTB, coreD],
    position: [W / 2, tTB / 2, coreMidZ]
  }, {
    name: 'Top',
    size: [W - 2 * tSide, tTB, coreD],
    position: [W / 2, H - tTB / 2, coreMidZ]
  }, {
    name: 'Left Side',
    size: [tSide, H, coreD],
    position: [tSide / 2, H / 2, coreMidZ]
  }, {
    name: 'Right Side',
    size: [tSide, H, coreD],
    position: [W - tSide / 2, H / 2, coreMidZ]
  }, {
    name: 'Back',
    size: backSize,
    position: backPos
  }];
  const baseId = Date.now();
  const newBoards = panelDefs.map((pd, i) => {
    const assignedId = oldIdMap[pd.name] || baseId + i;
    const b = {
      id: assignedId,
      name: pd.name,
      parentId: groupId,
      size: pd.size,
      position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
      material: cfg.material || 'pine',
      lumberType: 'plywood',
      grainDirection: 'length',
      joint: 'None',
      shape: 'box',
      operations: [],
      edgeJoints: []
    };
    if (backStyle === 'inset') {
      const backId = oldIdMap['Back'] || baseId + 4;
      const rOp = {
        type: 'dado',
        direction: b.name.includes('Side') ? 'y' : 'x',
        width: tBack,
        depth: b.name.includes('Side') ? tSide / 2 : tTB / 2,
        offset: -coreD / 2 + tBack / 2,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: backId.toString()
      };
      if (b.name === 'Left Side') {
        b.operations.push({
          ...rOp,
          id: Date.now() + Math.random(),
          face: 'right'
        });
      } else if (b.name === 'Right Side') {
        b.operations.push({
          ...rOp,
          id: Date.now() + Math.random(),
          face: 'left'
        });
      } else if (b.name === 'Bottom') {
        b.operations.push({
          ...rOp,
          id: Date.now() + Math.random(),
          face: 'top'
        });
      } else if (b.name === 'Top') {
        b.operations.push({
          ...rOp,
          id: Date.now() + Math.random(),
          face: 'bottom'
        });
      }
    }
    return b;
  });

  return {
    groupId,
    savedParams,
    newBoards,
    isEditing,
    backStyle,
    tSide,
    tTB,
    tBack,
    baseId,
    oldIdMap
  };
}
