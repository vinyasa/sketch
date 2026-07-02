/**
 * sheetPacker.js
 *
 * Smart 2D Plywood Sheet Layout Optimizer.
 * Employs a First-Fit Decreasing Height (FFDH) Shelf-Packing algorithm
 * that guarantees realistic table saw cuts (guillotine cuts), accounts
 * for saw blade kerf, and respects wood grain direction constraints.
 */

const KERF = 0.125; // 1/8" saw blade kerf

// Available sheet sizes in inches
export const SHEET_SIZES = {
    '4x8': { label: "4' × 8' (48\" × 96\")", w: 48, h: 96 },
    '5x5': { label: "5' × 5' (60\" × 60\")", w: 60, h: 60 },
    'metric': { label: "1220mm × 2440mm", w: 48.0315, h: 96.063 }
};

/**
 * Returns sorted dimensions of a board: [Length, Width, Thickness]
 */
export function getSortedDims(size) {
    if (!Array.isArray(size) || size.length !== 3) return [1, 1, 1];
    return [...size].sort((a, b) => b - a);
}

/**
 * Performs 2D bin-packing optimization on a list of boards.
 *
 * @param {Array} boards - List of board objects
 * @param {string} sheetSizeKey - Key from SHEET_SIZES ('4x8' | '5x5' | 'metric')
 * @returns {Array} List of sheet layouts grouped by thickness and species
 */
