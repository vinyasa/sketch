import { computeWorldAABB, collectChildBoards } from '../sceneGraph';

export function generateDrawers(cfg, boards, groups, defaultMaterial) {
  const parseNum = (val, def) => {
    if (val === undefined || val === null || val === '') return def;
    const n = parseFloat(val);
    return isNaN(n) ? def : n;
  };
  const W = parseNum(cfg.width, 24);
  const H = parseNum(cfg.height, 30);
  const Dval = parseNum(cfg.depth, 20);
  const count = parseInt(cfg.count ?? 3, 10);
  const slideWidth = parseNum(cfg.slideWidth, 0.5);
  const verticalGap = parseNum(cfg.verticalGap, 0.125);
  const topClearance = parseNum(cfg.topClearance, 1.0);
  const tBox = parseNum(cfg.thicknessBox, 0.5);
  const tBot = parseNum(cfg.thicknessBottom, 0.25);
  const tFace = parseNum(cfg.thicknessFace, 0.75);
  const faceStyle = cfg.faceStyle ?? 'inset';
  const overlayAmount = parseNum(cfg.overlayAmount, 0.5);
  const jointType = cfg.jointType ?? 'butt';
  const isEditing = !!cfg.editGroupId;
  const rootGroupId = isEditing ? cfg.editGroupId : 'Drawers ' + Math.floor(Math.random() * 1000);
  const {
    editGroupId,
    ...savedParams
  } = cfg;
  let offset = [
    parseNum(cfg.offsetX, 0),
    parseNum(cfg.offsetY, 0),
    parseNum(cfg.offsetZ, 0)
  ];
  let rootParent = 'Workspace';
  const oldIdMap = {};
  if (isEditing) {
    const childBoards = collectChildBoards(rootGroupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      offset = [aabb.minX, aabb.minY, aabb.minZ];
    }
    rootParent = groups[rootGroupId]?.parentId || 'Workspace';
    childBoards.forEach(b => {
      const parts = b.parentId.split(' ');
      const drawerNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(drawerNum)) {
        const drawerIndex = drawerNum - 1;
        oldIdMap[drawerIndex + '_' + b.name] = b.id;
      }
    });
  }
  const newBoards = [];
  const newGroups = {};
  if (!isEditing) {
    newGroups[rootGroupId] = {
      parentId: rootParent,
      isExpanded: true,
      visible: true,
      meta: {
        builder: 'drawerStack',
        params: savedParams
      }
    };
  } else {
    newGroups[rootGroupId] = {
      ...groups[rootGroupId],
      meta: {
        builder: 'drawerStack',
        params: savedParams
      }
    };
  }
  const slotH = (H - (count - 1) * verticalGap) / count;
  let boxD = Dval;
  let faceW = W;
  let faceX = W / 2;
  let faceZ = Dval;
  if (faceStyle === 'inset') {
    boxD = Dval - tFace;
    faceZ = Dval - tFace / 2;
  } else {
    faceW = W + 2 * overlayAmount;
    faceX = W / 2;
    faceZ = Dval + tFace / 2;
  }
  const boxW = W - 2 * slideWidth;
  const boxH = slotH - topClearance;
  let baseId = Date.now();
  for (let i = 0; i < count; i++) {
    const drawerGroupId = rootGroupId + ' Drawer ' + (i + 1);
    newGroups[drawerGroupId] = {
      parentId: rootGroupId,
      isExpanded: false,
      visible: true
    };
    const currentY = i * (slotH + verticalGap);
    const boxCenterY = currentY + boxH / 2;
    const faceCenterY = currentY + slotH / 2;
    let fW = boxW;
    if (jointType === 'butt') {
      fW = boxW - 2 * tBox;
    } else if (jointType === 'rabbet') {
      fW = boxW - tBox;
    }
    const bLeft = {
      id: oldIdMap[i + '_Box Left'] || baseId++,
      name: `Box Left`,
      parentId: drawerGroupId,
      size: [tBox, boxH, boxD],
      position: [slideWidth + tBox / 2, boxCenterY, boxD / 2]
    };
    const bRight = {
      id: oldIdMap[i + '_Box Right'] || baseId++,
      name: `Box Right`,
      parentId: drawerGroupId,
      size: [tBox, boxH, boxD],
      position: [W - slideWidth - tBox / 2, boxCenterY, boxD / 2]
    };
    const bFront = {
      id: oldIdMap[i + '_Box Front'] || baseId++,
      name: `Box Front`,
      parentId: drawerGroupId,
      size: [fW, boxH, tBox],
      position: [W / 2, boxCenterY, boxD - tBox / 2]
    };
    const bBack = {
      id: oldIdMap[i + '_Box Back'] || baseId++,
      name: `Box Back`,
      parentId: drawerGroupId,
      size: [fW, boxH, tBox],
      position: [W / 2, boxCenterY, tBox / 2]
    };
    const bBot = {
      id: oldIdMap[i + '_Box Bottom'] || baseId++,
      name: `Box Bottom`,
      parentId: drawerGroupId,
      size: [boxW - tBox, tBot, boxD - tBox],
      position: [W / 2, currentY + 0.5 + tBot / 2, boxD / 2]
    };
    let specificFaceH = slotH + verticalGap;
    let specificFaceY = faceCenterY;
    if (faceStyle === 'overlay') {
      if (count === 1) {
        specificFaceH = slotH + 2 * overlayAmount;
      } else if (i === 0) {
        specificFaceH = slotH + overlayAmount + verticalGap / 2;
        specificFaceY = currentY + slotH / 2 - overlayAmount / 2 + verticalGap / 4;
      } else if (i === count - 1) {
        specificFaceH = slotH + overlayAmount + verticalGap / 2;
        specificFaceY = currentY + slotH / 2 + overlayAmount / 2 - verticalGap / 4;
      }
    } else {
      specificFaceH = slotH;
    }
    const bFace = {
      id: oldIdMap[i + '_Face'] || baseId++,
      name: `Face`,
      parentId: drawerGroupId,
      size: [faceW, specificFaceH, tFace],
      position: [faceX, specificFaceY, faceZ]
    };

    // Corner Joints
    if (jointType === 'rabbet') {
      const cornerDepth = tBox / 2;
      const cornerWidth = tBox / 2;
      const fOffset = fW / 2 - tBox / 4;
      const sOffset = boxD / 2 - tBox / 4;

      const fRabL = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: -fOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bLeft.id.toString(),
        face: 'back',
        direction: 'y'
      };
      const fRabR = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: fOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bRight.id.toString(),
        face: 'back',
        direction: 'y'
      };
      bFront.operations = [{
        ...fRabL,
        id: Date.now() + Math.random()
      }, {
        ...fRabR,
        id: Date.now() + Math.random()
      }];

      const bRabL = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: -fOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bLeft.id.toString(),
        face: 'front',
        direction: 'y'
      };
      const bRabR = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: fOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bRight.id.toString(),
        face: 'front',
        direction: 'y'
      };
      bBack.operations = [{
        ...bRabL,
        id: Date.now() + Math.random()
      }, {
        ...bRabR,
        id: Date.now() + Math.random()
      }];

      const lRabF = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: sOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bFront.id.toString(),
        face: 'right',
        direction: 'y'
      };
      const lRabB = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: -sOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bBack.id.toString(),
        face: 'right',
        direction: 'y'
      };
      bLeft.operations = [{
        ...lRabF,
        id: Date.now() + Math.random()
      }, {
        ...lRabB,
        id: Date.now() + Math.random()
      }];

      const rRabF = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: sOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bFront.id.toString(),
        face: 'left',
        direction: 'y'
      };
      const rRabB = {
        type: 'dado',
        width: cornerWidth,
        depth: cornerDepth,
        offset: -sOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: bBack.id.toString(),
        face: 'left',
        direction: 'y'
      };
      bRight.operations = [{
        ...rRabF,
        id: Date.now() + Math.random()
      }, {
        ...rRabB,
        id: Date.now() + Math.random()
      }];
    }
    const drawerBoards = [bLeft, bRight, bFront, bBack, bBot, bFace].map(b => ({
      ...b,
      position: [b.position[0] + offset[0], b.position[1] + offset[1], b.position[2] + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: b.operations || [],
      edgeJoints: b.edgeJoints || []
    }));

    // Dado the bottom
    const dL = drawerBoards[0];
    const dR = drawerBoards[1];
    const dF = drawerBoards[2];
    const dB = drawerBoards[3];
    const dBot = drawerBoards[4];

    const dadoDepth = tBox / 2;
    const dadoOffset = 0.5 + tBot / 2 - boxH / 2;

    const dadoOp = {
      type: 'dado',
      width: tBot,
      depth: dadoDepth,
      offset: dadoOffset,
      length: 0,
      lengthOffset: 0,
      source: 'edge-joint',
      partnerId: dBot.id.toString()
    };
    dL.operations.push({
      ...dadoOp,
      id: Date.now() + Math.random(),
      face: 'right',
      direction: 'z'
    });
    dR.operations.push({
      ...dadoOp,
      id: Date.now() + Math.random(),
      face: 'left',
      direction: 'z'
    });
    dF.operations.push({
      ...dadoOp,
      id: Date.now() + Math.random(),
      face: 'back',
      direction: 'x'
    });
    dB.operations.push({
      ...dadoOp,
      id: Date.now() + Math.random(),
      face: 'front',
      direction: 'x'
    });
    [dL, dR, dF, dB].forEach(side => {
      side.edgeJoints = [{
        partnerId: dBot.id.toString(),
        type: 'dado',
        overBoardId: side.id.toString()
      }];
      dBot.edgeJoints = dBot.edgeJoints || [];
      dBot.edgeJoints.push({
        partnerId: side.id.toString(),
        type: 'dado',
        overBoardId: side.id.toString()
      });
    });
    newBoards.push(...drawerBoards);
  }

  return {
    rootGroupId,
    newGroups,
    newBoards,
    isEditing
  };
}
