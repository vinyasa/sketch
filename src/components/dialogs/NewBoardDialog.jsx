import React from 'react';
import { taperValidation, normalizeTaper } from '../../utils/geometryBuilders';
import useStore from '../../store/useStore';
import { parseLumberyardNominal } from '../../utils/lumberyard';
import NumericInput from '../NumericInput';

const NewBoardDialog = () => {
    const { newBoardDialog: dialog, setNewBoardDialog: setDialog, groups, handleNewBoardConfirm: onConfirm, units, lumberyardSnapEnabled } = useStore();
    if (!dialog) return null;

    const shape = dialog.shape ?? 'box';
    // Taper: 4-angle model
    const taper = normalizeTaper(dialog.taper ?? {});
    const { angleLeft: aL, angleRight: aR, angleFront: aF, angleBack: aB } = taper;
    // Cylinder values derived from dialog
    const cylRadius = dialog.cylinder?.radius ?? dialog.sizeX / 2;
    const cylHeight = dialog.sizeY;

    const btnStyle = (active) => ({
        padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600,
        borderRadius: '6px',
        border: active ? '1px solid rgba(188,138,95,0.8)' : '1px solid var(--border-color)',
        background: active ? 'rgba(188,138,95,0.2)' : 'transparent',
        color: active ? 'var(--accent-color)' : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.15s',
    });

    const inputStyle = (warn) => ({
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: `1px solid ${warn ? '#ff3b30' : 'var(--border-color)'}`,
        borderRadius: '6px', outline: 'none', fontSize: '0.9rem',
    });

    const setTaperAngle = (key, val) =>
        setDialog(p => ({ ...p, taper: { ...normalizeTaper(p.taper), [key]: Math.max(0, parseFloat(val) || 0) } }));

    let taperPreview = null;
    if (shape === 'taper') {
        const { xBottom, zBottom, xWarn, zWarn } = taperValidation(
            dialog.sizeX, dialog.sizeY, dialog.sizeZ, aL, aR, aF, aB
        );
        const hasWarn = xWarn || zWarn;
        taperPreview = (
            <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Left (X−) °</div>
                        <input type="number" min="0" max="89" step="0.5" value={aL}
                            onChange={e => setTaperAngle('angleLeft', e.target.value)}
                            style={inputStyle(xWarn)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Right (X+) °</div>
                        <input type="number" min="0" max="89" step="0.5" value={aR}
                            onChange={e => setTaperAngle('angleRight', e.target.value)}
                            style={inputStyle(xWarn)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Front (Z+) °</div>
                        <input type="number" min="0" max="89" step="0.5" value={aF}
                            onChange={e => setTaperAngle('angleFront', e.target.value)}
                            style={inputStyle(zWarn)} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Back (Z−) °</div>
                        <input type="number" min="0" max="89" step="0.5" value={aB}
                            onChange={e => setTaperAngle('angleBack', e.target.value)}
                            style={inputStyle(zWarn)} />
                    </div>
                </div>
                <div style={{
                    padding: '7px 10px', borderRadius: '6px', fontSize: '0.75rem',
                    background: hasWarn ? 'rgba(255,59,48,0.08)' : 'rgba(60,200,90,0.08)',
                    border: `1px solid ${hasWarn ? 'rgba(255,59,48,0.3)' : 'rgba(60,200,90,0.25)'}`,
                    color: 'var(--text-muted)',
                }}>
                    Bottom cross-section:{' '}
                    <span style={{ color: xWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>
                        X' = {units === 'metric' ? `${(Math.max(0, xBottom) * 25.4).toFixed(1)}mm` : `${Math.max(0, xBottom).toFixed(3)}"`}
                    </span>
                    {' × '}
                    <span style={{ color: zWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>
                        Z' = {units === 'metric' ? `${(Math.max(0, zBottom) * 25.4).toFixed(1)}mm` : `${Math.max(0, zBottom).toFixed(3)}"`}
                    </span>
                </div>
                <p className="hint" style={{ marginTop: '5px' }}>
                    Top face is full size. Each side tapers inward independently. Size = bounding box.
                </p>
            </div>
        );
    }

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }}>
            <div className="glass-panel" style={{ padding: '24px', width: '400px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ margin: 0 }}>Add New Component</h2>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Component Name</h4>
                    <input
                        type="text" value={dialog.name}
                        onChange={e => {
                            const val = e.target.value;
                            setDialog(p => ({ ...p, name: val }));
                        }}
                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                    />
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Parent Assembly</h4>
                    <select
                        value={dialog.parentId}
                        onChange={e => setDialog(p => ({ ...p, parentId: e.target.value }))}
                        style={{
                            width: '100%', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                            background: 'var(--bg-color)', color: 'var(--text-main)',
                            border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                        }}
                    >
                        <option value="Workspace">Workspace (Root)</option>
                        {Object.keys(groups).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Shape</h4>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {['box', 'taper', 'cylinder'].map(s => (
                            <button
                                key={s}
                                style={btnStyle(shape === s)}
                                onClick={() => {
                                    if (s === 'box') {
                                        setDialog(p => ({ ...p, shape: undefined, taper: undefined, cylinder: undefined }));
                                    } else if (s === 'taper') {
                                        setDialog(p => ({ ...p, shape: 'taper', taper: p.taper ?? { angleLeft: 2, angleRight: 2, angleFront: 2, angleBack: 2 }, cylinder: undefined }));
                                    } else if (s === 'cylinder') {
                                        const r = dialog.sizeX / 2;
                                        setDialog(p => ({ ...p, shape: 'cylinder', cylinder: { radius: r, axis: 'y' }, sizeX: r * 2, sizeZ: r * 2, taper: undefined }));
                                    }
                                }}
                            >
                                {s === 'box' ? '■ Box' : s === 'taper' ? '◢ Taper' : '○ Cylinder'}
                            </button>
                        ))}
                    </div>
                    {taperPreview}

                    {/* ── Cylinder inputs ── */}
                    {shape === 'cylinder' && (
                        <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Radius ({units === 'metric' ? 'mm' : 'in'})</div>
                                <input
                                    type="number" min={units === 'metric' ? '1' : '0.0625'} step={units === 'metric' ? '1' : '0.125'} value={units === 'metric' ? parseFloat((cylRadius * 25.4).toFixed(2)) : parseFloat(cylRadius.toFixed(4))}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const r = units === 'metric' ? Math.max(1, val) / 25.4 : Math.max(0.0625, val);
                                        setDialog(p => ({ ...p, cylinder: { radius: r }, sizeX: r * 2, sizeZ: r * 2 }));
                                    }}
                                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                />
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Diam: {units === 'metric' ? `${(cylRadius * 2 * 25.4).toFixed(1)}mm` : `${(cylRadius * 2).toFixed(3)}"`}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Height ({units === 'metric' ? 'mm' : 'in'})</div>
                                <input
                                    type="number" min={units === 'metric' ? '1' : '0.0625'} step={units === 'metric' ? '1' : '0.125'} value={units === 'metric' ? parseFloat((cylHeight * 25.4).toFixed(2)) : parseFloat(cylHeight.toFixed(4))}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const h = units === 'metric' ? Math.max(1, val) / 25.4 : Math.max(0.0625, val);
                                        setDialog(p => ({ ...p, sizeY: h, position: [p.position[0], h / 2, p.position[2]] }));
                                    }}
                                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                AABB: {units === 'metric'
                                    ? `${(cylRadius*2*25.4).toFixed(1)}mm × ${(cylHeight*25.4).toFixed(1)}mm × ${(cylRadius*2*25.4).toFixed(1)}mm`
                                    : `${(cylRadius*2).toFixed(3)}" × ${cylHeight.toFixed(3)}" × ${(cylRadius*2).toFixed(3)}"`
                                } — used unchanged by constraints.
                            </p>
                        </div>
                    )}


                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Size ({units === 'metric' ? 'mm' : 'in'}) — Bounding Box</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }} title="X: width">X<NumericInput step={units === 'metric' ? '1' : '0.5'} value={units === 'metric' ? parseFloat((dialog.sizeX * 25.4).toFixed(2)) : dialog.sizeX} onChange={val => setDialog(p => ({ ...p, sizeX: units === 'metric' ? val / 25.4 : val }))} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }} title="Y: height">Y<NumericInput step={units === 'metric' ? '1' : '0.5'} value={units === 'metric' ? parseFloat((dialog.sizeY * 25.4).toFixed(2)) : dialog.sizeY} onChange={val => setDialog(p => ({ ...p, sizeY: units === 'metric' ? val / 25.4 : val }))} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }} title="Z: depth">Z<NumericInput step={units === 'metric' ? '1' : '0.5'} value={units === 'metric' ? parseFloat((dialog.sizeZ * 25.4).toFixed(2)) : dialog.sizeZ} onChange={val => setDialog(p => ({ ...p, sizeZ: units === 'metric' ? val / 25.4 : val }))} /></div>
                    </div>
                    <p className="hint" style={{ marginTop: '4px' }}>X = Red (left/right) · Y = Green (height) · Z = Blue (depth)</p>
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Position ({units === 'metric' ? 'mm' : 'in'})</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<NumericInput step={units === 'metric' ? '10' : '1'} value={units === 'metric' ? parseFloat((dialog.position[0] * 25.4).toFixed(2)) : dialog.position[0]} onChange={val => setDialog(p => ({ ...p, position: [units === 'metric' ? val / 25.4 : val, p.position[1], p.position[2]] }))} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<NumericInput step={units === 'metric' ? '10' : '1'} value={units === 'metric' ? parseFloat((dialog.position[1] * 25.4).toFixed(2)) : dialog.position[1]} onChange={val => setDialog(p => ({ ...p, position: [p.position[0], units === 'metric' ? val / 25.4 : val, p.position[2]] }))} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<NumericInput step={units === 'metric' ? '10' : '1'} value={units === 'metric' ? parseFloat((dialog.position[2] * 25.4).toFixed(2)) : dialog.position[2]} onChange={val => setDialog(p => ({ ...p, position: [p.position[0], p.position[1], units === 'metric' ? val / 25.4 : val] }))} /></div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button className="nav-btn" style={{ flex: 1, padding: '8px' }} onClick={() => setDialog(null)}>Cancel</button>
                    <button className="primary-btn" style={{ flex: 1, padding: '8px' }} onClick={onConfirm}>Add Component</button>
                </div>
            </div>
        </div>
    );
};

export default NewBoardDialog;
