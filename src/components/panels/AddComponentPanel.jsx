import React, { useState } from 'react';
import useStore from '../../store/useStore';

// ─── Shape catalogue — add new entries here as shapes are implemented ─────────
const SHAPES = [
    {
        id: 'box',
        label: 'Custom Board',
        icon: '📐',
        description: 'Generic box — open dialog to define manual sizes',
        color: '#bc8a5f',
    },
    {
        id: 'taper',
        label: 'Tapered Leg',
        icon: '📏',
        description: 'Classic furniture leg with angled faces',
        color: '#7a9e7e',
    },
    {
        id: 'cylinder',
        label: 'Cylinder',
        icon: '○',
        description: 'Round leg, post, disc — set radius & height in the dialog',
        color: '#7ea0bc',
    },
];

const spawnBoard = (name, size) => {
    const state = useStore.getState();
    const { boards, groups, selectedItemIds, pushHistory, setBoards, defaultMaterial, setSelectedItemIds } = state;
    
    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
    const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

    pushHistory();
    const newBoard = {
        id: Date.now(),
        name,
        parentId: targetParent,
        size,
        position: [0, size[1] / 2, 0], // Spawn resting on the floor
        orientation: [0, 0, 0],
        material: defaultMaterial || 'pine',
        shape: 'box',
        operations: []
    };
    setBoards([...boards, newBoard]);
    setSelectedItemIds([newBoard.id.toString()]);
};

// ─── Shape card ───────────────────────────────────────────────────────────────
const ShapeCard = ({ shape, onAdd }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            className="inspector-card"
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onAdd(shape)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                background: hov ? 'rgba(255,255,255,0.08)' : undefined,
                borderColor: hov ? shape.color + '80' : undefined,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-1px)' : 'none',
                boxShadow: hov ? '0 4px 12px rgba(0,0,0,0.25)' : 'none',
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: shape.color + '22',
                border: `1px solid ${shape.color}55`,
                fontSize: '1.1rem',
            }}>
                {shape.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {shape.label}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {shape.description}
                </div>
            </div>

            <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: shape.color,
                opacity: hov ? 1 : 0.5, transition: 'opacity 0.15s',
                flexShrink: 0,
            }}>
                + Add
            </div>
        </div>
    );
};

// ─── Smart Generators ─────────────────────────────────────────────────────────
const DimensionalLumberCard = ({ expanded, onToggle }) => {
    const [thicknessStr, setThicknessStr] = useState("1.5");
    const [widthStr, setWidthStr] = useState("3.5");
    const [length, setLength] = useState(96);
    const [orientation, setOrientation] = useState("Flat");

    const handleSpawn = () => {
        const t = parseFloat(thicknessStr);
        const w = parseFloat(widthStr);
        const l = parseFloat(length);
        if (!t || !w || !l) return;
        
        let size = [l, t, w];
        if (orientation === 'On Edge') size = [l, w, t];
        if (orientation === 'Vertical') size = [w, l, t];
        
        const thickName = thicknessStr === "0.75" ? "1x" : thicknessStr === "1.5" ? "2x" : "4x";
        const widthNameMatch = { "1.5": "2", "2.5": "3", "3.5": "4", "5.5": "6", "7.25": "8", "9.25": "10", "11.25": "12" };
        const widthName = widthNameMatch[widthStr] || "Custom";
        const name = `${thickName}${widthName} Lumber`;

        spawnBoard(name, size);
    };

    return (
        <div className="inspector-card" style={{ padding: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
                <div style={{ fontSize: '1.2rem', marginRight: '8px' }}>🪵</div>
                <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>Dimensional Lumber</div>
                <div style={{ fontSize: '0.7rem' }}>{expanded ? '▼' : '▶'}</div>
            </div>
            {expanded && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Type (Thickness)</div>
                            <select className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={thicknessStr} onChange={e => setThicknessStr(e.target.value)}>
                                <option value="0.75">1x (0.75" actual)</option>
                                <option value="1.5">2x (1.5" actual)</option>
                                <option value="3.5">4x (3.5" actual)</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Width</div>
                            <select className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={widthStr} onChange={e => setWidthStr(e.target.value)}>
                                <option value="1.5">2" (1.5" actual)</option>
                                <option value="2.5">3" (2.5" actual)</option>
                                <option value="3.5">4" (3.5" actual)</option>
                                <option value="5.5">6" (5.5" actual)</option>
                                <option value="7.25">8" (7.25" actual)</option>
                                <option value="9.25">10" (9.25" actual)</option>
                                <option value="11.25">12" (11.25" actual)</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Length (in)</div>
                            <input type="number" step="1" className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={length} onChange={e => setLength(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Orientation</div>
                            <select className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={orientation} onChange={e => setOrientation(e.target.value)}>
                                <option value="Flat">Flat</option>
                                <option value="On Edge">On Edge</option>
                                <option value="Vertical">Vertical</option>
                            </select>
                        </div>
                    </div>
                    <button className="primary-btn" style={{ marginTop: '4px', padding: '6px', fontSize: '0.8rem' }} onClick={handleSpawn}>+ Spawn Lumber</button>
                </div>
            )}
        </div>
    );
};

