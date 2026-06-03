import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const TableBaseBuilderDialog = () => {
    const { tableBaseDialog: dialog, setTableBaseDialog: setDialog, buildTableBase, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const W_in = parseNum(dialog.width, 48);
    const H_in = parseNum(dialog.height, 29);
    const D_in = parseNum(dialog.depth, 30);
    const legSize_in = parseNum(dialog.legSize, 2.25);
    const legTaperAngle = parseNum(dialog.legTaperAngle, 1.5);
    const apronHeight_in = parseNum(dialog.apronHeight, 4.0);
    const apronThickness_in = parseNum(dialog.apronThickness, 0.75);
    const apronInset_in = parseNum(dialog.apronInset, 0.25);
    const apronJoint = dialog.apronJoint || 'pocket-hole';

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const D = isMetric ? parseFloat((D_in * 25.4).toFixed(1)) : D_in;
    const legSize = isMetric ? parseFloat((legSize_in * 25.4).toFixed(1)) : legSize_in;
    const apronHeight = isMetric ? parseFloat((apronHeight_in * 25.4).toFixed(1)) : apronHeight_in;
    const apronThickness = isMetric ? parseFloat((apronThickness_in * 25.4).toFixed(1)) : apronThickness_in;
    const apronInset = isMetric ? parseFloat((apronInset_in * 25.4).toFixed(1)) : apronInset_in;

    // Stringers Count Formula
    let numStringers = 0;
    if (W_in > 36) {
        numStringers = Math.max(1, Math.floor((W_in - 24) / 12));
    }

    const valid = W_in > 2 * legSize_in && D_in > 2 * legSize_in && H_in > apronHeight_in;

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const selectStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const unitFmtLabel = isMetric ? 'mm' : 'in';
    const unitLabel = isMetric ? 'mm' : '"';
    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : (isMetric ? 1 : 3));

    const handleBuild = () => {
        if (!valid) return;
        if (buildTableBase) buildTableBase(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '450px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏓</span> Table Base Builder
                </h2>

                {/* Overall Base Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Dimensions ({unitFmtLabel})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="12" value={W}
                                onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="6" value={H}
                                onChange={val => setDialog(p => ({ ...p, height: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Depth (Z)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="12" value={D}
                                onChange={val => setDialog(p => ({ ...p, depth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Legs Sizing & Taper */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Leg Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Leg Post Width ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "5" : "0.125"} min="1" value={legSize}
                                onChange={val => setDialog(p => ({ ...p, legSize: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Leg Taper Angle (°)</div>
                            <input type="number" step="0.5" min="0" max="15" value={legTaperAngle}
                                onChange={e => setDialog(p => ({ ...p, legTaperAngle: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        Legs taper on their two inward-facing sides only.
                    </p>
                </div>

                {/* Aprons and Connections */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Aprons & Joints</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <div style={labelStyle}>Apron Height ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "5" : "0.25"} min="1" value={apronHeight}
                                onChange={val => setDialog(p => ({ ...p, apronHeight: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Apron Thickness ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0.25" value={apronThickness}
                                onChange={val => setDialog(p => ({ ...p, apronThickness: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Apron Inset ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0" value={apronInset}
                                onChange={val => setDialog(p => ({ ...p, apronInset: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Apron-to-Leg Joint</div>
                            <select value={apronJoint}
                                onChange={e => setDialog(p => ({ ...p, apronJoint: e.target.value }))}
                                style={selectStyle}>
                                <option value="pocket-hole">Pocket Holes (Flush Butt)</option>
                                <option value="loose-tenon">Loose Tenon (Dominoes)</option>
                                <option value="dowels">Dowel Pins</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Base Summary & Stringer Feedback */}
                <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                    <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Structural Summary' : '⚠ Invalid Configuration'}</h4>
                    {valid ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                            <div><strong>Leg Size:</strong> {fmt(legSize)}{unitLabel} × {fmt(legSize)}{unitLabel} square tapered at {legTaperAngle}°</div>
                            <div><strong>Aprons:</strong> 4 panels at {fmt(apronHeight)}{unitLabel} tall, inset by {fmt(apronInset)}{unitLabel}</div>
                            <div><strong>Stringers:</strong> {numStringers > 0 ? `${numStringers} front-to-back stringers` : `No stringers (Width ≤ ${isMetric ? '914mm' : '36"'})`}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px' }}>
                                Stringers automatically scale to support table top screws.
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            Overall dimensions must be larger than leg widths and apron heights.
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
                        🏓 Build Table Base
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableBaseBuilderDialog;
