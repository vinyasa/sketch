import React, { useState } from 'react';
import { solveAlignmentConstraint } from '../../utils/constraintSolver';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';

import useStore from '../../store/useStore';

const InspectorPanel = () => {
    const [cloneOffset, setCloneOffset] = useState(0.75);

    const {
        boards, groups, selectedItemIds,
        updateVector, moveGroup,
        setBoards, setGroups, setSelectedItemIds,
        pushHistory,
        dropBoardToFloor, dropGroupToFloor,
        handleAssemblyDelete, handleComponentDelete,
        constraintTargetMode, setConstraintTargetMode,
        updateProceduralBox
    } = useStore();

    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);

    // ─── Assembly (Group) Inspector ──────────────────────────────────────────
    if (selectedGroup) {
        const isWorkspace = selectedGroup === 'Workspace';

        // Compute overall dimensions from child boards
        const childBoards = collectChildBoards(selectedGroup, boards, groups);
        let overallSize = [0, 0, 0];
        if (childBoards.length > 0) {
            const aabb = computeWorldAABB(childBoards);
            overallSize = [
                Math.abs(aabb.maxX - aabb.minX),
                Math.abs(aabb.maxY - aabb.minY),
                Math.abs(aabb.maxZ - aabb.minZ)
            ];
        }

        return (
            <>
                <div className="inspector-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assembly:</span>
                    <input 
                        type="text" 
                        value={selectedGroup} 
                        disabled={isWorkspace}
                        title={isWorkspace ? 'Root workspace cannot be renamed' : 'Click to rename assembly'}
                        onChange={(e) => {
                            const newName = e.target.value;
                            if (newName === selectedGroup || groups[newName]) return;
                            let nextGroups = { ...groups };
                            nextGroups[newName] = nextGroups[selectedGroup];
                            delete nextGroups[selectedGroup];
                            Object.keys(nextGroups).forEach(k => {
                                if (nextGroups[k].parentId === selectedGroup) nextGroups[k].parentId = newName;
                            });
                            setGroups(nextGroups);
                            setBoards(boards.map(bd => bd.parentId === selectedGroup ? { ...bd, parentId: newName } : bd));
                            setSelectedItemIds(selectedItemIds.map(id => id === selectedGroup ? newName : id));
                        }}
                        style={{ flex: 1, width: '100%', background: isWorkspace ? 'transparent' : 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid', borderColor: isWorkspace ? 'transparent' : 'var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} 
                    />
                </div>
                <div className="inspector-section">
                    <h4>Overall Dimensions (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" value={overallSize[0].toFixed(4)} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" value={overallSize[1].toFixed(4)} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" value={overallSize[2].toFixed(4)} disabled /></div>
                    </div>
                </div>
                {!isWorkspace && (
                    <div className="inspector-section">
                        <h4>Move Group (delta in)</h4>
                        <div className="vec3-inputs">
                            <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 0, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 1, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 2, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                        </div>
                        <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropGroupToFloor}>↓ Set on Floor</button>
                        <p className="hint" style={{ marginTop: '6px' }}>Enter a delta value and press Enter to shift all children.</p>
                    </div>
                )}
                {groups[selectedGroup].meta && groups[selectedGroup].meta.type === 'procedural-box' && (
                    <div className="inspector-section" style={{ background: 'rgba(188, 138, 95, 0.1)', border: '1px solid rgba(188, 138, 95, 0.3)' }}>
                        <h4 style={{ color: 'var(--accent-color)' }}>Procedural Box Generator</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Joint Strategy:</span>
                            <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: '100px' }} onClick={() => {
                                const cur = groups[selectedGroup].meta.joint;
                                const next = cur === 'butt-A' ? 'butt-B' : cur === 'butt-B' ? 'miter' : 'butt-A';
                                updateProceduralBox(selectedGroup, { joint: next });
                            }}>
                                {groups[selectedGroup].meta.joint === 'butt-A' ? 'Butt (Front/Back full)' : groups[selectedGroup].meta.joint === 'butt-B' ? 'Butt (Sides full)' : 'Miter'}
                            </button>
                        </div>
                        <p className="hint" style={{ marginTop: '6px' }}>Click to auto-recalculate all 4 walls.</p>
                    </div>
                )}
                {!isWorkspace && (
                    <div style={{ marginTop: '16px' }}>
                        <button
                            className="nav-btn"
                            style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                            onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                            onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                            onClick={handleAssemblyDelete}
                        >
                            Delete Assembly & Contents
                        </button>
                    </div>
                )}
            </>
        );
    }

    // ─── Multi-select ────────────────────────────────────────────────────────
    if (selectedItemIds.length > 1) {
        return (
            <>
                <div className="inspector-title">Multiple Selected ({selectedItemIds.length})</div>
                <div className="inspector-section"><p className="hint">Use AI Chat for bulk transforms.</p></div>
            </>
        );
    }

    // ─── Single Board Inspector ──────────────────────────────────────────────
    if (selectedBoard) {
        // Sort dimensions to show Length/Width/Thickness labels
        const sorted = [...selectedBoard.size].map((v, i) => ({ val: v, idx: i })).sort((a, b) => b.val - a.val);
        const dimLabels = ['Length', 'Width', 'Thickness'];

        const incomingConstraints = [];
        boards.forEach(b => {
            if (b.id !== selectedBoard.id && b.constraints) {
                b.constraints.forEach((c, idx) => {
                    if (c.targetId.toString() === selectedBoard.id.toString()) {
                        incomingConstraints.push({ sourceBoard: b, constraint: c, internalIndex: idx });
                    }
                });
            }
        });

        const handleClone = () => {
            if (!selectedBoard) return;
            // Clone along the thinnest axis direction
            const minSize = Math.min(...selectedBoard.size);
            const thickAxis = selectedBoard.size.indexOf(minSize);
            
            const maxId = Math.max(...boards.map(b => parseInt(b.id) || 0), 0);
            const newId = maxId + 1;
            
            const newPos = [...selectedBoard.position];
            newPos[thickAxis] += cloneOffset;
            
            const newBoard = {
                ...selectedBoard,
                id: newId,
                position: newPos,
                constraints: []
            };
            
            const match = selectedBoard.name.match(/^(.*?)(\sCopy\s\d+|\sCopy)?$/);
            const baseName = match ? match[1] : selectedBoard.name;
            let maxCopyIdx = 0;
            boards.forEach(b => {
                 const m = b.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Copy (\\d+)$`));
                 if (m) maxCopyIdx = Math.max(maxCopyIdx, parseInt(m[1]));
                 else if (b.name === `${baseName} Copy`) maxCopyIdx = Math.max(maxCopyIdx, 1);
            });
            
            if (maxCopyIdx > 0) {
                newBoard.name = `${baseName} Copy ${maxCopyIdx + 1}`;
            } else {
                newBoard.name = `${baseName} Copy`;
            }
            
            pushHistory();
            setBoards([...boards, newBoard]);
            setSelectedItemIds([newId.toString()]);
        };

        return (
            <>
                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                    <input type="text" value={selectedBoard.name} onChange={e => { const v = e.target.value; setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, name: v } : b)); }} title="Click to rename component" style={{ width: '100%', background: 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} />
                </div>
                <div className="inspector-section">
                    <h4>Size (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.5" value={Number(selectedBoard.size[0].toFixed(4))} onChange={e => updateVector('size', 0, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.5" value={Number(selectedBoard.size[1].toFixed(4))} onChange={e => updateVector('size', 1, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.5" value={Number(selectedBoard.size[2].toFixed(4))} onChange={e => updateVector('size', 2, e.target.value)} /></div>
                    </div>
                    <div className="hint" style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                        {sorted.map((d, i) => `${dimLabels[i]}: ${d.val.toFixed(2)}" (${['X','Y','Z'][d.idx]})`).join(' · ')}
                    </div>
                </div>
                <div className="inspector-section">
                    <h4>Position (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.125" value={Number(selectedBoard.position[0].toFixed(4))} onChange={e => updateVector('position', 0, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.125" value={Number(selectedBoard.position[1].toFixed(4))} onChange={e => updateVector('position', 1, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.125" value={Number(selectedBoard.position[2].toFixed(4))} onChange={e => updateVector('position', 2, e.target.value)} /></div>
                    </div>
                    <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropBoardToFloor}>↓ Set on Floor</button>
                </div>
                <div className="inspector-section">
                    <h4>Active Constraints</h4>
                    {(() => {
                        const hasConstraints = (selectedBoard.constraints && selectedBoard.constraints.length > 0) || incomingConstraints.length > 0;

                        if (!hasConstraints) {
                            return <div className="hint" style={{ marginTop: 0 }}>No relational constraints set.</div>;
                        }

                        return (
                            <ul style={{ margin: '8px 0 16px 0', padding: 0, listStyle: 'none' }}>
                                {(selectedBoard.constraints || []).map((c, i) => {
                                    const targetBoard = boards.find(b => b.id.toString() === c.targetId.toString());
                                    const tName = targetBoard ? targetBoard.name : 'Unknown';
                                    return (
                                        <li key={`out_${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: c.enabled === false ? 0.5 : 1 }}>
                                            <span><strong>{c.type}</strong> → {tName}</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {(c.type === 'Flush' || c.type === 'Glue') && (
                                                    <button onClick={() => {
                                                        pushHistory();
                                                        setBoards(prev => prev.map(b => {
                                                            if (b.id === selectedBoard.id) {
                                                                const result = solveAlignmentConstraint(b, c, prev, groups);
                                                                return result ? { ...b, ...result } : b;
                                                            }
                                                            return b;
                                                        }));
                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                )}
                                                <button onClick={() => {
                                                    pushHistory();
                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === i ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={c.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{c.enabled === false ? '🔓' : '🔒'}</button>
                                                <button onClick={() => {
                                                    pushHistory();
                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== i) } : b));
                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                            </div>
                                        </li>
                                    );
                                })}
                                {incomingConstraints.map((item, i) => {
                                    const { sourceBoard, constraint, internalIndex } = item;
                                    return (
                                        <li key={`in_${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: constraint.enabled === false ? 0.5 : 1 }}>
                                            <span>{sourceBoard.name} → <strong>{constraint.type}</strong></span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {(constraint.type === 'Flush' || constraint.type === 'Glue') && (
                                                    <button onClick={() => {
                                                        pushHistory();
                                                        setBoards(prev => prev.map(b => {
                                                            if (b.id === sourceBoard.id) {
                                                                const result = solveAlignmentConstraint(b, constraint, prev, groups);
                                                                return result ? { ...b, ...result } : b;
                                                            }
                                                            return b;
                                                        }));
                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                )}
                                                <button onClick={() => {
                                                    pushHistory();
                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === internalIndex ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={constraint.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{constraint.enabled === false ? '🔓' : '🔒'}</button>
                                                <button onClick={() => {
                                                    pushHistory();
                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== internalIndex) } : b));
                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        );
                    })()}

                    {constraintTargetMode && constraintTargetMode.active ? (
                        <div style={{ padding: '12px', background: 'rgba(188, 138, 95, 0.1)', border: '1px dashed var(--accent-color)', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                                {constraintTargetMode.step === 1 ? `Select Source Face on ${selectedBoard.name}...` : `Select Target Face on another board...`}
                            </div>
                            <button className="nav-btn" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => setConstraintTargetMode(null)}>Cancel</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <select
                                id="add_constraint_select"
                                style={{
                                    flex: 1, padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                value=""
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        setConstraintTargetMode({ active: true, type: val, step: 1, sourceId: selectedBoard.id.toString(), sourceFace: null });
                                    }
                                }}
                            >
                                <option value="" disabled>+ Add Constraint...</option>
                                <option value="Glue">Glue To Face</option>
                                <option value="Flush">Make Flush</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="inspector-section">
                    <h4>Parent Node:</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}><strong>{selectedBoard.parentId}</strong></div>
                </div>
                <div className="inspector-section">
                    <h4>Clone Component</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.82rem' }}>Offset (in):</span>
                        <input type="number" step="0.125" value={cloneOffset} onChange={e => setCloneOffset(Number(e.target.value))} style={{ width: '60px', padding: '4px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                        <button className="primary-btn" style={{ flex: 1, padding: '4px 0', fontSize: '0.9rem' }} onClick={handleClone}>Clone Along Thin Axis</button>
                    </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                    <button
                        className="nav-btn"
                        style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                        onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                        onClick={handleComponentDelete}
                    >
                        Delete Component
                    </button>
                </div>
            </>
        );
    }

    return <div className="hint" style={{ marginTop: '0px' }}>Select a component in the outliner or viewport.</div>;
};

export default InspectorPanel;
