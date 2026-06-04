import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const FaceFrameBuilderDialog = () => {
    const { faceFrameDialog: dialog, setFaceFrameDialog: setDialog, buildFaceFrame, groups, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const cabinetGroupId = dialog.cabinetGroupId;
    const hasCabinet = !!cabinetGroupId;
    const cabinetGroup = cabinetGroupId ? groups[cabinetGroupId] : null;
    const cabinetName = cabinetGroup ? cabinetGroup.name : (dialog.parentCabinetName || 'Selected Cabinet');

    const W_in = parseNum(dialog.width, 24);
    const H_in = parseNum(dialog.height, 30);
    const t_in = parseNum(dialog.thickness, 0.75);
    const wStile_in = parseNum(dialog.stileWidth, 1.5);
    const wRail_in = parseNum(dialog.railWidth, 1.5);

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const t = isMetric ? parseFloat((t_in * 25.4).toFixed(1)) : t_in;
    const wStile = isMetric ? parseFloat((wStile_in * 25.4).toFixed(1)) : wStile_in;
    const wRail = isMetric ? parseFloat((wRail_in * 25.4).toFixed(1)) : wRail_in;

    const valid = W_in > (2 * wStile_in) && H_in > (2 * wRail_in);

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const unitFmtLabel = isMetric ? 'mm' : 'in';

    const handleBuild = () => {
        if (!valid) return;
        if (buildFaceFrame) buildFaceFrame(dialog);
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
                    <span style={{ fontSize: '1.2rem' }}>🖼️</span> Face Frame
                </h2>

                {/* Cabinet Detection Banner */}
                {hasCabinet && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px dashed rgba(52, 199, 89, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                        lineHeight: 1.4
                    }}>
                        <strong>✓ Cabinet Group Selected ("{cabinetName}")</strong><br/>
                        The face frame will be placed and auto-sized precisely to fit the front face of the selected cabinet.
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
                        You selected a board belonging to a cabinet, but not the entire cabinet group. To automatically fit this face frame, close this builder, select the <strong>Cabinet</strong> group in the tree or double-click it, and try again.
                    </div>
                )}
                {!hasCabinet && !dialog.cabinetBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Cabinet selected.</strong><br/>
                        Building a standalone face frame. You can input custom dimensions directly below.<br/>
                        <span style={{ display: 'block', marginTop: '6px', color: 'var(--accent-color)', fontWeight: 'bold' }}>💡 Tip: To auto-fit, close this builder, select the entire Cabinet group in the tree, and try again.</span>
                    </div>
                )}

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Opening ({unitFmtLabel})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                    </div>
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Frame Dimensions ({unitFmtLabel})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Stile Width</div>
                            <NumericInput step={isMetric ? "5" : "0.125"} min={isMetric ? "10" : "0.5"} value={wStile}
                                onChange={val => setDialog(p => ({ ...p, stileWidth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Rail Width</div>
                            <NumericInput step={isMetric ? "5" : "0.125"} min={isMetric ? "10" : "0.5"} value={wRail}
                                onChange={val => setDialog(p => ({ ...p, railWidth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Thickness</div>
                            <NumericInput step={isMetric ? "1" : "0.125"} min={isMetric ? "3" : "0.25"} value={t}
                                onChange={val => setDialog(p => ({ ...p, thickness: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {!valid && (
                    <div className="inspector-card" style={{ margin: 0, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.3)' }}>
                        <h4 style={{ color: '#ff3b30' }}>⚠ Invalid Dimensions</h4>
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            The stiles and rails are too wide for the given opening size.
                        </div>
                    </div>
                )}

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
                        🖼️ Build Frame
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FaceFrameBuilderDialog;
