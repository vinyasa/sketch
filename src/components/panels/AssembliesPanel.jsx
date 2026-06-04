import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';

const ASSEMBLIES = [
    {
        id: 'tableBase',
        label: 'Table Base',
        icon: '🏓',
        description: 'Tapered legs, aprons, and responsive stringers',
        color: '#ff7a00',
    },
    {
        id: 'tableTop',
        label: 'Table Top',
        icon: '➖',
        description: 'Slat glue-up with tenons and auto-snap',
        color: '#ffaa00',
    },
    {
        id: 'box',
        label: 'Box',
        icon: '📦',
        description: '6-sided box with top and bottom sitting flush on sides',
        color: '#908070',
    },
    {
        id: 'cabinet',
        label: 'Cabinet',
        icon: '🗄',
        description: 'Box with top, bottom, sides, front & back — ready for dados',
        color: '#b08855',
    },
    {
        id: 'faceFrame',
        label: 'Face Frame',
        icon: '🖼️',
        description: 'Traditional cabinet front with stiles and rails',
        color: '#b5855c',
    },
    {
        id: 'shakerDoor',
        label: 'Door',
        icon: '🚪',
        description: 'Custom door with Shaker (5-piece) or Slab (Flat) options',
        color: '#a07850',
    },
    {
        id: 'drawerStack',
        label: 'Drawers',
        icon: '🗃️',
        description: 'Stack of drawer boxes with optional faces',
        color: '#8d6d53',
    },
    {
        id: 'shelving',
        label: 'Shelving',
        icon: '📚',
        description: 'Evenly spaced horizontal shelves for any opening',
        color: '#6d8d53',
    },
];

const AssemblyCard = ({ item, onSelect }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            className="inspector-card"
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onSelect(item)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                background: hov ? 'rgba(255,255,255,0.08)' : undefined,
                borderColor: hov ? item.color + '80' : undefined,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-1px)' : 'none',
                boxShadow: hov ? '0 4px 12px rgba(0,0,0,0.25)' : 'none',
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: item.color + '22',
                border: `1px solid ${item.color}55`,
                fontSize: '1.1rem',
            }}>
                {item.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {item.label}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {item.description}
                </div>
            </div>

            <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: item.color,
                opacity: hov ? 1 : 0.5, transition: 'opacity 0.15s',
                flexShrink: 0,
            }}>
                + Add
            </div>
        </div>
    );
};

