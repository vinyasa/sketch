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
  const groupId = isEditing ? cfg.editGroupId : 'Door ' + Math.floor(Math.random() * 1000);
  const { editGroupId, ...savedParams } = cfg;
  
  let offset = [
    parseNum(cfg.offsetX, 0),
    parseNum(cfg.offsetY, 0),
    parseNum(cfg.offsetZ, 0)
  ];

  const doorStyle = cfg.doorStyle || 'overlay';
  const insetClearance = parseNum(cfg.insetClearance, 0.125);
  const overlayReveal = parseNum(cfg.overlayReveal, 0.25);
  const doorConstruction = cfg.doorConstruction || 'shaker';
  const doorCount = parseNum(cfg.doorCount, 1);
  const doubleDoorGap = parseNum(cfg.doubleDoorGap, 0.09375); // 3/32" default gap

  const cabinetGroupId = cfg.cabinetGroupId;
  const faceFrameGroupId = cfg.faceFrameGroupId;
  
  let cabWidth = 18;
  let cabHeight = 30;
  let cabMinX = 0;
  let cabMinY = 0;
  let cabMaxZ = 0;
  
  let openingWidth = W;
  let openingHeight = H;
  let openingMinX = offset[0];
  let openingMinY = offset[1];
  let openingMinZ = offset[2];

  if (cabinetGroupId && groups[cabinetGroupId]) {
    const cabBoards = collectChildBoards(cabinetGroupId, boards, groups);
    if (cabBoards.length > 0) {
      const aabb = computeWorldAABB(cabBoards);
      cabWidth = aabb.maxX - aabb.minX;
      cabHeight = aabb.maxY - aabb.minY;
      cabMinX = aabb.minX;
      cabMinY = aabb.minY;
      cabMaxZ = aabb.maxZ;
      
      const cabGroup = groups[cabinetGroupId];
      const tSide = parseNum(cabGroup.meta?.params?.thicknessSide, 0.75);
      const tTB = parseNum(cabGroup.meta?.params?.thicknessTB, 0.75);
      
      if (doorStyle === 'inset') {
        openingWidth = cabWidth - 2 * tSide;
        openingHeight = cabHeight - 2 * tTB;
        openingMinX = cabMinX + tSide;
        openingMinY = cabMinY + tTB;
        openingMinZ = cabMaxZ - tFrame;
      } else {
        openingWidth = cabWidth;
        openingHeight = cabHeight;
        openingMinX = cabMinX;
        openingMinY = cabMinY;
        openingMinZ = cabMaxZ;
      }
    }
  } else if (faceFrameGroupId && groups[faceFrameGroupId]) {
    const ffBoards = collectChildBoards(faceFrameGroupId, boards, groups);
    if (ffBoards.length > 0) {
      const aabb = computeWorldAABB(ffBoards);
      const ffWidth = aabb.maxX - aabb.minX;
      const ffHeight = aabb.maxY - aabb.minY;
      const ffMinX = aabb.minX;
      const ffMinY = aabb.minY;
      const ffMaxZ = aabb.maxZ;
      
      const ffGroup = groups[faceFrameGroupId];
      const wStileFF = parseNum(ffGroup.meta?.params?.stileWidth, 1.5);
      const wRailFF = parseNum(ffGroup.meta?.params?.railWidth, 1.5);
      
      if (doorStyle === 'inset') {
        openingWidth = ffWidth - 2 * wStileFF;
        openingHeight = ffHeight - 2 * wRailFF;
        openingMinX = ffMinX + wStileFF;
        openingMinY = ffMinY + wRailFF;
        openingMinZ = ffMaxZ - tFrame;
      } else {
        openingWidth = ffWidth;
        openingHeight = ffHeight;
        openingMinX = ffMinX;
        openingMinY = ffMinY;
        openingMinZ = ffMaxZ;
      }
    }
  }

  let totalSpaceW = W;
  let finalH = H;
  let startOffset = [...offset];

  if ((cabinetGroupId && groups[cabinetGroupId]) || (faceFrameGroupId && groups[faceFrameGroupId])) {
    if (doorStyle === 'inset') {
      totalSpaceW = openingWidth - 2 * insetClearance;
      finalH = openingHeight - 2 * insetClearance;
      startOffset = [
        openingMinX + insetClearance,
        openingMinY + insetClearance,
        openingMinZ
      ];
    } else {
      totalSpaceW = openingWidth - 2 * overlayReveal;
      finalH = openingHeight - 2 * overlayReveal;
      startOffset = [
        openingMinX + overlayReveal,
        openingMinY + overlayReveal,
        openingMinZ
      ];
    }
  }

  const oldIdMap = {};
  if (isEditing) {
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      if (!cabinetGroupId && !faceFrameGroupId) {
        startOffset = [aabb.minX, aabb.minY, aabb.minZ];
        totalSpaceW = aabb.maxX - aabb.minX;
        finalH = aabb.maxY - aabb.minY;
      }
    }
    childBoards.forEach(b => { oldIdMap[b.name] = b.id; });
  }

  const eachDoorW = doorCount === 2 
    ? (totalSpaceW - doubleDoorGap) / 2
    : totalSpaceW;

  const doors = [];
  for (let dIdx = 0; dIdx < doorCount; dIdx++) {
    const doorOffsetX = startOffset[0] + dIdx * (eachDoorW + doubleDoorGap);
    doors.push({
      w: eachDoorW,
      offset: [doorOffsetX, startOffset[1], startOffset[2]],
      prefix: doorCount === 2 ? (dIdx === 0 ? 'Left Door ' : 'Right Door ') : ''
    });
  }

  const midZ = tFrame / 2;
  const baseId = Date.now();

  let panelDefs = [];
  doors.forEach((door, dIdx) => {
    const finalW = door.w;
    const finalOffset = door.offset;
    const prefix = door.prefix;

    if (doorConstruction === 'flat') {
      panelDefs.push({
        name: prefix + 'Flat Door Panel',
        size: [finalW, finalH, tFrame],
        position: [finalW / 2, finalH / 2, midZ],
        offset: finalOffset,
        operations: []
      });
    } else {
      const panelW = finalW - 2 * wStile + 2 * grooveD - clear;
      const panelH = finalH - 2 * wStile + 2 * grooveD - clear;
      const railTotalW = finalW - 2 * wStile + 2 * grooveD;
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

      panelDefs.push({
        name: prefix + 'Left Stile',
        size: [wStile, finalH, tFrame],
        position: [wStile / 2, finalH / 2, midZ],
        offset: finalOffset,
        operations: [{
          id: baseId + dIdx * 100 + 10,
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
        name: prefix + 'Right Stile',
        size: [wStile, finalH, tFrame],
        position: [finalW - wStile / 2, finalH / 2, midZ],
        offset: finalOffset,
        operations: [{
          id: baseId + dIdx * 100 + 20,
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
        name: prefix + 'Top Rail',
        size: [railTotalW, wStile, tFrame],
        position: [finalW / 2, finalH - wStile / 2, midZ],
        offset: finalOffset,
        operations: [{
          id: baseId + dIdx * 100 + 30,
          type: 'dado',
          face: 'bottom',
          direction: 'x',
          width: grooveW,
          depth: grooveD,
          offset: 0,
          length: 0,
          lengthOffset: 0,
          source: 'shaker'
        }, ...makeTenons(baseId + dIdx * 100 + 30)]
      }, {
        name: prefix + 'Bottom Rail',
        size: [railTotalW, wStile, tFrame],
        position: [finalW / 2, wStile / 2, midZ],
        offset: finalOffset,
        operations: [{
          id: baseId + dIdx * 100 + 40,
          type: 'dado',
          face: 'top',
          direction: 'x',
          width: grooveW,
          depth: grooveD,
          offset: 0,
          length: 0,
          lengthOffset: 0,
          source: 'shaker'
        }, ...makeTenons(baseId + dIdx * 100 + 40)]
      }, {
        name: prefix + 'Panel',
        size: [panelW, panelH, tPanel],
        position: [finalW / 2, finalH / 2, midZ],
        offset: finalOffset,
        operations: []
      });
    }
  });

  const newBoards = panelDefs.map((pd, i) => {
    const assignedId = oldIdMap[pd.name] || baseId + 500 + i;
    return {
      id: assignedId,
      name: pd.name,
      parentId: groupId,
      size: pd.size,
      position: [pd.position[0] + pd.offset[0], pd.position[1] + pd.offset[1], pd.position[2] + pd.offset[2]],
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
