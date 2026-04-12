import React from 'react';

import useStore from '../../store/useStore';

const SettingsPanel = () => {
    const {
        units, setUnits,
        gridSnap, setGridSnap,
        defaultMaterial, setDefaultMaterial,
        showEdges, setShowEdges,
        showDimensions, setShowDimensions,
        showBoundingBox, setShowBoundingBox,
        globalBounds, setGlobalBounds,
        theme, setTheme
    } = useStore();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px', color: 'var(--text-main)' }}>

            <div>
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Measurement System</label>
                <select className="nav-btn" value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                    <option value="imperial">Imperial (Inches / Fractions)</option>
                    <option value="metric">Metric (Millimeters)</option>
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Viewport vectors will automatically convert to your selected unit standard.</p>
            </div>

            <div>
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Global Grid Snapping</label>
                <select className="nav-btn" value={gridSnap} onChange={(e) => setGridSnap(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                    <option value="off">Off (Free floating)</option>
                    <option value="1/8 in">1/8 Inch (Precision)</option>
                    <option value="1/2 in">1/2 Inch (Standard)</option>
                    <option value="1 in">1 Inch (Rough)</option>
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Controls the bounding lock when nudging components via the AI or inspector.</p>
            </div>

            <div>
                <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Default Board Material</label>
                <select className="nav-btn" value={defaultMaterial} onChange={(e) => setDefaultMaterial(e.target.value)} style={{ width: '100%', outline: 'none', textTransform: 'capitalize' }}>
                    {['pine', 'cherry', 'walnut', 'red-oak', 'white-oak'].map(m => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
                </select>
                <p className="hint" style={{ marginTop: '4px' }}>Default lumber allocated when generating new boards or assemblies.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Architectural Edges
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders high-contrast boundary lines around all structural components.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Dimensions
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders 3D bounding dimension lines and text in the viewport.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                    <input type="checkbox" checked={showBoundingBox} onChange={(e) => setShowBoundingBox(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    Show Selection Envelope
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Renders an absolute 3D bounding box indicating total geometric size of selected components.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
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

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={theme === 'dark'} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} style={{ width: '18px', height: '18px' }} />
                    Enable Dark Mode
                </label>
                <p className="hint" style={{ marginTop: '4px' }}>Toggle between high-contrast layout and daylight drafting theme.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <strong style={{ color: '#ff3b30' }}>System Storage Cache</strong>
                <p className="hint" style={{ marginTop: '4px', marginBottom: '8px' }}>Permanently destroy the browser's local memory reserve.</p>
                <button className="nav-btn" style={{ color: '#ff3b30', borderColor: 'rgba(255, 59, 48, 0.3)' }} onClick={() => { if (confirm('Destroy local workspace cache?')) { localStorage.removeItem('lucey_save'); alert('Cache destroyed. Please reload.'); } }}>Wipe Local Cache</button>
            </div>

        </div>
    );
};

export default SettingsPanel;
