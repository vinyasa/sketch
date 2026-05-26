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
        const { boards, groups, selectedItemIds } = useStore.getState();
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

        let defaultCfg = {};
        if (bounds) {
            defaultCfg.width = Math.abs(bounds.maxX - bounds.minX);
            defaultCfg.height = Math.abs(bounds.maxY - bounds.minY);
            defaultCfg.depth = Math.abs(bounds.maxZ - bounds.minZ);
            defaultCfg.offsetX = bounds.minX;
            defaultCfg.offsetY = bounds.minY;
            // Provide base offsetZ, overridden below where appropriate
            defaultCfg.offsetZ = bounds.minZ;
        }

        if (item.id === 'cabinet') {
            setCabinetDialog({
                width: 24, height: 30, depth: 14,
                thicknessTB: 0.75, thicknessSide: 0.75,
                thicknessFront: 0.75, thicknessBack: 0.25,
                ...defaultCfg,
            });
        } else if (item.id === 'box') {
            setBoxDialog({
                width: 18, height: 12, depth: 12,
                thicknessTB: 0.5, thicknessSide: 0.5,
                thicknessFront: 0.5, thicknessBack: 0.5,
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
                } else {
                    const b = boards.find(board => board.id.toString() === selId.toString());
                    if (b && b.parentId && groups[b.parentId]) {
                        const builder = groups[b.parentId].meta?.builder;
                        if (builder === 'cabinet') {
                            cabinetGroupId = b.parentId;
                        } else if (builder === 'face-frame') {
                            faceFrameGroupId = b.parentId;
                        }
                    }
                }
            }
            setShakerDoorDialog({
                width: bounds ? (bounds.maxX - bounds.minX) : 18,
                height: bounds ? (bounds.maxY - bounds.minY) : 30,
                ...defaultCfg,
                offsetZ: bounds ? bounds.maxZ : 0, // Doors sit on the front
                cabinetGroupId,
                faceFrameGroupId
            });
        } else if (item.id === 'drawerStack') {
            setDrawerDialog({
                ...defaultCfg,
            });
        } else if (item.id === 'faceFrame') {
            let cabinetGroupId = null;
            if (selectedItemIds && selectedItemIds.length === 1) {
                const selId = selectedItemIds[0];
                if (groups[selId] && groups[selId].meta?.builder === 'cabinet') {
                    cabinetGroupId = selId;
                } else {
                    const b = boards.find(board => board.id.toString() === selId.toString());
                    if (b && b.parentId && groups[b.parentId] && groups[b.parentId].meta?.builder === 'cabinet') {
                        cabinetGroupId = b.parentId;
                    }
                }
            }
            setFaceFrameDialog({
                ...defaultCfg,
                width: bounds ? (bounds.maxX - bounds.minX) : 24,
                height: bounds ? (bounds.maxY - bounds.minY) : 30,
                offsetZ: bounds ? bounds.maxZ : 0, // Face frames sit on the front
                cabinetGroupId: cabinetGroupId
            });
        } else if (item.id === 'shelving') {
            setShelvingDialog({
                ...defaultCfg,
            });
        } else if (item.id === 'tableBase') {
            setTableBaseDialog({
                width: 48, height: 29, depth: 30,
                legSize: 2.25, legTaperAngle: 1.5,
                apronHeight: 4.0, apronThickness: 0.75,
                apronInset: 0.25, apronJoint: 'pocket-hole',
                ...defaultCfg,
            });
        } else if (item.id === 'tableTop') {
            setTableTopDialog({
                boardWidth: 5.5, thickness: 1.0,
                widthOverhang: 2.0, depthOverhang: 2.0,
                tenonSpacing: 10, jointType: 'loose-tenon',
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
