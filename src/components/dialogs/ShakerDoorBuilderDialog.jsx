import React from 'react';
import useStore from '../../store/useStore';

const ShakerDoorBuilderDialog = () => {
    const { shakerDoorDialog: dialog, setShakerDoorDialog: setDialog, buildShakerDoor } = useStore();
    if (!dialog) return null;

    const W = dialog.width ?? 18;
    const H = dialog.height ?? 30;
    const tFrame = dialog.thicknessFrame ?? 0.75;
    const tPanel = dialog.thicknessPanel ?? 0.25;
    const wStileRail = dialog.widthStileRail ?? 2;
    const grooveDepth = dialog.grooveDepth ?? 0.375;
    const grooveWidth = dialog.grooveWidth ?? 0.25;
    const panelClearance = dialog.panelClearance ?? 0.125;

    // Derived panel sizes for the summary
    const stile = { x: wStileRail, y: H, z: tFrame };
    const rail = { x: W - (2 * wStileRail), y: wStileRail, z: tFrame };
    
    // Panel width is inside width (W - 2*stile) + 2*grooveDepth - panelClearance
    const panelW = W - (2 * wStileRail) + (2 * grooveDepth) - panelClearance;
    const panelH = H - (2 * wStileRail) + (2 * grooveDepth) - panelClearance;
    const panel = { x: panelW, y: panelH, z: tPanel };

    const valid = W > 2 * wStileRail && H > 2 * wStileRail && tFrame >= grooveWidth;

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : 3);

    const handleBuild = () => {
        if (!valid) return;
        buildShakerDoor(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '540px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🚪</span> Shaker Door Builder
                </h2>

                {/* Overall Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <input type="number" step="0.5" min="4" value={W}
                                onChange={e => setDialog(p => ({ ...p, width: Math.max(4, parseFloat(e.target.value) || 4) }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <input type="number" step="0.5" min="4" value={H}
                                onChange={e => setDialog(p => ({ ...p, height: Math.max(4, parseFloat(e.target.value) || 4) }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Frame Details */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Frame Details (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Stile/Rail Width</div>
                            <input type="number" step="0.125" min="1" value={wStileRail}
                                onChange={e => setDialog(p => ({ ...p, widthStileRail: Math.max(1, parseFloat(e.target.value) || 1) }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Frame Thickness</div>
                            <input type="number" step="0.125" min="0.5" value={tFrame}
                                onChange={e => setDialog(p => ({ ...p, thicknessFrame: Math.max(0.5, parseFloat(e.target.value) || 0.5) }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Groove Details */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Groove & Panel Details (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Groove Depth</div>
                            <input type="number" step="0.0625" min="0" value={grooveDepth}
                                onChange={e => setDialog(p => ({ ...p, grooveDepth: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Groove Width</div>
                            <input type="number" step="0.0625" min="0" value={grooveWidth}
                                onChange={e => setDialog(p => ({ ...p, grooveWidth: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Panel Thickness</div>
                            <input type="number" step="0.0625" min="0.125" value={tPanel}
                                onChange={e => setDialog(p => ({ ...p, thicknessPanel: Math.max(0.125, parseFloat(e.target.value) || 0.125) }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Panel Clearance</div>
                            <input type="number" step="0.0625" min="0" value={panelClearance}
                                onChange={e => setDialog(p => ({ ...p, panelClearance: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        The panel sits inside the groove in the stiles and rails, with the specified clearance so it doesn't bottom out.
                    </p>
                </div>

                {/* Panel Summary */}
                <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                    <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Component Summary' : '⚠ Invalid Dimensions'}</h4>
                    {valid ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                            <div><strong>Stiles (×2):</strong> {fmt(stile.x)}" × {fmt(stile.y)}" × {fmt(stile.z)}" <span style={{ color: 'var(--text-muted)' }}>(full height)</span></div>
                            <div><strong>Rails (×2):</strong> {fmt(rail.x)}" × {fmt(rail.y)}" × {fmt(rail.z)}" <span style={{ color: 'var(--text-muted)' }}>(between stiles)</span></div>
                            <div><strong>Center Panel:</strong> {fmt(panel.x)}" × {fmt(panel.y)}" × {fmt(panel.z)}" <span style={{ color: 'var(--text-muted)' }}>(with {fmt(panelClearance)}" clearance)</span></div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            Dimensions are invalid. Stile/rail width must be less than half the total width/height.
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="nav-btn" style={{ flex: 1, padding: '10px' }}
                        onClick={() => setDialog(null)}>
                        Cancel
                    </button>
                    <button className="primary-btn" style={{
                        flex: 1, padding: '10px',
                        opacity: valid ? 1 : 0.4,
                        cursor: valid ? 'pointer' : 'default',
                    }}
                        disabled={!valid}
                        onClick={handleBuild}>
                        🚪 Build Door
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShakerDoorBuilderDialog;
