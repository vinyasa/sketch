import React from 'react';
import { taperValidation, normalizeTaper } from '../../utils/geometryBuilders';
import useStore from '../../store/useStore';

const NewBoardDialog = () => {
    const { newBoardDialog: dialog, setNewBoardDialog: setDialog, groups, handleNewBoardConfirm: onConfirm } = useStore();
    if (!dialog) return null;

    const shape = dialog.shape ?? 'box';
    const { outerCorner: outerC, angleZ: dAz, angleX: dAx } = normalizeTaper(dialog.taper ?? {});

    const btnStyle = (active) => ({
        padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600,
        borderRadius: '6px',
        border: active ? '1px solid rgba(188,138,95,0.8)' : '1px solid var(--border-color)',
        background: active ? 'rgba(188,138,95,0.2)' : 'transparent',
        color: active ? 'var(--accent-color)' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.15s',
    });

    let taperPreview = null;
    if (shape === 'taper') {
        const { zBottom, xBottom, zWarn, xWarn } = taperValidation(
            dialog.sizeX, dialog.sizeY, dialog.sizeZ, dAz, dAx
        );
        const hasWarn = zWarn || xWarn;
        taperPreview = (
            <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Back taper (Z-) degrees</div>
                        <input
                            type="number" min="0" max="89" step="0.5"
                            value={dAz}
                            onChange={e => setDialog(p => { const t = normalizeTaper(p.taper); return { ...p, taper: { ...t, angleZ: Math.max(0, parseFloat(e.target.value) || 0) } }; })}
                            style={{
                                width: '100%', padding: '5px 8px',
                                background: 'var(--bg-color)', color: 'var(--text-main)',
                                border: `1px solid ${zWarn ? '#ff3b30' : 'var(--border-color)'}`,
                                borderRadius: '6px', outline: 'none', fontSize: '0.9rem',
                            }}
                        />
                        {zWarn && <div style={{ fontSize: '0.68rem', color: '#ff3b30', marginTop: '2px' }}>{zWarn}</div>}
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Side taper (X+) degrees</div>
                        <input
                            type="number" min="0" max="89" step="0.5"
                            value={dAx}
                            onChange={e => setDialog(p => { const t = normalizeTaper(p.taper); return { ...p, taper: { ...t, angleX: Math.max(0, parseFloat(e.target.value) || 0) } }; })}
                            style={{
                                width: '100%', padding: '5px 8px',
                                background: 'var(--bg-color)', color: 'var(--text-main)',
                                border: `1px solid ${xWarn ? '#ff3b30' : 'var(--border-color)'}`,
                                borderRadius: '6px', outline: 'none', fontSize: '0.9rem',
                            }}
                        />
                        {xWarn && <div style={{ fontSize: '0.68rem', color: '#ff3b30', marginTop: '2px' }}>{xWarn}</div>}
                    </div>
                </div>
                <div style={{
                    padding: '7px 10px', borderRadius: '6px', fontSize: '0.75rem',
                    background: hasWarn ? 'rgba(255,59,48,0.08)' : 'rgba(60,200,90,0.08)',
                    border: `1px solid ${hasWarn ? 'rgba(255,59,48,0.3)' : 'rgba(60,200,90,0.25)'}`,
                    color: 'var(--text-muted)',
                }}>
                    Bottom cross-section:{' '}
                    <span style={{ color: xWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>{Math.max(0, xBottom).toFixed(3)}"</span>
                    {' x '}
                    <span style={{ color: zWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>{Math.max(0, zBottom).toFixed(3)}"</span>
                    {' (W x D)'}
                </div>
                <p className="hint" style={{ marginTop: '5px' }}>
                    Front-left corner is the fixed outer corner. Size = bounding box (used unchanged by all constraints).
                </p>
            </div>
        );
    }

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }}>
            <div className="glass-panel" style={{ padding: '24px', width: '400px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ margin: 0 }}>Add New Component</h2>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Component Name</h4>
                    <input
                        type="text" value={dialog.name}
                        onChange={e => setDialog(p => ({ ...p, name: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                    />
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Parent Assembly</h4>
                    <select
                        value={dialog.parentId}
                        onChange={e => setDialog(p => ({ ...p, parentId: e.target.value }))}
                        style={{
                            width: '100%', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                            background: 'var(--bg-color)', color: 'var(--text-main)',
                            border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                        }}
                    >
                        <option value="Workspace">Workspace (Root)</option>
                        {Object.keys(groups).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Shape</h4>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {['box', 'taper'].map(s => (
                            <button
                                key={s}
                                style={btnStyle(shape === s)}
                                onClick={() => setDialog(p => ({
                                    ...p,
                                    shape: s === 'box' ? undefined : 'taper',
                                    taper: s === 'taper' ? (p.taper ?? { outerCorner: 'fl', angleZ: 2, angleX: 2 }) : undefined,
                                }))}
                            >
                                {s === 'box' ? '\u25a0 Box' : '\u25e2 Taper'}
                            </button>
                        ))}
                    </div>
                    {taperPreview}
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Size (in) — Bounding Box</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }} title="X: width">X<input type="number" step="0.5" value={dialog.sizeX} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeX: v })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }} title="Y: height">Y<input type="number" step="0.5" value={dialog.sizeY} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeY: v })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }} title="Z: depth">Z<input type="number" step="0.5" value={dialog.sizeZ} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeZ: v })) }} /></div>
                    </div>
                    <p className="hint" style={{ marginTop: '4px' }}>X = Red (left/right) · Y = Green (height) · Z = Blue (depth)</p>
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Spawn Position (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="1" value={dialog.position[0]} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, position: [v, p.position[1], p.position[2]] })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="1" value={dialog.position[1]} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, position: [p.position[0], v, p.position[2]] })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="1" value={dialog.position[2]} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, position: [p.position[0], p.position[1], v] })) }} /></div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button className="nav-btn" style={{ flex: 1, padding: '8px' }} onClick={() => setDialog(null)}>Cancel</button>
                    <button className="primary-btn" style={{ flex: 1, padding: '8px' }} onClick={onConfirm}>Add Component</button>
                </div>
            </div>
        </div>
    );
};

export default NewBoardDialog;
