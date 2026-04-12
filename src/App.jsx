import React, { useEffect } from 'react';
import './index.css';
import './App.css';
import Viewport3D from './components/Viewport3D';
import DraggablePanel from './components/layout/DraggablePanel';
import AppHeader from './components/layout/AppHeader';
import AIChatPanel from './components/panels/AIChatPanel';
import OutlinerPanel from './components/panels/OutlinerPanel';
import InspectorPanel from './components/panels/InspectorPanel';
import SettingsPanel from './components/panels/SettingsPanel';
import CutListPanel from './components/panels/CutListPanel';
import NewBoardDialog from './components/dialogs/NewBoardDialog';
import useStore from './store/useStore';

export default function App() {
    const {
        // UI toggles
        showCutlistPanel,
        showSettingsPanel,
        isRightPanelOpen,
        toast,
        confirmDialog, setConfirmDialog,
        // Settings for App mount
        theme,
        // History for focus capture
        pushHistory
    } = useStore();

    // Apply theme on initial mount (store handles subsequent changes via setTheme)
    useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    return (
        <div className="app-container">
            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: '#fff', padding: '12px 24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10000, fontWeight: 'bold' }}>
                    {toast}
                </div>
            )}
            <div className="canvas-area">
                <Viewport3D />
            </div>

            <div className="app-overlay">
                <AppHeader />

                <main className="main-workspace">
                    {isRightPanelOpen && (
                        <DraggablePanel title="AI Assistant" defaultPosition={{ x: 20, y: window.innerHeight * 0.45 }}>
                            <AIChatPanel />
                        </DraggablePanel>
                    )}

                    <aside className={`sidebar right-sidebar ${!isRightPanelOpen ? 'collapsed' : ''}`} style={{ background: 'transparent' }}>
                        <div className="flex-1 inspector-panel" style={{ overflowY: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                            {showSettingsPanel && (
                                <DraggablePanel title="Settings" defaultPosition={{ x: window.innerWidth / 2 - 250, y: 100 }} defaultSize={{ width: 500 }}>
                                    <SettingsPanel />
                                </DraggablePanel>
                            )}

                            <DraggablePanel title="Outliner" defaultPosition={{ x: window.innerWidth - 270, y: 80 }}>
                                <OutlinerPanel />
                            </DraggablePanel>

                            <DraggablePanel title="Inspector" defaultPosition={{ x: window.innerWidth - 540, y: 80 }} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                                <InspectorPanel />
                            </DraggablePanel>
                        </div>
                    </aside>

                    {showCutlistPanel && (
                        <DraggablePanel title="Project Cut List" defaultPosition={{ x: 100, y: 100 }} defaultSize={{ width: 600 }}>
                            <CutListPanel />
                        </DraggablePanel>
                    )}
                </main>

                {confirmDialog && (
                    <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }} onClick={() => setConfirmDialog(null)}>
                        <div className="glass-panel" style={{ padding: '24px', width: '380px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ margin: 0, color: '#ff3b30' }}>⚠ Confirm Deletion</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>{confirmDialog.message}</p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button className="nav-btn" style={{ padding: '8px 20px', border: '1px solid var(--border-color)' }} onClick={() => setConfirmDialog(null)}>Cancel</button>
                                <button className="nav-btn" style={{ padding: '8px 20px', background: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', fontWeight: 'bold' }} onClick={confirmDialog.onConfirm}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                <NewBoardDialog />
            </div>
        </div>
    )
}
