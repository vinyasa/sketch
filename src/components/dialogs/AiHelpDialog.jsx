import React from 'react';
import useStore from '../../store/useStore';

const AiHelpDialog = () => {
    const { showAiHelpDialog, setShowAiHelpDialog } = useStore();

    if (!showAiHelpDialog) return null;

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0, padding: '20px' }} onClick={() => setShowAiHelpDialog(false)}>
            <div className="glass-panel" style={{ padding: '30px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-main)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                
                <button className="nav-btn" onClick={() => setShowAiHelpDialog(false)} style={{ position: 'absolute', top: '15px', right: '15px', width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--panel-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', fontSize: '1.2rem' }}>
                    &times;
                </button>

                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--accent-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text-main)' }}>AI Assistant Cheat Sheet</h2>
                    <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '0.95rem' }}>Select one or more components before giving a command, unless creating something new.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '30px' }}>
                    <div>
                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '0 0 10px 0', paddingBottom: '4px' }}>↔️ Length & Width</h3>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 0 }}>Automatically edits the longest/middle dimension.</p>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Increase:</b> <span style={{ color: '#d14' }}>grow, extend, longer, add, wider...</span><br/><i style={{ color: '#666' }}>"Make this 2 inches longer"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Decrease:</b> <span style={{ color: '#d14' }}>cut, trim, chop, shorter, narrow...</span><br/><i style={{ color: '#666' }}>"Trim 1/4 inch off the length"</i></li>
                        </ul>

                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '20px 0 10px 0', paddingBottom: '4px' }}>🗜️ Thickness & Height</h3>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 0 }}>Thickness = smallest dimension. Height = World Y-Axis.</p>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Thickness:</b> <span style={{ color: '#d14' }}>thick, thinner, shave...</span><br/><i style={{ color: '#666' }}>"Shave 1/8 inch off the thickness"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Height:</b> <span style={{ color: '#d14' }}>tall, taller, short (w/o length)</span><br/><i style={{ color: '#666' }}>"Make this 5 inches taller"</i></li>
                        </ul>
                        
                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '20px 0 10px 0', paddingBottom: '4px' }}>🧭 Moving & Nudging</h3>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Keywords:</b> <span style={{ color: '#d14' }}>move, nudge</span></li>
                            <li style={{ marginBottom: '8px' }}><b>Positive (+):</b> <span style={{ color: '#d14' }}>up, right, forward</span> (or X/Y/Z, Red/Green/Blue)<br/><i style={{ color: '#666' }}>"Move this 3 up"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Negative (-):</b> <span style={{ color: '#d14' }}>down, left, back</span><br/><i style={{ color: '#666' }}>"Nudge left 1/2 inch"</i></li>
                        </ul>
                    </div>

                    <div>
                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '0 0 10px 0', paddingBottom: '4px' }}>🔄 Rotating & Spinning</h3>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Keywords:</b> <span style={{ color: '#d14' }}>rotate, spin, turn, orient</span><br/><i style={{ color: '#666' }}>"Rotate 90 on green"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Overrides:</b> <span style={{ color: '#d14' }}>flip</span> (180°), <span style={{ color: '#d14' }}>reset rotation</span><br/><i style={{ color: '#666' }}>"Flip on Z"</i></li>
                        </ul>

                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '20px 0 10px 0', paddingBottom: '4px' }}>🧰 Tool Modifiers</h3>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginTop: 0 }}>Quickly apply CSG cuts via text.</p>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Holes:</b> <span style={{ color: '#d14' }}>drill, bore, hole...</span><br/><i style={{ color: '#666' }}>"Drill a 2 inch hole along X"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Coves:</b> <span style={{ color: '#d14' }}>cove, hollow...</span><br/><i style={{ color: '#666' }}>"Cut a 1/2 inch cove on bottom"</i></li>
                            <li style={{ marginBottom: '8px' }}><b>Arcs:</b> <span style={{ color: '#d14' }}>arc, cut curve...</span><br/><i style={{ color: '#666' }}>"Cut curve 0 to 45 along z"</i></li>
                        </ul>

                        <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', margin: '20px 0 10px 0', paddingBottom: '4px' }}>🧩 Generation</h3>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.9rem' }}>
                            <li style={{ marginBottom: '8px' }}><b>Material:</b> <span style={{ color: '#d14' }}>walnut, pine, cherry, oak</span></li>
                            <li style={{ marginBottom: '8px' }}><b>Tapered Legs:</b> <span style={{ color: '#d14' }}>tapered leg, add taper</span></li>
                            <li style={{ marginBottom: '8px' }}><b>Auto-Tops:</b> <span style={{ color: '#d14' }}>put a top on this</span></li>
                            <li style={{ marginBottom: '8px' }}><b>Assemblies:</b> <span style={{ color: '#d14' }}>build a 24 inch box, build a cube</span></li>
                        </ul>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button className="nav-btn" style={{ padding: '8px 20px', background: 'var(--accent-color)', color: '#fff', border: 'none', fontWeight: 'bold' }} onClick={() => setShowAiHelpDialog(false)}>Got it</button>
                </div>
            </div>
        </div>
    );
};

export default AiHelpDialog;
