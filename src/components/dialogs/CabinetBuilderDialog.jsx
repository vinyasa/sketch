import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const CabinetBuilderDialog = () => {
    const { cabinetDialog: dialog, setCabinetDialog: setDialog, buildCabinet, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const W_in = parseNum(dialog.width, 24);
    const H_in = parseNum(dialog.height, 30);
    const D_in = parseNum(dialog.depth, 14);
    const tTB_in = parseNum(dialog.thicknessTB, 0.75);
    const tSide_in = parseNum(dialog.thicknessSide, 0.75);
    const tFront_in = parseNum(dialog.thicknessFront, 0.75);
    const tBack_in = parseNum(dialog.thicknessBack, 0.25);

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const D = isMetric ? parseFloat((D_in * 25.4).toFixed(1)) : D_in;
    const tTB = isMetric ? parseFloat((tTB_in * 25.4).toFixed(1)) : tTB_in;
    const tSide = isMetric ? parseFloat((tSide_in * 25.4).toFixed(1)) : tSide_in;
    const tFront = isMetric ? parseFloat((tFront_in * 25.4).toFixed(1)) : tFront_in;
    const tBack = isMetric ? parseFloat((tBack_in * 25.4).toFixed(1)) : tBack_in;

    const jointType = 'butt'; // Hardcoded as per design decision
    const backStyle = dialog.backStyle ?? 'flat';

    // Derived panel sizes for the summary (assuming butt joint: sides full height, top/bottom between)
    const coreDepth = backStyle === 'flat' ? D - tBack : D;
    const topBottom = { x: W - 2 * tSide, y: tTB, z: coreDepth };
    const sides = { x: tSide, y: H, z: coreDepth };
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

    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : (isMetric ? 1 : 3));
    const unitLabel = isMetric ? 'mm' : '"';

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
                    <span style={{ fontSize: '1.2rem' }}>🗄</span> {dialog.editGroupId ? 'Edit Cabinet' : 'Cabinet Builder'}
                </h2>

                {/* Overall Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions ({isMetric ? 'mm' : 'in'})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={W}
                                onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={H}
                                onChange={val => setDialog(p => ({ ...p, height: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Depth (Z)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={D}
                                onChange={val => setDialog(p => ({ ...p, depth: isMetric ? val / 25.4 : val }))}
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
                            <div style={labelStyle}>Corner Joints</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', padding: '6px 0', lineHeight: 1.4 }}>
                                Built natively as <strong>Butt Joints</strong>.<br/>
                                <span style={{ color: 'var(--text-muted)' }}>Use the Tools panel later to change to Rabbet or Miter.</span>
                            </div>
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
                    <h4>Panel Thickness ({isMetric ? 'mm' : 'in'})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Top / Bottom</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0.125" value={tTB}
                                onChange={val => setDialog(p => ({ ...p, thicknessTB: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Left / Right Sides</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0.125" value={tSide}
                                onChange={val => setDialog(p => ({ ...p, thicknessSide: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Back</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0.125" value={tBack}
                                onChange={val => setDialog(p => ({ ...p, thicknessBack: isMetric ? val / 25.4 : val }))}
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
                            <div><strong>Top / Bottom:</strong> {fmt(topBottom.x)}{unitLabel} × {fmt(topBottom.y)}{unitLabel} × {fmt(topBottom.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(fits between sides)</span></div>
                            <div><strong>Left / Right:</strong> {fmt(sides.x)}{unitLabel} × {fmt(sides.y)}{unitLabel} × {fmt(sides.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(full height)</span></div>
                            <div><strong>Back:</strong> {fmt(back.x)}{unitLabel} × {fmt(back.y)}{unitLabel} × {fmt(back.z)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>(flush, no overlap)</span></div>
                            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Core depth (excluding back): {fmt(coreDepth)}{unitLabel} · Back-bottom-left at origin
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
                        {dialog.editGroupId ? '🗄 Update Cabinet' : '🗄 Build Cabinet'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CabinetBuilderDialog;
