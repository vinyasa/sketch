import { collectChildBoards, computeWorldAABB } from './sceneGraph';

export function generateSmartMeasurementsHelper(groupId, boards, groups) {
  const group = groups[groupId];
  if (!group) return [];

  const measurements = [];
  const builderType = group.meta?.builder; // 'shelving' or 'drawerStack' or 'cabinet' or 'box'
  const isCarcass = builderType === 'cabinet' || builderType === 'box';

  let carcassGroupId = null;
  let carcassGroup = null;

  if (isCarcass) {
    carcassGroupId = groupId;
    carcassGroup = group;
  } else {
    // Resolve cabinetGroupId or boxGroupId
    let parentId = group.parentId;
    let parentGroup = parentId ? groups[parentId] : null;
    
    // If the parent is a face frame or drawer stack, go up one more level
    if (parentGroup && (parentGroup.meta?.builder === 'face-frame' || parentGroup.meta?.builder === 'drawerStack')) {
      parentId = parentGroup.parentId;
      parentGroup = parentId ? groups[parentId] : null;
    }

    if (parentGroup && (parentGroup.meta?.builder === 'cabinet' || parentGroup.meta?.builder === 'box')) {
      carcassGroupId = parentId;
      carcassGroup = parentGroup;
    }
  }

  if (carcassGroupId && carcassGroup) {
    // ── CASE A: Embedded in or is a Cabinet or Box ──
    const parentBoards = boards.filter(b => b.parentId === carcassGroupId);
    const leftSide = parentBoards.find(b => b.name === 'Left Side');
    const rightSide = parentBoards.find(b => b.name === 'Right Side');
    const topPanel = parentBoards.find(b => b.name === 'Top');
    const bottomPanel = parentBoards.find(b => b.name === 'Bottom');

    if (leftSide && rightSide && topPanel && bottomPanel) {
      const parentParams = carcassGroup.meta?.params || {};
      const H = parseFloat(parentParams.height || 30);
      const D = parseFloat(parentParams.depth || 14);
      const tSide = parseFloat(parentParams.thicknessSide || 0.75);
      const tTB = parseFloat(parentParams.thicknessTB || 0.75);
      const tBack = parseFloat(parentParams.thicknessBack || 0.25);
      const backStyle = parentParams.backStyle || 'flat';
      const coreD = carcassGroup.meta?.builder === 'box'
        ? D - parseFloat(parentParams.thicknessFront || 0.5) - tBack
        : (backStyle === 'flat' ? D - tBack : D);

      // ── IF SELECTED GROUP IS THE CARCASS ITSELF (Cabinet / Box) ──
      if (isCarcass) {
        // 1. Overall Height (Left side)
        measurements.push({
          id: `smart_height_${groupId}`,
          pointA: { boardId: leftSide.id.toString(), localOffset: [-tSide / 2, -H / 2, coreD / 2] },
          pointB: { boardId: leftSide.id.toString(), localOffset: [-tSide / 2, H / 2, coreD / 2] },
          color: '#34c759', // Green for outer bounds
          offset: 3.5,
          offsetDir: [-1, 0, 0] // to the left
        });

        // 2. Overall Width (Across front top)
        measurements.push({
          id: `smart_width_${groupId}`,
          pointA: { boardId: leftSide.id.toString(), localOffset: [-tSide / 2, H / 2, coreD / 2] },
          pointB: { boardId: rightSide.id.toString(), localOffset: [tSide / 2, H / 2, coreD / 2] },
          color: '#34c759',
          offset: 3.5,
          offsetDir: [0, 1, 0] // upwards
        });

        // 3. Overall Depth (Along left top edge)
        measurements.push({
          id: `smart_depth_${groupId}`,
          pointA: { boardId: leftSide.id.toString(), localOffset: [-tSide / 2, H / 2, -coreD / 2] },
          pointB: { boardId: leftSide.id.toString(), localOffset: [-tSide / 2, H / 2, coreD / 2] },
          color: '#34c759',
          offset: 4.5,
          offsetDir: [-1, 0, 0] // to the left
        });
      }

      // ── IF SELECTED GROUP IS THE EMBEDDED ASSEMBLY (Shelving / Drawers) ──
      if (!isCarcass) {
        // ── Process Shelving ──
        if (builderType === 'shelving') {
        const shelves = boards
          .filter(b => b.parentId === groupId)
          .sort((a, b) => b.position[1] - a.position[1]); // top to bottom

        if (shelves.length > 0) {
          const tShelf = shelves[0].size[1];
          const DShelf = shelves[0].size[2];

          // 1. Spacing top panel to first shelf
          measurements.push({
            id: `smart_space_top_${groupId}`,
            pointA: { boardId: topPanel.id.toString(), localOffset: [0, -tTB / 2, coreD / 2] },
            pointB: { boardId: shelves[0].id.toString(), localOffset: [0, tShelf / 2, DShelf / 2] },
            color: '#bc8a5f', // Warm wood for gaps
            offset: 2.0,
            offsetDir: [0, 0, 1] // forward
          });

          // 2. Spacing between consecutive shelves
          for (let i = 0; i < shelves.length - 1; i++) {
            measurements.push({
              id: `smart_space_mid_${i}_${groupId}`,
              pointA: { boardId: shelves[i].id.toString(), localOffset: [0, -tShelf / 2, DShelf / 2] },
              pointB: { boardId: shelves[i + 1].id.toString(), localOffset: [0, tShelf / 2, DShelf / 2] },
              color: '#bc8a5f',
              offset: 2.0,
              offsetDir: [0, 0, 1]
            });
          }

          // 3. Spacing last shelf to bottom panel
          measurements.push({
            id: `smart_space_bot_${groupId}`,
            pointA: { boardId: shelves[shelves.length - 1].id.toString(), localOffset: [0, -tShelf / 2, DShelf / 2] },
            pointB: { boardId: bottomPanel.id.toString(), localOffset: [0, tTB / 2, coreD / 2] },
            color: '#bc8a5f',
            offset: 2.0,
            offsetDir: [0, 0, 1]
          });

          // 4. Staggered Cumulative Layout Measurements
          const measureRef = group.meta?.params?.measureRef || 'top';
          if (measureRef === 'top-of-bottom') {
            const sortedShelves = [...shelves].sort((a, b) => a.position[1] - b.position[1]); // bottom to top
            sortedShelves.forEach((shelf, i) => {
              measurements.push({
                id: `smart_cum_up_${i}_${groupId}`,
                pointA: { boardId: bottomPanel.id.toString(), localOffset: [0, tTB / 2, coreD / 2] },
                pointB: { boardId: shelf.id.toString(), localOffset: [0, tShelf / 2, DShelf / 2] },
                color: '#ff9f0a',
                offset: 4.0 + i * 1.5,
                offsetDir: [0, 0, 1]
              });
            });
          } else if (measureRef === 'bottom') {
            const sortedShelves = [...shelves].sort((a, b) => a.position[1] - b.position[1]); // bottom to top
            sortedShelves.forEach((shelf, i) => {
              measurements.push({
                id: `smart_cum_floor_${i}_${groupId}`,
                pointA: { boardId: bottomPanel.id.toString(), localOffset: [0, -tTB / 2, coreD / 2] },
                pointB: { boardId: shelf.id.toString(), localOffset: [0, tShelf / 2, DShelf / 2] },
                color: '#ff9f0a',
                offset: 4.0 + i * 1.5,
                offsetDir: [0, 0, 1]
              });
            });
          } else {
            // Default top-down
            const sortedShelves = [...shelves].sort((a, b) => b.position[1] - a.position[1]); // top to bottom
            sortedShelves.forEach((shelf, i) => {
              measurements.push({
                id: `smart_cum_down_${i}_${groupId}`,
                pointA: { boardId: topPanel.id.toString(), localOffset: [0, -tTB / 2, coreD / 2] },
                pointB: { boardId: shelf.id.toString(), localOffset: [0, tShelf / 2, DShelf / 2] },
                color: '#ff9f0a',
                offset: 4.0 + i * 1.5,
                offsetDir: [0, 0, 1]
              });
            });
          }
        }
      }

      // ── Process Drawer Stack ──
      if (builderType === 'drawerStack') {
        const childGroups = Object.keys(groups).filter(k => groups[k].parentId === groupId);
        const faces = boards
          .filter(b => childGroups.includes(b.parentId) && b.name === 'Face')
          .sort((a, b) => b.position[1] - a.position[1]); // top to bottom

        if (faces.length > 0) {
          // 1. Spacing top panel to first drawer face
          measurements.push({
            id: `smart_dr_space_top_${groupId}`,
            pointA: { boardId: topPanel.id.toString(), localOffset: [0, -tTB / 2, coreD / 2] },
            pointB: { boardId: faces[0].id.toString(), localOffset: [0, faces[0].size[1] / 2, faces[0].size[2] / 2] },
            color: '#bc8a5f',
            offset: 2.0,
            offsetDir: [0, 0, 1]
          });

          // 2. Individual face heights and middle reveals (gaps)
          faces.forEach((face, i) => {
            // Face Height
            measurements.push({
              id: `smart_dr_face_h_${i}_${groupId}`,
              pointA: { boardId: face.id.toString(), localOffset: [0, -face.size[1] / 2, face.size[2] / 2] },
              pointB: { boardId: face.id.toString(), localOffset: [0, face.size[1] / 2, face.size[2] / 2] },
              color: '#ff9f0a',
              offset: 2.0,
              offsetDir: [0, 0, 1]
            });

            // Reveal Gap to next face
            if (i < faces.length - 1) {
              measurements.push({
                id: `smart_dr_gap_${i}_${groupId}`,
                pointA: { boardId: face.id.toString(), localOffset: [0, -face.size[1] / 2, face.size[2] / 2] },
                pointB: { boardId: faces[i + 1].id.toString(), localOffset: [0, faces[i + 1].size[1] / 2, faces[i + 1].size[2] / 2] },
                color: '#bc8a5f',
                offset: 2.0,
                offsetDir: [0, 0, 1]
              });
            }
          });

          // 3. Spacing last drawer face to bottom panel
          measurements.push({
            id: `smart_dr_space_bot_${groupId}`,
            pointA: { boardId: faces[faces.length - 1].id.toString(), localOffset: [0, -faces[faces.length - 1].size[1] / 2, faces[faces.length - 1].size[2] / 2] },
            pointB: { boardId: bottomPanel.id.toString(), localOffset: [0, tTB / 2, coreD / 2] },
            color: '#bc8a5f',
            offset: 2.0,
            offsetDir: [0, 0, 1]
          });
        }
      }
      }
    }
  } else {
    // ── CASE B: Standalone mode (fall back to measuring the group itself) ──
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length > 0) {
      const aabb = computeWorldAABB(childBoards);
      const W = Math.abs(aabb.maxX - aabb.minX);
      const H = Math.abs(aabb.maxY - aabb.minY);
      const D = Math.abs(aabb.maxZ - aabb.minZ);

      // Standalone shelves/drawers sorted from top to bottom
      const elements = childBoards
        .filter(b => b.name.startsWith('Shelf') || b.name === 'Face')
        .sort((a, b) => b.position[1] - a.position[1]);

      if (elements.length > 0) {
        const firstEl = elements[0];
        const lastEl = elements[elements.length - 1];

        // 1. Overall height (Bottom of last element to top of first element)
        measurements.push({
          id: `smart_stand_height_${groupId}`,
          pointA: { boardId: lastEl.id.toString(), localOffset: [0, -lastEl.size[1] / 2, lastEl.size[2] / 2] },
          pointB: { boardId: firstEl.id.toString(), localOffset: [0, firstEl.size[1] / 2, firstEl.size[2] / 2] },
          color: '#34c759',
          offset: 2.0,
          offsetDir: [-1, 0, 0]
        });

        // 2. Individual spacings between consecutive elements
        for (let i = 0; i < elements.length - 1; i++) {
          measurements.push({
            id: `smart_stand_space_${i}_${groupId}`,
            pointA: { boardId: elements[i].id.toString(), localOffset: [0, -elements[i].size[1] / 2, elements[i].size[2] / 2] },
            pointB: { boardId: elements[i + 1].id.toString(), localOffset: [0, elements[i + 1].size[1] / 2, elements[i + 1].size[2] / 2] },
            color: '#bc8a5f',
            offset: 1.5,
            offsetDir: [0, 0, 1]
          });
        }
      }
    }
  }

  return measurements;
}
