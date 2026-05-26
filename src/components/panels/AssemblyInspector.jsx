import React, { useState, useEffect } from 'react';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import useStore from '../../store/useStore';
import ParametricControls from './ParametricControls';

// Round to ≤4 decimal places, stripping trailing zeros
const fmt4 = (v) => parseFloat(v.toFixed(4));

const SmartAssemblyProfiler = ({ targetBoardIds }) => {
    const { boards, applyAssemblyProfile, clearAssemblyProfile } = useStore();
    const [profileType, setProfileType] = useState('roundover');
    const [faceDirection, setFaceDirection] = useState('top');
    const [radius, setRadius] = useState(0.25);
    const [width, setWidth] = useState(0.25);

    const selectedBoards = boards.filter(b => targetBoardIds.includes(b.id.toString()));
    
    let hasExistingProfile = false;
    let existingVal = 0.25;
    let existingType = 'roundover';
    
    for (const b of selectedBoards) {
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

    const handleApply = () => {
        const params = profileType === 'roundover' ? { radius } : { width };
        applyAssemblyProfile(targetBoardIds, faceDirection, profileType, params);
    };

    const handleClear = () => {
        clearAssemblyProfile(targetBoardIds, faceDirection);
    };

    return (
        <div className="inspector-section" style={{
            background: 'rgba(188, 138, 95, 0.05)',
            border: '1px solid rgba(188, 138, 95, 0.25)',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '12px',
            marginBottom: '12px'
        }}>
            <h4 style={{ color: 'var(--accent-color)', margin: '0 0 6px 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⌸ Smart Edge Profiler
            </h4>
            <p className="hint" style={{ marginTop: '2px', marginBottom: '8px', fontSize: '0.66rem' }}>
                Applies a non-destructive profile around the outer perimeter edges of the selected assembly.
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
                        <span style={{ color: 'var(--text-main)' }}>{profileType === 'roundover' ? radius : width}"</span>
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
                        onClick={handleApply}
                    >
                        {hasExistingProfile ? 'Update Profile' : 'Apply Perimeter Profile'}
                    </button>
                    {hasExistingProfile && (
                        <button
                            className="nav-btn"
                            style={{ padding: '5px 10px', fontSize: '0.72rem', color: '#ff3b30', borderColor: 'rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', cursor: 'pointer' }}
                            onClick={handleClear}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const AssemblyInspector = ({ selectedGroup }) => {
    const {
        boards, groups, selectedItemIds, constraints, units,
        moveGroup, setBoards, setGroups, setSelectedItemIds,
        dropGroupToFloor, glueAssembly, unglueAssembly, createPivotProxy,
        handleAssemblyDelete, cloneAssembly, updateProceduralBox,
        constraintTargetMode, setConstraintTargetMode
    } = useStore();

    const isWorkspace = selectedGroup === 'Workspace';
    const meta = !isWorkspace && groups[selectedGroup] ? groups[selectedGroup].meta : null;
    const hasBuilder = !!meta?.builder;

    const supportsX = hasBuilder;
    const supportsY = hasBuilder && meta.builder !== 'table-top';
    const supportsZ = hasBuilder && !['shaker-door', 'face-frame'].includes(meta.builder);

    // Compute overall dimensions from child boards
    const childBoards = collectChildBoards(selectedGroup, boards, groups);
    let overallSize = [0, 0, 0];
    let isGlued = false;
    
    if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        overallSize = [
            Math.abs(aabb.maxX - aabb.minX),
            Math.abs(aabb.maxY - aabb.minY),
            Math.abs(aabb.maxZ - aabb.minZ)
        ];

        const childIds = new Set(childBoards.map(b => b.id.toString()));
        isGlued = Object.values(constraints).some(c => 
            c.type === 'Glue' && childIds.has(c.boardAId) && childIds.has(c.boardBId)
        );
    }

    const handleDimensionChange = (dimension, value) => {
        if (!meta) return;
        let key = '';
        if (dimension === 'X') {
            key = 'width';
        } else if (dimension === 'Y') {
            key = 'height';
        } else if (dimension === 'Z') {
            key = 'depth';
        }
        
        let numVal = parseFloat(value);
        if (units === 'metric' && !isNaN(numVal)) {
            numVal = numVal / 25.4;
        }
        
        const newParams = { ...(meta.params || {}), [key]: isNaN(numVal) ? value : numVal };
        const cfg = { ...newParams, editGroupId: selectedGroup };
        const state = useStore.getState();
        
        if (meta.builder === 'cabinet') state.buildCabinet(cfg);
        else if (meta.builder === 'box') state.buildBox(cfg);
        else if (meta.builder === 'shaker-door') state.buildShakerDoor(cfg);
        else if (meta.builder === 'drawerStack') state.buildDrawers(cfg);
        else if (meta.builder === 'face-frame') {
            if (state.buildFaceFrame) state.buildFaceFrame(cfg);
        } else if (meta.builder === 'shelving') {
            if (state.buildShelving) state.buildShelving(cfg);
        } else if (meta.builder === 'table-base') {
            if (state.buildTableBase) state.buildTableBase(cfg);
        } else if (meta.builder === 'table-top') {
            if (state.buildTableTop) state.buildTableTop(cfg);
        }
    };

    // Sticky banner — always rendered when constraint pick mode is active
    const ConstraintBanner = constraintTargetMode?.active ? (
        <div style={{
            padding: '10px 12px', marginBottom: '12px',
            background: 'rgba(188, 138, 95, 0.12)',
            border: '1px dashed var(--accent-color)',
            borderRadius: '8px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '6px' }}>
                {constraintTargetMode.type === 'Glue'
                    ? `Click a board to glue to…`
                    : constraintTargetMode.step === 1
                        ? `Click a face on the source board…`
                        : `Click a face on the target board…`
                }
            </div>
            <button className="nav-btn"
                style={{ fontSize: '0.72rem', padding: '3px 10px', border: '1px solid var(--accent-color)' }}
                onClick={() => setConstraintTargetMode(null)}>
                Cancel (Esc)
            </button>
        </div>
    ) : null;

    return (
        <>
            {ConstraintBanner}
            <div className="inspector-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assembly:</span>
                <input
                    type="text"
                    value={selectedGroup}
                    disabled={isWorkspace}
                    title={isWorkspace ? 'Root workspace cannot be renamed' : 'Click to rename assembly'}
                    onChange={(e) => {
                        const newName = e.target.value;
                        if (!newName.trim()) return; // don't allow empty names
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
                <h4>Overall Dimensions ({units === 'metric' ? 'mm' : 'in'})</h4>
                <div className="vec3-inputs">
                    <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>
                        X
                        <input 
                            type="number" 
                            step={units === 'metric' ? '1' : '0.125'} 
                            value={units === 'metric' ? fmt4(overallSize[0] * 25.4) : fmt4(overallSize[0])} 
                            disabled={!supportsX} 
                            onChange={e => handleDimensionChange('X', e.target.value)}
                            style={!supportsX ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} 
                        />
                    </div>
                    <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>
                        Y
                        <input 
                            type="number" 
                            step={units === 'metric' ? '1' : '0.125'} 
                            value={units === 'metric' ? fmt4(overallSize[1] * 25.4) : fmt4(overallSize[1])} 
                            disabled={!supportsY} 
                            onChange={e => handleDimensionChange('Y', e.target.value)}
                            style={!supportsY ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} 
                        />
                    </div>
                    <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>
                        Z
                        <input 
                            type="number" 
                            step={units === 'metric' ? '1' : '0.125'} 
                            value={units === 'metric' ? fmt4(overallSize[2] * 25.4) : fmt4(overallSize[2])} 
                            disabled={!supportsZ} 
                            onChange={e => handleDimensionChange('Z', e.target.value)}
                            style={!supportsZ ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} 
                        />
                    </div>
                </div>
            </div>
            {!isWorkspace && (() => {
                // Compute centroid of all child boards
                const cx = childBoards.length > 0 ? fmt4(childBoards.reduce((s, b) => s + b.position[0], 0) / childBoards.length) : 0;
                const cy = childBoards.length > 0 ? fmt4(childBoards.reduce((s, b) => s + b.position[1], 0) / childBoards.length) : 0;
                const cz = childBoards.length > 0 ? fmt4(childBoards.reduce((s, b) => s + b.position[2], 0) / childBoards.length) : 0;
                const centroid = [cx, cy, cz];

                const handleCentroidChange = (axis, newVal) => {
                    const v = parseFloat(newVal);
                    if (isNaN(v)) return;
                    const delta = v - centroid[axis];
                    if (Math.abs(delta) < 0.0001) return;
                    moveGroup(selectedGroup, axis, delta);
                };

                return (
                    <div className="inspector-section">
                        <h4>Position ({units === 'metric' ? 'mm' : 'in'})</h4>
                        <div className="vec3-inputs">
                            <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step={units === 'metric' ? '1' : '0.125'} value={units === 'metric' ? fmt4(centroid[0] * 25.4) : centroid[0]} onChange={e => handleCentroidChange(0, units === 'metric' ? parseFloat(e.target.value) / 25.4 : e.target.value)} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step={units === 'metric' ? '1' : '0.125'} value={units === 'metric' ? fmt4(centroid[1] * 25.4) : centroid[1]} onChange={e => handleCentroidChange(1, units === 'metric' ? parseFloat(e.target.value) / 25.4 : e.target.value)} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step={units === 'metric' ? '1' : '0.125'} value={units === 'metric' ? fmt4(centroid[2] * 25.4) : centroid[2]} onChange={e => handleCentroidChange(2, units === 'metric' ? parseFloat(e.target.value) / 25.4 : e.target.value)} /></div>
                        </div>
                        <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropGroupToFloor}>↓ Set on Floor</button>
                        <p className="hint" style={{ marginTop: '6px' }}>Assembly centroid — changes move all children in real time.</p>
                    </div>
                );
            })()}
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
                <SmartAssemblyProfiler targetBoardIds={childBoards.map(b => b.id.toString())} />
            )}
            {!isWorkspace && (
                <div style={{ marginTop: '16px' }}>
                    <button
                        className="primary-btn"
                        style={{ 
                            width: '100%', padding: '8px', fontWeight: 'bold', marginBottom: '8px',
                            background: isGlued ? 'rgba(255, 59, 48, 0.05)' : undefined,
                            color: isGlued ? '#ff3b30' : undefined,
                            border: isGlued ? '1px solid rgba(255, 59, 48, 0.3)' : undefined,
                        }}
                        onMouseEnter={e => {
                            if (isGlued) e.target.style.background = 'rgba(255, 59, 48, 0.15)';
                        }}
                        onMouseLeave={e => {
                            if (isGlued) e.target.style.background = 'rgba(255, 59, 48, 0.05)';
                        }}
                        onClick={() => isGlued ? unglueAssembly(selectedGroup) : glueAssembly(selectedGroup)}
                    >
                        {isGlued ? 'Unglue Assembly' : 'Glue Assembly'}
                    </button>
                    {groups[selectedGroup].meta?.builder && (
                        <ParametricControls groupId={selectedGroup} meta={groups[selectedGroup].meta} />
                    )}
                    <button
                        className="primary-btn"
                        style={{ width: '100%', padding: '8px', fontWeight: 'bold', marginBottom: '8px' }}
                        onClick={() => createPivotProxy(selectedGroup)}
                    >
                        Create Pivot Proxy
                    </button>
                    <button
                        className="primary-btn"
                        style={{ width: '100%', padding: '8px', fontWeight: 'bold', marginBottom: '16px' }}
                        onClick={() => cloneAssembly(selectedGroup)}
                    >
                        Clone Assembly
                    </button>
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
};

export default AssemblyInspector;
