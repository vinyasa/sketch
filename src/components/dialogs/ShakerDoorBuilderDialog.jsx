import React from 'react';
import useStore from '../../store/useStore';

const ShakerDoorBuilderDialog = () => {
    const { shakerDoorDialog: dialog, setShakerDoorDialog: setDialog, buildShakerDoor, groups } = useStore();
    if (!dialog) return null;

    const cabinetGroupId = dialog.cabinetGroupId;
    const faceFrameGroupId = dialog.faceFrameGroupId;
    const hasCabinet = !!cabinetGroupId;
    const hasFaceFrame = !!faceFrameGroupId;
    const cabinetGroup = cabinetGroupId ? groups[cabinetGroupId] : null;
    const faceFrameGroup = faceFrameGroupId ? groups[faceFrameGroupId] : null;
    const cabinetName = cabinetGroup ? cabinetGroup.name : 'Selected Cabinet';
    const faceFrameName = faceFrameGroup ? faceFrameGroup.name : 'Selected Face Frame';

    const parse = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const W = parse(dialog.width, 18);
    const H = parse(dialog.height, 30);
    const tFrame = parse(dialog.thicknessFrame, 0.75);
    const tPanel = parse(dialog.thicknessPanel, 0.25);
    const wStileRail = parse(dialog.widthStileRail, 2);
    const grooveDepth = parse(dialog.grooveDepth, 0.375);
    const grooveWidth = parse(dialog.grooveWidth, 0.25);
    const panelClearance = parse(dialog.panelClearance, 0.125);

    const doorStyle = dialog.doorStyle || 'overlay';
    const insetClearance = parse(dialog.insetClearance, 0.125);
    const overlayReveal = parse(dialog.overlayReveal, 0.25);
    const doorConstruction = dialog.doorConstruction || 'shaker';
    const doorCount = parse(dialog.doorCount, 1);
    const doubleDoorGap = parse(dialog.doubleDoorGap, 0.09375); // 3/32" gap default

    let openingW = W;
    let openingH = H;
    if (hasCabinet && cabinetGroup) {
        const tSide = parse(cabinetGroup.meta?.params?.thicknessSide, 0.75);
        const tTB = parse(cabinetGroup.meta?.params?.thicknessTB, 0.75);
        if (doorStyle === 'inset') {
            openingW = W - 2 * tSide;
            openingH = H - 2 * tTB;
        }
    } else if (hasFaceFrame && faceFrameGroup) {
        const wStileFF = parse(faceFrameGroup.meta?.params?.stileWidth, 1.5);
        const wRailFF = parse(faceFrameGroup.meta?.params?.railWidth, 1.5);
        if (doorStyle === 'inset') {
            openingW = W - 2 * wStileFF;
            openingH = H - 2 * wRailFF;
        }
    }

    const totalDoorSpaceW = doorStyle === 'inset'
        ? (openingW - 2 * insetClearance)
        : ((hasCabinet || hasFaceFrame) ? (W - 2 * overlayReveal) : W);

    const actualDoorW = doorCount === 2
        ? (totalDoorSpaceW - doubleDoorGap) / 2
        : totalDoorSpaceW;

    const actualDoorH = doorStyle === 'inset'
        ? (openingH - 2 * insetClearance)
        : ((hasCabinet || hasFaceFrame) ? (H - 2 * overlayReveal) : H);

    // Derived panel sizes for the summary (Shaker only)
    const stile = { x: wStileRail, y: actualDoorH, z: tFrame };
    const rail = { x: actualDoorW - (2 * wStileRail), y: wStileRail, z: tFrame };
    
    const panelW = actualDoorW - (2 * wStileRail) + (2 * grooveDepth) - panelClearance;
    const panelH = actualDoorH - (2 * wStileRail) + (2 * grooveDepth) - panelClearance;
    const panel = { x: panelW, y: panelH, z: tPanel };

    const valid = doorConstruction === 'flat' 
        ? (W > 0 && H > 0)
        : (actualDoorW > 2 * wStileRail && actualDoorH > 2 * wStileRail && tFrame >= grooveWidth);

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
                    <span style={{ fontSize: '1.2rem' }}>🚪</span> Door Builder
                </h2>

                {/* Selection Detection Banner */}
                {hasCabinet && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px dashed rgba(52, 199, 89, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                        lineHeight: 1.4
                    }}>
                        <strong>✓ Cabinet Group Selected ("{cabinetName}")</strong><br/>
                        The doors will be placed flush against the front of the selected cabinet, pre-populated to match its carcass size.
                    </div>
                )}
                {hasFaceFrame && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px dashed rgba(52, 199, 89, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                        lineHeight: 1.4
                    }}>
                        <strong>✓ Face Frame Selected ("{faceFrameName}")</strong><br/>
                        The doors will be placed flush against the front of the face frame, pre-populated to match its outer dimensions.
                    </div>
                )}
                {!hasCabinet && !hasFaceFrame && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Cabinet or Face Frame selected.</strong><br/>
                        Building a standalone door. You can input custom dimensions directly below.
                    </div>
                )}

                {/* Overall Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <input type="number" step="0.5" min="4" value={W}
                                onChange={e => setDialog(p => ({ ...p, width: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <input type="number" step="0.5" min="4" value={H}
                                onChange={e => setDialog(p => ({ ...p, height: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Door Quantity */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Door Quantity</h4>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <button
                            className="nav-btn"
                            type="button"
                            style={{
                                flex: 1, padding: '5px 0', fontSize: '0.78rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                background: doorCount === 1 ? 'var(--accent-color)' : 'transparent',
                                color: doorCount === 1 ? 'white' : 'var(--text-muted)',
                                fontWeight: doorCount === 1 ? 'bold' : 'normal',
                            }}
                            onClick={() => setDialog(p => ({ ...p, doorCount: 1 }))}
                        >
                            Single Door
                        </button>
                        <button
                            className="nav-btn"
                            type="button"
                            style={{
                                flex: 1, padding: '5px 0', fontSize: '0.78rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                background: doorCount === 2 ? 'var(--accent-color)' : 'transparent',
                                color: doorCount === 2 ? 'white' : 'var(--text-muted)',
                                fontWeight: doorCount === 2 ? 'bold' : 'normal',
                            }}
                            onClick={() => setDialog(p => ({ ...p, doorCount: 2 }))}
                        >
                            Double Doors
                        </button>
                    </div>
                    {doorCount === 2 && (
                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={labelStyle}>Gap between doors (in)</span>
                            <input type="number" step="0.03125" min="0" value={dialog.doubleDoorGap !== undefined ? dialog.doubleDoorGap : 0.09375}
                                onChange={e => setDialog(p => ({ ...p, doubleDoorGap: e.target.value }))}
                                style={{ ...inputStyle, width: '90px', marginLeft: 'auto', padding: '4px 6px' }} />
                        </div>
                    )}
                </div>

                {/* Construction Style */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Construction Style</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Door Type</div>
                            <select value={doorConstruction}
                                onChange={e => setDialog(p => ({ ...p, doorConstruction: e.target.value }))}
                                style={{
                                    width: '100%', padding: '5px 8px',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px',
                                    outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                                }}>
                                <option value="shaker">Shaker (5-Piece Frame & Panel)</option>
                                <option value="flat">Slab / Flat (Single Solid Board)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Door Style & Reveal */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Mounting Style</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Door Style</div>
                            <select value={doorStyle}
                                onChange={e => setDialog(p => ({ ...p, doorStyle: e.target.value }))}
                                style={{
                                    width: '100%', padding: '5px 8px',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px',
                                    outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                                }}>
                                <option value="overlay">Overlay Door (Flush on front)</option>
                                <option value="inset">Inset Door (Flush in opening)</option>
                            </select>
                        </div>
                        {doorStyle === 'overlay' && (
                            <div>
                                <div style={labelStyle}>Overlay Reveal (in)</div>
                                <input type="number" step="0.1" min="0" value={overlayReveal}
                                    onChange={e => setDialog(p => ({ ...p, overlayReveal: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                        )}
                        {doorStyle === 'inset' && (
                            <div>
                                <div style={labelStyle}>Reveal Clearance (in)</div>
                                <input type="number" step="0.03125" min="0" value={insetClearance}
                                    onChange={e => setDialog(p => ({ ...p, insetClearance: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Frame & Groove Details (Shaker only) */}
                {doorConstruction === 'shaker' ? (
                    <>
                        {/* Frame Details */}
                        <div className="inspector-card" style={{ margin: 0 }}>
                            <h4>Frame Details (in)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={labelStyle}>Stile/Rail Width</div>
                                    <input type="number" step="0.125" min="1" value={wStileRail}
                                        onChange={e => setDialog(p => ({ ...p, widthStileRail: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Frame Thickness</div>
                                    <input type="number" step="0.125" min="0.5" value={tFrame}
                                        onChange={e => setDialog(p => ({ ...p, thicknessFrame: e.target.value }))}
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
                                        onChange={e => setDialog(p => ({ ...p, grooveDepth: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Groove Width</div>
                                    <input type="number" step="0.0625" min="0" value={grooveWidth}
                                        onChange={e => setDialog(p => ({ ...p, grooveWidth: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Panel Thickness</div>
                                    <input type="number" step="0.0625" min="0.125" value={tPanel}
                                        onChange={e => setDialog(p => ({ ...p, thicknessPanel: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Panel Clearance</div>
                                    <input type="number" step="0.0625" min="0" value={panelClearance}
                                        onChange={e => setDialog(p => ({ ...p, panelClearance: e.target.value }))}
                                        style={inputStyle} />
                                </div>
                            </div>
                            <p className="hint" style={{ marginTop: '6px' }}>
                                The panel sits inside the groove in the stiles and rails, with the specified clearance so it doesn't bottom out.
                            </p>
                        </div>
                    </>
                ) : (
                    /* Flat Details */
                    <div className="inspector-card" style={{ margin: 0 }}>
                        <h4>Slab Details (in)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            <div>
                                <div style={labelStyle}>Door Thickness</div>
                                <input type="number" step="0.125" min="0.25" value={tFrame}
                                    onChange={e => setDialog(p => ({ ...p, thicknessFrame: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Panel Summary */}
                <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                    <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Component Summary' : '⚠ Invalid Dimensions'}</h4>
                    {valid ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                            {doorConstruction === 'flat' ? (
                                <div><strong>Flat Slab Door{doorCount === 2 ? 's (×2)' : ''}:</strong> {fmt(actualDoorW)}" × {fmt(actualDoorH)}" × {fmt(tFrame)}" <span style={{ color: 'var(--text-muted)' }}>({doorCount === 2 ? 'two single solid panels' : 'single solid panel'})</span></div>
                            ) : (
                                <>
                                    <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '3px' }}>Sizes per Door ({doorCount === 2 ? '2 Doors total' : '1 Door'}):</div>
                                    <div><strong>Stiles (×{2 * doorCount}):</strong> {fmt(stile.x)}" × {fmt(stile.y)}" × {fmt(stile.z)}" <span style={{ color: 'var(--text-muted)' }}>(vertical frame)</span></div>
                                    <div><strong>Rails (×{2 * doorCount}):</strong> {fmt(rail.x)}" × {fmt(rail.y)}" × {fmt(rail.z)}" <span style={{ color: 'var(--text-muted)' }}>(horizontal stiles fit)</span></div>
                                    <div><strong>Center Panel{doorCount === 2 ? 's (×2)' : ''}:</strong> {fmt(panel.x)}" × {fmt(panel.y)}" × {fmt(panel.z)}" <span style={{ color: 'var(--text-muted)' }}>(inner panels)</span></div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            {doorConstruction === 'flat' ? 'Please specify a valid door thickness.' : 'Dimensions are invalid. Individual stile/rail width must be less than half of each door width/height.'}
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
                        🚪 Build Door{doorCount === 2 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShakerDoorBuilderDialog;
