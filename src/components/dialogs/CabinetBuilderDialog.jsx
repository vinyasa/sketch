import React from 'react';
import useStore from '../../store/useStore';

const CabinetBuilderDialog = () => {
    const { cabinetDialog: dialog, setCabinetDialog: setDialog, buildCabinet } = useStore();
    if (!dialog) return null;

    const parse = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const W = parse(dialog.width, 24);
    const H = parse(dialog.height, 30);
    const D = parse(dialog.depth, 14);
    const tTB = parse(dialog.thicknessTB, 0.75);
    const tSide = parse(dialog.thicknessSide, 0.75);
    const tFront = parse(dialog.thicknessFront, 0.75);
    const tBack = parse(dialog.thicknessBack, 0.25);
    const jointType = dialog.jointType ?? 'rabbet';
    const backStyle = dialog.backStyle ?? 'flat';

    // Derived panel sizes for the summary
    const coreDepth = D - tFront - tBack;
    const topBottom = { x: W, y: tTB, z: coreDepth };
    const sides = { x: tSide, y: H, z: coreDepth };
    const front = { x: W, y: H, z: tFront };
    const back = { x: W, y: H, z: tBack };

    const valid = coreDepth > 0 && W > 2 * tSide && H > 2 * tTB;

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
        buildCabinet(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '440px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🗄</span> Cabinet Builder
                </h2>

                {/* Overall Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions (in)</h4>
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
                        Total outer dimensions including all panels.
                    </p>
                </div>

                {/* Construction */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Construction</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Corner Joint Type</div>
                            <select
                                value={jointType}
                                onChange={e => setDialog(p => ({ ...p, jointType: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="rabbet">Dual Rabbet Joint</option>
                                <option value="butt">Butt Joint</option>
                            </select>
                        </div>
                        <div>
                            <div style={labelStyle}>Back Style</div>
                            <select
                                value={backStyle}
                                onChange={e => setDialog(p => ({ ...p, backStyle: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="flat">Flat (Nailed on)</option>
                                <option value="inset">Inset (Rabbeted)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Panel Thicknesses */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Panel Thickness (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Top / Bottom</div>
                            <input type="number" step="0.0625" min="0.125" value={tTB}
                                onChange={e => setDialog(p => ({ ...p, thicknessTB: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Left / Right Sides</div>
                            <input type="number" step="0.0625" min="0.125" value={tSide}
                                onChange={e => setDialog(p => ({ ...p, thicknessSide: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Front</div>
                            <input type="number" step="0.0625" min="0.125" value={tFront}
                                onChange={e => setDialog(p => ({ ...p, thicknessFront: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Back</div>
                            <input type="number" step="0.0625" min="0.125" value={tBack}
                                onChange={e => setDialog(p => ({ ...p, thicknessBack: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        {backStyle === 'inset' 
                            ? "Back is inset into sides/top/bottom via rabbets. Overall cabinet depth equals the side depth."
                            : "Back attaches flush to the rear. Overall cabinet depth equals side depth plus back thickness."}
                    </p>
                </div>

                {/* Panel Summary */}
                <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                    <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Panel Summary' : '⚠ Invalid Dimensions'}</h4>
                    {valid ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                            <div><strong>Top / Bottom:</strong> {fmt(topBottom.x)}" × {fmt(topBottom.y)}" × {fmt(topBottom.z)}" <span style={{ color: 'var(--text-muted)' }}>(full width, overlap sides)</span></div>
                            <div><strong>Left / Right:</strong> {fmt(sides.x)}" × {fmt(sides.y)}" × {fmt(sides.z)}" <span style={{ color: 'var(--text-muted)' }}>(full height)</span></div>
                            <div><strong>Front:</strong> {fmt(front.x)}" × {fmt(front.y)}" × {fmt(front.z)}" <span style={{ color: 'var(--text-muted)' }}>(flush, no overlap)</span></div>
                            <div><strong>Back:</strong> {fmt(back.x)}" × {fmt(back.y)}" × {fmt(back.z)}" <span style={{ color: 'var(--text-muted)' }}>(flush, no overlap)</span></div>
                            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Core depth (between front/back): {fmt(coreDepth)}" · Back-bottom-left at origin
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            Panel thicknesses exceed the overall dimensions. Adjust sizes to continue.
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
                        🗄 Build Cabinet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CabinetBuilderDialog;
