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
  const gap = parseNum(cfg.gap, 0.125);
  const verticalGap = gap;
  const topClearance = parseNum(cfg.topClearance, 1.0);
  const tBox = parseNum(cfg.thicknessBox, 0.5);
  const tBot = parseNum(cfg.thicknessBottom, 0.25);
  const tFace = parseNum(cfg.thicknessFace, 0.75);
  const faceStyle = cfg.faceStyle ?? 'inset';
  const overlayAmount = parseNum(cfg.overlayAmount, 0.5);
  const reveal = parseNum(cfg.reveal, 0.375);
  const jointType = cfg.jointType ?? 'butt';

  const roundDownTo1_8 = (val) => Math.floor(val * 8) / 8;
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

  // Resolve cabinetGroupId to align and center drawers inside opening
  let cabinetGroupId = cfg.cabinetGroupId;
  if (!cabinetGroupId && isEditing) {
    const parentId = groups[rootGroupId]?.parentId;
    if (parentId && groups[parentId]?.meta?.builder === 'cabinet') {
      cabinetGroupId = parentId;
    }
  }

  const selectedCabinet = cabinetGroupId ? groups[cabinetGroupId] : null;

  let tSide = 0.75;
  let tTB = 0.75;
  let tBack = 0.25;

  if (selectedCabinet) {
    const cabParams = selectedCabinet.meta?.params || {};
    const cabW = parseNum(cabParams.width, 24);
    const cabH = parseNum(cabParams.height, 30);
    const cabD = parseNum(cabParams.depth, 14);
    tSide = parseNum(cabParams.thicknessSide, 0.75);
    tTB = parseNum(cabParams.thicknessTB, 0.75);
    tBack = parseNum(cabParams.thicknessBack, 0.25);
    
    const cabOpeningWidth = cabW - 2 * tSide;
    const cabOpeningHeight = cabH - 2 * tTB;
    
    const cabBoards = collectChildBoards(cabinetGroupId, boards, groups);
    if (cabBoards.length > 0) {
      const cabAABB = computeWorldAABB(cabBoards);
      offset[0] = cabAABB.minX + tSide + (cabOpeningWidth - W) / 2;
      offset[1] = cabAABB.minY + tTB + (cabOpeningHeight - H) / 2;
      offset[2] = cabAABB.minZ + tBack;
    }
    rootParent = cabinetGroupId;
  } else if (isEditing) {
    const childBoards = collectChildBoards(rootGroupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      offset = [aabb.minX, aabb.minY, aabb.minZ];
    }
    rootParent = groups[rootGroupId]?.parentId || 'Workspace';
  }

  if (isEditing) {
    const childBoards = collectChildBoards(rootGroupId, boards, groups);
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
  const slotHeights = (cfg.slotHeights && cfg.slotHeights.length === count 
    ? cfg.slotHeights.map(Number) 
    : Array(count).fill((H - (count + 1) * gap) / count))
    .map(roundDownTo1_8);

  const totalStackH = slotHeights.reduce((sum, h) => sum + h, 0) + count * gap;
  const leftoverY = H - totalStackH;

  const boxW = roundDownTo1_8(W - 2 * slideWidth);
  // Subtract 1" from available depth to leave the 1" back clearance gap
  const boxD = roundDownTo1_8(faceStyle === 'inset' ? Dval - tFace - 1.0 : Dval - 1.0);

  let faceW = W;
  let faceX = W / 2;
  let faceZ = Dval;
  if (faceStyle === 'inset') {
    faceW = roundDownTo1_8(W - 2 * gap);
    faceZ = Dval - tFace / 2;
  } else {
    faceW = roundDownTo1_8(W + 2 * (tSide - reveal));
    faceZ = Dval + tFace / 2;
  }
  
  let baseId = Date.now();

  for (let i = 0; i < count; i++) {
    const sH = slotHeights[i];
    const boxH = sH - topClearance;

    const drawerGroupId = rootGroupId + ' Drawer ' + (i + 1);
    newGroups[drawerGroupId] = {
      parentId: rootGroupId,
      isExpanded: false,
      visible: true
    };
    
    // Top-down physical position calculation (Drawer 1 is Top Drawer)
    const sumHeightsAbove = slotHeights.slice(0, i).reduce((sum, h) => sum + h, 0);
    const sumGapsAbove = (i + 1) * gap; // Account for the top perimeter gap
    const currentY = H - sumHeightsAbove - sumGapsAbove - sH;

    // Calculate individual drawer face height and center Y position first, so box bottom can shift relative to it
    const faceCenterY = currentY + sH / 2;
    let specificFaceH = sH;
    let specificFaceY = faceCenterY;
    if (faceStyle === 'inset') {
      specificFaceH = roundDownTo1_8(sH);
    } else {
      const overallH = H + 2 * tTB;
      const totalFaceSpace = overallH - 2 * reveal;
      const totalGaps = (count - 1) * gap;
      const totalFaceHeightsSum = totalFaceSpace - totalGaps;
      const sumSlotH = slotHeights.reduce((s, h) => s + h, 0);
      
      const faceH = sumSlotH > 0 ? sH * (totalFaceHeightsSum / sumSlotH) : 0;
      specificFaceH = roundDownTo1_8(faceH);
      
      const topFaceEdge = H + tTB - reveal;
      let sumFaceHeightsAbove = 0;
      for (let j = 0; j < i; j++) {
        const sjH = slotHeights[j];
        const fjH = sumSlotH > 0 ? sjH * (totalFaceHeightsSum / sumSlotH) : 0;
        sumFaceHeightsAbove += roundDownTo1_8(fjH);
      }
      const topOfCurrentFace = topFaceEdge - sumFaceHeightsAbove - i * gap;
      specificFaceY = topOfCurrentFace - specificFaceH / 2;
    }

    // Determine the bottom of the drawer face
    const faceBottomY = specificFaceY - specificFaceH / 2;

    // The drawer box bottom shifts up exactly 5/8" (0.625") from the bottom of the face
    const boxBottomY = faceBottomY + 0.625;
    const boxCenterY = boxBottomY + boxH / 2;

    let fW = boxW;
    if (jointType === 'butt') {
      fW = boxW - 2 * tBox;
    } else if (jointType === 'rabbet') {
      fW = boxW - tBox;
    }
    // Shift box boards 1" along Z (starts at 1.0" in local coordinates, leaving 1" back clearance)
    const bLeft = {
      id: oldIdMap[i + '_Box Left'] || baseId++,
      name: `Box Left`,
      parentId: drawerGroupId,
      size: [tBox, boxH, boxD],
      position: [slideWidth + tBox / 2, boxCenterY, 1.0 + boxD / 2]
    };
    const bRight = {
      id: oldIdMap[i + '_Box Right'] || baseId++,
      name: `Box Right`,
      parentId: drawerGroupId,
      size: [tBox, boxH, boxD],
      position: [W - slideWidth - tBox / 2, boxCenterY, 1.0 + boxD / 2]
    };
    const bFront = {
      id: oldIdMap[i + '_Box Front'] || baseId++,
      name: `Box Front`,
      parentId: drawerGroupId,
      size: [fW, boxH, tBox],
      position: [W / 2, boxCenterY, 1.0 + boxD - tBox / 2]
    };
    const bBack = {
      id: oldIdMap[i + '_Box Back'] || baseId++,
      name: `Box Back`,
      parentId: drawerGroupId,
      size: [fW, boxH, tBox],
      position: [W / 2, boxCenterY, 1.0 + tBox / 2]
    };
    const bBot = {
      id: oldIdMap[i + '_Box Bottom'] || baseId++,
      name: `Box Bottom`,
      parentId: drawerGroupId,
      size: [boxW - tBox, tBot, boxD - tBox],
      position: [W / 2, boxBottomY + 0.5 + tBot / 2, 1.0 + boxD / 2]
    };
    const bFace = {
      id: oldIdMap[i + '_Face'] || baseId++,
      name: `Face`,
      parentId: drawerGroupId,
      size: [faceW, specificFaceH, tFace],
      position: [faceX, specificFaceY, faceZ]
    };
    const bSlideL = {
      id: oldIdMap[i + '_Slide Left'] || baseId++,
      name: `Slide Left`,
      parentId: drawerGroupId,
      size: [slideWidth, 1.5, boxD],
      position: [slideWidth / 2, boxCenterY, 1.0 + boxD / 2],
      material: { type: 'color', hex: '#8e9296' }
    };
    const bSlideR = {
      id: oldIdMap[i + '_Slide Right'] || baseId++,
      name: `Slide Right`,
      parentId: drawerGroupId,
      size: [slideWidth, 1.5, boxD],
      position: [W - slideWidth / 2, boxCenterY, 1.0 + boxD / 2],
      material: { type: 'color', hex: '#8e9296' }
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
    const drawerBoards = [bLeft, bRight, bFront, bBack, bBot, bFace, bSlideL, bSlideR].map(b => {
      const isFace = b.name === 'Face';
      const isSlide = b.name.includes('Slide');
      const defaultLumberType = isFace ? 'solid' : (isSlide ? 'solid' : 'plywood');
      
      return {
        ...b,
        position: [b.position[0] + offset[0], b.position[1] + offset[1], b.position[2] + offset[2]],
        material: b.material || defaultMaterial,
        joint: 'None',
        shape: 'box',
        lumberType: defaultLumberType,
        grainDirection: 'length',
        operations: b.operations || [],
        edgeJoints: b.edgeJoints || []
      };
    });

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
