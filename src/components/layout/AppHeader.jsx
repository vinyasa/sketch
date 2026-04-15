import React from 'react';

import useStore from '../../store/useStore';

const AppHeader = () => {
    const {
        fileMenuOpen, setFileMenuOpen,
        saveWorkspace, exportWorkspace, loadWorkspace, importWorkspace,
        recentFiles,
        handleUndo, handleRedo, history, redoHistory,
        showCutlistPanel, setShowCutlistPanel,
        showSettingsPanel, setShowSettingsPanel,
        showAssemblyLibrary, setShowAssemblyLibrary,
        showLightingPanel, setShowLightingPanel,
        showMaterialsPanel, setShowMaterialsPanel,
        showAddComponentPanel, setShowAddComponentPanel,
        showOutlinerPanel, setShowOutlinerPanel,
        isOrtho, setIsOrtho,
        showGrid, setShowGrid,
        showDimensions, setShowDimensions,
        isRightPanelOpen, setIsRightPanelOpen
    } = useStore();
    return (
        <header className="app-header glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div className="logo">Little Lucey <span>Woodcraft</span></div>
                <div className="toolbar-menus">
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <span onClick={() => setFileMenuOpen(!fileMenuOpen)} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: fileMenuOpen ? 'var(--bg-color)' : 'transparent' }}>
                            File ⏷
                        </span>
                        {fileMenuOpen && (
                            <div className="glass-panel" style={{
                                position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                                display: 'flex', flexDirection: 'column', padding: '8px', minWidth: '160px',
                                zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                                borderRadius: '8px', background: 'var(--panel-bg)'
                            }}>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { saveWorkspace(); setFileMenuOpen(false); }}>💾 Save</button>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { exportWorkspace(); setFileMenuOpen(false); }}>💾 Save As...</button>
                                <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { loadWorkspace(); setFileMenuOpen(false); }}>📂 Load</button>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { document.getElementById('project-import-input').click(); setFileMenuOpen(false); }}>📂 Open...</button>

                                {recentFiles.length > 0 && (
                                    <>
                                        <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                        <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open Recent</div>
                                        {recentFiles.map(r => (
                                            <button key={r.name} className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => { loadWorkspace(r.name); setFileMenuOpen(false); }}>
                                                ⏱ {r.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <input type="file" id="project-import-input" accept=".json" style={{ display: 'none' }} onChange={importWorkspace} />
                    <span onClick={handleUndo} style={{ opacity: history.length ? 1 : 0.4, marginLeft: '8px', cursor: history.length ? 'pointer' : 'default' }}>↺ Undo ({history.length})</span>
                    <span onClick={handleRedo} style={{ opacity: redoHistory.length ? 1 : 0.4, marginLeft: '8px', cursor: redoHistory.length ? 'pointer' : 'default' }}>↻ Redo ({redoHistory.length})</span>
                </div>
            </div>
            <nav className="top-nav">
                {/* ── Col 1: Shapes (new) ── */}
                <button
                    className={`nav-btn ${showAddComponentPanel ? 'active' : ''}`}
                    onClick={() => setShowAddComponentPanel(!showAddComponentPanel)}
                    title="Add a new shape or component to the workspace"
                >
                    🔷 Components
                </button>

                {/* ── Cols 2–5 row 1: Library │ Materials │ Grid ☑ │ (empty) ── */}
                <button className={`nav-btn ${showAssemblyLibrary ? 'active' : ''}`} onClick={() => setShowAssemblyLibrary(!showAssemblyLibrary)}>📦 Library</button>
                <button className={`nav-btn ${showMaterialsPanel ? 'active' : ''}`} onClick={() => setShowMaterialsPanel(!showMaterialsPanel)}>🎨 Materials</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.71rem', color: 'var(--text-muted)', padding: '3px 8px', userSelect: 'none' }}>
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} style={{ accentColor: 'var(--accent-color)', width: '12px', height: '12px', cursor: 'pointer' }} />
                    Grid
                </label>
                {/* ── Col 5 row 1: Outliner ── */}
                <button className={`nav-btn ${showOutlinerPanel ? 'active' : ''}`} onClick={() => setShowOutlinerPanel(!showOutlinerPanel)} title="Toggle Outliner">🗂️ Outliner</button>

                {/* ── Col 6 row 1: Hide/Show ── */}
                <button className="nav-btn accent-fill" style={{ padding: '3px 10px', marginLeft: '20px' }} onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}>
                    {isRightPanelOpen ? 'Hide ⏵' : '⏴ Show'}
                </button>

                {/* ── Col 1 row 2: empty placeholder ── */}
                <div />

                {/* ── Cols 2–5 row 2: Settings │ Lighting │ Dims ☑ │ Perspective ── */}
                <button className={`nav-btn ${showSettingsPanel ? 'active' : ''}`} onClick={() => setShowSettingsPanel(!showSettingsPanel)}>⚙️ Settings</button>
                <button className={`nav-btn ${showLightingPanel ? 'active' : ''}`} onClick={() => setShowLightingPanel(!showLightingPanel)}>💡 Lighting</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.71rem', color: 'var(--text-muted)', padding: '3px 8px', userSelect: 'none' }}>
                    <input type="checkbox" checked={showDimensions} onChange={e => setShowDimensions(e.target.checked)} style={{ accentColor: 'var(--accent-color)', width: '12px', height: '12px', cursor: 'pointer' }} />
                    Dims
                </label>
                <button className={`nav-btn ${isOrtho ? 'active' : ''}`} onClick={() => setIsOrtho(!isOrtho)} title={isOrtho ? 'Switch to Perspective' : 'Switch to Parallel'}>
                    {isOrtho ? '📐 Parallel' : '📷 Perspective'}
                </button>

                {/* ── Col 6 row 2: Cut List ── */}
                <button className={`nav-btn ${showCutlistPanel ? 'active' : ''}`} style={{ marginLeft: '20px' }} onClick={() => setShowCutlistPanel(!showCutlistPanel)}>📋 Cut List</button>
            </nav>
        </header>
    );
};

export default AppHeader;
