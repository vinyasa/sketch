import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

const ToolsPanel = () => {
    // Staged modifier edits — changes are held locally until "Apply" is clicked
    const [stagedOps, setStagedOps] = useState({});
    // New modifiers that haven't been committed to the store yet
    const [pendingNewOps, setPendingNewOps] = useState([]);

    const {
        boards, selectedItemIds,
        setBoards, pushHistory,
        removeOperation, updateOperation,
        setComputingMessage,
        editingToolOpId, setEditingToolOpId,
        applyRabbetJoint, toggleRabbetJoint, removeRabbetJoint,
        applySubtraction, toggleBoardVisibility,
    } = useStore();

    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);

    // Multi-board selection for joint tools
    const selectedBoards = selectedItemIds.length === 2
        ? selectedItemIds.map(id => boards.find(b => b.id.toString() === id)).filter(Boolean)
        : [];
    const canShowRabbetJoint = selectedBoards.length === 2;

    // Clear staged modifier edits when the selected board changes
    const selectedBoardId = selectedItemIds?.[0];
    useEffect(() => { setStagedOps({}); setPendingNewOps([]); }, [selectedBoardId]);

    // ── Tool-type Add Buttons ────────────────────────────────────────────────
    const addToolBtnStyle = {
        flex: 1, padding: '8px 6px', background: 'var(--bg-color)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        color: 'var(--text-main)', fontSize: '0.78rem', cursor: 'pointer',
        transition: 'all 0.15s', fontWeight: 600,
    };

    const handleAddTool = (newOp) => {
        if (!selectedBoard) return;
        setPendingNewOps(prev => [...prev, newOp]);
        setEditingToolOpId(newOp.id);
    };

    // ── Render combined operations list ──────────────────────────────────────
    const committedOps = selectedBoard ? (selectedBoard.operations || []) : [];
    const pendingIds = new Set(pendingNewOps.map(o => o.id));
    const allOps = [...committedOps, ...pendingNewOps];

    // If editingToolOpId is set, only show that operation's editor
    const editingOp = editingToolOpId ? allOps.find(o => o.id === editingToolOpId) : null;

    return (
        <div>
            {/* ── Dual Rabbet Joint Section (2 boards selected) ── */}
            {canShowRabbetJoint && (() => {
                const [bA, bB] = selectedBoards;
                const existingJoint = bA.rabbetJoint && bA.rabbetJoint.partnerId === bB.id.toString();
                const overBoard = existingJoint
                    ? boards.find(b => b.id.toString() === bA.rabbetJoint.overBoardId)
                    : null;
                const underBoard = existingJoint && overBoard
                    ? (overBoard.id === bA.id ? bB : bA)
                    : null;

                return (
                    <div style={{
                        padding: '12px', marginBottom: '14px', borderRadius: '8px',
                        background: 'rgba(100, 180, 255, 0.06)',
                        border: '1px solid rgba(100, 180, 255, 0.3)',
                    }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64b4ff', marginBottom: '8px' }}>
                            🔗 Dual Rabbet Joint
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            {bA.name} ↔ {bB.name}
                        </div>

                        {existingJoint ? (
                            <div>
                                <div style={{
                                    fontSize: '0.75rem', color: 'var(--text-main)',
                                    padding: '6px 10px', marginBottom: '8px',
                                    background: 'rgba(100, 180, 255, 0.08)', borderRadius: '6px',
                                    border: '1px solid rgba(100, 180, 255, 0.15)',
                                }}>
                                    <strong>{overBoard?.name}</strong> over <strong>{underBoard?.name}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                        onClick={() => toggleRabbetJoint(bA.id)}
                                        style={{
                                            flex: 1, padding: '7px', fontSize: '0.78rem', fontWeight: 600,
                                            background: 'rgba(100, 180, 255, 0.12)', border: '1px solid rgba(100, 180, 255, 0.4)',
                                            borderRadius: '6px', color: '#64b4ff', cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                        onMouseLeave={e => e.target.style.filter = ''}
                                    >⇄ Flip</button>
                                    <button
                                        onClick={() => removeRabbetJoint(bA.id)}
                                        style={{
                                            padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600,
                                            background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)',
                                            borderRadius: '6px', color: '#ff3b30', cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                        onMouseLeave={e => e.target.style.filter = ''}
                                    >✕ Remove</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => applyRabbetJoint(bA.id, bB.id)}
                                    title={`${bA.name} keeps full size, ${bB.name} shrinks`}
                                    style={{
                                        flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                        background: 'rgba(60,200,90,0.12)', border: '1px solid rgba(60,200,90,0.4)',
                                        borderRadius: '6px', color: '#34c759', cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                    onMouseLeave={e => e.target.style.filter = ''}
                                >{bA.name} over {bB.name}</button>
                                <button
                                    onClick={() => applyRabbetJoint(bB.id, bA.id)}
                                    title={`${bB.name} keeps full size, ${bA.name} shrinks`}
                                    style={{
                                        flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                        background: 'rgba(60,200,90,0.12)', border: '1px solid rgba(60,200,90,0.4)',
                                        borderRadius: '6px', color: '#34c759', cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                    onMouseLeave={e => e.target.style.filter = ''}
                                >{bB.name} over {bA.name}</button>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Boolean Subtract Section (2 boards selected) ── */}
            {canShowRabbetJoint && (() => {
                const [bA, bB] = selectedBoards;
                return (
                    <div style={{
                        padding: '12px', marginBottom: '14px', borderRadius: '8px',
                        background: 'rgba(255, 140, 50, 0.06)',
                        border: '1px solid rgba(255, 140, 50, 0.3)',
                    }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff8c32', marginBottom: '8px' }}>
                            🔪 Boolean Subtract
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Carve one board's shape out of another. The cutter board will be hidden.
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                onClick={() => applySubtraction(bA.id, bB.id)}
                                title={`"${bB.name}" carves into "${bA.name}"`}
                                style={{
                                    flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                    background: 'rgba(255, 140, 50, 0.12)', border: '1px solid rgba(255, 140, 50, 0.4)',
                                    borderRadius: '6px', color: '#ff8c32', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                onMouseLeave={e => e.target.style.filter = ''}
                            >{bA.name} − {bB.name}</button>
                            <button
                                onClick={() => applySubtraction(bB.id, bA.id)}
                                title={`"${bA.name}" carves into "${bB.name}"`}
                                style={{
                                    flex: 1, padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                    background: 'rgba(255, 140, 50, 0.12)', border: '1px solid rgba(255, 140, 50, 0.4)',
                                    borderRadius: '6px', color: '#ff8c32', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => e.target.style.filter = 'brightness(1.2)'}
                                onMouseLeave={e => e.target.style.filter = ''}
                            >{bB.name} − {bA.name}</button>
                        </div>
                    </div>
                );
            })()}

            {/* ── Tool Type Buttons ── */}
            {selectedBoard ? (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    <button
                        onClick={() => handleAddTool({ id: Date.now(), type: 'hole', radius: 1, offsetX: 0, offsetY: 0, axis: 'y' })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >◎ Hole</button>
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 1, type: 'cove', edge: 'top', depth: 1, axis: 'y' })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >◡ Cove</button>
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 2, type: 'arc', startAngle: 0, endAngle: 90, innerRadius: 0, axis: 'y' })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >◠ Arc</button>
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 3, type: 'dado', face: 'top', width: 0.75, depth: 0.375, offset: 0, direction: 'x', length: 0, lengthOffset: 0 })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >✂ Dado</button>
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 4, type: 'miter', face: 'x+', fenceEdge: 'z-', angle: 45, bevel: 0 })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >⊿ Miter</button>
                </div>
            ) : !canShowRabbetJoint && (
                <div className="hint" style={{ marginBottom: '14px' }}>Select a board to add or edit tools.</div>
            )}

            {/* ── Tool summaries (when not editing a specific tool) ── */}
            {selectedBoard && !editingOp && allOps.length > 0 && (
                <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Applied Tools</div>
                    {allOps.map((op) => {
                        const isNew = pendingIds.has(op.id);
                        const icon = { hole: '◎', cove: '◡', arc: '◠', dado: '✂', miter: '⊿', subtract: '🔪' }[op.type] || '●';
                        const summary = getToolSummary(op);
                        return (
                            <div key={op.id} style={{
                                padding: '8px 10px', marginBottom: '4px',
                                background: isNew ? 'rgba(188,138,95,0.06)' : 'rgba(255,255,255,0.03)',
                                border: isNew ? '1px solid rgba(188,138,95,0.4)' : '1px solid var(--border-color)',
                                borderRadius: '6px', transition: 'all 0.2s',
                                opacity: op.enabled === false ? 0.4 : 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                        {icon} {op.type}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <button
                                            onClick={() => updateOperation(selectedBoard.id, op.id, { enabled: op.enabled === false ? true : false })}
                                            title={op.enabled === false ? 'Enable Cut' : 'Disable Cut'}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', transition: 'color 0.2s' }}
                                            onMouseEnter={e => e.target.style.color = 'var(--text-main)'}
                                            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                                        >
                                            {op.enabled === false ? '⊘' : '👁'}
                                        </button>
                                        <button
                                            onClick={() => setEditingToolOpId(op.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px' }}
                                        >✎ Edit</button>
                                        <button
                                            onClick={() => {
                                                if (isNew) {
                                                    setPendingNewOps(prev => prev.filter(p => p.id !== op.id));
                                                } else {
                                                    removeOperation(selectedBoard.id, op.id);
                                                }
                                                setStagedOps(prev => { const next = { ...prev }; delete next[op.id]; return next; });
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px' }}
                                        >✕</button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{summary}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedBoard && !editingOp && allOps.length === 0 && (
                <div className="hint">No tools applied. Use the buttons above to add a tool.</div>
            )}

            {/* ── Full Tool Editor (when editing a specific tool) ── */}
            {selectedBoard && editingOp && (() => {
                const op = editingOp;
                const isNew = pendingIds.has(op.id);
                const staged = stagedOps[op.id] || {};
                const displayOp = { ...op, ...staged };
                const hasPending = isNew || Object.keys(staged).length > 0;

                const upd = (patch) => {
                    if (isNew) {
                        setPendingNewOps(prev => prev.map(p =>
                            p.id === op.id ? { ...p, ...patch } : p
                        ));
                    }
                    setStagedOps(prev => ({
                        ...prev,
                        [op.id]: { ...(prev[op.id] || {}), ...patch }
                    }));
                };

                const applyStaged = () => {
                    if (!hasPending) return;
                    setComputingMessage('Performing 3D calculations… please wait.');
                    requestAnimationFrame(() => {
                        pushHistory();
                        if (isNew) {
                            const finalOp = { ...op, ...staged };
                            setBoards(prev => prev.map(b =>
                                b.id.toString() === selectedBoard.id.toString()
                                    ? { ...b, operations: [...(b.operations || []), finalOp] }
                                    : b
                            ));
                            setPendingNewOps(prev => prev.filter(p => p.id !== op.id));
                        } else {
                            setBoards(prev => prev.map(b =>
                                b.id.toString() === selectedBoard.id.toString()
                                    ? { ...b, operations: (b.operations || []).map(o => o.id === op.id ? { ...o, ...staged } : o) }
                                    : b
                            ));
                        }
                        setStagedOps(prev => { const next = { ...prev }; delete next[op.id]; return next; });
                        setEditingToolOpId(null);
                        setTimeout(() => setComputingMessage(null), 2000);
                    });
                };

                const cancelEdit = () => {
                    if (isNew) {
                        setPendingNewOps(prev => prev.filter(p => p.id !== op.id));
                    }
                    setStagedOps(prev => { const next = { ...prev }; delete next[op.id]; return next; });
                    setEditingToolOpId(null);
                };

                const del = () => {
                    if (isNew) {
                        setPendingNewOps(prev => prev.filter(p => p.id !== op.id));
                    } else {
                        removeOperation(selectedBoard.id, op.id);
                    }
                    setStagedOps(prev => { const next = { ...prev }; delete next[op.id]; return next; });
                    setEditingToolOpId(null);
                };

                const icon = { hole: '◎', cove: '◡', arc: '◠', dado: '✂', miter: '⊿', subtract: '🔪' }[op.type] || '●';

                return (
                    <div style={{
                        padding: '12px', borderRadius: '8px',
                        background: 'rgba(188,138,95,0.06)',
                        border: '1px solid rgba(188,138,95,0.4)',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-color)', textTransform: 'capitalize' }}>
                                {icon} {displayOp.type} Tool
                            </span>
                            <button onClick={cancelEdit} style={{
                                background: 'none', border: 'none', color: 'var(--text-muted)',
                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                            }}>← Back</button>
                        </div>

                        {/* ── Arc Editor ── */}
                        {op.type === 'arc' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Start Angle (°)</div>
                                    <input type="number" step="1" value={displayOp.startAngle} onChange={e => upd({ startAngle: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>End Angle (°)</div>
                                    <input type="number" step="1" value={displayOp.endAngle} onChange={e => upd({ endAngle: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Cutout to Leave (in)</div>
                                    <input type="number" min="0" step="0.25" value={parseFloat((displayOp.innerRadius ?? 0).toFixed(4))} onChange={e => upd({ innerRadius: Math.max(0, parseFloat(e.target.value) || 0) })} style={inputStyle} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Extrude Axis</div>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {['x', 'y', 'z'].map(a => {
                                            const axisColor = { x: 'rgba(255, 60, 60', y: 'rgba(60, 200, 90', z: 'rgba(60, 150, 255' }[a];
                                            const isActive = displayOp.axis === a;
                                            return (
                                                <button key={a} onClick={() => upd({ axis: a })} style={{ flex: 1, padding: '5px', fontSize: '0.8rem', borderRadius: '4px', border: isActive ? `1px solid ${axisColor}, 0.8)` : '1px solid var(--border-color)', background: isActive ? `${axisColor}, 0.25)` : `${axisColor}, 0.07)`, color: isActive ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: isActive ? 700 : 400, transition: 'all 0.15s' }}>{a.toUpperCase()}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Cove Editor ── */}
                        {op.type === 'cove' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Edge</div>
                                    <select value={displayOp.edge} onChange={e => upd({ edge: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        <option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option>
                                    </select>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Depth (in)</div>
                                    <input type="number" min="0" step="0.25" value={parseFloat((displayOp.depth ?? 0).toFixed(4))} onChange={e => upd({ depth: Math.max(0, parseFloat(e.target.value) || 0) })} style={inputStyle} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Axis</div>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {['x', 'y', 'z'].map(a => {
                                            const axisColor = { x: 'rgba(255, 60, 60', y: 'rgba(60, 200, 90', z: 'rgba(60, 150, 255' }[a];
                                            const isActive = displayOp.axis === a;
                                            return (
                                                <button key={a} onClick={() => upd({ axis: a })} style={{ flex: 1, padding: '5px', fontSize: '0.8rem', borderRadius: '4px', border: isActive ? `1px solid ${axisColor}, 0.8)` : '1px solid var(--border-color)', background: isActive ? `${axisColor}, 0.25)` : `${axisColor}, 0.07)`, color: isActive ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: isActive ? 700 : 400, transition: 'all 0.15s' }}>{a.toUpperCase()}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Hole Editor ── */}
                        {op.type === 'hole' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Hole Radius (in)</div>
                                    <input type="number" min="0.125" step="0.125" value={parseFloat((displayOp.radius ?? 0).toFixed(4))} onChange={e => upd({ radius: Math.max(0, parseFloat(e.target.value) || 0) })} style={inputStyle} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Offset X (in)</div>
                                    <input type="number" step="0.25" value={parseFloat((displayOp.offsetX ?? 0).toFixed(4))} onChange={e => upd({ offsetX: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Offset Y (in)</div>
                                    <input type="number" step="0.25" value={parseFloat((displayOp.offsetY ?? 0).toFixed(4))} onChange={e => upd({ offsetY: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Axis</div>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {['x', 'y', 'z'].map(a => {
                                            const axisColor = { x: 'rgba(255, 60, 60', y: 'rgba(60, 200, 90', z: 'rgba(60, 150, 255' }[a];
                                            const isActive = displayOp.axis === a;
                                            return (
                                                <button key={a} onClick={() => upd({ axis: a })} style={{ flex: 1, padding: '5px', fontSize: '0.8rem', borderRadius: '4px', border: isActive ? `1px solid ${axisColor}, 0.8)` : '1px solid var(--border-color)', background: isActive ? `${axisColor}, 0.25)` : `${axisColor}, 0.07)`, color: isActive ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: isActive ? 700 : 400, transition: 'all 0.15s' }}>{a.toUpperCase()}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Dado Editor ── */}
                        {op.type === 'dado' && (() => {
                            const faceMap = {
                                top:    { depthAxis: 'y', faceAxes: ['x', 'z'] },
                                bottom: { depthAxis: 'y', faceAxes: ['x', 'z'] },
                                front:  { depthAxis: 'z', faceAxes: ['x', 'y'] },
                                back:   { depthAxis: 'z', faceAxes: ['x', 'y'] },
                                right:  { depthAxis: 'x', faceAxes: ['y', 'z'] },
                                left:   { depthAxis: 'x', faceAxes: ['y', 'z'] },
                            };
                            const currentFace = displayOp.face || 'top';
                            const { faceAxes } = faceMap[currentFace];
                            const currentDir = displayOp.direction || faceAxes[0];
                            const axisColor = a => ({ x: 'rgba(255, 60, 60', y: 'rgba(60, 200, 90', z: 'rgba(60, 150, 255' }[a]);
                            const faceColor = f => ({ top: 'y', bottom: 'y', front: 'z', back: 'z', left: 'x', right: 'x' }[f]);
                            const isThrough = (displayOp.length ?? 0) <= 0;

                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                                    {/* Face selector */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Face</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                                            {['top', 'bottom', 'front', 'back', 'left', 'right'].map(f => {
                                                const ac = axisColor(faceColor(f));
                                                const active = currentFace === f;
                                                return (
                                                    <button key={f} onClick={() => {
                                                        const newFaceAxes = faceMap[f].faceAxes;
                                                        const patch = { face: f };
                                                        if (!newFaceAxes.includes(currentDir)) patch.direction = newFaceAxes[0];
                                                        upd(patch);
                                                    }} style={{ padding: '4px', fontSize: '0.72rem', borderRadius: '4px', border: active ? `1px solid ${ac}, 0.8)` : '1px solid var(--border-color)', background: active ? `${ac}, 0.25)` : `${ac}, 0.07)`, color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.15s', textTransform: 'capitalize' }}>{f}</button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Direction toggle */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Channel Direction</div>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {faceAxes.map(a => {
                                                const ac = axisColor(a);
                                                const active = currentDir === a;
                                                return (
                                                    <button key={a} onClick={() => upd({ direction: a })} style={{ flex: 1, padding: '5px', fontSize: '0.8rem', borderRadius: '4px', border: active ? `1px solid ${ac}, 0.8)` : '1px solid var(--border-color)', background: active ? `${ac}, 0.25)` : `${ac}, 0.07)`, color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>Along {a.toUpperCase()}</button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Width */}
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Width (in)</div>
                                        <input type="number" min="0.0625" step="0.0625" value={parseFloat((displayOp.width ?? 0.75).toFixed(4))} onChange={e => upd({ width: Math.max(0.0625, parseFloat(e.target.value) || 0.0625) })} style={inputStyle} />
                                    </div>

                                    {/* Depth */}
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Depth (in)</div>
                                        <input type="number" min="0.0625" step="0.0625" value={parseFloat((displayOp.depth ?? 0.375).toFixed(4))} onChange={e => upd({ depth: Math.max(0.0625, parseFloat(e.target.value) || 0.0625) })} style={inputStyle} />
                                    </div>

                                    {/* Offset */}
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Offset (in)</div>
                                        <input type="number" step="0.125" value={parseFloat((displayOp.offset ?? 0).toFixed(4))} onChange={e => upd({ offset: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                    </div>

                                    {/* Through toggle */}
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            <input type="checkbox" checked={isThrough} onChange={e => upd({ length: e.target.checked ? 0 : 2 })} style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }} />
                                            Through
                                        </label>
                                    </div>

                                    {/* Length & Length Offset (only when not through) */}
                                    {!isThrough && (
                                        <>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Length (in)</div>
                                                <input type="number" min="0.125" step="0.125" value={parseFloat((displayOp.length ?? 2).toFixed(4))} onChange={e => upd({ length: Math.max(0.125, parseFloat(e.target.value) || 0.125) })} style={inputStyle} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Length Offset (in)</div>
                                                <input type="number" step="0.125" value={parseFloat((displayOp.lengthOffset ?? 0).toFixed(4))} onChange={e => upd({ lengthOffset: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── Action Buttons ── */}
                        {/* ── Miter Editor ── */}
                        {op.type === 'miter' && (() => {
                            const currentAngle = displayOp.angle ?? 45;
                            const faceLabels = {
                                'x+': 'Right End', 'x-': 'Left End',
                                'z+': 'Front End', 'z-': 'Back End',
                            };
                            const curFace = displayOp.face || 'x+';

                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {/* Cut End Toggle */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Cut End</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                            {['x+', 'x-', 'z-', 'z+'].map(f => {
                                                const active = curFace === f;
                                                // Default fence selection to maintain standard behavior
                                                const defaultFence = f.startsWith('x') ? 'z-' : 'x-';
                                                
                                                return (
                                                    <button key={f} onClick={() => upd({ face: f, fenceEdge: defaultFence })} style={{
                                                        padding: '6px', fontSize: '0.75rem', borderRadius: '4px',
                                                        border: active ? '1px solid rgba(188,138,95,0.8)' : '1px solid var(--border-color)',
                                                        background: active ? 'rgba(188,138,95,0.25)' : 'rgba(255,255,255,0.04)',
                                                        color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                                                        fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                                                    }}>{faceLabels[f]}</button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Miter Angle input */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Miter (°) — turntable swing, 0 = square</div>
                                        <input type="number" min="0" max="60" step="1" value={currentAngle}
                                            onChange={e => upd({ angle: Math.max(0, Math.min(60, parseFloat(e.target.value) || 0)) })}
                                            style={inputStyle} />
                                        <input type="range" min="0" max="60" step="1" value={currentAngle}
                                            onChange={e => upd({ angle: parseFloat(e.target.value) })}
                                            style={{ width: '100%', marginTop: '4px', accentColor: 'var(--accent-color)' }} />
                                    </div>

                                    {/* Bevel Angle input */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Bevel (°) — blade tilt, + from bottom, − from top</div>
                                        <input type="number" min="-60" max="60" step="1" value={displayOp.bevel ?? 0}
                                            onChange={e => upd({ bevel: Math.max(-60, Math.min(60, parseFloat(e.target.value) || 0)) })}
                                            style={inputStyle} />
                                        <input type="range" min="-60" max="60" step="1" value={displayOp.bevel ?? 0}
                                            onChange={e => upd({ bevel: parseFloat(e.target.value) })}
                                            style={{ width: '100%', marginTop: '4px', accentColor: 'var(--accent-color)' }} />
                                    </div>

                                    <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                        Miter swings the cut across the face. Bevel tilts the blade sideways. Combine both for a compound miter.
                                    </p>
                                </div>
                            );
                        })()}

                        {/* ── Subtract Editor ── */}
                        {op.type === 'subtract' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Cutter Board</div>
                                    <div style={{
                                        padding: '6px 10px', borderRadius: '6px',
                                        background: 'rgba(255, 140, 50, 0.08)',
                                        border: '1px solid rgba(255, 140, 50, 0.2)',
                                        fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)',
                                    }}>
                                        {displayOp.cutterName || 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Cutter Size</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                        {displayOp.cutterSize ? `${displayOp.cutterSize[0]}" × ${displayOp.cutterSize[1]}" × ${displayOp.cutterSize[2]}"` : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Shape</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                        {displayOp.cutterShape || 'box'}
                                    </div>
                                </div>
                                {displayOp.cutterId && (() => {
                                    const cutterBoard = boards.find(bd => bd.id.toString() === displayOp.cutterId);
                                    if (!cutterBoard) return null;
                                    return (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            <input
                                                type="checkbox"
                                                checked={cutterBoard.visible !== false}
                                                onChange={() => toggleBoardVisibility(cutterBoard.id)}
                                                style={{ accentColor: '#ff8c32', cursor: 'pointer' }}
                                            />
                                            Show cutter board
                                        </label>
                                    );
                                })()}
                                <p className="hint" style={{ marginTop: '0' }}>
                                    This is a frozen snapshot. The cut shape won't change if you move the cutter board.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                            <button onClick={applyStaged} disabled={!hasPending} style={{
                                flex: 1, padding: '7px',
                                background: hasPending ? 'rgba(60,200,90,0.12)' : 'transparent',
                                border: hasPending ? '1px solid rgba(60,200,90,0.5)' : '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: hasPending ? '#34c759' : 'var(--text-muted)',
                                cursor: hasPending ? 'pointer' : 'default',
                                fontSize: '0.8rem', fontWeight: 700,
                                opacity: hasPending ? 1 : 0.4,
                                transition: 'all 0.15s',
                            }}>✓ Apply</button>
                            <button onClick={del} style={{
                                padding: '7px 14px',
                                background: 'rgba(255,59,48,0.08)',
                                border: '1px solid rgba(255,59,48,0.3)',
                                borderRadius: '6px',
                                color: '#ff3b30',
                                cursor: 'pointer',
                                fontSize: '0.8rem', fontWeight: 600,
                                transition: 'all 0.15s',
                            }}>✕ Remove</button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// ── Shared input style ──────────────────────────────────────────────────────
const inputStyle = {
    width: '100%', padding: '5px 8px',
    background: 'var(--bg-color)', color: 'var(--text-main)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    outline: 'none', fontSize: '0.9rem',
};

// ── Build a compact summary string for each tool type ────────────────────────
function getToolSummary(op) {
    switch (op.type) {
        case 'dado':
            return `${op.face || 'top'} surface · along ${(op.direction || 'x').toUpperCase()}`;
        case 'hole':
            return `r=${(op.radius ?? 0).toFixed(2)}" · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'cove':
            return `${op.edge || 'top'} edge · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'arc':
            return `${op.startAngle ?? 0}°–${op.endAngle ?? 90}° · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'miter': {
            const bevel = op.bevel ?? 0;
            return `${faceLabel(op.face || 'x+')} · ${op.angle ?? 45}°${bevel > 0 ? ` · Bevel ${bevel}°` : ''}`;
        }
        case 'subtract':
            return `Subtracting "${op.cutterName || 'unknown'}" · ${op.cutterShape || 'box'}`;
        default:
            return op.type;
    }
}

function faceLabel(f) {
    return { 'z+': 'Front', 'z-': 'Back', 'x+': 'Right', 'x-': 'Left' }[f] || f;
}

export default ToolsPanel;
