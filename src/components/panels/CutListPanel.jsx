import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../../store/useStore';
import { normalizeMaterial, WOOD_CATALOGUE, getMaterialDisplayColor } from '../../utils/materialCatalogue';
import { packPlywoodSheets, SHEET_SIZES } from '../../utils/sheetPacker';
import { formatUnit } from '../../utils/units';

const fmt4 = (v) => parseFloat(v.toFixed(4));

const matLabel = (material, board) => {
    if (board && board.name && board.name.includes('Slide')) {
        return 'Slides';
    }
    const m = normalizeMaterial(material);
    if (m.type === 'color') return `Paint ${m.hex}`;
    return WOOD_CATALOGUE[m.id]?.label ?? m.id;
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-main)' };
const tdMono = { ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' };

const btnBase = {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    fontSize: '0.76rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none'
};
const btnActive = {
    ...btnBase,
    background: 'var(--accent-color)',
    color: 'white',
    borderColor: 'var(--accent-color)'
};
const btnIdle = {
    ...btnBase,
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-muted)',
    borderColor: 'var(--border-color)'
};

const EXCLUDED_HARDWARE_KEYWORDS = ['slide', 'hardware', 'hinge', 'pull', 'knob', 'handle', 'bracket'];
const isHardwareBoard = (name) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return EXCLUDED_HARDWARE_KEYWORDS.some(kw => lower.includes(kw));
};

const renderPartLabel = (p, idx, scale, units, isHtmlString = false) => {
    const partW = p.w * scale;
    const partH = p.h * scale;
    const pieceCode = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) + 1 : '');
    const showHorizontal = partW > 45 && partH > 22;
    const showVertical = !showHorizontal && partH > 45 && partW > 22;
    const showCodeOnly = !showHorizontal && !showVertical && partW > 12 && partH > 12;

    const formattedDim = `${formatUnit(p.w, units)}×${formatUnit(p.h, units)}`;

    if (isHtmlString) {
        if (showHorizontal) {
            return `
                <text x="${partW / 2}" y="${partH / 2 - 2}" text-anchor="middle" fill="#000000" font-size="8px" font-weight="bold" font-family="sans-serif">${p.board.name}</text>
                <text x="${partW / 2}" y="${partH / 2 + 7}" text-anchor="middle" fill="rgba(0,0,0,0.7)" font-size="7px" font-family="monospace">${formattedDim}</text>
            `;
        } else if (showVertical) {
            return `
                <g transform="rotate(90, ${partW / 2}, ${partH / 2})">
                    <text x="${partW / 2}" y="${partH / 2 - 2}" text-anchor="middle" fill="#000000" font-size="8px" font-weight="bold" font-family="sans-serif">${p.board.name}</text>
                    <text x="${partW / 2}" y="${partH / 2 + 7}" text-anchor="middle" fill="rgba(0,0,0,0.7)" font-size="7px" font-family="monospace">${formattedDim}</text>
                </g>
            `;
        } else if (showCodeOnly) {
            return `
                <text x="${partW / 2}" y="${partH / 2 + 3}" text-anchor="middle" fill="#000000" font-size="9px" font-weight="bold" font-family="sans-serif">${pieceCode}</text>
            `;
        }
        return '';
    } else {
        if (showHorizontal) {
            return (
                <>
                    <text
                        x={partW / 2}
                        y={partH / 2 - 2}
                        textAnchor="middle"
                        fill="#000000"
                        fontSize="7.5px"
                        fontWeight="bold"
                    >
                        {p.board.name}
                    </text>
                    <text
                        x={partW / 2}
                        y={partH / 2 + 7}
                        textAnchor="middle"
                        fill="rgba(0,0,0,0.65)"
                        fontSize="6.5px"
                        fontFamily="monospace"
                    >
                        {formattedDim}
                    </text>
                </>
            );
        } else if (showVertical) {
            return (
                <g transform={`rotate(90, ${partW / 2}, ${partH / 2})`}>
                    <text
                        x={partW / 2}
                        y={partH / 2 - 2}
                        textAnchor="middle"
                        fill="#000000"
                        fontSize="7.5px"
                        fontWeight="bold"
                    >
                        {p.board.name}
                    </text>
                    <text
                        x={partW / 2}
                        y={partH / 2 + 7}
                        textAnchor="middle"
                        fill="rgba(0,0,0,0.65)"
                        fontSize="6.5px"
                        fontFamily="monospace"
                    >
                        {formattedDim}
                    </text>
                </g>
            );
        } else if (showCodeOnly) {
            return (
                <text
                    x={partW / 2}
                    y={partH / 2 + 3}
                    textAnchor="middle"
                    fill="#000000"
                    fontSize="8.5px"
                    fontWeight="bold"
                >
                    {pieceCode}
                </text>
            );
        }
        return null;
    }
};

