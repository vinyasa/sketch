import React, { useState } from 'react';
import useStore from '../../store/useStore';

export default function PrintDialog() {
    const { showPrintDialog, setShowPrintDialog, setPrintCapture, selectedItemIds } = useStore();
    const [showDims, setShowDims] = useState(true);
    const [framing, setFraming] = useState('current');
    const [renderMode, setRenderMode] = useState('full'); // 'full' | 'wireframe' | 'light'

    if (!showPrintDialog) return null;

    const hasSelection = selectedItemIds.length > 0;

    const handlePrint = () => {
        setPrintCapture({ showDims, resolution: 2, framing, renderMode });
        setShowPrintDialog(false);
    };

    const btnStyle = { flex: 1, fontSize: '0.8rem', padding: '6px 8px' };
    const labelStyle = { fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowPrintDialog(false)}>
            <div className="glass-panel" onClick={e => e.stopPropagation()} style={{
                padding: '24px 32px', borderRadius: '16px', minWidth: '380px',
                border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                background: 'var(--menu-bg)',
            }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 700 }}>🖨️ Print / Export Image</h2>

                {/* Framing */}
                <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Camera Framing</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className={`nav-btn ${framing === 'current' ? 'active' : ''}`} onClick={() => setFraming('current')} style={btnStyle}>Current View</button>
                        <button className={`nav-btn ${framing === 'fitAll' ? 'active' : ''}`} onClick={() => setFraming('fitAll')} style={btnStyle}>Fit All</button>
                        <button className={`nav-btn ${framing === 'fitSelection' ? 'active' : ''}`} onClick={() => setFraming('fitSelection')} disabled={!hasSelection} style={{ ...btnStyle, opacity: hasSelection ? 1 : 0.4 }}>Fit Selection</button>
                    </div>
                </div>

                {/* Render Mode */}
                <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Render Style</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className={`nav-btn ${renderMode === 'full' ? 'active' : ''}`} onClick={() => setRenderMode('full')} style={btnStyle}>Full Color</button>
                        <button className={`nav-btn ${renderMode === 'light' ? 'active' : ''}`} onClick={() => setRenderMode('light')} style={btnStyle}>Light (Ink Saver)</button>
                        <button className={`nav-btn ${renderMode === 'wireframe' ? 'active' : ''}`} onClick={() => setRenderMode('wireframe')} style={btnStyle}>Wireframe</button>
                    </div>
                </div>

                {/* Dimensions toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={showDims} onChange={e => setShowDims(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    Show custom measurements
                </label>

                {/* Info */}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    White background • No grid • No selection highlights • No auto-dimensions
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="nav-btn" onClick={() => setShowPrintDialog(false)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>Cancel</button>
                    <button className="nav-btn active" onClick={handlePrint} style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600 }}>📷 Capture</button>
                </div>
            </div>
        </div>
    );
}
