import React, { useState } from 'react';

import useStore from '../../store/useStore';

const SettingsPanel = () => {
    const {
        units, setUnits,
        gridSnap, setGridSnap,
        defaultMaterial, setDefaultMaterial,
        showEdges, setShowEdges,
        showMeasurements, setShowMeasurements,
        showBoundingBox, setShowBoundingBox,
        enableCollisions, setEnableCollisions,
        globalBounds, setGlobalBounds,
        theme, setTheme,
        autosaveInterval, setAutosaveInterval,
        showToast
    } = useStore();
    const [confirmWipe, setConfirmWipe] = useState(false);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px', color: 'var(--text-main)' }}>

            <div className="inspector-card">
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Measurement System</label>
                <select className="nav-btn" value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                    <option value="imperial">Imperial (Inches / Fractions)</option>
                    <option value="metric">Metric (Millimeters)</option>
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Viewport vectors will automatically convert to your selected unit standard.</p>
            </div>

            <div className="inspector-card">
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Global Grid Snapping</label>
                <select className="nav-btn" value={gridSnap} onChange={(e) => setGridSnap(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                    <option value="off">Off (Free floating)</option>
                    <option value="1/16 in">1/16 Inch (Extreme)</option>
                    <option value="1/8 in">1/8 Inch (Fine)</option>
                    <option value="1/4 in">1/4 Inch (Standard)</option>
                    <option value="1/2 in">1/2 Inch (Rough)</option>
                    <option value="1 in">1 Inch (Very Rough)</option>
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Controls the bounding lock when nudging components via the AI or inspector.</p>
            </div>

            <div className="inspector-card">
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Workspace Scale (Grid Size)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="number" step="1" min="1" max="100" className="nav-btn" style={{ flex: 1, padding: '4px 8px' }} value={(useStore(s => s.workspaceSize) || 120) / 12} onChange={(e) => useStore.getState().setWorkspaceSize((parseFloat(e.target.value) || 10) * 12)} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>feet</span>
                </div>
                <p className="hint" style={{ marginTop: '4px' }}>Defines the total length/width of the 3D grid plane in feet. Grid snapping will automatically scale based on this size.</p>
            </div>

            <div className="inspector-card">
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Default Board Material</label>
                <select className="nav-btn" value={defaultMaterial} onChange={(e) => setDefaultMaterial(e.target.value)} style={{ width: '100%', outline: 'none', textTransform: 'capitalize' }}>
                    {['pine', 'cherry', 'walnut', 'red-oak', 'white-oak'].map(m => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Default lumber allocated when generating new boards or assemblies.</p>
            </div>

            <div className="inspector-card">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Architectural Edges
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders high-contrast boundary lines around all structural components.</p>
            </div>

            <div className="inspector-card">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showMeasurements} onChange={(e) => setShowMeasurements(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Dimensions
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders 3D bounding dimension lines and text in the viewport.</p>
            </div>

            <div className="inspector-card">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showBoundingBox} onChange={(e) => setShowBoundingBox(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Selection Envelope
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders an absolute 3D bounding box indicating total geometric size of selected components.</p>
            </div>

            <div className="inspector-card">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={enableCollisions} onChange={(e) => setEnableCollisions(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Enable Physics / Collision Warnings
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Visually flag overlapping geometry or illegal structural intersections in the viewport.</p>
            </div>

            <div className="inspector-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: '600', opacity: 0.85, margin: 0 }}>Project Volume Bounds</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.8rem', color: 'var(--accent-color)' }}>
                        <input type="checkbox" checked={globalBounds.enabled} onChange={(e) => setGlobalBounds(prev => ({ ...prev, enabled: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    </label>
                </div>
                <p className="hint" style={{ marginTop: '8px' }}>Forces Top generation AI to strictly adhere to maximum limit dimensions, automatically shrinking structural elements down to specified hardware tolerances!</p>
                {globalBounds.enabled && (
                    <div className="vec3-inputs" style={{ marginTop: '12px' }}>
                        <div>W<input type="number" step="1" value={globalBounds.x} onChange={e => setGlobalBounds(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))} title="Max Width" /></div>
                        <div style={{ borderColor: 'var(--accent-color)' }}>H<input type="number" step="1" value={globalBounds.y} onChange={e => setGlobalBounds(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))} title="Max Height" /></div>
                        <div>D<input type="number" step="1" value={globalBounds.z} onChange={e => setGlobalBounds(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))} title="Max Depth" /></div>
                    </div>
                )}
            </div>

            <div className="inspector-card">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={theme === 'dark'} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} style={{ width: '18px', height: '18px' }} />
                    Enable Dark Mode
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Toggle between high-contrast layout and daylight drafting theme.</p>
            </div>

            <div className="inspector-card">
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Autosave</label>
                <select className="nav-btn" value={autosaveInterval} onChange={(e) => setAutosaveInterval(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                    <option value="off">Off</option>
                    <option value="1">Every 1 minute</option>
                    <option value="5">Every 5 minutes</option>
                    <option value="10">Every 10 minutes</option>
                    <option value="30">Every 30 minutes</option>
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Silently saves to local storage on the selected schedule. Does not prompt or show a toast.</p>
            </div>

            <div className="inspector-card" style={{ borderColor: 'rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.05)' }}>
                <strong style={{ color: '#ff3b30' }}>System Storage Cache</strong>
                <p className="hint" style={{ marginTop: '4px', marginBottom: '8px' }}>Permanently destroy the browser's local memory reserve.</p>
                {!confirmWipe ? (
                    <button className="nav-btn" style={{ color: '#ff3b30', borderColor: 'rgba(255, 59, 48, 0.3)' }} onClick={() => setConfirmWipe(true)}>Wipe Local Cache</button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(255,59,48,0.08)', borderRadius: '8px', border: '1px solid rgba(255,59,48,0.3)' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ff3b30', fontWeight: '600' }}>⚠️ Are you sure? This cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="primary-btn" style={{ flex: 1, background: '#ff3b30', borderColor: '#ff3b30' }} onClick={() => {
                                localStorage.removeItem('lucey_save');
                                showToast('✅ Cache wiped! Reloading...');
                                setTimeout(() => window.location.reload(), 1500);
                            }}>Yes, wipe it</button>
                            <button className="nav-btn" style={{ flex: 1 }} onClick={() => setConfirmWipe(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default SettingsPanel;