const CutListPanel = () => {
    const { boards, units, plywoodInventory, setPlywoodInventory, setBoards } = useStore();
    const [mode, setMode] = useState('detail'); // 'detail' | 'grouped' | 'plywood'
    const [sheetSize, setSheetSize] = useState('4x8'); // '4x8' | '5x5' | 'metric'
    const [showPlywood, setShowPlywood] = useState(true);
    const [showSolid, setShowSolid] = useState(true);

    const [prioritizeInventory, setPrioritizeInventory] = useState(() => {
        try {
            const saved = localStorage.getItem('lucey_prioritize_inventory');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    const setAndPersistPrioritizeInventory = (val) => {
        setPrioritizeInventory(val);
        try {
            localStorage.setItem('lucey_prioritize_inventory', JSON.stringify(val));
        } catch {}
    };

    const [showInvManager, setShowInvManager] = useState(false);
    const [invWidth, setInvWidth] = useState('');
    const [invHeight, setInvHeight] = useState('');
    const [invThickness, setInvThickness] = useState('0.75');
    const [invMaterial, setInvMaterial] = useState('pine');
    const [invLabel, setInvLabel] = useState('');

    useEffect(() => {
        setInvThickness(units === 'metric' ? '0.7087' : '0.75');
    }, [units]);

    const toggleGrainDirection = (boardId) => {
        setBoards(prev => prev.map(b => {
            if (b.id === boardId) {
                const nextGrain = b.grainDirection === 'width' ? 'length' : 'width';
                return {
                    ...b,
                    grainDirection: nextGrain
                };
            }
            return b;
        }));
    };

    const handleAddInventoryItem = () => {
        const wVal = parseFloat(invWidth);
        const hVal = parseFloat(invHeight);
        const tVal = parseFloat(invThickness);

        if (isNaN(wVal) || wVal <= 0 || isNaN(hVal) || hVal <= 0) {
            alert('Please enter valid positive dimensions for width and height.');
            return;
        }

        const widthInInches = units === 'metric' ? wVal / 25.4 : wVal;
        const heightInInches = units === 'metric' ? hVal / 25.4 : hVal;
        const thicknessInInches = tVal;

        const newItem = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            width: widthInInches,
            height: heightInInches,
            thickness: thicknessInInches,
            material: invMaterial,
            label: invLabel.trim() || undefined
        };

        setPlywoodInventory([...(plywoodInventory || []), newItem]);
        setInvWidth('');
        setInvHeight('');
        setInvLabel('');
    };

    const handleRemoveInventoryItem = (id) => {
        setPlywoodInventory((plywoodInventory || []).filter(item => item.id !== id));
    };

    // ─── Virtually Merge Split Legs ─────────────────────────────────────────
    const visibleBoards = useMemo(() => {
        const mergedList = [];
        const lowerLegs = new Map(); // key: parentId + leg index -> lower board
        const upperLegs = new Map(); // key: parentId + leg index -> upper board

        boards.filter(b => b.shape !== 'plane' && !isHardwareBoard(b.name)).forEach(b => {
            const matchUpper = b.name.match(/^Leg (\d+) Upper$/);
            const matchLower = b.name.match(/^Leg (\d+) Lower$/);
            if (matchUpper) {
                const index = matchUpper[1];
                const key = `${b.parentId || 'Workspace'}|||${index}`;
                upperLegs.set(key, b);
            } else if (matchLower) {
                const index = matchLower[1];
                const key = `${b.parentId || 'Workspace'}|||${index}`;
                lowerLegs.set(key, b);
            } else {
                mergedList.push({ ...b });
            }
        });

        upperLegs.forEach((upperBoard, key) => {
            const lowerBoard = lowerLegs.get(key);
            if (lowerBoard) {
                const index = key.split('|||')[1];
                const fullHeight = upperBoard.size[1] + lowerBoard.size[1];
                mergedList.push({
                    id: `merged_leg_${key}`,
                    name: `Leg ${index}`,
                    material: upperBoard.material,
                    size: [upperBoard.size[0], fullHeight, upperBoard.size[2]],
                    parentId: upperBoard.parentId,
                    lumberType: upperBoard.lumberType || 'solid',
                    grainDirection: upperBoard.grainDirection || 'length'
                });
            } else {
                mergedList.push({ ...upperBoard });
            }
        });

        lowerLegs.forEach((lowerBoard, key) => {
            if (!upperLegs.has(key)) {
                mergedList.push({ ...lowerBoard });
            }
        });

        return mergedList;
    }, [boards]);

    // ── Sorted Detail Boards ──────────────────────────────────────────────────
    const sortedDetailBoards = useMemo(() => {
        return [...visibleBoards].sort((a, b) => {
            // 1. Sort by Type (Plywood vs Solid)
            const typeA = a.lumberType === 'plywood' ? 'Plywood' : 'Solid';
            const typeB = b.lumberType === 'plywood' ? 'Plywood' : 'Solid';
            const cmpType = typeA.localeCompare(typeB);
            if (cmpType !== 0) return cmpType;

            // 2. Sort by Thickness (smallest dimension)
            const thickA = Math.min(...a.size);
            const thickB = Math.min(...b.size);
            if (Math.abs(thickA - thickB) > 0.0001) {
                return thickA - thickB;
            }

            // 3. Sort by Lumber (material label)
            const labelA = matLabel(a.material, a);
            const labelB = matLabel(b.material, b);
            return labelA.localeCompare(labelB);
        });
    }, [visibleBoards]);

    // ── Grouped data ─────────────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const map = new Map();
        visibleBoards.forEach(b => {
            const label = matLabel(b.material, b);
            const dims = [...b.size].sort((a, c) => c - a); // Keep raw numbers in inches for formatUnit
            const type = b.lumberType === 'plywood' ? 'Plywood' : 'Solid';
            const key = `${label}|||${type}|||${dims.join('|')}`;
            if (!map.has(key)) {
                map.set(key, { label, type, dims, count: 0, names: [] });
            }
            const entry = map.get(key);
            entry.count++;
            entry.names.push(b.name);
        });
        return [...map.values()].sort((a, b) =>
            a.type.localeCompare(b.type) || a.label.localeCompare(b.label) || b.dims[0] - a.dims[0]
        );
    }, [visibleBoards]);

    const filteredGrouped = useMemo(() => {
        return grouped.filter(g => {
            if (g.type === 'Plywood') return showPlywood;
            if (g.type === 'Solid') return showSolid;
            return true;
        });
    }, [grouped, showPlywood, showSolid]);

    // ── Plywood Sheet Packing Layouts ────────────────────────────────────────
    const packedGroups = useMemo(() => {
        return packPlywoodSheets(visibleBoards, sheetSize, plywoodInventory || [], prioritizeInventory);
    }, [visibleBoards, sheetSize, plywoodInventory, prioritizeInventory]);

    // ── Page Count Calculation ──
    const totalPrintPages = useMemo(() => {
        const totalPlywoodSheets = packedGroups.reduce((sum, grp) => sum + grp.sheets.length, 0);
        return 1 + totalPlywoodSheets; // 1 Page for Cut List Detail + Plywood layouts
    }, [packedGroups]);

    // ─── Single Sheet Print Spooler Helper ───────────────────────────────────
    // ─── Single Sheet Print Spooler Helper ───────────────────────────────────
    const handlePrintSheet = (grp, sheet, autoPrint = false) => {
        const materialLabel = matLabel(grp.material);
        const thickLabel = formatUnit(grp.thickness, units);
        const sheetW = sheet.width;
        const sheetH = sheet.height;

        const printWindow = window.open('', '_blank', 'width=850,height=950');
        if (!printWindow) {
            alert("Pop-up blocker prevented opening the print window. Please allow popups for this site.");
            return;
        }

        const baseSheetW = 48;
        const svgW = Math.max(200, Math.min(450, (sheetW / baseSheetW) * 450));
        const svgH = (sheetH / sheetW) * svgW;
        const scale = svgW / sheetW;
        const printBelow = sheetH <= 36;
        const speciesColor = getMaterialDisplayColor(sheet.material);

        const placementsHtml = sheet.placements.map((p, idx) => {
            const partW = p.w * scale;
            const partH = p.h * scale;
            const px = p.x * scale;
            const py = p.y * scale;

            // Dashed grain lines
            const numLines = Math.max(2, Math.round((p.rotated ? p.h : p.w) / 3));
            let grainLinesSvg = '';
            for (let i = 1; i < numLines; i++) {
                if (p.rotated) {
                    const lineY = (i / numLines) * partH;
                    grainLinesSvg += `<line x1="2" y1="${lineY}" x2="${partW - 2}" y2="${lineY}" stroke="rgba(0,0,0,0.12)" stroke-dasharray="3,6" stroke-width="1" />`;
                } else {
                    const lineX = (i / numLines) * partW;
                    grainLinesSvg += `<line x1="${lineX}" y1="2" x2="${lineX}" y2="${partH - 2}" stroke="rgba(0,0,0,0.12)" stroke-dasharray="3,6" stroke-width="1" />`;
                }
            }

            const labelText = renderPartLabel(p, idx, scale, units, true);

            return `
                <g transform="translate(${px}, ${py})">
                    <rect width="${partW}" height="${partH}" fill="${speciesColor}" stroke="#bc8a5f" stroke-width="1.5" style="fill-opacity: 0.75;" />
                    ${grainLinesSvg}
                    ${labelText}
                </g>
            `;
        }).join('\n');

        const partsListHtml = sheet.placements.map((p, idx) => {
            const pieceCode = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) + 1 : '');
            return `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #ddd; font-weight:bold;">
                        <span style="background:#eeeeee; border:1px solid #ccc; padding:2px 5px; border-radius:3px; font-size:0.7rem; font-family:monospace; font-weight:bold; margin-right:6px; color:#444;">${pieceCode}</span>
                        ${p.board.name}
                    </td>
                    <td style="padding:8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${formatUnit(p.w, units)}</td>
                    <td style="padding:8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${formatUnit(p.h, units)}</td>
                    <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center; color:#555;">${p.rotated ? 'Rotated 90° (Width grain)' : 'Aligned (Length grain)'}</td>
                </tr>
            `;
        }).join('\n');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Cut Sheet - Sheet ${sheet.id}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #333;
                        margin: 40px;
                        background: #fff;
                    }
                    .header {
                        border-bottom: 2px solid #333;
                        padding-bottom: 12px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 1.5rem;
                    }
                    .header .meta {
                        font-size: 0.9rem;
                        color: #666;
                        font-weight: bold;
                    }
                    .layout-container {
                        display: flex;
                        flex-direction: ${printBelow ? 'column' : 'row'};
                        gap: 30px;
                        margin-bottom: 30px;
                        align-items: ${printBelow ? 'stretch' : 'flex-start'};
                    }
                    .svg-box {
                        border: 2px solid #333;
                        background: #fafafa;
                        padding: 10px;
                        border-radius: 4px;
                        width: fit-content;
                    }
                    .info-box {
                        flex: 1;
                        min-width: 250px;
                        max-width: ${printBelow ? '100%' : 'none'};
                    }
                    .info-box h3 {
                        margin-top: 0;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 6px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.85rem;
                        margin-top: 10px;
                    }
                    th {
                        background: #f4f4f4;
                        padding: 8px;
                        text-align: left;
                        font-weight: 600;
                        border-bottom: 2px solid #ddd;
                    }
                    @media print {
                        body { margin: 20px; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; background:#f0e4d4; padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:0.9rem; color:#8b5a2b;">🖨️ Ready to Print Sheet Layout</span>
                    <button onclick="window.print()" style="background:#bc8a5f; color:white; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Print Page</button>
                </div>
                
                <div class="header">
                    <h1>${sheet.isInventory ? `Scrap Layout (${sheet.label})` : `Sheet ${sheet.id} &mdash; Cut Layout`}</h1>
                    <div class="meta">${thickLabel} ${materialLabel} Plywood &middot; Efficiency: ${sheet.efficiency.toFixed(1)}%</div>
                </div>
                
                <div class="layout-container">
                    <div class="svg-box">
                        <svg width="${svgW}" height="${svgH}" style="overflow:hidden;">
                            <g opacity="0.08">
                                <line x1="${svgW * 0.2}" y1="0" x2="${svgW * 0.2}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                <line x1="${svgW * 0.4}" y1="0" x2="${svgW * 0.4}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                <line x1="${svgW * 0.6}" y1="0" x2="${svgW * 0.6}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                <line x1="${svgW * 0.8}" y1="0" x2="${svgW * 0.8}" y2="${svgH}" stroke="#000" stroke-width="1" />
                            </g>
                            ${placementsHtml}
                        </svg>
                    </div>
                    
                    <div class="info-box">
                        <h3>Sheet Inventory</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th style="text-align:right;">Width</th>
                                    <th style="text-align:right;">Height</th>
                                    <th style="text-align:center;">Grain</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${partsListHtml}
                            </tbody>
                        </table>
                        
                        <div style="margin-top:20px; font-size:0.8rem; color:#666; line-height:1.4;">
                            <strong>Notes:</strong><br>
                            * Layout accounts for standard 1/8" saw blade kerf clearance.<br>
                            * Standard sheet size used: ${fmt4(sheetW)}" × ${fmt4(sheetH)}".<br>
                            * Grain direction overlays match physical alignment.
                        </div>
                    </div>
                </div>
                
                ${autoPrint ? `
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
                ` : ''}
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // ─── Print All Spooler Helper ────────────────────────────────────────────
    const handlePrintAll = () => {
        const printWindow = window.open('', '_blank', 'width=850,height=950');
        if (!printWindow) {
            alert("Pop-up blocker prevented opening the print window. Please allow popups for this site.");
            return;
        }

        // 1. Cut List Grouped Table HTML (Page 1)
        const groupedRowsHtml = filteredGrouped.map(g => {
            const isPly = g.type === 'Plywood';
            const thicknessLabel = formatUnit(g.dims[2], units);
            const sizeLabel = `${formatUnit(g.dims[0], units)} × ${formatUnit(g.dims[1], units)}`;
            return `
                <tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-weight:bold;">${g.label}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; color: ${isPly ? '#8b5a2b' : '#333'}; font-weight: 600;">${g.type}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${thicknessLabel}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${sizeLabel}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-weight:bold; text-align:center;">${g.count}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; color:#555; font-size:0.8rem;">${g.names.join(', ')}</td>
                </tr>
            `;
        }).join('\n');

        const groupedSectionHtml = `
            <div class="page-container" style="page-break-after: always; margin-bottom: 40px;">
                <div class="header">
                    <h1>Project Lumber Cut List &mdash; Overview</h1>
                    <div class="meta">Mode: Grouped Summary &middot; Total Types: ${filteredGrouped.length}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Lumber Material</th>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Classification</th>
                            <th style="padding:8px; text-align:right; background:#f4f4f4; border-bottom:2px solid #ddd;">Thickness</th>
                            <th style="padding:8px; text-align:right; background:#f4f4f4; border-bottom:2px solid #ddd;">Dimensions (L × W)</th>
                            <th style="padding:8px; text-align:center; background:#f4f4f4; border-bottom:2px solid #ddd;">Qty</th>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Parts</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedRowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        // 2. Plywood Layout Sheets HTML (Pages 2 to N)
        let plywoodSectionsHtml = '';
        packedGroups.forEach(grp => {
            const materialLabel = matLabel(grp.material);
            const thickLabel = formatUnit(grp.thickness, units);

            grp.sheets.forEach(sheet => {
                const baseSheetW = 48;
                const svgW = Math.max(200, Math.min(450, (sheet.width / baseSheetW) * 450));
                const svgH = (sheet.height / sheet.width) * svgW;
                const scale = svgW / sheet.width;
                const printBelow = sheet.height <= 36;
                const speciesColor = getMaterialDisplayColor(sheet.material);

                const placementsHtml = sheet.placements.map((p, idx) => {
                    const partW = p.w * scale;
                    const partH = p.h * scale;
                    const px = p.x * scale;
                    const py = p.y * scale;

                    const numLines = Math.max(2, Math.round((p.rotated ? p.h : p.w) / 3));
                    let grainLinesSvg = '';
                    for (let i = 1; i < numLines; i++) {
                        if (p.rotated) {
                            const lineY = (i / numLines) * partH;
                            grainLinesSvg += `<line x1="2" y1="${lineY}" x2="${partW - 2}" y2="${lineY}" stroke="rgba(0,0,0,0.12)" stroke-dasharray="3,6" stroke-width="1" />`;
                        } else {
                            const lineX = (i / numLines) * partW;
                            grainLinesSvg += `<line x1="${lineX}" y1="2" x2="${lineX}" y2="${partH - 2}" stroke="rgba(0,0,0,0.12)" stroke-dasharray="3,6" stroke-width="1" />`;
                        }
                    }

                    const labelText = renderPartLabel(p, idx, scale, units, true);

                    return `
                        <g transform="translate(${px}, ${py})">
                            <rect width="${partW}" height="${partH}" fill="${speciesColor}" stroke="#bc8a5f" stroke-width="1.5" style="fill-opacity: 0.75;" />
                            ${grainLinesSvg}
                            ${labelText}
                        </g>
                    `;
                }).join('\n');

                const partsListHtml = sheet.placements.map((p, idx) => {
                    const pieceCode = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) + 1 : '');
                    return `
                        <tr>
                            <td style="padding:6px; border-bottom:1px solid #ddd; font-weight:bold;">
                                <span style="background:#eeeeee; border:1px solid #ccc; padding:1px 4px; border-radius:3px; font-size:0.65rem; font-family:monospace; font-weight:bold; margin-right:6px; color:#444;">${pieceCode}</span>
                                ${p.board.name}
                            </td>
                            <td style="padding:6px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${formatUnit(p.w, units)}</td>
                            <td style="padding:6px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${formatUnit(p.h, units)}</td>
                            <td style="padding:6px; border-bottom:1px solid #ddd; text-align:center; color:#555;">${p.rotated ? 'Rotated 90°' : 'Aligned'}</td>
                        </tr>
                    `;
                }).join('\n');

                plywoodSectionsHtml += `
                    <div class="page-container" style="page-break-after: always; margin-bottom: 40px; page-break-inside: avoid;">
                        <div class="header">
                            <h1>${sheet.isInventory ? `Scrap Layout (${sheet.label})` : `Sheet ${sheet.id} &mdash; Cut Layout`}</h1>
                            <div class="meta">${thickLabel} ${materialLabel} Plywood &middot; Efficiency: ${sheet.efficiency.toFixed(1)}%</div>
                        </div>
                        
                        <div class="layout-container" style="flex-direction: ${printBelow ? 'column' : 'row'}; align-items: ${printBelow ? 'stretch' : 'flex-start'};">
                            <div class="svg-box" style="width: fit-content;">
                                <svg width="${svgW}" height="${svgH}" style="overflow:hidden;">
                                    <g opacity="0.08">
                                        <line x1="${svgW * 0.2}" y1="0" x2="${svgW * 0.2}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                        <line x1="${svgW * 0.4}" y1="0" x2="${svgW * 0.4}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                        <line x1="${svgW * 0.6}" y1="0" x2="${svgW * 0.6}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                        <line x1="${svgW * 0.8}" y1="0" x2="${svgW * 0.8}" y2="${svgH}" stroke="#000" stroke-width="1" />
                                    </g>
                                    ${placementsHtml}
                                </svg>
                            </div>
                            
                            <div class="info-box" style="max-width: ${printBelow ? '100%' : 'none'};">
                                <h3>Sheet Inventory</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Component</th>
                                            <th style="text-align:right;">Width</th>
                                            <th style="text-align:right;">Height</th>
                                            <th style="text-align:center;">Grain</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${partsListHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            });
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Project Cut Sheets - Print All</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #333;
                        margin: 40px;
                        background: #fff;
                    }
                    .header {
                        border-bottom: 2px solid #333;
                        padding-bottom: 12px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 1.4rem;
                    }
                    .header .meta {
                        font-size: 0.85rem;
                        color: #666;
                        font-weight: bold;
                    }
                    .layout-container {
                        display: flex;
                        gap: 30px;
                        flex-wrap: wrap;
                        margin-bottom: 30px;
                        align-items: flex-start;
                    }
                    .svg-box {
                        border: 2px solid #333;
                        background: #fafafa;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    .info-box {
                        flex: 1;
                        min-width: 250px;
                    }
                    .info-box h3 {
                        margin-top: 0;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 6px;
                        font-size: 0.95rem;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.8rem;
                    }
                    th {
                        background: #f4f4f4;
                        padding: 6px 8px;
                        text-align: left;
                        font-weight: 600;
                        border-bottom: 2px solid #ddd;
                    }
                    @media print {
                        body { margin: 20px; }
                        .no-print { display: none !important; }
                        .page-container {
                            page-break-inside: avoid;
                            page-break-after: always;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; background:#f0e4d4; padding:12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:0.9rem; color:#8b5a2b;">🖨️ Ready to Print All (Includes Overview & Plywood Sheets)</span>
                    <button onclick="window.print()" style="background:#bc8a5f; color:white; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Print All Pages</button>
                </div>
                
                ${groupedSectionHtml}
                ${plywoodSectionsHtml}
                
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Toggle Modes & Print All Header Bar ── */}
            <div style={{ display: 'flex', gap: '6px', padding: '10px 16px 0', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={mode === 'detail'  ? btnActive : btnIdle} onClick={() => setMode('detail')}>
                        Detail
                    </button>
                    <button style={mode === 'grouped' ? btnActive : btnIdle} onClick={() => setMode('grouped')}>
                        Grouped
                    </button>
                    <button style={mode === 'plywood' ? btnActive : btnIdle} onClick={() => setMode('plywood')}>
                        Plywood Layout
                    </button>
                </div>
                
                {/* Print All Button showing calculated total printed pages count */}
                <button
                    onClick={handlePrintAll}
                    style={{
                        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 'bold',
                        background: 'var(--accent-color)', color: 'white', border: 'none', cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#a8754b'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-color)'}
                >
                    🖨️ Print All ({totalPrintPages} Page{totalPrintPages !== 1 ? 's' : ''})
                </button>
            </div>

            {/* ── Content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 16px' }}>
                {mode === 'detail' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={th}>Lumber</th>
                                <th style={th}>Type</th>
                                <th style={th}>Component</th>
                                <th style={{ ...th, textAlign: 'right' }}>Length ({units === 'metric' ? 'mm' : 'in'})</th>
                                <th style={{ ...th, textAlign: 'right' }}>Width ({units === 'metric' ? 'mm' : 'in'})</th>
                                <th style={{ ...th, textAlign: 'right' }}>Thickness ({units === 'metric' ? 'mm' : 'in'})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDetailBoards.map(b => {
                                const dims = [...b.size].sort((a, c) => c - a);
                                const isPly = b.lumberType === 'plywood';
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={td}>{matLabel(b.material, b)}</td>
                                        <td style={{ ...td, fontWeight: 600, color: isPly ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                                            {isPly ? 'Plywood' : 'Solid'}
                                        </td>
                                        <td style={td}>{b.name}</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{formatUnit(dims[0], units)}</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{formatUnit(dims[1], units)}</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{formatUnit(dims[2], units)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {mode === 'grouped' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Checkboxes Row */}
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>FILTER BY TYPE:</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}>
                                <input
                                    type="checkbox"
                                    checked={showPlywood}
                                    onChange={(e) => setShowPlywood(e.target.checked)}
                                    style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                />
                                Plywood
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}>
                                <input
                                    type="checkbox"
                                    checked={showSolid}
                                    onChange={(e) => setShowSolid(e.target.checked)}
                                    style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                />
                                Solid
                            </label>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ ...th, textAlign: 'center', width: '36px' }}>Qty</th>
                                    <th style={th}>Lumber</th>
                                    <th style={th}>Type</th>
                                    <th style={th}>Dimensions ({units === 'metric' ? 'mm' : 'in'})</th>
                                    <th style={th}>Components</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGrouped.map((g, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                                            {g.count}×
                                        </td>
                                        <td style={td}>{g.label}</td>
                                        <td style={{ ...td, fontWeight: 600, color: g.type === 'Plywood' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                                            {g.type}
                                        </td>
                                        <td style={tdMono}>
                                            {formatUnit(g.dims[0], units)} × {formatUnit(g.dims[1], units)} × {formatUnit(g.dims[2], units)}
                                        </td>
                                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                            {g.names.join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {mode === 'plywood' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Selector card */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.03)', padding: '10px 14px',
                            borderRadius: '8px', border: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>SHEET SIZE:</span>
                            <select
                                value={sheetSize}
                                onChange={(e) => setSheetSize(e.target.value)}
                                style={{
                                    padding: '4px 8px', background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem',
                                    cursor: 'pointer', outline: 'none'
                                }}
                            >
                                {Object.entries(SHEET_SIZES).map(([k, cfg]) => (
                                    <option key={k} value={k}>{cfg.label}</option>
                                ))}
                            </select>
                            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                ✂ 1/8" saw kerf accounted
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}>
                                <input
                                    type="checkbox"
                                    checked={prioritizeInventory}
                                    onChange={(e) => setAndPersistPrioritizeInventory(e.target.checked)}
                                    style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                />
                                Prioritize Plywood Inventory
                            </label>

                            <button
                                onClick={() => setShowInvManager(!showInvManager)}
                                style={{
                                    marginLeft: 'auto',
                                    padding: '4px 10px',
                                    borderRadius: '5px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.74rem',
                                    fontWeight: 'bold',
                                    background: showInvManager ? 'var(--accent-color)' : 'rgba(255,255,255,0.04)',
                                    color: showInvManager ? 'white' : 'var(--text-main)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                🎒 Scrap Inventory ({(plywoodInventory || []).length} pc{(plywoodInventory || []).length !== 1 ? 's' : ''})
                            </button>
                        </div>

                        {/* Inventory Manager Panel */}
                        {showInvManager && (
                            <div style={{
                                borderTop: '1px dashed var(--border-color)',
                                paddingTop: '12px',
                                marginTop: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                {/* Add item form */}
                                <div style={{
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{ fontSize: '0.74rem', fontWeight: 'bold', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                        Add Plywood Scrap to Inventory
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>MATERIAL</div>
                                            <select
                                                value={invMaterial}
                                                onChange={e => setInvMaterial(e.target.value)}
                                                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.76rem' }}
                                            >
                                                {Object.entries(WOOD_CATALOGUE).map(([k, cfg]) => (
                                                    <option key={k} value={k}>{cfg.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>THICKNESS</div>
                                            <select
                                                value={invThickness}
                                                onChange={e => setInvThickness(e.target.value)}
                                                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.76rem' }}
                                            >
                                                {units === 'metric' ? (
                                                    <>
                                                        <option value="0.2362">6mm (≈1/4")</option>
                                                        <option value="0.3543">9mm (≈3/8")</option>
                                                        <option value="0.4724">12mm (≈1/2")</option>
                                                        <option value="0.5906">15mm (≈5/8")</option>
                                                        <option value="0.7087">18mm (≈3/4")</option>
                                                        <option value="0.9843">25mm (≈1")</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="0.25">1/4" (0.25")</option>
                                                        <option value="0.375">3/8" (0.375")</option>
                                                        <option value="0.5">1/2" (0.50")</option>
                                                        <option value="0.625">5/8" (0.625")</option>
                                                        <option value="0.75">3/4" (0.75")</option>
                                                        <option value="1.0">1" (1.00")</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>WIDTH ({units === 'metric' ? 'mm' : 'in'})</div>
                                            <input
                                                type="number"
                                                step="any"
                                                value={invWidth}
                                                onChange={e => setInvWidth(e.target.value)}
                                                placeholder="Width"
                                                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.76rem' }}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>LENGTH (Grain Dir) ({units === 'metric' ? 'mm' : 'in'})</div>
                                            <input
                                                type="number"
                                                step="any"
                                                value={invHeight}
                                                onChange={e => setInvHeight(e.target.value)}
                                                placeholder="Length (Grain)"
                                                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.76rem' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={invLabel}
                                            onChange={e => setInvLabel(e.target.value)}
                                            placeholder="Label / Note (optional, e.g. Leftover back)"
                                            style={{ flex: 1, padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.76rem' }}
                                        />
                                        <button
                                            onClick={handleAddInventoryItem}
                                            style={{
                                                padding: '4px 14px',
                                                borderRadius: '4px',
                                                background: 'var(--accent-color)',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 'bold',
                                                fontSize: '0.76rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Add Piece
                                        </button>
                                    </div>
                                </div>

                                {/* Inventory list */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>CURRENT STOCK:</div>
                                    {(plywoodInventory || []).length === 0 ? (
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                                            No scrap pieces in inventory. Add some above!
                                        </div>
                                    ) : (
                                        (plywoodInventory || []).map((item) => (
                                            <div key={item.id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: 'rgba(255,255,255,0.02)',
                                                padding: '5px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(255,255,255,0.04)',
                                                fontSize: '0.74rem'
                                            }}>
                                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                                    {item.label ? `"${item.label}" - ` : ''}
                                                    {formatUnit(parseFloat(item.thickness), units)} {WOOD_CATALOGUE[item.material]?.label || item.material}
                                                </span>
                                                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                                    {formatUnit(parseFloat(item.width), units)} × {formatUnit(parseFloat(item.height), units)}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveInventoryItem(item.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        color: '#e06c75',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        marginLeft: '12px',
                                                        padding: '2px 4px',
                                                        fontSize: '0.8rem'
                                                    }}
                                                    title="Delete from stock"
                                                >
                                                    ❌
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {packedGroups.length === 0 ? (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                                border: '1px dashed var(--border-color)', textAlign: 'center'
                            }}>
                                <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📋</span>
                                <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-main)' }}>No Plywood Components</h4>
                                <p className="hint" style={{ maxWidth: '280px', margin: 0, fontSize: '0.74rem', lineHeight: '1.4' }}>
                                    Select components in the inspector, classify them as **Plywood**, and they will automatically lay out here to calculate sheets.
                                </p>
                            </div>
                        ) : (
                            packedGroups.map((grp, grpIdx) => {
                                const materialLabel = matLabel(grp.material);
                                const thickLabel = formatUnit(grp.thickness, units);

                                return (
                                    <div key={grpIdx} style={{
                                        border: '1px solid var(--border-color)', borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.1)', padding: '14px', marginBottom: '8px'
                                    }}>
                                        {/* Subheader */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                                            <h4 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                                                {thickLabel} {materialLabel} Plywood
                                            </h4>
                                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                Total Sheets: {grp.sheets.length}
                                            </span>
                                        </div>

                                        {/* Sheets list */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {grp.sheets.map((sheet) => {
                                                const svgW = 220;
                                                const svgH = (sheet.height / sheet.width) * svgW;
                                                const scale = svgW / sheet.width;
                                                const speciesColor = getMaterialDisplayColor(sheet.material);

                                                return (
                                                    <div key={sheet.id} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                                        
                                                        {/* Vector Sheet Diagram Thumbnail (Enlargeable on Click) */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>
                                                                {sheet.isInventory ? `Scrap Piece Layout: ${sheet.label}` : `Sheet ${sheet.id} (${formatUnit(sheet.width, units)} × ${formatUnit(sheet.height, units)})`}
                                                            </div>
                                                            <div 
                                                                title="Click to enlarge & print layout sheet"
                                                                onClick={() => handlePrintSheet(grp, sheet, false)}
                                                                style={{
                                                                    cursor: 'pointer', borderRadius: '4px',
                                                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                                                                    overflow: 'hidden', transition: 'transform 0.15s ease, border-color 0.15s ease',
                                                                    border: '1.5px solid var(--border-color)'
                                                                }}
                                                                onMouseEnter={e => {
                                                                    e.currentTarget.style.transform = 'scale(1.02)';
                                                                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                                                                }}
                                                                onMouseLeave={e => {
                                                                    e.currentTarget.style.transform = 'scale(1)';
                                                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                                                }}
                                                            >
                                                                <svg width={svgW} height={svgH} style={{
                                                                    background: '#1a1a1a', display: 'block', pointerEvents: 'none'
                                                                }}>
                                                                    {/* Faint native vertical sheet grain lines */}
                                                                    {!grp.isPaint && (
                                                                        <g opacity="0.08">
                                                                            {[0.2, 0.4, 0.6, 0.8].map((xp, idx) => (
                                                                                <line key={idx} x1={svgW * xp} y1={0} x2={svgW * xp} y2={svgH} stroke="#ffffff" strokeWidth={1} />
                                                                            ))}
                                                                        </g>
                                                                    )}

                                                                    {/* Part Placements */}
                                                                    {sheet.placements.map((p, pIdx) => {
                                                                        const partW = p.w * scale;
                                                                        const partH = p.h * scale;
                                                                        const px = p.x * scale;
                                                                        const py = p.y * scale;

                                                                        const showGrain = !grp.isPaint;
                                                                        const numLines = Math.max(2, Math.round((p.rotated ? p.h : p.w) / 3));
                                                                        const grainLines = [];
                                                                        if (showGrain) {
                                                                            for (let i = 1; i < numLines; i++) {
                                                                                if (p.rotated) {
                                                                                    const lineY = (i / numLines) * partH;
                                                                                    grainLines.push(
                                                                                        <line key={i} x1={2} y1={lineY} x2={partW - 2} y2={lineY} stroke="rgba(0,0,0,0.14)" strokeDasharray="3,6" strokeWidth={1} />
                                                                                    );
                                                                                } else {
                                                                                    const lineX = (i / numLines) * partW;
                                                                                    grainLines.push(
                                                                                        <line key={i} x1={lineX} y1={2} x2={lineX} y2={partH - 2} stroke="rgba(0,0,0,0.14)" strokeDasharray="3,6" strokeWidth={1} />
                                                                                    );
                                                                                }
                                                                            }
                                                                        }

                                                                        return (
                                                                            <g key={pIdx} transform={`translate(${px}, ${py})`}>
                                                                                <rect
                                                                                    width={partW}
                                                                                    height={partH}
                                                                                    fill={speciesColor}
                                                                                    stroke="var(--accent-color)"
                                                                                    strokeWidth={1}
                                                                                    style={{ fillOpacity: 0.85 }}
                                                                                />
                                                                                {grainLines}
                                                                                {renderPartLabel(p, pIdx, scale, units, false)}
                                                                            </g>
                                                                        );
                                                                    })}
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        {/* Efficiency Metrics & Inventory */}
                                                        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: 'center' }}>
                                                            <div style={{
                                                                fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)',
                                                                display: 'flex', justifyContent: 'space-between'
                                                            }}>
                                                                <span>Efficiency:</span>
                                                                <span style={{ color: 'var(--accent-color)' }}>
                                                                    {sheet.efficiency.toFixed(1)}% used
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', background: 'var(--accent-color)', width: `${sheet.efficiency}%` }} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                                <button
                                                                    className="primary-btn"
                                                                    style={{ flex: 1, padding: '3px 6px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                                    onClick={() => handlePrintSheet(grp, sheet, false)}
                                                                >
                                                                    🔍 Zoom Detail
                                                                </button>
                                                                <button
                                                                    className="nav-btn"
                                                                    style={{ padding: '3px 8px', fontSize: '0.68rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                                                    onClick={() => handlePrintSheet(grp, sheet, true)}
                                                                >
                                                                    🖨️ Print Sheet
                                                                </button>
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                <div style={{ fontWeight: 'bold', marginBottom: '2px', textTransform: 'uppercase', fontSize: '0.64rem', letterSpacing: '0.3px' }}>Nested Components:</div>
                                                                <ul style={{ margin: 0, paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    {sheet.placements.map((p, idx) => {
                                                                        const isWidthGrain = p.board.grainDirection === 'width';
                                                                        const pieceCode = String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) + 1 : '');
                                                                        return (
                                                                            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                                                <span style={{
                                                                                    background: 'rgba(255,255,255,0.08)',
                                                                                    padding: '1px 5px',
                                                                                    borderRadius: '3px',
                                                                                    fontSize: '0.66rem',
                                                                                    fontFamily: 'monospace',
                                                                                    fontWeight: 'bold',
                                                                                    color: 'var(--accent-color)',
                                                                                    marginRight: '2px'
                                                                                }}>{pieceCode}</span>
                                                                                <strong>{p.board.name}</strong>: {formatUnit(p.w, units)} × {formatUnit(p.h, units)}{p.rotated ? ' (rotated)' : ''}
                                                                                <button
                                                                                    onClick={() => toggleGrainDirection(p.board.id)}
                                                                                    title={isWidthGrain ? "Grain: Widthwise (↔). Click to change to Lengthwise (↕)." : "Grain: Lengthwise (↕). Click to change to Widthwise (↔)."}
                                                                                    style={{
                                                                                        background: 'rgba(255,255,255,0.06)',
                                                                                        border: '1px solid var(--border-color)',
                                                                                        borderRadius: '4px',
                                                                                        padding: '0px 5px',
                                                                                        fontSize: '0.74rem',
                                                                                        color: 'var(--accent-color)',
                                                                                        cursor: 'pointer',
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        marginLeft: '6px',
                                                                                        height: '18px',
                                                                                        transition: 'all 0.15s ease'
                                                                                    }}
                                                                                    onMouseEnter={e => {
                                                                                        e.currentTarget.style.background = 'var(--accent-color)';
                                                                                        e.currentTarget.style.color = '#fff';
                                                                                    }}
                                                                                    onMouseLeave={e => {
                                                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                                                        e.currentTarget.style.color = 'var(--accent-color)';
                                                                                    }}
                                                                                >
                                                                                    {isWidthGrain ? '↔' : '↕'}
                                                                                </button>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        </div>

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CutListPanel;
