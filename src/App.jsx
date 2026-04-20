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
import AssemblyLibraryPanel from './components/panels/AssemblyLibraryPanel';
import LightingPanel from './components/panels/LightingPanel';
import MaterialsPanel from './components/panels/MaterialsPanel';
import AddComponentPanel from './components/panels/AddComponentPanel';
import ToolsPanel from './components/panels/ToolsPanel';
import NewBoardDialog from './components/dialogs/NewBoardDialog';
import CabinetBuilderDialog from './components/dialogs/CabinetBuilderDialog';
import ErrorBoundary from './components/layout/ErrorBoundary';
import useStore from './store/useStore';

export default function App() {
    const {
        // UI toggles
        showCutlistPanel, setShowCutlistPanel,
        showSettingsPanel, setShowSettingsPanel,
        showAssemblyLibrary, setShowAssemblyLibrary,
        showLightingPanel, setShowLightingPanel,
        showMaterialsPanel, setShowMaterialsPanel,
        showAddComponentPanel, setShowAddComponentPanel,
        showToolsPanel, setShowToolsPanel,
        showOutlinerPanel, setShowOutlinerPanel,
        isRightPanelOpen, setIsRightPanelOpen,
        selectedItemIds,
        toast,
        computingMessage,
        confirmDialog, setConfirmDialog,
        // Settings for App mount
        theme,
        // History for focus capture
        pushHistory,
        // Autosave
        autosaveInterval,
        saveWorkspace,
    } = useStore();

    // Apply theme on initial mount (store handles subsequent changes via setTheme)
    useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Autosave interval — silent save (no prompt, no toast)
    useEffect(() => {
        if (autosaveInterval === 'off') return;
        const ms = parseInt(autosaveInterval, 10) * 60 * 1000;
        const id = setInterval(() => {
            const { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors, autosaveInterval: ai } = useStore.getState();
            const payload = { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors, autosaveInterval: ai };
            localStorage.setItem('lucey_save', JSON.stringify(payload));
        }, ms);
        return () => clearInterval(id);
    }, [autosaveInterval]);

    return (
        <ErrorBoundary>
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
                        <DraggablePanel title="AI Assistant" defaultPosition={{ x: 20, y: 90 }} onClose={() => setIsRightPanelOpen(false)}>
                            <AIChatPanel />
                        </DraggablePanel>
                    )}

                    {showSettingsPanel && (
                        <DraggablePanel title="Settings" defaultPosition={{ x: window.innerWidth / 2 - 250, y: 100 }} defaultSize={{ width: 500 }} onClose={() => setShowSettingsPanel(false)}>
                            <SettingsPanel />
                        </DraggablePanel>
                    )}

                    {showOutlinerPanel && (
                        <DraggablePanel title="Outliner" defaultPosition={{ x: window.innerWidth - 270, y: 80 }} onClose={() => setShowOutlinerPanel(false)}>
                            <OutlinerPanel />
                        </DraggablePanel>
                    )}

                    {selectedItemIds.length > 0 && (
                        <DraggablePanel title="Inspector" defaultPosition={{ x: window.innerWidth - 540, y: 80 }} defaultSize={{ width: 375 }} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                            <InspectorPanel />
                        </DraggablePanel>
                    )}

                    {showCutlistPanel && (
                        <DraggablePanel title="Project Cut List" defaultPosition={{ x: 100, y: 100 }} defaultSize={{ width: 600 }} onClose={() => setShowCutlistPanel(false)}>
                            <CutListPanel />
                        </DraggablePanel>
                    )}

                    {showAssemblyLibrary && (
                        <DraggablePanel title="📦 Assembly Library" defaultPosition={{ x: 20, y: 100 }} defaultSize={{ width: 330 }} onClose={() => setShowAssemblyLibrary(false)}>
                            <AssemblyLibraryPanel />
                        </DraggablePanel>
                    )}

                    {showLightingPanel && (
                        <DraggablePanel title="💡 Lighting" defaultPosition={{ x: 370, y: 100 }} defaultSize={{ width: 310 }} onClose={() => setShowLightingPanel(false)}>
                            <LightingPanel />
                        </DraggablePanel>
                    )}

                    {showMaterialsPanel && (
                        <DraggablePanel title="🎨 Materials" defaultPosition={{ x: 700, y: 100 }} defaultSize={{ width: 290 }} onClose={() => setShowMaterialsPanel(false)}>
                            <MaterialsPanel />
                        </DraggablePanel>
                    )}

                    {showAddComponentPanel && (
                        <DraggablePanel title="＋ Add Component" defaultPosition={{ x: window.innerWidth / 2 - 130, y: 100 }} defaultSize={{ width: 260 }} onClose={() => setShowAddComponentPanel(false)}>
                            <AddComponentPanel />
                        </DraggablePanel>
                    )}

                    {showToolsPanel && (
                        <DraggablePanel title="🛠 Tools" defaultPosition={{ x: window.innerWidth / 2 - 170, y: 120 }} defaultSize={{ width: 340 }} onClose={() => setShowToolsPanel(false)} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                            <ToolsPanel />
                        </DraggablePanel>
                    )}
                </main>

                {computingMessage && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}>
                        <div style={{ background: 'var(--panel-bg, #1e1e1e)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(188,138,95,0.3)', borderTop: '3px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600 }}>{computingMessage}</span>
                        </div>
                    </div>
                )}

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
                <CabinetBuilderDialog />
            </div>
        </div>
        </ErrorBoundary>
    )
}
