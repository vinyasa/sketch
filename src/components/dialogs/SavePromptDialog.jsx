import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

const SavePromptDialog = () => {
    const { 
        showSavePromptDialog, setShowSavePromptDialog, 
        currentFileName, saveWorkspace, 
        savePromptCallback, setSavePromptCallback 
    } = useStore();
    
    const [fileName, setFileName] = useState('');

    useEffect(() => {
        if (showSavePromptDialog) {
            setFileName(currentFileName || 'My Design');
        }
    }, [showSavePromptDialog, currentFileName]);

    if (!showSavePromptDialog) return null;

    const handleSave = () => {
        const name = fileName.trim() || 'My Design';
        saveWorkspace(name);
        if (savePromptCallback) {
            savePromptCallback();
            setSavePromptCallback(null);
        }
        setShowSavePromptDialog(false);
    };

    const handleCancel = () => {
        setSavePromptCallback(null);
        setShowSavePromptDialog(false);
    };

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }} onClick={handleCancel}>
            <div className="glass-panel" style={{ padding: '24px', width: '360px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>💾 Save Project As</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Project Name</label>
                    <input 
                        type="text" 
                        className="inspector-input" 
                        value={fileName} 
                        onChange={e => setFileName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                        autoFocus
                    />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button className="nav-btn" style={{ padding: '8px 20px', border: '1px solid var(--border-color)' }} onClick={handleCancel}>Cancel</button>
                    <button className="nav-btn primary" style={{ padding: '8px 20px', background: 'var(--accent-color)', color: '#fff', border: 'none', fontWeight: 'bold' }} onClick={handleSave}>Save</button>
                </div>
            </div>
        </div>
    );
};

export default SavePromptDialog;
