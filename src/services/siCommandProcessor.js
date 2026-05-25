import * as THREE from 'three';
import { computeWorldAABB, collectChildBoards } from '../utils/sceneGraph';
import { propagateMove } from '../utils/constraintSolver';
import { calculateProceduralBoxWalls } from '../utils/procedural';
import { WOOD_CATALOGUE, PAINT_PALETTE } from '../utils/materialCatalogue';

export function processSiCommand(text, set, get) {
  const {
    pushHistory,
    selectedItemIds,
    setBoards,
    setGroups,
    setSelectedItemIds,
    boards,
    groups,
    constraints,
    defaultMaterial,
    globalBounds,
    setChatMessages,
    setShowAiHelpDialog
  } = get();
  pushHistory();
  const lower = text.toLowerCase();
  let reply = "I've processed your request.";
  let updated = false;

  // ── Help / Cheat Sheet ───────────────────────────────────────────────
  if (/(help|what can you do|cheat sheet|command|syntax|\bhow \b)/.test(lower)) {
    setShowAiHelpDialog(true);
    reply = "I've popped open the command cheat sheet for you!";
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: reply
      }]);
    }, 300);
    return;
  }

  // Parses plain decimals, pure fractions (3/8), and mixed numbers (1 3/8)
  const parseMeasurement = str => {
    if (!str) return null;
    const mixed = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      const whole = parseInt(mixed[1]);
      const frac = parseInt(mixed[2]) / parseInt(mixed[3]);
      return whole + (whole < 0 ? -frac : frac);
    }
    const frac = str.match(/^(-?)(\d+)\/(\d+)$/);
    if (frac) return (frac[1] === '-' ? -1 : 1) * parseInt(frac[2]) / parseInt(frac[3]);
    const v = parseFloat(str);
    return isNaN(v) ? null : v;
  };

  // Finds first measurement token (decimal, fraction, or mixed number) in the lowercased text
  const extractMeasurement = s => {
    const m = s.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?\d*\.?\d+)/);
    return m ? parseMeasurement(m[1]) : null;
  };

  // ── Material change ──────────────────────────────────────────────────
  const allWoods = Object.entries(WOOD_CATALOGUE).map(([id, spec]) => ({
    id,
    label: spec.label.toLowerCase(),
    type: 'wood'
  }));
  const allPaints = PAINT_PALETTE.map(({
    hex,
    label
  }) => ({
    hex,
    label: label.toLowerCase(),
    type: 'color'
  }));
  const allMats = [...allWoods, ...allPaints].sort((a, b) => b.label.length - a.label.length);
  const matchedMat = allMats.find(m => lower.includes(m.label));
  if (matchedMat) {
    const matDesc = matchedMat.type === 'wood' ? {
      type: 'wood',
      id: matchedMat.id
    } : {
      type: 'color',
      hex: matchedMat.hex
    };
    setBoards(prev => prev.map(b => selectedItemIds.length > 0 ? selectedItemIds.includes(b.id.toString()) ? {
      ...b,
      material: matDesc
    } : b : {
      ...b,
      material: matDesc
    }));
    const displayLabel = matchedMat.label.replace(/\b\w/g, l => l.toUpperCase());
    reply = selectedItemIds.length > 0 ? `Changed selected to ${displayLabel}.` : `Changed all to ${displayLabel}.`;
    updated = true;

    // ── Move / Nudge (color-based or directional) ────────────────────────
  } else if ((lower.includes('nudge') || lower.includes('move')) && selectedItemIds.length > 0) {
    // Determine axis from color names or direction words
    let axis = 1; // default: Y (green/up)
    if (lower.includes('red') || lower.includes('left') || lower.includes('right') || /\bx\b/.test(lower)) axis = 0;
    if (lower.includes('blue') || lower.includes('forward') || lower.includes('back') || /\bz\b/.test(lower)) axis = 2;
    if (lower.includes('green') || lower.includes('up') || lower.includes('down') || /\by\b/.test(lower)) axis = 1;
    let val = 1;
    if (lower.includes('down') || lower.includes('left') || lower.includes('back')) val = -1;
    const match = lower.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?[\d.]+)/);
    if (match) val = parseMeasurement(match[1]) * (val < 0 ? -1 : 1);
    const deltaVec = [0, 0, 0];
    deltaVec[axis] = val;
    const moveMap = propagateMove(selectedItemIds, deltaVec, constraints);
    setBoards(prev => prev.map(b => {
      const d = moveMap.get(b.id.toString());
      if (d) {
        return {
          ...b,
          position: [b.position[0] + d[0], b.position[1] + d[1], b.position[2] + d[2]]
        };
      }
      return b;
    }));
    const axisName = ['red (X)', 'green (Y)', 'blue (Z)'][axis];
    reply = `Moved ${moveMap.size} component(s) by ${val}" along ${axisName}.`;
    updated = true;

    // ── Tapered leg — add / convert / partial ──────────────────────────
  } else if ((lower.includes('taper') || lower.includes('tapered')) && (lower.includes('leg') || lower.includes('add') || lower.includes('make') || lower.includes('convert'))) {
    const angleMatch = lower.match(/(\d*\.?\d+)\s*(?:deg|°|degree)/i);
    const az = angleMatch ? parseFloat(angleMatch[1]) : 2;
    const ax = /dual|both|side/.test(lower) ? az : 0;
    if (/halfway|half way|partial|lower half|bottom half/.test(lower)) {
      // Partial taper: box upper + tapered lower, glued together
      const totalH = 30,
        t = 1.5,
        halfH = totalH / 2;
      const newGroupId = 'Tapered Leg ' + Math.floor(Math.random() * 1000);
      const upperId = Date.now(),
        lowerId = upperId + 1;
      setGroups(prev => ({
        ...prev,
        [newGroupId]: {
          parentId: 'Workspace',
          isExpanded: true,
          visible: true
        }
      }));
      const upperBoard = {
        id: upperId,
        name: 'Leg Upper',
        parentId: newGroupId,
        size: [t, halfH, t],
        position: [0, halfH + halfH / 2, 0],
        material: defaultMaterial,
        joint: 'None',
        operations: []
      };
      const lowerBoard = {
        id: lowerId,
        name: 'Leg Lower',
        parentId: newGroupId,
        shape: 'taper',
        taper: {
          angleLeft: ax,
          angleRight: ax,
          angleFront: az,
          angleBack: az
        },
        size: [t, halfH, t],
        position: [0, halfH / 2, 0],
        material: defaultMaterial,
        joint: 'None',
        operations: [],
        note: 'One piece; taper lower ' + halfH + '" only.'
      };
      const glueId = (Date.now() + 2).toString();
      setBoards(prev => [...prev, upperBoard, lowerBoard]);
      get().setConstraints(prev => ({
        ...prev,
        [glueId]: {
          type: 'Glue',
          boardAId: upperId.toString(),
          boardBId: lowerId.toString(),
          offset: [0, halfH, 0],
          enabled: true
        }
      }));
      setSelectedItemIds([newGroupId]);
      reply = 'Partial-tapered leg: ' + halfH + '" straight upper + ' + halfH + '" tapered lower (' + az + '° back), glued as one unit.';
      updated = true;
    } else if (/make|convert|change/.test(lower) && selectedItemIds.length > 0) {
      setBoards(prev => prev.map(b => selectedItemIds.includes(b.id.toString()) ? {
        ...b,
        shape: 'taper',
        taper: {
          angleLeft: ax,
          angleRight: ax,
          angleFront: az,
          angleBack: az
        }
      } : b));
      reply = 'Converted to tapered — back ' + az + '°' + (ax > 0 ? ', side ' + ax + '°' : '') + '.';
      updated = true;
    } else {
      const newId = Date.now();
      setBoards(prev => [...prev, {
        id: newId,
        name: 'Tapered Leg',
        parentId: 'Workspace',
        shape: 'taper',
        taper: {
          angleLeft: ax,
          angleRight: ax,
          angleFront: az,
          angleBack: az
        },
        size: [1.5, 30, 1.5],
        position: [0, 15, 0],
        material: defaultMaterial,
        joint: 'None',
        operations: []
      }]);
      setSelectedItemIds([newId.toString()]);
      reply = 'Added 1.5×30×1.5" tapered leg — back ' + az + '°' + (ax > 0 ? ', side ' + ax + '°' : '') + '. Bounding box unchanged.';
      updated = true;
    }

    // ── Add leg ──────────────────────────────────────────────────────────
    // ── Add/drill hole operation on selected board ───────────────────────
  } else if (selectedItemIds.length > 0 && /(drill|bore|add).*(hole|pocket)|(hole|pocket).*(drill|bore|add)/i.test(lower)) {
    const r = extractMeasurement(lower) ?? 1;
    let axis = 'y';
    if (/(through x|along x|\bx axis\b)/.test(lower)) axis = 'x';else if (/(through z|along z|\bz axis\b)/.test(lower)) axis = 'z';
    const op = {
      id: Date.now(),
      type: 'hole',
      radius: Math.abs(r),
      offsetX: 0,
      offsetY: 0,
      axis
    };
    setBoards(prev => prev.map(b => selectedItemIds.includes(b.id.toString()) ? {
      ...b,
      operations: [...(b.operations || []), op]
    } : b));
    reply = `Added ${r}" radius hole (${axis}-axis) to ${selectedItemIds.length} board(s). Adjust offset in the Inspector.`;
    updated = true;

    // ── Add cove operation on selected board ──────────────────────────────
  } else if (selectedItemIds.length > 0 && /(add|cut|make).*(cove|hollow)|(cove|hollow).*(add|cut|make)/i.test(lower)) {
    const depth = extractMeasurement(lower) ?? 1;
    let edge = 'top';
    if (/bottom/.test(lower)) edge = 'bottom';else if (/left/.test(lower)) edge = 'left';else if (/right/.test(lower)) edge = 'right';
    let axis = 'y';
    if (/(\bx axis\b|along x)/.test(lower)) axis = 'x';else if (/(\bz axis\b|along z)/.test(lower)) axis = 'z';
    const op = {
      id: Date.now(),
      type: 'cove',
      edge,
      depth: Math.abs(depth),
      axis
    };
    setBoards(prev => prev.map(b => selectedItemIds.includes(b.id.toString()) ? {
      ...b,
      operations: [...(b.operations || []), op]
    } : b));
    reply = `Added ${depth}" ${edge}-edge cove to ${selectedItemIds.length} board(s).`;
    updated = true;

    // ── Add arc operation on selected board ───────────────────────────────
  } else if (selectedItemIds.length > 0 && /(add|make|cut).*(arc|curve|cutout)|(arc|curve|cutout).*(add|make|cut)/i.test(lower)) {
    const angleMatch = lower.match(/(\d+)\s*(?:to|-|through)\s*(\d+)/);
    const startAngle = angleMatch ? parseInt(angleMatch[1]) : 0;
    const endAngle = angleMatch ? parseInt(angleMatch[2]) : 90;
    let axis = 'y';
    if (/(\bx axis\b|along x)/.test(lower)) axis = 'x';else if (/(\bz axis\b|along z)/.test(lower)) axis = 'z';
    const op = {
      id: Date.now(),
      type: 'arc',
      startAngle,
      endAngle,
      innerRadius: 0,
      axis
    };
    setBoards(prev => prev.map(b => selectedItemIds.includes(b.id.toString()) ? {
      ...b,
      operations: [...(b.operations || []), op]
    } : b));
    reply = `Added arc modifier (${startAngle}°–${endAngle}°, ${axis}-axis) to ${selectedItemIds.length} board(s).`;
    updated = true;
  } else if (lower.includes('add') && lower.includes('leg')) {
    const newId = Date.now();
    setBoards(prev => [...prev, {
      id: newId,
      name: 'New Leg',
      parentId: 'Workspace',
      size: [1.5, 12, 1.5],
      position: [0, 6, 0],
      material: defaultMaterial,
      joint: 'Butt 1',
      operations: []
    }]);
    setSelectedItemIds([newId.toString()]);
    reply = `Added a new 1.5×12×1.5 leg at origin, sitting on floor.`;
    updated = true;

    // ── Add top ──────────────────────────────────────────────────────────
  } else if (lower.includes('top') && (lower.includes('add') || lower.includes('put'))) {
    let targets = [];
    if (selectedItemIds.length === 0 || selectedItemIds.includes('Workspace')) {
      targets = boards;
    } else {
      const validBoards = new Set();
      const traverse = pId => {
        boards.filter(b => b.parentId === pId).forEach(b => validBoards.add(b));
        Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
      };
      selectedItemIds.forEach(id => {
        if (Object.keys(groups).includes(id)) {
          traverse(id);
        } else {
          const b = boards.find(x => x.id.toString() === id);
          if (b) validBoards.add(b);
        }
      });
      targets = Array.from(validBoards);
    }
    if (targets.length === 0) {
      reply = "I need some existing geometry to calculate where a top should go!";
    } else {
      const aabb = computeWorldAABB(targets);
      let newWidth = Math.abs(aabb.maxX - aabb.minX);
      let newDepth = Math.abs(aabb.maxZ - aabb.minZ);
      const thickness = 0.75;
      if (newWidth < 3) newWidth = Math.max(newWidth, 24);
      if (newDepth < 3) newDepth = Math.max(newDepth, 16);
      const newX = (aabb.minX + aabb.maxX) / 2;
      const newZ = (aabb.minZ + aabb.maxZ) / 2;
      const newY = aabb.maxY + thickness / 2;
      const newId = Date.now();
      const pId = targets[0]?.parentId || 'Workspace';
      setBoards(prev => [...prev, {
        id: newId,
        name: 'Table Top',
        parentId: pId,
        size: [newWidth, thickness, newDepth],
        position: [newX, newY, newZ],
        material: defaultMaterial,
        joint: 'None',
        operations: []
      }]);
      setSelectedItemIds([newId.toString()]);
      reply = `Generated top at Y=${newY.toFixed(2)}".`;
      updated = true;
    }

    // ── Build cube ───────────────────────────────────────────────────────
    // All 6 panels are identical 12×12×0.75".
    // Outer extent is 12" in every axis; 3 panels overlap at every corner.
  } else if (/(build|create|make).+cube/i.test(lower)) {
    const side = 12,
      t = 0.75;
    const half = side / 2;
    const newGroupId = 'Cube ' + Math.floor(Math.random() * 1000);
    setGroups(prev => ({
      ...prev,
      [newGroupId]: {
        parentId: 'Workspace',
        isExpanded: true,
        visible: true
      }
    }));

    // Panel positions so outer extents are 0→12 in Y, -6→+6 in X and Z
    const panelDefs = [{
      name: 'Bottom',
      size: [side, t, side],
      position: [0, t / 2, 0]
    }, {
      name: 'Top',
      size: [side, t, side],
      position: [0, side - t / 2, 0]
    }, {
      name: 'Front',
      size: [side, side, t],
      position: [0, half, half - t / 2]
    }, {
      name: 'Back',
      size: [side, side, t],
      position: [0, half, -(half - t / 2)]
    }, {
      name: 'Left',
      size: [t, side, side],
      position: [-(half - t / 2), half, 0]
    }, {
      name: 'Right',
      size: [t, side, side],
      position: [half - t / 2, half, 0]
    }];
    const cubeBoards = panelDefs.map((bd, i) => ({
      id: Date.now() + i,
      name: bd.name,
      size: bd.size,
      position: bd.position,
      parentId: newGroupId,
      material: defaultMaterial,
      joint: 'None',
      shape: 'box',
      operations: []
    }));
    setBoards(prev => [...prev, ...cubeBoards]);
    setSelectedItemIds([newGroupId]);
    reply = `Built a 12" cube — 6 panels, each 12×12×0.75", overlapping at every corner.`;
    updated = true;

    // ── Build box ────────────────────────────────────────────────────────
  } else if (/(build|create|make).+box/i.test(lower)) {
    let newWidth = 24,
      newDepth = 16;
    const thickness = 0.75;
    let newHeight = 12;
    let newX = 0,
      newZ = 0,
      baseY = 0;
    const hMatch = lower.match(/(\d*\.?\d+)\s*(?:inch|in|"|'')\s*(tall|high|deep|box)/i);
    if (hMatch && hMatch[1]) {
      newHeight = parseFloat(hMatch[1]);
    }
    if (/(bounding box|workspace box|workspace bounds|global bounds)/.test(lower) && globalBounds && globalBounds.enabled) {
      newWidth = globalBounds.x;
      newDepth = globalBounds.z;
    }
    const proceduralMeta = {
      type: 'procedural-box',
      w: newWidth,
      h: newHeight,
      d: newDepth,
      t: thickness,
      joint: 'butt-A'
    };
    const newGroupId = 'Assembly ' + Math.floor(Math.random() * 1000);
    setGroups(prev => ({
      ...prev,
      [newGroupId]: {
        parentId: 'Workspace',
        isExpanded: true,
        visible: true,
        meta: proceduralMeta
      }
    }));
    const wallsData = calculateProceduralBoxWalls(proceduralMeta);
    const newBoards = wallsData.map((wd, i) => ({
      id: Date.now() + i,
      name: `${wd.role} Wall`,
      parentId: newGroupId,
      size: wd.size,
      position: [wd.position[0] + newX, wd.position[1] + baseY, wd.position[2] + newZ],
      material: defaultMaterial,
      joint: 'None',
      operations: []
    }));
    setBoards(prev => [...prev, ...newBoards]);
    setSelectedItemIds([newGroupId]);
    reply = `Generated ${newHeight}" box (${newWidth}×${newDepth}) sitting on floor.`;
    updated = true;

    // ── Resize (cut/add/length/width/thickness) ──────────────────────────
  } else if (/(cut|add|trim|extend|shave|chop|short|shorter|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease|wider|thicker|longer|tall|taller)/.test(lower)) {
    const val = extractMeasurement(lower);
    if (val !== null) {
      // "taller" / "shorter" = world-space height (Y axis, index 1) — not sorted dims
      const isTall = /(taller|tall)/.test(lower) && !/(length|longer|long)/.test(lower);
      const isShorter = /\bshorter\b/.test(lower) && !/(length|longer|long)/.test(lower);
      const isNegative = isShorter || /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
      const delta = isNegative ? -val : val;

      // "longer" / "length" / "short" = sorted longest dim; "taller/shorter" handled above
      const isLength = !isTall && !isShorter && /(long|length|longer)/.test(lower);
      const isWidth = /(wide|narrow|width|wider)/.test(lower);
      const isThickness = /(thick|thin|thicker|thinner|thickness)/.test(lower);
      let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : [];
      if (targetedBoards.length === 0) {
        targetedBoards = boards.filter(b => lower.includes(b.name.toLowerCase()));
      }
      if (targetedBoards.length > 0) {
        const targetIds = targetedBoards.map(b => b.id.toString());
        setBoards(prev => prev.map(b => {
          if (targetIds.includes(b.id.toString())) {
            let dims = [{
              idx: 0,
              val: b.size[0]
            }, {
              idx: 1,
              val: b.size[1]
            }, {
              idx: 2,
              val: b.size[2]
            }];
            dims.sort((a, c) => c.val - a.val);
            let targetIndex;
            if (isTall || isShorter) targetIndex = 1; // world Y = up/down
            else if (isLength) targetIndex = dims[0].idx; // sorted longest
            else if (isWidth) targetIndex = dims[1].idx; // sorted middle
            else if (isThickness) targetIndex = dims[2].idx; // sorted smallest
            else {
              // Axis-color / direction words
              if (/(right|left)/.test(lower) || lower.includes('red') || /\bx\b/.test(lower)) targetIndex = 0;else if (/(up|down|top|bottom)/.test(lower) || lower.includes('green') || /\by\b/.test(lower)) targetIndex = 1;else if (/(front|back)/.test(lower) || lower.includes('blue') || /\bz\b/.test(lower)) targetIndex = 2;else targetIndex = dims[2].idx; // default: thickness
            }
            let newSize = [...b.size];
            const actualDelta = Math.max(0.1 - newSize[targetIndex], delta);
            newSize[targetIndex] += actualDelta;
            return {
              ...b,
              size: newSize
            };
          }
          return b;
        }));
        const dimLabel = isTall || isShorter ? 'height (Y)' : isLength ? 'length' : isWidth ? 'width' : 'thickness';
        reply = `Adjusted ${dimLabel} of ${targetIds.length} component(s) by ${delta > 0 ? '+' : ''}${delta}".`;
        updated = true;
      } else {
        reply = "I don't know which board to resize! Please select a component or say its name.";
        updated = true;
      }
    } else {
      reply = "I didn't detect a number! Try 'make this 1 inch wider'.";
      updated = true;
    }
    // ── Rotate ───────────────────────────────────────────────────────────
  } else if (/(rotat|spin|turn|flip|orient)/.test(lower)) {
    const degrees = extractMeasurement(lower);
    if (degrees !== null) {
      // Axis detection: color names, axis letters, or semantic words
      let axis = 1; // default: Y (up/down spin is most common)
      if (/(right|left|red|\bx\b)/.test(lower)) axis = 0;else if (/(up|down|green|\by\b)/.test(lower)) axis = 1;else if (/(front|back|blue|\bz\b)/.test(lower)) axis = 2;
      let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : boards.filter(b => lower.includes(b.name.toLowerCase()));
      if (targetedBoards.length > 0) {
        const targetIds = targetedBoards.map(b => b.id.toString());
        const radians = degrees * Math.PI / 180;
        pushHistory();
        setBoards(boards.map(b => {
          if (!targetIds.includes(b.id.toString())) return b;
          const ori = [...(b.orientation || [0, 0, 0])];
          // 'flip' sets absolute 180°; other commands are additive
          if (/flip/.test(lower)) {
            ori[axis] = ori[axis] === 0 ? Math.PI : 0;
          } else {
            ori[axis] = ori[axis] + radians;
          }
          return {
            ...b,
            orientation: ori
          };
        }));
        const axisLabel = ['X (Red)', 'Y (Green)', 'Z (Blue)'][axis];
        reply = `Rotated ${targetIds.length} board(s) ${/flip/.test(lower) ? '180° (flipped)' : `${degrees}°`} on ${axisLabel}.`;
        updated = true;
      } else {
        reply = "Select a board first, or name it — e.g. 'rotate Leg A 90 on Y'.";
        updated = true;
      }
    } else if (/reset/.test(lower)) {
      // "reset rotation"
      const targetIds = selectedItemIds;
      if (targetIds.length > 0) {
        pushHistory();
        setBoards(boards.map(b => targetIds.includes(b.id.toString()) ? {
          ...b,
          orientation: [0, 0, 0]
        } : b));
        reply = `Rotation reset to 0° on ${targetIds.length} board(s).`;
        updated = true;
      }
    } else {
      reply = "I didn't detect an angle! Try 'rotate 90 on Y' or 'rotate 45 on red'.";
      updated = true;
    }
  }
  if (!updated) {
    reply = "I need clearer instructions. Try 'move this 3 along red' or 'make this 1 inch wider'.";
  }
  setTimeout(() => {
    get().setChatMessages(prev => [...prev, {
      role: 'ai',
      text: reply
    }]);
  }, 500);
}
