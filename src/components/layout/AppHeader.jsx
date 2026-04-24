import React, { useState } from 'react';

import useStore from '../../store/useStore';

const AppHeader = () => {
    const {
        fileMenuOpen, setFileMenuOpen,
        saveWorkspace, exportWorkspace, loadWorkspace, importWorkspace,
        setShowNewWorkspaceDialog,
        setShowPrintDialog,
        setCabinetDialog, setShakerDoorDialog,
        recentFiles,
        handleUndo, handleRedo, history, redoHistory,
        showCutlistPanel, setShowCutlistPanel,
        showSettingsPanel, setShowSettingsPanel,
        showAssemblyLibrary, setShowAssemblyLibrary,
        showLightingPanel, setShowLightingPanel,
        showMaterialsPanel, setShowMaterialsPanel,
        showAddComponentPanel, setShowAddComponentPanel,
        showAssembliesPanel, setShowAssembliesPanel,
        showToolsPanel, setShowToolsPanel,
        showHardwarePanel, setShowHardwarePanel,
        showAnimationPanel, setShowAnimationPanel,
        showOutlinerPanel, setShowOutlinerPanel,
        isOrtho, setIsOrtho,
        showGrid, setShowGrid,
        showMeasurements, setShowMeasurements,
        measureMode, setMeasureMode,
        isRightPanelOpen, setIsRightPanelOpen,
        currentFileName,
    } = useStore();

    const [isNavOpen, setIsNavOpen] = useState(true);

    return (
        <div className="header-overlay">
            
            {/* ── CARD 1: Logo & File Menu (Fixed Left) ── */}
            <header className="header-left-card glass-panel">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="logo">Little Lucey <span>Woodcraft</span></div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--accent-color)', marginTop: '12px', paddingLeft: '2px', opacity: 0.7 }}>{currentFileName || 'Untitled'}</div>
                </div>
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
                                borderRadius: '8px', background: 'var(--menu-bg)'
                            }}>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { setFileMenuOpen(false); setShowNewWorkspaceDialog(true); }}>✨ New Workspace</button>
                                <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { saveWorkspace(); setFileMenuOpen(false); }}>💾 Save</button>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { exportWorkspace(); setFileMenuOpen(false); }}>💾 Save As...</button>
                                <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { setShowPrintDialog(true); setFileMenuOpen(false); }}>🖨️ Print / Export...</button>
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
            </header>

            {/* ── CARD 2: Sliding Nav Drawer (Right) ── */}
            <div className="header-right-wrapper">

                {/* Sliding Grid */}
                <div className={`nav-drawer glass-panel ${isNavOpen ? 'open' : 'collapsed'}`}>
                    <nav className="top-nav">
                        
                        {/* ── ROW 1 ── */}
                        <button className={`nav-btn ${showAddComponentPanel ? 'active' : ''}`} onClick={() => setShowAddComponentPanel(!showAddComponentPanel)} title="Add shapes">🔷 Components</button>
                        <button className={`nav-btn ${showAssembliesPanel ? 'active' : ''}`} onClick={() => setShowAssembliesPanel(!showAssembliesPanel)} title="Parametric builders">🧱 Builders</button>
                        <button className={`nav-btn ${showAssemblyLibrary ? 'active' : ''}`} onClick={() => setShowAssemblyLibrary(!showAssemblyLibrary)}>📦 Library</button>
                        <button className={`nav-btn ${showMaterialsPanel ? 'active' : ''}`} onClick={() => setShowMaterialsPanel(!showMaterialsPanel)}>🎨 Materials</button>
                        <button className={`nav-btn ${showOutlinerPanel ? 'active' : ''}`} onClick={() => setShowOutlinerPanel(!showOutlinerPanel)} title="Toggle Outliner">🗂️ Outliner</button>
                        <button className={`nav-btn ${isRightPanelOpen ? 'active' : ''}`} onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}>🤖 AI Assistant</button>
                        <button className={`nav-btn ${showCutlistPanel ? 'active' : ''}`} onClick={() => setShowCutlistPanel(!showCutlistPanel)}>📋 Cut List</button>

                        {/* ── ROW 2 ── */}
                        <button className={`nav-btn ${showToolsPanel ? 'active' : ''}`} onClick={() => setShowToolsPanel(!showToolsPanel)} title="CSG modifiers">🛠 Tools</button>
                        <button className={`nav-btn ${showHardwarePanel ? 'active' : ''}`} onClick={() => setShowHardwarePanel(!showHardwarePanel)} title="Attach hardware">🔩 Hardware</button>
                        <button className={`nav-btn ${showSettingsPanel ? 'active' : ''}`} onClick={() => setShowSettingsPanel(!showSettingsPanel)}>⚙️ Settings</button>
                        <button className={`nav-btn ${showLightingPanel ? 'active' : ''}`} onClick={() => setShowLightingPanel(!showLightingPanel)}>💡 Lighting</button>
                        <button className={`nav-btn ${isOrtho ? 'active' : ''}`} onClick={() => setIsOrtho(!isOrtho)} title="Camera Mode">
                            {isOrtho ? '📐 Parallel' : '📷 Perspective'}
                        </button>
                        <button className={`nav-btn ${showAnimationPanel ? 'active' : ''}`} onClick={() => setShowAnimationPanel(!showAnimationPanel)} title="Animate">🎬 Animate</button>
                        <button className={`nav-btn ${measureMode?.active ? 'active' : ''}`} onClick={() => {
                            if (measureMode?.active) setMeasureMode(null);
                            else setMeasureMode({ active: true, firstPoint: null });
                        }} title="Measure distances">📏 Measure</button>

                        {/* ── ROW 3 ── */}
                        <label className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.71rem', userSelect: 'none', margin: 0, padding: '3px 8px' }}>
                            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} style={{ accentColor: 'var(--accent-color)', width: '12px', height: '12px', cursor: 'pointer' }} />
                            Grid
                        </label>
                        <label className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.71rem', userSelect: 'none', margin: 0, padding: '3px 8px' }}>
                            <input type="checkbox" checked={showMeasurements} onChange={e => setShowMeasurements(e.target.checked)} style={{ accentColor: 'var(--accent-color)', width: '12px', height: '12px', cursor: 'pointer' }} />
                            Dims
                        </label>
                        <div /> {/* Empty col 3 */}
                        <div /> {/* Empty col 4 */}
                        <div /> {/* Empty col 5 */}
                        <div /> {/* Empty col 6 */}
                        <div /> {/* Empty col 7 */}

                    </nav>
                </div>

                {/* Arrow Toggle */}
                <div 
                    className="nav-toggle-btn" 
                    onClick={() => setIsNavOpen(!isNavOpen)}
                    title={isNavOpen ? 'Hide Toolbars' : 'Show Toolbars'}
                >
                    {isNavOpen ? '▶' : '◀'}
                </div>
            </div>
        </div>
    );
};

export default AppHeader;
