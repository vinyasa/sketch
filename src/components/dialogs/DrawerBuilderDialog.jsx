import React from 'react';
import useStore from '../../store/useStore';

const DrawerBuilderDialog = () => {
    const { drawerDialog: dialog, setDrawerDialog: setDialog, buildDrawers } = useStore();
    if (!dialog) return null;

    const parse = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const W = parse(dialog.width, 24);
    const H = parse(dialog.height, 30);
    const D = parse(dialog.depth, 20);
    
    const count = parseInt(dialog.count ?? 3, 10);
    const slideWidth = parse(dialog.slideWidth, 0.5);
    const verticalGap = parse(dialog.verticalGap, 0.125);
    const topClearance = parse(dialog.topClearance, 1.0);
    
    const thicknessBox = parse(dialog.thicknessBox, 0.5);
    const thicknessBottom = parse(dialog.thicknessBottom, 0.25);
    const thicknessFace = parse(dialog.thicknessFace, 0.75);
    
    const faceStyle = dialog.faceStyle ?? 'inset';
    const overlayAmount = parse(dialog.overlayAmount, 0.5);
    const jointType = dialog.jointType ?? 'butt';

    const valid = W > 2 * slideWidth + 2 * thicknessBox && H > count * verticalGap + count * 2 && count > 0;

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const handleBuild = () => {
        if (!valid) return;
        buildDrawers(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '480px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🗃️</span> Drawer Builder
                </h2>

                {/* Overall Opening Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Cabinet Opening (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <input type="number" step="0.5" min="1" value={W}
                                onChange={e => setDialog(p => ({ ...p, width: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <input type="number" step="0.5" min="1" value={H}
                                onChange={e => setDialog(p => ({ ...p, height: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Depth (Z)</div>
                            <input type="number" step="0.5" min="1" value={D}
                                onChange={e => setDialog(p => ({ ...p, depth: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        The clear interior opening of the cabinet where drawers will be installed.
                    </p>
                </div>

                {/* Drawer Configuration */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Drawer Configuration</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <div style={labelStyle}>Number of Drawers</div>
                            <input type="number" step="1" min="1" max="10" value={count}
                                onChange={e => setDialog(p => ({ ...p, count: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Corner Joint Type</div>
                            <select
                                value={jointType}
                                onChange={e => setDialog(p => ({ ...p, jointType: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="butt">Butt (Sides capture F/B)</option>
                                <option value="rabbet">Rabbeted Sides</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Slide Width</div>
                            <input type="number" step="0.125" min="0" value={slideWidth}
                                onChange={e => setDialog(p => ({ ...p, slideWidth: e.target.value }))}
                                style={inputStyle} title="Clearance on each side for the slide hardware" />
                        </div>
                        <div>
                            <div style={labelStyle}>Vertical Gap</div>
                            <input type="number" step="0.0625" min="0" value={verticalGap}
                                onChange={e => setDialog(p => ({ ...p, verticalGap: e.target.value }))}
                                style={inputStyle} title="Gap between drawer faces" />
                        </div>
                        <div>
                            <div style={labelStyle}>Box Top Clear.</div>
                            <input type="number" step="0.125" min="0" value={topClearance}
                                onChange={e => setDialog(p => ({ ...p, topClearance: e.target.value }))}
                                style={inputStyle} title="Clearance above the drawer box to the slot ceiling" />
                        </div>
                    </div>
                </div>

                {/* Face Styling */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Drawer Face Styling</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: faceStyle === 'overlay' ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <div style={labelStyle}>Face Style</div>
                            <select
                                value={faceStyle}
                                onChange={e => setDialog(p => ({ ...p, faceStyle: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="inset">Inset (Flush with frame)</option>
                                <option value="overlay">Overlay (Proud of frame)</option>
                            </select>
                        </div>
                        {faceStyle === 'overlay' && (
                            <div>
                                <div style={labelStyle}>Overlay Amount</div>
                                <input type="number" step="0.125" min="0" value={overlayAmount}
                                    onChange={e => setDialog(p => ({ ...p, overlayAmount: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Material Thickness */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Material Thickness (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Box Sides</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessBox}
                                onChange={e => setDialog(p => ({ ...p, thicknessBox: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Bottom Panel</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessBottom}
                                onChange={e => setDialog(p => ({ ...p, thicknessBottom: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Drawer Face</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessFace}
                                onChange={e => setDialog(p => ({ ...p, thicknessFace: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {!valid && (
                    <div style={{ color: '#ff3b30', fontSize: '0.85rem', background: 'rgba(255, 59, 48, 0.1)', padding: '8px', borderRadius: '4px' }}>
                        Invalid dimensions. Ensure cabinet opening is larger than clearances.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button className="secondary-btn" onClick={() => setDialog(null)}>Cancel</button>
                    <button className="primary-btn" disabled={!valid} onClick={handleBuild}>
                        {dialog.editGroupId ? 'Update Drawers' : 'Build Drawers'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrawerBuilderDialog;
