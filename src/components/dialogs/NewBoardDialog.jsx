import React from 'react';

import useStore from '../../store/useStore';

const NewBoardDialog = () => {
    const { newBoardDialog: dialog, setNewBoardDialog: setDialog, groups, handleNewBoardConfirm: onConfirm } = useStore();
    if (!dialog) return null;

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }}>
            <div className="glass-panel" style={{ padding: '24px', width: '380px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 style={{ margin: 0 }}>Add New Component</h2>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Component Name</h4>
                    <input type="text" value={dialog.name} onChange={e => setDialog(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }} />
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Parent Assembly</h4>
                    <select value={dialog.parentId} onChange={e => setDialog(p => ({ ...p, parentId: e.target.value }))} style={{
                        width: '100%', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                        background: 'var(--bg-color)', color: 'var(--text-main)',
                        border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <option value="Workspace">Workspace (Root)</option>
                        {Object.keys(groups).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <div className="inspector-section" style={{ margin: 0 }}>
                    <h4>Size (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }} title="X — Red — Left/Right">X<input type="number" step="0.5" value={dialog.sizeX} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeX: v })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }} title="Y — Green — Up/Down">Y<input type="number" step="0.5" value={dialog.sizeY} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeY: v })) }} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }} title="Z — Blue — Front/Back">Z<input type="number" step="0.5" value={dialog.sizeZ} onChange={e => { const v = parseFloat(e.target.value) || 0; setDialog(p => ({ ...p, sizeZ: v })) }} /></div>
                    </div>
                    <p className="hint" style={{ marginTop: '4px' }}>X = Red (left/right) · Y = Green (up/down) · Z = Blue (front/back)</p>
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
                    <button className="primary-btn" style={{ flex: 1, padding: '8px' }} onClick={onConfirm}>Add Board</button>
                </div>
            </div>
        </div>
    );
};

export default NewBoardDialog;
