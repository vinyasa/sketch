import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import useStore from '../../store/useStore';
import { collectChildBoards } from '../../utils/sceneGraph';

const ToolsPanel = () => {
    // Staged modifier edits — changes are held locally until "Apply" is clicked
    const [stagedOps, setStagedOps] = useState({});
    // New modifiers that haven't been committed to the store yet
    const [pendingNewOps, setPendingNewOps] = useState([]);
    
    // UI state for bulk edge joints
    const [bulkJointType, setBulkJointType] = useState('rabbet');
    const [bulkSideOverTop, setBulkSideOverTop] = useState(true);

    const {
        boards, selectedItemIds, groups,
        setBoards, pushHistory,
        removeOperation, updateOperation,
        editingToolOpId, setEditingToolOpId,
        applyEdgeJoint, toggleEdgeJoint, removeEdgeJoint, switchEdgeJointType,
        applyBulkEdgeJoints, removeBulkEdgeJoints,
        applySubtraction, toggleBoardVisibility,
        applyAssemblyProfile, clearAssemblyProfile,
    } = useStore();

    // Smart Edge Profiler State
    const [profileType, setProfileType] = useState('roundover');
    const [faceDirection, setFaceDirection] = useState('top');
    const [radius, setRadius] = useState(0.25);
    const [width, setWidth] = useState(0.25);

    // Collect all board IDs from selectedItemIds (including children of selected groups)
    const targetBoardIds = useMemo(() => {
        const ids = [];
        (selectedItemIds || []).forEach(id => {
            if (groups?.[id]) {
                ids.push(...collectChildBoards(id, boards, groups).map(b => b.id.toString()));
            } else if (boards.some(b => b.id.toString() === id)) {
                ids.push(id.toString());
            }
        });
        return Array.from(new Set(ids));
    }, [selectedItemIds, boards, groups]);

    const selectedBoardsForProfile = useMemo(() => {
        return boards.filter(b => targetBoardIds.includes(b.id.toString()));
    }, [boards, targetBoardIds]);

    let hasExistingProfile = false;
    let existingVal = 0.25;
    let existingType = 'roundover';

    for (const b of selectedBoardsForProfile) {
        const found = b.operations?.find(op => op.source === 'assembly-profile' && op.meta?.faceDirection === faceDirection);
        if (found) {
            hasExistingProfile = true;
            existingVal = found.profile === 'roundover' ? found.radius : found.width;
            existingType = found.profile;
            break;
        }
    }

    useEffect(() => {
        if (hasExistingProfile) {
            setProfileType(existingType);
            if (existingType === 'roundover') setRadius(existingVal);
            else setWidth(existingVal);
        }
    }, [faceDirection, hasExistingProfile, existingVal, existingType]);

    const handleApplyAssemblyProfile = () => {
        const params = profileType === 'roundover' ? { radius } : { width };
        applyAssemblyProfile(targetBoardIds, faceDirection, profileType, params);
    };

    const handleClearAssemblyProfile = () => {
        clearAssemblyProfile(targetBoardIds, faceDirection);
    };


    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);

    // Multi-board selection for joint tools
    const selectedBoards = selectedItemIds.length >= 2
        ? selectedItemIds.map(id => boards.find(b => b.id.toString() === id)).filter(Boolean)
        : [];
        
    const bbOf = (b) => [0, 1, 2].map(i => ({
        min: b.position[i] - b.size[i] / 2,
        max: b.position[i] + b.size[i] / 2,
    }));

    const touches = selectedBoards.length >= 2 && selectedBoards.every((b1, i1) => 
        selectedBoards.every((b2, i2) => {
            if (i1 >= i2) return true;
            const b1b = bbOf(b1), b2b = bbOf(b2);
            return [0, 1, 2].every(i => Math.min(b1b[i].max, b2b[i].max) - Math.max(b1b[i].min, b2b[i].min) > -0.05);
        })
    );
    
    const overlaps = selectedBoards.length === 2 && (() => {
        try {
            const getOBB = (b) => {
                const rot = b.orientation || b.rotation || [0, 0, 0];
                const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ');
                const quaternion = new THREE.Quaternion().setFromEuler(euler);
                const position = new THREE.Vector3(...b.position);
                
                let matrix = new THREE.Matrix4();
                if (b.pivot) {
                     const pivotPos = new THREE.Vector3(...b.pivot);
                     const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
                     const invPivotMatrix = new THREE.Matrix4().makeTranslation(-pivotPos.x, -pivotPos.y, -pivotPos.z);
                     const translationMatrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
                     matrix.multiply(translationMatrix).multiply(rotationMatrix).multiply(invPivotMatrix);
                } else {
                     matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
                }

                const obb = new OBB();
                const epsilon = 0.05; // Shrink slightly to avoid false positive on flush
                obb.halfSize.set(
                    Math.max(0, b.size[0]/2 - epsilon), 
                    Math.max(0, b.size[1]/2 - epsilon), 
                    Math.max(0, b.size[2]/2 - epsilon)
                );
                obb.applyMatrix4(matrix);
                return obb;
            };
            const obb1 = getOBB(selectedBoards[0]);
            const obb2 = getOBB(selectedBoards[1]);
            return obb1.intersectsOBB(obb2);
        } catch(e) {
            return false;
        }
    })();
    
    const isMiterJoint = selectedBoards.length === 2 && selectedBoards[0].edgeJoints?.some(j => j.partnerId === selectedBoards[1].id.toString() && j.type === 'miter');

    const canShowedgeJoint = touches;
    const canShowSubtraction = overlaps && !isMiterJoint;

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
            {/* ── Smart Edge Profiler Section (when there is a selection) ── */}
            {!editingOp && targetBoardIds.length >= 1 && (
                <div className="inspector-card" style={{
                    background: 'rgba(188, 138, 95, 0.06)',
                    borderColor: 'rgba(188, 138, 95, 0.3)',
                    marginBottom: '12px',
                }}>
                    <h4 style={{ color: 'var(--accent-color)', margin: '0 0 6px 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⌸ Smart Edge Profiler
                    </h4>
                    <p className="hint" style={{ marginTop: '2px', marginBottom: '8px', fontSize: '0.66rem' }}>
                        Applies a non-destructive profile around the outer perimeter edges of the selection.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>Profile</div>
                                <select
                                    value={profileType}
                                    onChange={e => setProfileType(e.target.value)}
                                    style={{
                                        width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.75rem', cursor: 'pointer'
                                    }}
                                >
                                    <option value="roundover">Roundover</option>
                                    <option value="chamfer">Chamfer</option>
                                </select>
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>Target Face</div>
                                <select
                                    value={faceDirection}
                                    onChange={e => setFaceDirection(e.target.value)}
                                    style={{
                                        width: '100%', padding: '4px 6px', background: 'var(--bg-color)', color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.75rem', cursor: 'pointer'
                                    }}
                                >
                                    <option value="top">Top Face (Y+)</option>
                                    <option value="bottom">Bottom Face (Y-)</option>
                                    <option value="front">Front Face (Z+)</option>
                                    <option value="back">Back Face (Z-)</option>
                                    <option value="left">Left Face (X-)</option>
                                    <option value="right">Right Face (X+)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                <span>{profileType === 'roundover' ? 'Roundover Radius' : 'Chamfer Width'}</span>
                                <span style={{ color: 'var(--text-main)' }}>{profileType === 'roundover' ? radius : width}”</span>
                            </div>
                            <input
                                type="range" min="0.0625" max="1.5" step="0.0625"
                                value={profileType === 'roundover' ? radius : width}
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    if (profileType === 'roundover') setRadius(val);
                                    else setWidth(val);
                                }}
                                style={{ width: '100%', accentColor: 'var(--accent-color)', height: '4px', cursor: 'pointer', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button
                                className="primary-btn"
                                style={{ flex: 1, padding: '5px 10px', fontSize: '0.72rem', fontWeight: 'bold' }}
                                onClick={handleApplyAssemblyProfile}
                            >
                                {hasExistingProfile ? 'Update Profile' : 'Apply Perimeter Profile'}
                            </button>
                            {hasExistingProfile && (
                                <button
                                    className="nav-btn"
                                    style={{ padding: '5px 10px', fontSize: '0.72rem', color: '#ff3b30', borderColor: 'rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', cursor: 'pointer' }}
                                    onClick={handleClearAssemblyProfile}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edge Joint Section (2+ boards selected) ── */}
            {canShowedgeJoint && (() => {
                const boardIds = selectedBoards.map(b => b.id.toString());
                
                // Count how many joints exist among selection
                let existingJoints = 0;
                let firstJointType = null;
                
                selectedBoards.forEach(b => {
                    if (b.edgeJoints) {
                        b.edgeJoints.forEach(j => {
                            if (boardIds.includes(j.partnerId)) {
                                existingJoints++;
                                if (!firstJointType) firstJointType = j.type;
                            }
                        });
                    }
                });
                
                // Since each joint is tracked on both boards, existingJoints is 2x the actual joint count
                const actualJointCount = existingJoints / 2;
                
                // If there are existing joints, maybe show their type as active
                const activeType = actualJointCount > 0 ? (firstJointType || 'rabbet') : 'butt';

                const handleTypeClick = (type) => {
                    setBulkJointType(type);
                    applyBulkEdgeJoints(boardIds, type, bulkSideOverTop);
                };
                
                let overBoardName = 'Sides';
                let underBoardName = 'T/B';
                
                if (selectedBoards.length === 2) {
                    const [bA, bB] = selectedBoards;
                    if (actualJointCount > 0 && bA.edgeJoints) {
                        const joint = bA.edgeJoints.find(j => j.partnerId === bB.id.toString());
                        if (joint) {
                            const overId = joint.overBoardId;
                            if (bA.id.toString() === overId) {
                                overBoardName = bA.name; underBoardName = bB.name;
                            } else {
                                overBoardName = bB.name; underBoardName = bA.name;
                            }
                        }
                    } else {
                        // Guess based on geometric extension
                        const thinA = bA.size.indexOf(Math.min(...bA.size));
                        const thinB = bB.size.indexOf(Math.min(...bB.size));
                        
                        // A is over B if A spans across B's thin axis.
                        const A_bounds_in_B = [bA.position[thinB] - bA.size[thinB]/2, bA.position[thinB] + bA.size[thinB]/2];
                        const B_pos_in_B = bB.position[thinB];
                        
                        if (B_pos_in_B >= A_bounds_in_B[0] - 0.1 && B_pos_in_B <= A_bounds_in_B[1] + 0.1) {
                            overBoardName = bA.name; underBoardName = bB.name;
                        } else {
                            overBoardName = bB.name; underBoardName = bA.name;
                        }
                    }
                }

                const handleFlip = () => {
                    if (selectedBoards.length === 2) {
                        const [bA, bB] = selectedBoards;
                        let currentOverId = overBoardName === bA.name ? bA.id.toString() : bB.id.toString();
                        let currentUnderId = currentOverId === bA.id.toString() ? bB.id.toString() : bA.id.toString();
                        
                        const { removeEdgeJoint, applyEdgeJoint } = useStore.getState();
                        removeEdgeJoint(bA.id.toString(), bB.id.toString(), true, true);
                        setTimeout(() => {
                            applyEdgeJoint(currentUnderId, currentOverId, activeType, false, false, true);
                        }, 10);
                    } else {
                        const newSideOverTop = !bulkSideOverTop;
                        setBulkSideOverTop(newSideOverTop);
                        applyBulkEdgeJoints(boardIds, activeType, newSideOverTop);
                    }
                };

                let isBoxSelection = false;
                let topBottomBoard = null;
                let sideBoards = [];
                if (selectedBoards.length === 5) {
                    const thinAxes = selectedBoards.map(b => b.size.indexOf(Math.min(...b.size)));
                    const yCount = thinAxes.filter(a => a === 1).length;
                    const xzCount = thinAxes.filter(a => a === 0 || a === 2).length;
                    if (yCount === 1 && xzCount === 4) {
                        isBoxSelection = true;
                        topBottomBoard = selectedBoards[thinAxes.indexOf(1)];
                        sideBoards = selectedBoards.filter(b => b.id !== topBottomBoard.id);
                    }
                }

                const handleBoxPanelClick = (type) => {
                    if (isBoxSelection) {
                        const { applyBoxPanelJoint } = useStore.getState();
                        if (applyBoxPanelJoint) {
                            applyBoxPanelJoint(topBottomBoard.id.toString(), sideBoards.map(b => b.id.toString()), type);
                        }
                    }
                };

                return (
                    <div className="inspector-card" style={{
                        background: 'rgba(100, 180, 255, 0.06)',
                        borderColor: 'rgba(100, 180, 255, 0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64b4ff' }}>
                                🔗 Edge Joints {selectedBoards.length > 2 && `(${selectedBoards.length} boards)`}
                            </div>
                            {actualJointCount > 0 && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {actualJointCount} active joint{actualJointCount > 1 ? 's' : ''}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Row 1: Type Selection */}
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handleTypeClick('butt')}
                                    style={{
                                        flex: '1 1 calc(50% - 4px)', padding: '6px', fontSize: '0.72rem', fontWeight: 600,
                                        background: activeType === 'butt' ? 'rgba(100, 180, 255, 0.2)' : 'rgba(100, 180, 255, 0.05)',
                                        border: `1px solid rgba(100, 180, 255, ${activeType === 'butt' ? '0.6' : '0.2'})`,
                                        borderRadius: '6px', color: activeType === 'butt' ? '#64b4ff' : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                >Butt</button>
                                <button
                                    onClick={() => handleTypeClick('single-rabbet')}
                                    style={{
                                        flex: '1 1 calc(50% - 4px)', padding: '6px', fontSize: '0.72rem', fontWeight: 600,
                                        background: activeType === 'single-rabbet' ? 'rgba(100, 180, 255, 0.2)' : 'rgba(100, 180, 255, 0.05)',
                                        border: `1px solid rgba(100, 180, 255, ${activeType === 'single-rabbet' ? '0.6' : '0.2'})`,
                                        borderRadius: '6px', color: activeType === 'single-rabbet' ? '#64b4ff' : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                >Single Rabbet</button>
                                <button
                                    onClick={() => handleTypeClick('rabbet')}
                                    style={{
                                        flex: '1 1 calc(50% - 4px)', padding: '6px', fontSize: '0.72rem', fontWeight: 600,
                                        background: activeType === 'rabbet' ? 'rgba(100, 180, 255, 0.2)' : 'rgba(100, 180, 255, 0.05)',
                                        border: `1px solid rgba(100, 180, 255, ${activeType === 'rabbet' ? '0.6' : '0.2'})`,
                                        borderRadius: '6px', color: activeType === 'rabbet' ? '#64b4ff' : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                >Dual Rabbet</button>
                                <button
                                    onClick={() => handleTypeClick('miter')}
                                    style={{
                                        flex: '1 1 calc(50% - 4px)', padding: '6px', fontSize: '0.72rem', fontWeight: 600,
                                        background: activeType === 'miter' ? 'rgba(100, 180, 255, 0.2)' : 'rgba(100, 180, 255, 0.05)',
                                        border: `1px solid rgba(100, 180, 255, ${activeType === 'miter' ? '0.6' : '0.2'})`,
                                        borderRadius: '6px', color: activeType === 'miter' ? '#64b4ff' : 'var(--text-muted)',
                                        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                >Miter / Bevel</button>
                            </div>

                            {isBoxSelection ? (
                                <>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64b4ff', marginTop: '4px' }}>Panel Inset Options</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <button
                                            onClick={() => handleBoxPanelClick('sit-on')}
                                            style={{
                                                width: '100%', padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                                background: 'rgba(100, 180, 255, 0.12)', border: '1px solid rgba(100, 180, 255, 0.4)',
                                                borderRadius: '6px', color: '#64b4ff', cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >Sit On (Butt)</button>
                                        <button
                                            onClick={() => handleBoxPanelClick('rabbeted-inset')}
                                            style={{
                                                width: '100%', padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                                background: 'rgba(100, 180, 255, 0.12)', border: '1px solid rgba(100, 180, 255, 0.4)',
                                                borderRadius: '6px', color: '#64b4ff', cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >Rabbeted Inset</button>
                                        <button
                                            onClick={() => handleBoxPanelClick('full-inset')}
                                            style={{
                                                width: '100%', padding: '7px', fontSize: '0.75rem', fontWeight: 600,
                                                background: 'rgba(100, 180, 255, 0.12)', border: '1px solid rgba(100, 180, 255, 0.4)',
                                                borderRadius: '6px', color: '#64b4ff', cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >Full Inset</button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                        {selectedBoards.length === 2 ? `${overBoardName} over ${underBoardName}` : (bulkSideOverTop ? 'Sides over T/B' : 'T/B over Sides')}
                                    </div>
                                    <button
                                        onClick={handleFlip}
                                        style={{
                                            padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
                                            background: 'rgba(100, 180, 255, 0.12)', border: '1px solid rgba(100, 180, 255, 0.4)',
                                            borderRadius: '4px', color: '#64b4ff', cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                    >⇄ Flip</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── Boolean Subtract Section (2 boards selected) ── */}
            {canShowSubtraction && (() => {
                const [bA, bB] = selectedBoards;
                return (
                    <div className="inspector-card" style={{
                        background: 'rgba(255, 140, 50, 0.06)',
                        borderColor: 'rgba(255, 140, 50, 0.3)',
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
                <div className="inspector-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
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
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 5, type: 'pocket-holes', face: 'bottom', edge: 'left', count: 2, spacing: 'auto' })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >🧰 Pocket</button>
                     <button
                        onClick={() => handleAddTool({ id: Date.now() + 6, type: 'dowel-holes', face: 'top', count: 2, diameter: 0.375, depth: 0.75, spacing: 'auto' })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >⚎ Dowels</button>
                    <button
                        onClick={() => handleAddTool({ id: Date.now() + 7, type: 'edge-profile', profile: 'roundover', edge: 'y+z+', radius: 0.25, width: 0.25 })}
                        style={addToolBtnStyle}
                        onMouseEnter={e => e.target.style.background = 'rgba(188,138,95,0.12)'}
                        onMouseLeave={e => e.target.style.background = 'var(--bg-color)'}
                    >⌸ Profile</button>
                </div>
            ) : !canShowedgeJoint && (
                <div className="hint" style={{ marginBottom: '14px' }}>Select a board to add or edit tools.</div>
            )}

            {/* ── Tool summaries (when not editing a specific tool) ── */}
            {selectedBoard && !editingOp && allOps.length > 0 && (
                <div className="inspector-card">
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Applied Tools</div>
                    {allOps.map((op) => {
                        const isNew = pendingIds.has(op.id);
                        const icon = { hole: '◎', cove: '◡', arc: '◠', dado: '✂', miter: '⊿', subtract: '🔪', 'pocket-holes': '✙', 'dowel-holes': '⚎', 'edge-profile': '⌸' }[op.type] || '●';
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

                const icon = { hole: '◎', cove: '◡', arc: '◠', dado: '✂', miter: '⊿', subtract: '🔪', 'pocket-holes': '✙', 'dowel-holes': '⚎', 'edge-profile': '⌸' }[op.type] || '●';

                return (
                    <div className="inspector-card" style={{
                        background: 'rgba(188,138,95,0.06)',
                        borderColor: 'rgba(188,138,95,0.4)',
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
                                'y+': 'Top End', 'y-': 'Bottom End',
                                'z+': 'Front End', 'z-': 'Back End',
                            };
                            const curFace = displayOp.face || 'x+';

                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {/* Cut End Toggle */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Cut End</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                            {['x+', 'x-', 'y+', 'y-', 'z-', 'z+'].map(f => {
                                                const active = curFace === f;
                                                // Default fence selection to maintain standard behavior
                                                const defaultFence = f.startsWith('x') ? 'z-' : (f.startsWith('y') ? 'z-' : 'x-');
                                                
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

                                    {/* Bevel Angle & Direction UI */}
                                    {(() => {
                                        const rawBevel = displayOp.bevel ?? 0;
                                        const bevelDir = rawBevel >= 0 ? 'left' : 'right';
                                        const bevelAngle = Math.abs(rawBevel);

                                        const changeBevel = (angle, dir) => {
                                            const sign = dir === 'right' ? -1 : 1;
                                            upd({ bevel: sign * angle });
                                        };

                                        return (
                                            <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                    Bevel Angle (°) & Direction
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                                    <input type="number" min="0" max="60" step="1" value={bevelAngle}
                                                        onChange={e => {
                                                            const val = Math.max(0, Math.min(60, parseFloat(e.target.value) || 0));
                                                            changeBevel(val, bevelDir);
                                                        }}
                                                        style={{ ...inputStyle, flex: 1, minWidth: '0' }} />

                                                    {/* Direction toggle */}
                                                    <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                        <button 
                                                            type="button"
                                                            onClick={() => changeBevel(bevelAngle, 'left')} 
                                                            style={{
                                                                padding: '4px 8px', fontSize: '0.72rem', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                                                background: bevelDir === 'left' ? 'var(--accent-color)' : 'transparent',
                                                                color: bevelDir === 'left' ? '#fff' : 'var(--text-muted)',
                                                                fontWeight: bevelDir === 'left' ? 700 : 400
                                                            }}
                                                            title="Blade tilts left: the top face gets cut shorter, bottom stays the same."
                                                        >
                                                            ⬅ Tilt Left
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => changeBevel(bevelAngle, 'right')} 
                                                            style={{
                                                                padding: '4px 8px', fontSize: '0.72rem', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                                                background: bevelDir === 'right' ? 'var(--accent-color)' : 'transparent',
                                                                color: bevelDir === 'right' ? '#fff' : 'var(--text-muted)',
                                                                fontWeight: bevelDir === 'right' ? 700 : 400
                                                            }}
                                                            title="Blade tilts right: the top stays the same, bottom gets cut shorter."
                                                        >
                                                            Tilt Right ➡
                                                        </button>
                                                    </div>
                                                </div>

                                                <input type="range" min="0" max="60" step="1" value={bevelAngle}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        changeBevel(val, bevelDir);
                                                    }}
                                                    style={{ width: '100%', accentColor: 'var(--accent-color)', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', outline: 'none', margin: '4px 0' }} />

                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                                    {bevelDir === 'left' 
                                                        ? '💡 Left tilt: top face gets cut shorter, bottom stays original length.' 
                                                        : '💡 Right tilt: top stays original length, bottom gets cut shorter.'}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                        Miter swings the cut across the face. Bevel tilts the blade sideways. Combine both for a compound miter.
                                    </p>
                                </div>
                            );
                        })()}

                        {/* ── Pocket Holes Editor ── */}
                        {op.type === 'pocket-holes' && (() => {
                            const currentFace = displayOp.face || 'bottom';
                            const perpEdges = getPerpDirections(currentFace);
                            const currentEdge = perpEdges.includes(displayOp.edge) ? displayOp.edge : perpEdges[0];
                            const isAutoSpacing = displayOp.spacing === 'auto';
                            
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Face</div>
                                        <select value={currentFace} onChange={e => {
                                            const nextFace = e.target.value;
                                            const nextPerps = getPerpDirections(nextFace);
                                            upd({ face: nextFace, edge: nextPerps[0] });
                                        }} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="top">Top</option>
                                            <option value="bottom">Bottom</option>
                                            <option value="left">Left</option>
                                            <option value="right">Right</option>
                                            <option value="front">Front</option>
                                            <option value="back">Back</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Pointing Toward</div>
                                        <select value={currentEdge} onChange={e => upd({ edge: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            {perpEdges.map(pe => (
                                                <option key={pe} value={pe}>{pe.charAt(0).toUpperCase() + pe.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Hole Count</div>
                                        <input type="number" min="1" step="1" value={displayOp.count ?? 2} onChange={e => upd({ count: Math.max(1, parseInt(e.target.value) || 2) })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Spacing Mode</div>
                                        <select value={isAutoSpacing ? 'auto' : 'custom'} onChange={e => upd({ spacing: e.target.value === 'auto' ? 'auto' : 2 })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="auto">Auto (Even)</option>
                                            <option value="custom">Custom Spacing</option>
                                        </select>
                                    </div>
                                    {!isAutoSpacing && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Custom Spacing (in)</div>
                                            <input type="number" min="0.5" step="0.25" value={parseFloat((displayOp.spacing ?? 2).toFixed(4))} onChange={e => upd({ spacing: Math.max(0.5, parseFloat(e.target.value) || 2) })} style={inputStyle} />
                                        </div>
                                    )}
                                    <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                        Pocket holes are drilled at a 15° angle into the selected face, exiting exactly at the center of the pointing edge.
                                    </p>
                                </div>
                            );
                        })()}

                        {/* ── Dowel Holes Editor ── */}
                        {op.type === 'dowel-holes' && (() => {
                            const isAutoSpacing = displayOp.spacing === 'auto';
                            const diameter = displayOp.diameter ?? (displayOp.radius ? displayOp.radius * 2 : 0.375);
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Edge Face</div>
                                        <select value={displayOp.face || 'top'} onChange={e => upd({ face: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="top">Top</option>
                                            <option value="bottom">Bottom</option>
                                            <option value="left">Left</option>
                                            <option value="right">Right</option>
                                            <option value="front">Front</option>
                                            <option value="back">Back</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Hole Count</div>
                                        <input type="number" min="1" step="1" value={displayOp.count ?? 2} onChange={e => upd({ count: Math.max(1, parseInt(e.target.value) || 2) })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Hole Diameter (in)</div>
                                        <input type="number" min="0.02" step="0.0625" value={parseFloat(diameter.toFixed(4))} onChange={e => upd({ diameter: Math.max(0.01, parseFloat(e.target.value) || 0.375) })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Hole Depth (in)</div>
                                        <input type="number" min="0.1" step="0.125" value={parseFloat((displayOp.depth ?? 0.75).toFixed(4))} onChange={e => upd({ depth: Math.max(0.01, parseFloat(e.target.value) || 0.75) })} style={inputStyle} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Spacing Mode</div>
                                        <select value={isAutoSpacing ? 'auto' : 'custom'} onChange={e => upd({ spacing: e.target.value === 'auto' ? 'auto' : 2 })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            <option value="auto">Auto (Even)</option>
                                            <option value="custom">Custom Spacing</option>
                                        </select>
                                    </div>
                                    {!isAutoSpacing && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Custom Spacing (in)</div>
                                            <input type="number" min="0.5" step="0.25" value={parseFloat((displayOp.spacing ?? 2).toFixed(4))} onChange={e => upd({ spacing: Math.max(0.5, parseFloat(e.target.value) || 2) })} style={inputStyle} />
                                        </div>
                                    )}
                                    <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                        Dowel holes are blind holes centered along the thin axis centerline of the selected face and spaced out along the wide axis.
                                    </p>
                                </div>
                            );
                        })()}

                        {/* ── Edge Profile Editor ── */}
                        {op.type === 'edge-profile' && (() => {
                            const isRoundover = (displayOp.profile || 'roundover') === 'roundover';
                            
                            const edgesList = [
                                { val: 'y+z+', label: 'Top-Front Edge (X)' },
                                { val: 'y+z-', label: 'Top-Back Edge (X)' },
                                { val: 'y-z+', label: 'Bottom-Front Edge (X)' },
                                { val: 'y-z-', label: 'Bottom-Back Edge (X)' },
                                { val: 'z+x+', label: 'Front-Right Edge (Y)' },
                                { val: 'z+x-', label: 'Front-Left Edge (Y)' },
                                { val: 'z-x+', label: 'Back-Right Edge (Y)' },
                                { val: 'z-x-', label: 'Back-Left Edge (Y)' },
                                { val: 'x+y+', label: 'Top-Right Edge (Z)' },
                                { val: 'x+y-', label: 'Bottom-Right Edge (Z)' },
                                { val: 'x-y+', label: 'Top-Left Edge (Z)' },
                                { val: 'x-y-', label: 'Bottom-Left Edge (Z)' },
                            ];
                            
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Profile Type</div>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                            {['roundover', 'chamfer'].map(p => {
                                                const isActive = (displayOp.profile || 'roundover') === p;
                                                return (
                                                    <button key={p} onClick={() => upd({ profile: p })} style={{
                                                        flex: 1, padding: '5px', fontSize: '0.8rem', borderRadius: '4px',
                                                        border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                                        background: isActive ? 'rgba(188,138,95,0.25)' : 'rgba(255,255,255,0.04)',
                                                        color: isActive ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                                                        fontWeight: isActive ? 700 : 400, transition: 'all 0.15s',
                                                        textTransform: 'capitalize'
                                                    }}>{p}</button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Select Edge</div>
                                        <select value={displayOp.edge || 'y+z+'} onChange={e => upd({ edge: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                                            {edgesList.map(item => (
                                                <option key={item.val} value={item.val}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {isRoundover ? (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Roundover Radius (in)</div>
                                            <input type="number" min="0.0625" step="0.0625" value={parseFloat((displayOp.radius ?? 0.25).toFixed(4))} onChange={e => upd({ radius: Math.max(0.01, parseFloat(e.target.value) || 0.25) })} style={inputStyle} />
                                            <input type="range" min="0.0625" max="2" step="0.0625" value={displayOp.radius ?? 0.25} onChange={e => upd({ radius: parseFloat(e.target.value) })} style={{ width: '100%', marginTop: '4px', accentColor: 'var(--accent-color)' }} />
                                        </div>
                                    ) : (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Chamfer Width (in)</div>
                                            <input type="number" min="0.0625" step="0.0625" value={parseFloat((displayOp.width ?? 0.25).toFixed(4))} onChange={e => upd({ width: Math.max(0.01, parseFloat(e.target.value) || 0.25) })} style={inputStyle} />
                                            <input type="range" min="0.0625" max="2" step="0.0625" value={displayOp.width ?? 0.25} onChange={e => upd({ width: parseFloat(e.target.value) })} style={{ width: '100%', marginTop: '4px', accentColor: 'var(--accent-color)' }} />
                                        </div>
                                    )}
                                    <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '0' }}>
                                        Edge profiles apply a non-destructive {isRoundover ? 'radius roundover' : '45° bevel chamfer'} along the selected panel edge.
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
            const bevelText = bevel !== 0 ? ` · Bevel ${Math.abs(bevel)}° ${bevel > 0 ? 'Left' : 'Right'}` : '';
            return `${faceLabel(op.face || 'x+')} · ${op.angle ?? 45}°${bevelText}`;
        }
        case 'subtract':
            return `Subtracting "${op.cutterName || 'unknown'}" · ${op.cutterShape || 'box'}`;
        case 'pocket-holes':
            return `${op.face || 'bottom'} face · pointing ${op.edge || 'left'} · count=${op.count ?? 2} · spacing=${op.spacing || 'auto'}`;
        case 'dowel-holes': {
            const diameter = op.diameter ?? (op.radius ? op.radius * 2 : 0.375);
            return `${op.face || 'top'} face · count=${op.count ?? 2} · ø=${diameter.toFixed(4)}" · depth=${(op.depth ?? 0.75).toFixed(2)}"`;
        }
        case 'edge-profile':
            return `${op.profile === 'roundover' ? 'Roundover' : 'Chamfer'} on ${getEdgeProfileLabel(op.edge || 'y+z+')} · size=${op.profile === 'roundover' ? op.radius ?? 0.25 : op.width ?? 0.25}"`;
        default:
            return op.type;
    }
}

function getPerpDirections(f) {
    if (f === 'top' || f === 'bottom') return ['left', 'right', 'front', 'back'];
    if (f === 'left' || f === 'right') return ['top', 'bottom', 'front', 'back'];
    return ['left', 'right', 'top', 'bottom'];
}

function getEdgeProfileLabel(e) {
    const labels = {
        'y+z+': 'Top-Front (X)',
        'y+z-': 'Top-Back (X)',
        'y-z+': 'Bottom-Front (X)',
        'y-z-': 'Bottom-Back (X)',
        'z+x+': 'Front-Right (Y)',
        'z+x-': 'Front-Left (Y)',
        'z-x+': 'Back-Right (Y)',
        'z-x-': 'Back-Left (Y)',
        'x+y+': 'Top-Right (Z)',
        'x+y-': 'Bottom-Right (Z)',
        'x-y+': 'Top-Left (Z)',
        'x-y-': 'Bottom-Left (Z)',
    };
    return labels[e] || e;
}

function faceLabel(f) {
    return { 'z+': 'Front', 'z-': 'Back', 'x+': 'Right', 'x-': 'Left' }[f] || f;
}

export default ToolsPanel;
