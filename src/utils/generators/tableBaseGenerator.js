import { computeWorldAABB, collectChildBoards } from '../sceneGraph';
import { parseNum } from '../units';

export function generateTableBase(cfg, boards, groups, defaultMaterial) {
  
  const W = parseNum(cfg.width, 48);
  const H = parseNum(cfg.height, 29);
  const D = parseNum(cfg.depth, 30);
  const legSize = parseNum(cfg.legSize, 2.25);
  const legTaperAngle = parseNum(cfg.legTaperAngle, 1.5);
  const apronHeight = parseNum(cfg.apronHeight, 4.0);
  const apronThickness = parseNum(cfg.apronThickness, 0.75);
  const apronInset = parseNum(cfg.apronInset, 0.25);
  const apronJoint = cfg.apronJoint || 'pocket-hole'; // 'pocket-hole' or 'mortise-tenon'
  const stringerWidth = parseNum(cfg.stringerWidth, 3.0);
  const stringerThickness = parseNum(cfg.stringerThickness, 0.75);
  
  const isEditing = !!cfg.editGroupId;
  const groupId = isEditing ? cfg.editGroupId : 'Table Base ' + Math.floor(Math.random() * 1000);
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

  const baseId = Date.now();
  let idCounter = 0;
  const getNextId = (name, oldNameFallback) => {
    return oldIdMap[name] || (oldNameFallback && oldIdMap[oldNameFallback]) || (baseId + idCounter++);
  };

  const newBoards = [];
  const newConstraints = {};
  let constraintCounter = 0;

  // 1. Legs (Split each of the 4 legs into Leg Upper (straight box) and Leg Lower (tapered shaft))
  const halfLeg = legSize / 2;
  const hUpper = apronHeight;
  const hLower = H - apronHeight;
  const yUpper = H - hUpper / 2;
  const yLower = hLower / 2;

  const legDefs = [
    { num: 1, name: 'Front-Left',  x: halfLeg, z: D - halfLeg, taper: { angleRight: legTaperAngle, angleBack: legTaperAngle, angleLeft: 0, angleFront: 0 } },
    { num: 2, name: 'Front-Right', x: W - halfLeg, z: D - halfLeg, taper: { angleLeft: legTaperAngle, angleBack: legTaperAngle, angleRight: 0, angleFront: 0 } },
    { num: 3, name: 'Back-Left',   x: halfLeg, z: halfLeg, taper: { angleRight: legTaperAngle, angleFront: legTaperAngle, angleLeft: 0, angleBack: 0 } },
    { num: 4, name: 'Back-Right',  x: W - halfLeg, z: halfLeg, taper: { angleLeft: legTaperAngle, angleFront: legTaperAngle, angleRight: 0, angleBack: 0 } }
  ];

  const newGroups = {};
  const legsGroupId = groupId + '_Legs';
  newGroups[legsGroupId] = {
    parentId: groupId,
    visible: true,
    isExpanded: true,
    name: 'Legs'
  };

  legDefs.forEach(ld => {
    const legSubGroupId = groupId + '_Leg_' + ld.num;
    newGroups[legSubGroupId] = {
      parentId: legsGroupId,
      visible: true,
      isExpanded: true,
      name: `Leg ${ld.num}`
    };

    const upperName = `Leg ${ld.num} Upper`;
    const lowerName = `Leg ${ld.num} Lower`;
    const oldUpperName = `Leg ${ld.name} Upper`;
    const oldLowerName = `Leg ${ld.name} Lower`;

    const upperId = getNextId(upperName, oldUpperName);
    const lowerId = getNextId(lowerName, oldLowerName);

    // Straight upper block (inside apron area)
    newBoards.push({
      id: upperId,
      name: upperName,
      parentId: legSubGroupId,
      size: [legSize, hUpper, legSize],
      position: [ld.x + offset[0], yUpper + offset[1], ld.z + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: [],
      edgeJoints: []
    });

    // Tapered lower shaft (sloping to floor)
    newBoards.push({
      id: lowerId,
      name: lowerName,
      parentId: legSubGroupId,
      size: [legSize, hLower, legSize],
      position: [ld.x + offset[0], yLower + offset[1], ld.z + offset[2]],
      material: defaultMaterial,
      joint: 'None',
      shape: legTaperAngle > 0 ? 'taper' : 'box',
      taper: legTaperAngle > 0 ? ld.taper : undefined,
      operations: [],
      edgeJoints: []
    });

    // Automatically establish a rigid Glue constraint linking upper and lower pieces as one physical unit
    const cId = `glue_leg_split_${baseId}_${constraintCounter++}`;
    newConstraints[cId] = {
      type: 'Glue',
      boardAId: lowerId.toString(),
      boardBId: upperId.toString(),
      offset: [0, H / 2, 0], // exact Y center offset difference
      enabled: true
    };
  });

  // 2. Aprons
  const apronsGroupId = groupId + '_Aprons';
  newGroups[apronsGroupId] = {
    parentId: groupId,
    visible: true,
    isExpanded: true,
    name: 'Aprons'
  };

  const apronY = H - apronHeight / 2;

  // Front & Back Aprons (along X)
  const apronXSize = W - 2 * legSize;
  const frontApronZ = D - apronInset - apronThickness / 2;
  const backApronZ = apronInset + apronThickness / 2;

  const apronFrontName = 'Apron Front';
  newBoards.push({
    id: getNextId(apronFrontName),
    name: apronFrontName,
    parentId: apronsGroupId,
    size: [apronXSize, apronHeight, apronThickness],
    position: [W / 2 + offset[0], apronY + offset[1], frontApronZ + offset[2]],
    material: defaultMaterial,
    joint: 'None',
    shape: 'box',
    operations: [],
    edgeJoints: []
  });

  const apronBackName = 'Apron Back';
  newBoards.push({
    id: getNextId(apronBackName),
    name: apronBackName,
    parentId: apronsGroupId,
    size: [apronXSize, apronHeight, apronThickness],
    position: [W / 2 + offset[0], apronY + offset[1], backApronZ + offset[2]],
    material: defaultMaterial,
    joint: 'None',
    shape: 'box',
    operations: [],
    edgeJoints: []
  });

  // Left & Right Aprons (along Z)
  const apronZSize = D - 2 * legSize;
  const leftApronX = apronInset + apronThickness / 2;
  const rightApronX = W - apronInset - apronThickness / 2;

  const apronLeftName = 'Apron Left';
  newBoards.push({
    id: getNextId(apronLeftName),
    name: apronLeftName,
    parentId: apronsGroupId,
    size: [apronThickness, apronHeight, apronZSize],
    position: [leftApronX + offset[0], apronY + offset[1], D / 2 + offset[2]],
    material: defaultMaterial,
    joint: 'None',
    shape: 'box',
    operations: [],
    edgeJoints: []
  });

  const apronRightName = 'Apron Right';
  newBoards.push({
    id: getNextId(apronRightName),
    name: apronRightName,
    parentId: apronsGroupId,
    size: [apronThickness, apronHeight, apronZSize],
    position: [rightApronX + offset[0], apronY + offset[1], D / 2 + offset[2]],
    material: defaultMaterial,
    joint: 'None',
    shape: 'box',
    operations: [],
    edgeJoints: []
  });

  // 3. Stringers (front-to-back vertical plates connecting Front and Back aprons)
  const frontInnerZ = frontApronZ - apronThickness / 2;
  const backInnerZ = backApronZ + apronThickness / 2;
  const stringerLength = frontInnerZ - backInnerZ;
  const stringerZ = (frontInnerZ + backInnerZ) / 2;
  const stringerY = H - stringerWidth / 2;

  // Calculate stringers count dynamically
  let numStringers = 0;
  if (W > 36) {
    numStringers = Math.max(1, Math.floor((W - 24) / 12));
  }

  if (numStringers > 0) {
    const stringersGroupId = groupId + '_Stringers';
    newGroups[stringersGroupId] = {
      parentId: groupId,
      visible: true,
      isExpanded: true,
      name: 'Stringers'
    };

    const openingWidth = W - 2 * legSize;
    const spacing = openingWidth / (numStringers + 1);
    for (let i = 0; i < numStringers; i++) {
      const stringerX = legSize + spacing * (i + 1);
      const stringerName = `Stringer ${i + 1}`;
      newBoards.push({
        id: getNextId(stringerName),
        name: stringerName,
        parentId: stringersGroupId,
        size: [stringerThickness, stringerWidth, stringerLength],
        position: [stringerX + offset[0], stringerY + offset[1], stringerZ + offset[2]],
        material: defaultMaterial,
        joint: 'None',
        shape: 'box',
        operations: [],
        edgeJoints: []
      });
    }
  }

  // 4. Loose Tenons (Dominoes) or Dowels joints
  if (apronJoint === 'loose-tenon' || apronJoint === 'dowels') {
    const isDomino = apronJoint === 'loose-tenon';
    const jWidth = isDomino ? 0.3125 : 0.375; // 5/16" (8mm) domino thickness / 3/8" dowel diameter
    const jLength = isDomino ? 1.25 : 0.375; // 1-1/4" domino width / 3/8" dowel diameter
    const jDepth = 1.0;

    const offsetsY = [-apronHeight / 4, apronHeight / 4];
    const stringerOffsetsY = [-stringerWidth / 4, stringerWidth / 4];

    const leg1 = newBoards.find(b => b.name === 'Leg 1 Upper');
    const leg2 = newBoards.find(b => b.name === 'Leg 2 Upper');
    const leg3 = newBoards.find(b => b.name === 'Leg 3 Upper');
    const leg4 = newBoards.find(b => b.name === 'Leg 4 Upper');

    const apronFront = newBoards.find(b => b.name === 'Apron Front');
    const apronBack = newBoards.find(b => b.name === 'Apron Back');
    const apronLeft = newBoards.find(b => b.name === 'Apron Left');
    const apronRight = newBoards.find(b => b.name === 'Apron Right');

    const addJointPair = (boardA, faceA, offsetA, boardB, faceB, offsetB, isStringer = false) => {
      const currentOffsetsY = isStringer ? stringerOffsetsY : offsetsY;
      const depthA = isStringer ? 0.5 : jDepth;
      const depthB = isStringer ? 0.5 : jDepth;
      currentOffsetsY.forEach((yOff, idx) => {
        // Board A mortise/hole
        boardA.operations.push({
          id: baseId + 10000 + boardA.id + idx + Math.random(),
          type: isDomino ? 'dado' : 'hole',
          face: faceA,
          direction: 'y',
          width: jWidth,
          radius: jWidth / 2, // 3/16" radius for 3/8" dowel
          depth: depthA,
          offset: offsetA,
          length: jLength,
          lengthOffset: yOff,
          source: 'procedural-joint'
        });

        // Board B mortise/hole
        boardB.operations.push({
          id: baseId + 20000 + boardB.id + idx + Math.random(),
          type: isDomino ? 'dado' : 'hole',
          face: faceB,
          direction: 'y',
          width: jWidth,
          radius: jWidth / 2,
          depth: depthB,
          offset: offsetB,
          length: jLength,
          lengthOffset: yOff,
          source: 'procedural-joint'
        });
      });
    };

    // Apron Front to Legs
    if (apronFront) {
      if (leg1) addJointPair(apronFront, 'left', 0, leg1, 'right', frontApronZ - legDefs[0].z);
      if (leg2) addJointPair(apronFront, 'right', 0, leg2, 'left', frontApronZ - legDefs[1].z);
    }

    // Apron Back to Legs
    if (apronBack) {
      if (leg3) addJointPair(apronBack, 'left', 0, leg3, 'right', backApronZ - legDefs[2].z);
      if (leg4) addJointPair(apronBack, 'right', 0, leg4, 'left', backApronZ - legDefs[3].z);
    }

    // Apron Left to Legs
    if (apronLeft) {
      if (leg1) addJointPair(apronLeft, 'front', 0, leg1, 'back', leftApronX - legDefs[0].x);
      if (leg3) addJointPair(apronLeft, 'back', 0, leg3, 'front', leftApronX - legDefs[2].x);
    }

    // Apron Right to Legs
    if (apronRight) {
      if (leg2) addJointPair(apronRight, 'front', 0, leg2, 'back', rightApronX - legDefs[1].x);
      if (leg4) addJointPair(apronRight, 'back', 0, leg4, 'front', rightApronX - legDefs[3].x);
    }

    // Stringer connections to Front/Back aprons
    const stringerBoards = newBoards.filter(b => b.name.startsWith('Stringer '));
    stringerBoards.forEach(stringer => {
      if (apronFront) {
        const frontOffset = stringer.position[0] - apronFront.position[0];
        addJointPair(stringer, 'front', 0, apronFront, 'back', frontOffset, true);
      }
      if (apronBack) {
        const backOffset = stringer.position[0] - apronBack.position[0];
        addJointPair(stringer, 'back', 0, apronBack, 'front', backOffset, true);
      }
    });
  }

  // 5. Pocket Hole operations (End-connection pocket holes, drilled only if apronJoint is 'pocket-hole')
  if (apronJoint === 'pocket-hole') {
    const apronFront = newBoards.find(b => b.name === 'Apron Front');
    const apronBack = newBoards.find(b => b.name === 'Apron Back');
    const apronLeft = newBoards.find(b => b.name === 'Apron Left');
    const apronRight = newBoards.find(b => b.name === 'Apron Right');
    const stringerBoards = newBoards.filter(b => b.name.startsWith('Stringer '));
    if (apronFront) {
      apronFront.operations.push({
        id: baseId + 40000 + apronFront.id,
        type: 'pocket-holes',
        face: 'back',
        edge: 'left',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
      apronFront.operations.push({
        id: baseId + 41000 + apronFront.id,
        type: 'pocket-holes',
        face: 'back',
        edge: 'right',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
    }
    if (apronBack) {
      apronBack.operations.push({
        id: baseId + 40000 + apronBack.id,
        type: 'pocket-holes',
        face: 'front',
        edge: 'left',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
      apronBack.operations.push({
        id: baseId + 41000 + apronBack.id,
        type: 'pocket-holes',
        face: 'front',
        edge: 'right',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
    }
    if (apronLeft) {
      apronLeft.operations.push({
        id: baseId + 40000 + apronLeft.id,
        type: 'pocket-holes',
        face: 'right',
        edge: 'front',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
      apronLeft.operations.push({
        id: baseId + 41000 + apronLeft.id,
        type: 'pocket-holes',
        face: 'right',
        edge: 'back',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
    }
    if (apronRight) {
      apronRight.operations.push({
        id: baseId + 40000 + apronRight.id,
        type: 'pocket-holes',
        face: 'left',
        edge: 'front',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
      apronRight.operations.push({
        id: baseId + 41000 + apronRight.id,
        type: 'pocket-holes',
        face: 'left',
        edge: 'back',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
    }
    stringerBoards.forEach(stringer => {
      stringer.operations.push({
        id: baseId + 40000 + stringer.id,
        type: 'pocket-holes',
        face: 'left',
        edge: 'front',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
      stringer.operations.push({
        id: baseId + 41000 + stringer.id,
        type: 'pocket-holes',
        face: 'left',
        edge: 'back',
        count: 2,
        spacing: 'auto',
        source: 'procedural-joint'
      });
    });
  }

  return {
    groupId,
    savedParams,
    newBoards,
    newConstraints,
    newGroups,
    isEditing
  };
}
