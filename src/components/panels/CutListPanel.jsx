import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { normalizeMaterial, WOOD_CATALOGUE, getMaterialDisplayColor } from '../../utils/materialCatalogue';
import { packPlywoodSheets, SHEET_SIZES } from '../../utils/sheetPacker';

const fmt4 = (v) => parseFloat(v.toFixed(4));

const matLabel = (material) => {
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

const CutListPanel = () => {
    const { boards } = useStore();
    const [mode, setMode] = useState('detail'); // 'detail' | 'grouped' | 'plywood'
    const [sheetSize, setSheetSize] = useState('4x8'); // '4x8' | '5x5' | 'metric'

    // ─── Virtually Merge Split Legs ─────────────────────────────────────────
    const visibleBoards = useMemo(() => {
        const mergedList = [];
        const lowerLegs = new Map(); // key: parentId + leg index -> lower board
        const upperLegs = new Map(); // key: parentId + leg index -> upper board

        boards.filter(b => b.shape !== 'plane').forEach(b => {
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

    // ── Grouped data ─────────────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const map = new Map();
        visibleBoards.forEach(b => {
            const label = matLabel(b.material);
            const dims = [...b.size].sort((a, c) => c - a).map(fmt4); // L × W × T
            const key = `${label}|||${dims.join('|')}`;
            if (!map.has(key)) {
                map.set(key, { label, dims, count: 0, names: [] });
            }
            const entry = map.get(key);
            entry.count++;
            entry.names.push(b.name);
        });
        return [...map.values()].sort((a, b) =>
            a.label.localeCompare(b.label) || b.dims[0] - a.dims[0]
        );
    }, [visibleBoards]);

    // ── Plywood Sheet Packing Layouts ────────────────────────────────────────
    const packedGroups = useMemo(() => {
        return packPlywoodSheets(visibleBoards, sheetSize);
    }, [visibleBoards, sheetSize]);

    // ── Page Count Calculation ──
    const totalPrintPages = useMemo(() => {
        const totalPlywoodSheets = packedGroups.reduce((sum, grp) => sum + grp.sheets.length, 0);
        return 1 + totalPlywoodSheets; // 1 Page for Cut List Detail + Plywood layouts
    }, [packedGroups]);

    // ─── Single Sheet Print Spooler Helper ───────────────────────────────────
    const handlePrintSheet = (grp, sheet, autoPrint = false) => {
        const materialLabel = matLabel(grp.material);
        const thickLabel = fmt4(grp.thickness);
        const sheetW = sheet.width;
        const sheetH = sheet.height;

        const printWindow = window.open('', '_blank', 'width=850,height=950');
        if (!printWindow) {
            alert("Pop-up blocker prevented opening the print window. Please allow popups for this site.");
            return;
        }

        const svgW = 450;
        const svgH = (sheetH / sheetW) * svgW;
        const scale = svgW / sheetW;
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

            const showText = partW > 45 && partH > 22;
            const labelText = showText ? `
                <text x="${partW / 2}" y="${partH / 2 - 2}" text-anchor="middle" fill="#000000" font-size="8px" font-weight="bold" font-family="sans-serif">${p.board.name}</text>
                <text x="${partW / 2}" y="${partH / 2 + 7}" text-anchor="middle" fill="rgba(0,0,0,0.7)" font-size="7px" font-family="monospace">${fmt4(p.w)}"×${fmt4(p.h)}"</text>
            ` : '';

            return `
                <g transform="translate(${px}, ${py})">
                    <rect width="${partW}" height="${partH}" fill="${speciesColor}" stroke="#bc8a5f" stroke-width="1.5" style="fill-opacity: 0.75;" />
                    ${grainLinesSvg}
                    ${labelText}
                </g>
            `;
        }).join('\n');

        const partsListHtml = sheet.placements.map((p, idx) => `
            <tr>
                <td style="padding:8px; border-bottom:1px solid #ddd; font-weight:bold;">${p.board.name}</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${fmt4(p.w)}"</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${fmt4(p.h)}"</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center; color:#555;">${p.rotated ? 'Rotated 90° (Width grain)' : 'Aligned (Length grain)'}</td>
            </tr>
        `).join('\n');

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
                    <h1>Sheet ${sheet.id} &mdash; Cut Layout</h1>
                    <div class="meta">${thickLabel}" ${materialLabel} Plywood &middot; Efficiency: ${sheet.efficiency.toFixed(1)}%</div>
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

        // 1. Cut List Detail Table HTML (Page 1)
        const detailRowsHtml = visibleBoards.map(b => {
            const dims = [...b.size].sort((x, y) => y - x).map(fmt4);
            const isPly = b.lumberType === 'plywood';
            return `
                <tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-weight:bold;">${matLabel(b.material)}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; color: ${isPly ? '#8b5a2b' : '#333'}; font-weight: 600;">${isPly ? 'Plywood' : 'Solid'}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd;">${b.name}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${dims[0]}"</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${dims[1]}"</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${dims[2]}"</td>
                </tr>
            `;
        }).join('\n');

        const detailSectionHtml = `
            <div class="page-container" style="page-break-after: always; margin-bottom: 40px;">
                <div class="header">
                    <h1>Project Lumber Cut List &mdash; Overview</h1>
                    <div class="meta">Total Pieces: ${visibleBoards.length} &middot; Mode: Detailed Inventory</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Lumber Material</th>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Classification</th>
                            <th style="padding:8px; text-align:left; background:#f4f4f4; border-bottom:2px solid #ddd;">Component Name</th>
                            <th style="padding:8px; text-align:right; background:#f4f4f4; border-bottom:2px solid #ddd;">Length (in)</th>
                            <th style="padding:8px; text-align:right; background:#f4f4f4; border-bottom:2px solid #ddd;">Width (in)</th>
                            <th style="padding:8px; text-align:right; background:#f4f4f4; border-bottom:2px solid #ddd;">Thickness (in)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${detailRowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        // 2. Plywood Layout Sheets HTML (Pages 2 to N)
        let plywoodSectionsHtml = '';
        packedGroups.forEach(grp => {
            const materialLabel = matLabel(grp.material);
            const thickLabel = fmt4(grp.thickness);

            grp.sheets.forEach(sheet => {
                const svgW = 450;
                const svgH = (sheet.height / sheet.width) * svgW;
                const scale = svgW / sheet.width;
                const speciesColor = getMaterialDisplayColor(sheet.material);

                const placementsHtml = sheet.placements.map(p => {
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

                    const showText = partW > 45 && partH > 22;
                    const labelText = showText ? `
                        <text x="${partW / 2}" y="${partH / 2 - 2}" text-anchor="middle" fill="#000000" font-size="8px" font-weight="bold" font-family="sans-serif">${p.board.name}</text>
                        <text x="${partW / 2}" y="${partH / 2 + 7}" text-anchor="middle" fill="rgba(0,0,0,0.7)" font-size="7px" font-family="monospace">${fmt4(p.w)}"×${fmt4(p.h)}"</text>
                    ` : '';

                    return `
                        <g transform="translate(${px}, ${py})">
                            <rect width="${partW}" height="${partH}" fill="${speciesColor}" stroke="#bc8a5f" stroke-width="1.5" style="fill-opacity: 0.75;" />
                            ${grainLinesSvg}
                            ${labelText}
                        </g>
                    `;
                }).join('\n');

                const partsListHtml = sheet.placements.map(p => `
                    <tr>
                        <td style="padding:6px; border-bottom:1px solid #ddd; font-weight:bold;">${p.board.name}</td>
                        <td style="padding:6px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${fmt4(p.w)}"</td>
                        <td style="padding:6px; border-bottom:1px solid #ddd; font-family:monospace; text-align:right;">${fmt4(p.h)}"</td>
                        <td style="padding:6px; border-bottom:1px solid #ddd; text-align:center; color:#555;">${p.rotated ? 'Rotated 90°' : 'Aligned'}</td>
                    </tr>
                `).join('\n');

                plywoodSectionsHtml += `
                    <div class="page-container" style="page-break-after: always; margin-bottom: 40px; page-break-inside: avoid;">
                        <div class="header">
                            <h1>Sheet ${sheet.id} &mdash; Cut Layout</h1>
                            <div class="meta">${thickLabel}" ${materialLabel} Plywood &middot; Efficiency: ${sheet.efficiency.toFixed(1)}%</div>
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
                
                ${detailSectionHtml}
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
                                <th style={{ ...th, textAlign: 'right' }}>Length</th>
                                <th style={{ ...th, textAlign: 'right' }}>Width</th>
                                <th style={{ ...th, textAlign: 'right' }}>Thickness</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleBoards.map(b => {
                                const dims = [...b.size].sort((a, c) => c - a).map(fmt4);
                                const isPly = b.lumberType === 'plywood';
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={td}>{matLabel(b.material)}</td>
                                        <td style={{ ...td, fontWeight: 600, color: isPly ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                                            {isPly ? 'Plywood' : 'Solid'}
                                        </td>
                                        <td style={td}>{b.name}</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[0]}"</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[1]}"</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[2]}"</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {mode === 'grouped' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ ...th, textAlign: 'center', width: '36px' }}>Qty</th>
                                <th style={th}>Lumber</th>
                                <th style={th}>Dimensions (L × W × T)</th>
                                <th style={th}>Components</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((g, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                                        {g.count}×
                                    </td>
                                    <td style={td}>{g.label}</td>
                                    <td style={tdMono}>
                                        {g.dims[0]}" × {g.dims[1]}" × {g.dims[2]}"
                                    </td>
                                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                        {g.names.join(', ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                                const thickLabel = fmt4(grp.thickness);

                                return (
                                    <div key={grpIdx} style={{
                                        border: '1px solid var(--border-color)', borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.1)', padding: '14px', marginBottom: '8px'
                                    }}>
                                        {/* Subheader */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                                            <h4 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                                                {thickLabel}" {materialLabel} Plywood
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
                                                                Sheet {sheet.id} ({fmt4(sheet.width)}" × {fmt4(sheet.height)}")
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

                                                                        const showText = partW > 45 && partH > 22;

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
                                                                                {showText && (
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
                                                                                            {fmt4(p.w)}"×{fmt4(p.h)}"
                                                                                        </text>
                                                                                    </>
                                                                                )}
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
                                                                    {sheet.placements.map((p, idx) => (
                                                                        <li key={idx}>
                                                                            <strong>{p.board.name}</strong>: {fmt4(p.w)}" × {fmt4(p.h)}"{p.rotated ? ' (rotated)' : ''}
                                                                        </li>
                                                                    ))}
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