export function packPlywoodSheets(boards, sheetSizeKey = '4x8', plywoodInventory = [], prioritizeInventory = true) {
    const sizeCfg = SHEET_SIZES[sheetSizeKey] || SHEET_SIZES['4x8'];
    const sheetW = sizeCfg.w;
    const sheetH = sizeCfg.h;

    // 1. Filter out only boards marked as 'plywood'
    const plyBoards = boards.filter(b => b.lumberType === 'plywood' && b.visible !== false);
    if (plyBoards.length === 0) return [];

    // 2. Group boards by Thickness and Species/Material
    const groups = {};
    plyBoards.forEach(b => {
        const sorted = getSortedDims(b.size);
        const thickness = sorted[2]; // smallest dimension
        const mat = b.material || 'pine';
        const matId = typeof mat === 'string' ? mat : (mat.id || mat.hex || 'pine');
        const isPaint = typeof mat === 'object' && mat.type === 'color';
        
        // Key is unique combination of thickness and species
        const groupKey = `${thickness}|||${matId}`;
        if (!groups[groupKey]) {
            groups[groupKey] = {
                thickness,
                material: mat,
                isPaint,
                boards: []
            };
        }
        groups[groupKey].boards.push(b);
    });

    const results = [];

    // 3. Process each thickness/material group independently
    Object.keys(groups).forEach(key => {
        const grp = groups[key];
        const isPaint = grp.isPaint;
        
        // Prepare packing parts
        const parts = grp.boards.map(b => {
            const sorted = getSortedDims(b.size);
            const L = sorted[0]; // physical Length (longest)
            const W = sorted[1]; // physical Width (second longest)

            let w = W;
            let h = L;
            let rotated = false;
            let forceOrientation = false;

            if (!isPaint) {
                // For wood materials, enforce grain direction:
                // Plywood sheets have vertical grain (along Y/Height).
                // - grainDirection === 'length' -> Board Length must align with sheet height (Y).
                //   Therefore, part width = W, part height = L.
                // - grainDirection === 'width' -> Board Width must align with sheet height (Y).
                //   Therefore, part width = L, part height = W.
                forceOrientation = true;
                if (b.grainDirection === 'width') {
                    w = L;
                    h = W;
                    rotated = true;
                } else {
                    w = W;
                    h = L;
                    rotated = false;
                }
            }

            return {
                board: b,
                w,
                h,
                origW: W,
                origH: L,
                rotated,
                forceOrientation
            };
        });

        // Sort parts by height descending (standard First-Fit Decreasing Height)
        // If height is identical, sort by width descending.
        parts.sort((a, b) => b.h - a.h || b.w - a.w);

        const sheets = [];

        // Helper: create a new empty sheet layout
        const createNewSheet = () => ({
            id: sheets.filter(s => !s.isInventory).length + 1,
            material: grp.material,
            thickness: grp.thickness,
            width: sheetW,
            height: sheetH,
            placements: [],
            shelves: [], // shelves packed: { y, height }
            currentX: 0,
            currentY: 0,
            currentShelfH: 0
        });

        // Helper: create sheet from plywood inventory item
        const createSheetFromInventory = (invItem) => ({
            id: `inv_${invItem.id}`,
            isInventory: true,
            label: invItem.label || `${invItem.width}" × ${invItem.height}" Scrap`,
            material: grp.material,
            thickness: grp.thickness,
            width: parseFloat(invItem.width),
            height: parseFloat(invItem.height),
            placements: [],
            shelves: [],
            currentX: 0,
            currentY: 0,
            currentShelfH: 0
        });

        // Pre-fill sheets with matching inventory items if prioritized
        if (prioritizeInventory && Array.isArray(plywoodInventory)) {
            const matchingInventory = plywoodInventory.filter(item => {
                const thickMatch = Math.abs(parseFloat(item.thickness) - parseFloat(grp.thickness)) < 0.001;
                if (!thickMatch) return false;

                const matA = typeof item.material === 'string' ? item.material : (item.material?.id || item.material?.hex);
                const matB = typeof grp.material === 'string' ? grp.material : (grp.material?.id || grp.material?.hex);
                return matA === matB;
            });

            // Sort inventory items ascending by area (use smaller scraps first)
            matchingInventory.sort((a, b) => (parseFloat(a.width) * parseFloat(a.height)) - (parseFloat(b.width) * parseFloat(b.height)));

            matchingInventory.forEach(item => {
                sheets.push(createSheetFromInventory(item));
            });
        }

        // Pack each part
        parts.forEach(part => {
            let packed = false;

            // Try to pack in existing sheets (including inventory sheets)
            for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
                const sheet = sheets[sIdx];
                const activeW = sheet.width;
                const activeH = sheet.height;

                // Attempt to pack in the current shelf
                if (sheet.currentX + part.w <= activeW && sheet.currentY + part.h <= activeH) {
                    sheet.placements.push({
                        board: part.board,
                        x: sheet.currentX,
                        y: sheet.currentY,
                        w: part.w,
                        h: part.h,
                        rotated: part.rotated
                    });
                    sheet.currentX += part.w + KERF;
                    sheet.currentShelfH = Math.max(sheet.currentShelfH, part.h);
                    packed = true;
                    break;
                }

                // If it doesn't fit on the current shelf, try opening a new shelf on this sheet
                const nextY = sheet.currentY + sheet.currentShelfH + KERF;
                if (nextY + part.h <= activeH && part.w <= activeW) {
                    sheet.currentY = nextY;
                    sheet.currentX = 0;
                    sheet.currentShelfH = part.h;
                    
                    sheet.placements.push({
                        board: part.board,
                        x: sheet.currentX,
                        y: sheet.currentY,
                        w: part.w,
                        h: part.h,
                        rotated: part.rotated
                    });
                    sheet.currentX += part.w + KERF;
                    packed = true;
                    break;
                }

                // For paint parts, try rotating them if it helps them fit!
                if (!part.forceOrientation) {
                    const rotW = part.h;
                    const rotH = part.w;

                    // Try rotated on current shelf
                    if (sheet.currentX + rotW <= activeW && sheet.currentY + rotH <= activeH) {
                        sheet.placements.push({
                            board: part.board,
                            x: sheet.currentX,
                            y: sheet.currentY,
                            w: rotW,
                            h: rotH,
                            rotated: !part.rotated
                        });
                        sheet.currentX += rotW + KERF;
                        sheet.currentShelfH = Math.max(sheet.currentShelfH, rotH);
                        packed = true;
                        break;
                    }

                    // Try rotated on a new shelf
                    if (nextY + rotH <= activeH && rotW <= activeW) {
                        sheet.currentY = nextY;
                        sheet.currentX = 0;
                        sheet.currentShelfH = rotH;
                        
                        sheet.placements.push({
                            board: part.board,
                            x: sheet.currentX,
                            y: sheet.currentY,
                            w: rotW,
                            h: rotH,
                            rotated: !part.rotated
                        });
                        sheet.currentX += rotW + KERF;
                        packed = true;
                        break;
                    }
                }
            }

            // If still not packed, create a new sheet
            if (!packed) {
                const sheet = createNewSheet();
                
                // Pack as the first item on the first shelf of the new sheet
                sheet.currentShelfH = part.h;
                sheet.placements.push({
                    board: part.board,
                    x: sheet.currentX,
                    y: sheet.currentY,
                    w: part.w,
                    h: part.h,
                    rotated: part.rotated
                });
                sheet.currentX += part.w + KERF;
                
                sheets.push(sheet);
            }
        });

        // 4. Calculate efficiency metrics for each sheet
        const sheetLayouts = sheets.map(sheet => {
            let usedArea = 0;
            sheet.placements.forEach(p => {
                usedArea += p.w * p.h;
            });
            const totalArea = sheet.width * sheet.height;
            const efficiency = (usedArea / totalArea) * 100;

            return {
                id: sheet.id,
                isInventory: sheet.isInventory || false,
                label: sheet.label || `Sheet ${sheet.id}`,
                material: sheet.material,
                thickness: sheet.thickness,
                width: sheet.width,
                height: sheet.height,
                placements: sheet.placements,
                usedArea,
                totalArea,
                efficiency
            };
        });

        results.push({
            thickness: grp.thickness,
            material: grp.material,
            isPaint,
            sheets: sheetLayouts
        });
    });

    return results;
}
