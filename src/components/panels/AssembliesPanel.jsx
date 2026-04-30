import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';

const ASSEMBLIES = [
    {
        id: 'cabinet',
        label: 'Cabinet',
        icon: '🗄',
        description: 'Box with top, bottom, sides, front & back — ready for dados',
        color: '#b08855',
    },
    {
        id: 'box',
        label: 'Box',
        icon: '📦',
        description: '6-sided box with top and bottom sitting flush on sides',
        color: '#908070',
    },
    {
        id: 'shakerDoor',
        label: 'Shaker Door',
        icon: '🚪',
        description: 'Five-piece door with frame and central panel',
        color: '#a07850',
    },
    {
        id: 'faceFrame',
        label: 'Face Frame',
        icon: '🖼️',
        description: 'Traditional cabinet front with stiles and rails',
        color: '#b5855c',
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
    const { setCabinetDialog, setBoxDialog, setShakerDoorDialog, setDrawerDialog, setFaceFrameDialog, setShelvingDialog } = useStore();

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
            setShakerDoorDialog({
                ...defaultCfg,
                offsetZ: bounds ? bounds.maxZ : 0, // Doors sit on the front
            });
        } else if (item.id === 'drawerStack') {
            setDrawerDialog({
                ...defaultCfg,
            });
        } else if (item.id === 'faceFrame') {
            setFaceFrameDialog({
                ...defaultCfg,
                offsetZ: bounds ? bounds.maxZ : 0, // Face frames sit on the front
            });
        } else if (item.id === 'shelving') {
            setShelvingDialog({
                ...defaultCfg,
            });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
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
