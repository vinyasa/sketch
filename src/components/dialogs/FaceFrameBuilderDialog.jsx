import React from 'react';
import useStore from '../../store/useStore';

const FaceFrameBuilderDialog = () => {
    const { faceFrameDialog: dialog, setFaceFrameDialog: setDialog, buildFaceFrame } = useStore();
    if (!dialog) return null;

    const parse = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const W = parse(dialog.width, 24);
    const H = parse(dialog.height, 30);
    const t = parse(dialog.thickness, 0.75);
    const wStile = parse(dialog.stileWidth, 1.5);
    const wRail = parse(dialog.railWidth, 1.5);

    const valid = W > (2 * wStile) && H > (2 * wRail);

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

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Overall Opening (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                    </div>
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Frame Dimensions (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Stile Width</div>
                            <input type="number" step="0.125" min="0.5" value={wStile}
                                onChange={e => setDialog(p => ({ ...p, stileWidth: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Rail Width</div>
                            <input type="number" step="0.125" min="0.5" value={wRail}
                                onChange={e => setDialog(p => ({ ...p, railWidth: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Thickness</div>
                            <input type="number" step="0.125" min="0.25" value={t}
                                onChange={e => setDialog(p => ({ ...p, thickness: e.target.value }))}
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