const AssembliesPanel = () => {
    const { setCabinetDialog, setBoxDialog, setShakerDoorDialog, setDrawerDialog, setFaceFrameDialog, setShelvingDialog, setTableBaseDialog, setTableTopDialog } = useStore();

    const handleSelect = (item) => {
        const { boards, groups, selectedItemIds, units } = useStore.getState();
        let bounds = null;

        if (selectedItemIds && selectedItemIds.length > 0) {
            let selectedBoards = [];
            selectedItemIds.forEach(id => {
                if (groups[id]) {
                    selectedBoards.push(...collectChildBoards(id, boards, groups));
                } else {
                    const b = boards.find(b => b.id.toString() === id.toString());
                    if (b) selectedBoards.push(b);
                }
            });
            if (selectedBoards.length > 0) {
                bounds = computeWorldAABB(selectedBoards);
            }
        }

        // Check if only a single board of a cabinet, box, or face frame is selected
        let cabinetBoardSelected = false;
        let faceFrameBoardSelected = false;
        let boxBoardSelected = false;
        let parentCabinetName = '';
        let parentFaceFrameName = '';
        let parentBoxName = '';

        if (selectedItemIds && selectedItemIds.length === 1) {
            const selId = selectedItemIds[0];
            if (!groups[selId]) {
                const b = boards.find(board => board.id.toString() === selId.toString());
                if (b && b.parentId && groups[b.parentId]) {
                    const builder = groups[b.parentId].meta?.builder;
                    if (builder === 'cabinet') {
                        cabinetBoardSelected = true;
                        parentCabinetName = groups[b.parentId].name || 'Cabinet';
                    }
                    if (builder === 'face-frame') {
                        faceFrameBoardSelected = true;
                        parentFaceFrameName = groups[b.parentId].name || 'Face Frame';
                    }
                    if (builder === 'box') {
                        boxBoardSelected = true;
                        parentBoxName = groups[b.parentId].name || 'Box';
                    }
                }
            }
        }

        const isSingleBoardOfAssembly = cabinetBoardSelected || faceFrameBoardSelected || boxBoardSelected;

        let defaultCfg = {};
        if (bounds && !isSingleBoardOfAssembly) {
            defaultCfg.width = Math.abs(bounds.maxX - bounds.minX);
            defaultCfg.height = Math.abs(bounds.maxY - bounds.minY);
            defaultCfg.depth = Math.abs(bounds.maxZ - bounds.minZ);
            defaultCfg.offsetX = bounds.minX;
            defaultCfg.offsetY = bounds.minY;
            // Provide base offsetZ, overridden below where appropriate
            defaultCfg.offsetZ = bounds.minZ;
        }

        const isMetric = units === 'metric';

        if (item.id === 'cabinet') {
            setCabinetDialog({
                width: isMetric ? (600 / 25.4) : 24,
                height: isMetric ? (750 / 25.4) : 30,
                depth: isMetric ? (350 / 25.4) : 14,
                thicknessTB: isMetric ? (18 / 25.4) : 0.75,
                thicknessSide: isMetric ? (18 / 25.4) : 0.75,
                thicknessFront: isMetric ? (18 / 25.4) : 0.75,
                thicknessBack: isMetric ? (6 / 25.4) : 0.25,
                ...defaultCfg,
            });
        } else if (item.id === 'box') {
            setBoxDialog({
                width: isMetric ? (450 / 25.4) : 18,
                height: isMetric ? (300 / 25.4) : 12,
                depth: isMetric ? (300 / 25.4) : 12,
                thicknessTB: isMetric ? (12 / 25.4) : 0.5,
                thicknessSide: isMetric ? (12 / 25.4) : 0.5,
                thicknessFront: isMetric ? (12 / 25.4) : 0.5,
                thicknessBack: isMetric ? (12 / 25.4) : 0.5,
                ...defaultCfg,
            });
        } else if (item.id === 'shakerDoor') {
            let cabinetGroupId = null;
            let faceFrameGroupId = null;
            if (selectedItemIds && selectedItemIds.length === 1) {
                const selId = selectedItemIds[0];
                if (groups[selId]) {
                    const builder = groups[selId].meta?.builder;
                    if (builder === 'cabinet') {
                        cabinetGroupId = selId;
                    } else if (builder === 'face-frame') {
                        faceFrameGroupId = selId;
                    }
                }
            }
            setShakerDoorDialog({
                width: bounds && !isSingleBoardOfAssembly ? (bounds.maxX - bounds.minX) : (isMetric ? 450 / 25.4 : 18),
                height: bounds && !isSingleBoardOfAssembly ? (bounds.maxY - bounds.minY) : (isMetric ? 750 / 25.4 : 30),
                thicknessFrame: isMetric ? (18 / 25.4) : 0.75,
                thicknessPanel: isMetric ? (6 / 25.4) : 0.25,
                widthStileRail: isMetric ? (50 / 25.4) : 2,
                grooveDepth: isMetric ? (10 / 25.4) : 0.375,
                grooveWidth: isMetric ? (6 / 25.4) : 0.25,
                panelClearance: isMetric ? (3 / 25.4) : 0.125,
                insetClearance: isMetric ? (3 / 25.4) : 0.125,
                overlayReveal: isMetric ? (6 / 25.4) : 0.25,
                ...defaultCfg,
                offsetZ: bounds && !isSingleBoardOfAssembly ? bounds.maxZ : 0, // Doors sit on the front
                cabinetGroupId,
                faceFrameGroupId,
                cabinetBoardSelected,
                faceFrameBoardSelected,
                parentCabinetName,
                parentFaceFrameName,
                doorCount: 1,
                doubleDoorGap: isMetric ? (3 / 25.4) : 0.09375
            });
        } else if (item.id === 'drawerStack') {
            let cabinetGroupId = null;
            if (selectedItemIds && selectedItemIds.length === 1) {
                const selId = selectedItemIds[0];
                if (groups[selId] && groups[selId].meta?.builder === 'cabinet') {
                    cabinetGroupId = selId;
                }
            }

            let cabW = isMetric ? (600 / 25.4) : 24;
            let cabH = isMetric ? (750 / 25.4) : 30;
            let cabD = isMetric ? (500 / 25.4) : 20;
            if (cabinetGroupId && groups[cabinetGroupId]) {
                const cabParams = groups[cabinetGroupId].meta?.params || {};
                const w = parseFloat(cabParams.width || 24);
                const h = parseFloat(cabParams.height || 30);
                const d = parseFloat(cabParams.depth || 14);
                const tSide = parseFloat(cabParams.thicknessSide || 0.75);
                const tTB = parseFloat(cabParams.thicknessTB || 0.75);
                const tBack = parseFloat(cabParams.thicknessBack || 0.25);
                const cabCoreDepth = d - tBack;

                cabW = w - 2 * tSide;
                cabH = h - 2 * tTB;
                cabD = cabCoreDepth;
            }

            setDrawerDialog({
                ...defaultCfg,
                width: cabW,
                height: cabH,
                depth: cabD,
                cabinetGroupId: cabinetGroupId,
                cabinetBoardSelected,
                gap: isMetric ? (3 / 25.4) : 0.125,
                reveal: isMetric ? (10 / 25.4) : 0.375,
                slideWidth: isMetric ? (12.5 / 25.4) : 0.5,
                topClearance: isMetric ? (25 / 25.4) : 1.0,
                thicknessBox: isMetric ? (12 / 25.4) : 0.5,
                thicknessBottom: isMetric ? (6 / 25.4) : 0.25,
                thicknessFace: isMetric ? (18 / 25.4) : 0.75,
                overlayAmount: isMetric ? (12 / 25.4) : 0.5
            });
        } else if (item.id === 'faceFrame') {
            let cabinetGroupId = null;
            if (selectedItemIds && selectedItemIds.length === 1) {
                const selId = selectedItemIds[0];
                if (groups[selId] && groups[selId].meta?.builder === 'cabinet') {
                    cabinetGroupId = selId;
                }
            }
            setFaceFrameDialog({
                ...defaultCfg,
                width: bounds && !isSingleBoardOfAssembly ? (bounds.maxX - bounds.minX) : (isMetric ? (600 / 25.4) : 24),
                height: bounds && !isSingleBoardOfAssembly ? (bounds.maxY - bounds.minY) : (isMetric ? (750 / 25.4) : 30),
                stileWidth: isMetric ? (40 / 25.4) : 1.5,
                railWidth: isMetric ? (40 / 25.4) : 1.5,
                thickness: isMetric ? (18 / 25.4) : 0.75,
                offsetZ: bounds && !isSingleBoardOfAssembly ? bounds.maxZ : 0, // Face frames sit on the front
                cabinetGroupId: cabinetGroupId,
                cabinetBoardSelected,
                parentCabinetName
            });
        } else if (item.id === 'shelving') {
            let cabinetGroupId = null;
            let boxGroupId = null;
            if (selectedItemIds && selectedItemIds.length === 1) {
                const selId = selectedItemIds[0];
                if (groups[selId]) {
                    const builder = groups[selId].meta?.builder;
                    if (builder === 'cabinet') {
                        cabinetGroupId = selId;
                    } else if (builder === 'box') {
                        boxGroupId = selId;
                    }
                }
            }

            let cabW = isMetric ? (750 / 25.4) : 30;
            let cabH = isMetric ? (1200 / 25.4) : 48;
            let cabD = isMetric ? (280 / 25.4) : 11;
            let tSide = isMetric ? (18 / 25.4) : 0.75;
            let tTB = isMetric ? (18 / 25.4) : 0.75;
            let tBack = isMetric ? (6 / 25.4) : 0.25;
            let tFront = isMetric ? (12 / 25.4) : 0.5;

            let finalOffsetX = bounds && !isSingleBoardOfAssembly ? bounds.minX : 0;
            let finalOffsetY = bounds && !isSingleBoardOfAssembly ? bounds.minY : 0;
            let finalOffsetZ = bounds && !isSingleBoardOfAssembly ? bounds.minZ : 0;

            if (cabinetGroupId && groups[cabinetGroupId]) {
                const cabParams = groups[cabinetGroupId].meta?.params || {};
                const w = parseFloat(cabParams.width || 24);
                const h = parseFloat(cabParams.height || 30);
                const d = parseFloat(cabParams.depth || 14);
                tSide = parseFloat(cabParams.thicknessSide || 0.75);
                tTB = parseFloat(cabParams.thicknessTB || 0.75);
                tBack = parseFloat(cabParams.thicknessBack || 0.25);
                const cabCoreDepth = d - tBack;

                cabW = w - 2 * tSide;
                cabH = h - 2 * tTB;
                cabD = cabCoreDepth;

                finalOffsetX = finalOffsetX + tSide;
                finalOffsetY = finalOffsetY + tTB;
                finalOffsetZ = finalOffsetZ + tBack;
            } else if (boxGroupId && groups[boxGroupId]) {
                const boxParams = groups[boxGroupId].meta?.params || {};
                const w = parseFloat(boxParams.width || 18);
                const h = parseFloat(boxParams.height || 12);
                const d = parseFloat(boxParams.depth || 12);
                tSide = parseFloat(boxParams.thicknessSide || 0.5);
                tTB = parseFloat(boxParams.thicknessTB || 0.5);
                tFront = parseFloat(boxParams.thicknessFront || 0.5);
                tBack = parseFloat(boxParams.thicknessBack || 0.5);

                cabW = w - 2 * tSide;
                cabH = h - 2 * tTB;
                cabD = d - tFront - tBack;

                finalOffsetX = finalOffsetX + tSide;
                finalOffsetY = finalOffsetY + tTB;
                finalOffsetZ = finalOffsetZ + tBack;
            } else if (bounds && !isSingleBoardOfAssembly) {
                cabW = Math.abs(bounds.maxX - bounds.minX);
                cabH = Math.abs(bounds.maxY - bounds.minY);
                cabD = Math.abs(bounds.maxZ - bounds.minZ);
            }

            setShelvingDialog({
                ...defaultCfg,
                width: cabW,
                height: cabH,
                depth: cabD,
                cabinetGroupId,
                boxGroupId,
                cabinetBoardSelected,
                boxBoardSelected,
                parentCabinetName,
                parentBoxName,
                offsetX: finalOffsetX,
                offsetY: finalOffsetY,
                offsetZ: finalOffsetZ,
                count: 3,
                thickness: isMetric ? (18 / 25.4) : 0.75,
                addShelfPins: false
            });
        } else if (item.id === 'tableBase') {
            setTableBaseDialog({
                width: isMetric ? (1200 / 25.4) : 48,
                height: isMetric ? (730 / 25.4) : 29,
                depth: isMetric ? (750 / 25.4) : 30,
                legSize: isMetric ? (60 / 25.4) : 2.25,
                legTaperAngle: 1.5,
                apronHeight: isMetric ? (100 / 25.4) : 4.0,
                apronThickness: isMetric ? (18 / 25.4) : 0.75,
                apronInset: isMetric ? (6 / 25.4) : 0.25,
                apronJoint: 'pocket-hole',
                ...defaultCfg,
            });
        } else if (item.id === 'tableTop') {
            setTableTopDialog({
                boardWidth: isMetric ? (140 / 25.4) : 5.5,
                thickness: isMetric ? (25 / 25.4) : 1.0,
                widthOverhang: isMetric ? (50 / 25.4) : 2.0,
                depthOverhang: isMetric ? (50 / 25.4) : 2.0,
                tenonSpacing: isMetric ? (250 / 25.4) : 10,
                jointType: 'loose-tenon',
                ...defaultCfg,
            });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{
                fontSize: '0.6rem', color: 'var(--accent-color)', textTransform: 'uppercase',
                letterSpacing: '0.6px', fontWeight: 700, marginBottom: '2px',
            }}>
                Parametric Builders
            </div>
            {ASSEMBLIES.map(item => (
                <AssemblyCard key={item.id} item={item} onSelect={handleSelect} />
            ))}
            <p style={{
                fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center',
                marginTop: '4px', lineHeight: 1.4,
            }}>
                Added to your selected assembly,<br />or Workspace if nothing is selected.
            </p>
        </div>
    );
};

export default AssembliesPanel;
