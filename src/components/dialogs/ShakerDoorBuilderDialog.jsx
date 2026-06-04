import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const ShakerDoorBuilderDialog = () => {
    const { shakerDoorDialog: dialog, setShakerDoorDialog: setDialog, buildShakerDoor, groups, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const cabinetGroupId = dialog.cabinetGroupId;
    const faceFrameGroupId = dialog.faceFrameGroupId;
    const hasCabinet = !!cabinetGroupId;
    const hasFaceFrame = !!faceFrameGroupId;
    const cabinetGroup = cabinetGroupId ? groups[cabinetGroupId] : null;
    const faceFrameGroup = faceFrameGroupId ? groups[faceFrameGroupId] : null;
    const cabinetName = cabinetGroup ? cabinetGroup.name : (dialog.parentCabinetName || 'Selected Cabinet');
    const faceFrameName = faceFrameGroup ? faceFrameGroup.name : (dialog.parentFaceFrameName || 'Selected Face Frame');

    const W_in = parseNum(dialog.width, 18);
    const H_in = parseNum(dialog.height, 30);
    const tFrame_in = parseNum(dialog.thicknessFrame, 0.75);
    const tPanel_in = parseNum(dialog.thicknessPanel, 0.25);
    const wStileRail_in = parseNum(dialog.widthStileRail, 2);
    const grooveDepth_in = parseNum(dialog.grooveDepth, 0.375);
    const grooveWidth_in = parseNum(dialog.grooveWidth, 0.25);
    const panelClearance_in = parseNum(dialog.panelClearance, 0.125);

    const doorStyle = dialog.doorStyle || 'overlay';
    const insetClearance_in = parseNum(dialog.insetClearance, 0.125);
    const overlayReveal_in = parseNum(dialog.overlayReveal, 0.25);
    const doorConstruction = dialog.doorConstruction || 'shaker';
    const doorCount = parseNum(dialog.doorCount, 1);
    const doubleDoorGap_in = parseNum(dialog.doubleDoorGap, 0.09375); // 3/32" gap default

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const tFrame = isMetric ? parseFloat((tFrame_in * 25.4).toFixed(1)) : tFrame_in;
    const tPanel = isMetric ? parseFloat((tPanel_in * 25.4).toFixed(1)) : tPanel_in;
    const wStileRail = isMetric ? parseFloat((wStileRail_in * 25.4).toFixed(1)) : wStileRail_in;
    const grooveDepth = isMetric ? parseFloat((grooveDepth_in * 25.4).toFixed(1)) : grooveDepth_in;
    const grooveWidth = isMetric ? parseFloat((grooveWidth_in * 25.4).toFixed(1)) : grooveWidth_in;
    const panelClearance = isMetric ? parseFloat((panelClearance_in * 25.4).toFixed(1)) : panelClearance_in;
    const insetClearance = isMetric ? parseFloat((insetClearance_in * 25.4).toFixed(1)) : insetClearance_in;
    const overlayReveal = isMetric ? parseFloat((overlayReveal_in * 25.4).toFixed(1)) : overlayReveal_in;
    const doubleDoorGap = isMetric ? parseFloat((doubleDoorGap_in * 25.4).toFixed(1)) : doubleDoorGap_in;

    let openingW = W;
    let openingH = H;
    if (hasCabinet && cabinetGroup) {
        const tSide = parseNum(cabinetGroup.meta?.params?.thicknessSide, 0.75);
        const tTB = parseNum(cabinetGroup.meta?.params?.thicknessTB, 0.75);
        if (doorStyle === 'inset') {
            openingW = W - 2 * tSide;
            openingH = H - 2 * tTB;
        }
    } else if (hasFaceFrame && faceFrameGroup) {
        const wStileFF = parseNum(faceFrameGroup.meta?.params?.stileWidth, 1.5);
        const wRailFF = parseNum(faceFrameGroup.meta?.params?.railWidth, 1.5);
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

    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : (isMetric ? 1 : 3));
    const unitLabel = isMetric ? 'mm' : '"';

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
                {dialog.cabinetBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 149, 0, 0.1)',
                        border: '1px dashed rgba(255, 149, 0, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#ff9500',
                        lineHeight: 1.4
                    }}>
                        <strong>⚠ Single Board Selected ("{cabinetName}")</strong><br/>
                        You selected a board belonging to a cabinet, but not the entire cabinet group. To automatically fit these doors, close this builder, select the <strong>Cabinet</strong> group in the tree or double-click it, and try again.
                    </div>
                )}
                {dialog.faceFrameBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 149, 0, 0.1)',
                        border: '1px dashed rgba(255, 149, 0, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#ff9500',
                        lineHeight: 1.4
                    }}>
                        <strong>⚠ Single Board Selected ("{faceFrameName}")</strong><br/>
                        You selected a board belonging to a face frame, but not the entire face frame group. To automatically fit these doors, close this builder, select the <strong>Face Frame</strong> group in the tree, and try again.
                    </div>
                )}
                {!hasCabinet && !hasFaceFrame && !dialog.cabinetBoardSelected && !dialog.faceFrameBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Cabinet or Face Frame selected.</strong><br/>
                        Building a standalone door. You can input custom dimensions directly below.<br/>
                        <span style={{ display: 'block', marginTop: '6px', color: 'var(--accent-color)', fontWeight: 'bold' }}>💡 Tip: To auto-fit, close this builder, select the entire Cabinet or Face Frame group in the tree, and try again.</span>
                    </div>
                )}

                {/* Overall Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions ({isMetric ? 'mm' : 'in'})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="4" value={W}
                                onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="4" value={H}
                                onChange={val => setDialog(p => ({ ...p, height: isMetric ? val / 25.4 : val }))}
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
                            <span style={labelStyle}>Gap between doors ({isMetric ? 'mm' : 'in'})</span>
                            <NumericInput step={isMetric ? "1" : "0.03125"} min="0" value={doubleDoorGap}
                                onChange={val => setDialog(p => ({ ...p, doubleDoorGap: isMetric ? val / 25.4 : val }))}
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
                                <div style={labelStyle}>Overlay Reveal ({isMetric ? 'mm' : 'in'})</div>
                                <NumericInput step={isMetric ? "1" : "0.1"} min="0" value={overlayReveal}
                                    onChange={val => setDialog(p => ({ ...p, overlayReveal: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} />
                            </div>
                        )}
                        {doorStyle === 'inset' && (
                            <div>
                                <div style={labelStyle}>Reveal Clearance ({isMetric ? 'mm' : 'in'})</div>
                                <NumericInput step={isMetric ? "0.5" : "0.03125"} min="0" value={insetClearance}
                                    onChange={val => setDialog(p => ({ ...p, insetClearance: isMetric ? val / 25.4 : val }))}
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
                            <h4>Frame Details ({isMetric ? 'mm' : 'in'})</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={labelStyle}>Stile/Rail Width</div>
                                    <NumericInput step={isMetric ? "5" : "0.125"} min="1" value={wStileRail}
                                        onChange={val => setDialog(p => ({ ...p, widthStileRail: isMetric ? val / 25.4 : val }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Frame Thickness</div>
                                    <NumericInput step={isMetric ? "1" : "0.125"} min="0.5" value={tFrame}
                                        onChange={val => setDialog(p => ({ ...p, thicknessFrame: isMetric ? val / 25.4 : val }))}
                                        style={inputStyle} />
                                </div>
                            </div>
                        </div>

                        {/* Groove Details */}
                        <div className="inspector-card" style={{ margin: 0 }}>
                            <h4>Groove & Panel Details ({isMetric ? 'mm' : 'in'})</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={labelStyle}>Groove Depth</div>
                                    <NumericInput step={isMetric ? "1" : "0.0625"} min="0" value={grooveDepth}
                                        onChange={val => setDialog(p => ({ ...p, grooveDepth: isMetric ? val / 25.4 : val }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Groove Width</div>
                                    <NumericInput step={isMetric ? "1" : "0.0625"} min="0" value={grooveWidth}
                                        onChange={val => setDialog(p => ({ ...p, grooveWidth: isMetric ? val / 25.4 : val }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Panel Thickness</div>
                                    <NumericInput step={isMetric ? "1" : "0.0625"} min="0.125" value={tPanel}
                                        onChange={val => setDialog(p => ({ ...p, thicknessPanel: isMetric ? val / 25.4 : val }))}
                                        style={inputStyle} />
                                </div>
                                <div>
                                    <div style={labelStyle}>Panel Clearance</div>
                                    <NumericInput step={isMetric ? "0.5" : "0.0625"} min="0" value={panelClearance}
                                        onChange={val => setDialog(p => ({ ...p, panelClearance: isMetric ? val / 25.4 : val }))}
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
                        <h4>Slab Details ({isMetric ? 'mm' : 'in'})</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                            <div>
                                <div style={labelStyle}>Door Thickness</div>
                                <NumericInput step={isMetric ? "1" : "0.125"} min="0.25" value={tFrame}
                                    onChange={val => setDialog(p => ({ ...p, thicknessFrame: isMetric ? val / 25.4 : val }))}
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
                                <div><strong>Flat Slab Door{doorCount === 2 ? 's (×2)' : ''}:</strong> {fmt(actualDoorW)}{unitLabel} × {fmt(actualDoorH)}{unitLabel} × {fmt(tFrame)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>({doorCount === 2 ? 'two single solid panels' : 'single solid panel'})</span></div>
                            ) : (
                                <>
                                    <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '3px' }}>Sizes per Door ({doorCount === 2 ? `2 Doors total, units: ${unitLabel}` : `1 Door, units: ${unitLabel}`}):</div>
                                    <div><strong>Stiles (×{2 * doorCount}):</strong> {fmt(stile.x)}{unitLabel} × {fmt(stile.y)}{unitLabel} × {fmt(stile.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(vertical frame)</span></div>
                                    <div><strong>Rails (×{2 * doorCount}):</strong> {fmt(rail.x)}{unitLabel} × {fmt(rail.y)}{unitLabel} × {fmt(rail.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(horizontal stiles fit)</span></div>
                                    <div><strong>Center Panel{doorCount === 2 ? 's (×2)' : ''}:</strong> {fmt(panel.x)}{unitLabel} × {fmt(panel.y)}{unitLabel} × {fmt(panel.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(inner panels)</span></div>
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