const PlywoodCard = ({ expanded, onToggle }) => {
    const [thicknessStr, setThicknessStr] = useState("0.75");
    const [width, setWidth] = useState(48);
    const [length, setLength] = useState(96);
    const [orientation, setOrientation] = useState("Flat");

    const handleSpawn = () => {
        const t = parseFloat(thicknessStr);
        const w = parseFloat(width);
        const l = parseFloat(length);
        if (!t || !w || !l) return;
        
        let size = [l, t, w];
        if (orientation === 'Vertical Portrait') size = [w, l, t];
        if (orientation === 'Vertical Landscape') size = [l, w, t];
        
        const thickName = thicknessStr === "0.25" ? "1/4\"" 
                        : thicknessStr === "0.375" ? "3/8\""
                        : thicknessStr === "0.5" ? "1/2\"" 
                        : thicknessStr === "0.625" ? "5/8\""
                        : "3/4\"";
        const name = `${thickName} Plywood`;

        spawnBoard(name, size);
    };

    return (
        <div className="inspector-card" style={{ padding: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
                <div style={{ fontSize: '1.2rem', marginRight: '8px' }}>🟫</div>
                <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>Plywood / Sheet Goods</div>
                <div style={{ fontSize: '0.7rem' }}>{expanded ? '▼' : '▶'}</div>
            </div>
            {expanded && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Thickness</div>
                            <select className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={thicknessStr} onChange={e => setThicknessStr(e.target.value)}>
                                <option value="0.25">1/4" (0.25")</option>
                                <option value="0.375">3/8" (0.375")</option>
                                <option value="0.5">1/2" (0.5")</option>
                                <option value="0.625">5/8" (0.625")</option>
                                <option value="0.75">3/4" (0.75")</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Width (in)</div>
                            <input type="number" step="1" className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={width} onChange={e => setWidth(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Length (in)</div>
                            <input type="number" step="1" className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={length} onChange={e => setLength(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Orientation</div>
                            <select className="nav-btn" style={{ width: '100%', padding: '4px', fontSize: '0.8rem' }} value={orientation} onChange={e => setOrientation(e.target.value)}>
                                <option value="Flat">Flat</option>
                                <option value="Vertical Portrait">Vertical Portrait</option>
                                <option value="Vertical Landscape">Vertical Landscape</option>
                            </select>
                        </div>
                    </div>
                    <button className="primary-btn" style={{ marginTop: '4px', padding: '6px', fontSize: '0.8rem' }} onClick={handleSpawn}>+ Spawn Plywood</button>
                </div>
            )}
        </div>
    );
};

// ─── Panel ────────────────────────────────────────────────────────────────────
const AddComponentPanel = () => {
    const { manualAddBoard, manualAddCylinder, manualAddTaper } = useStore();
    const [openGenerator, setOpenGenerator] = useState(null);

    const handleAdd = (shape) => {
        if (shape.id === 'box') {
            manualAddBoard();
        } else if (shape.id === 'taper') {
            manualAddTaper();
        } else if (shape.id === 'cylinder') {
            manualAddCylinder();
        }
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.6px', fontWeight: 700, marginBottom: '2px',
            }}>
                Smart Generators
            </div>

            <DimensionalLumberCard expanded={openGenerator === 'lumber'} onToggle={() => setOpenGenerator(openGenerator === 'lumber' ? null : 'lumber')} />
            <PlywoodCard expanded={openGenerator === 'plywood'} onToggle={() => setOpenGenerator(openGenerator === 'plywood' ? null : 'plywood')} />

            <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.6px', fontWeight: 700, marginBottom: '2px', marginTop: '12px'
            }}>
                Custom Shapes
            </div>

            {SHAPES.map(shape => (
                <ShapeCard key={shape.id} shape={shape} onAdd={handleAdd} />
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

export default AddComponentPanel;

