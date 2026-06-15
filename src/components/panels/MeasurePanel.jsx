import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';
import { formatUnit } from '../../utils/units';
import { getWorldEdgePoints, calculateAngleBetweenVectors, getDistanceBetweenSegments } from '../../utils/edgeMeasurement';
import { calculateAngleBetweenNormals } from '../../utils/faceMeasurement';
import { getDynamicAngles, getLabelAndDist } from '../../utils/miterSawCalculator';
import * as THREE from 'three';

const MeasurePanel = () => {
    const {
        setMeasureMode,
        units,
        setUnits,
        imperialFormat,
        setImperialFormat,
        measureFaceAnglesActive,
        setMeasureFaceAnglesActive,
        selectedFaces,
        clearFaceSelection,
        measureEdgesActive,
        setMeasureEdgesActive,
        selectedEdges,
        clearEdgeSelection,
        boards,
        selectedItemIds,
        prepareBoardForMiterSaw,
        miterSawCuts,
        miterSawBoardId,
        selectedMiterCutIndex,
        setSelectedMiterCutIndex,
        incrementRotation,
        closeMiterSawMode,
    } = useStore();

    // ── Determine which tab should be active initially ──
    const getInitialTab = () => {
        if (measureEdgesActive) return 'edge';
        if (measureFaceAnglesActive) return 'face';
        if (miterSawBoardId) return 'miter';
        return 'linear';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [systemExpanded, setSystemExpanded] = useState(false);
    const [formatExpanded, setFormatExpanded] = useState(false);

    // ── Handle switching tabs (toggles store modes correctly) ──
    const switchTab = (tab) => {
        setActiveTab(tab);
        
        // Turn off all store modes
        setMeasureMode(null);
        setMeasureEdgesActive(false);
        setMeasureFaceAnglesActive(false);
        clearFaceSelection();
        clearEdgeSelection();
        closeMiterSawMode();
        
        if (tab === 'linear') {
            setMeasureMode({ active: true, firstPoint: null });
        } else if (tab === 'edge') {
            setMeasureEdgesActive(true);
        } else if (tab === 'face') {
            setMeasureFaceAnglesActive(true);
        } else if (tab === 'miter') {
            // Miter saw mode is activated on selected board by clicking 'Clone & Align'
        }
    };

    // Initialize/cleanup active state on mount and unmount
    useEffect(() => {
        const initial = getInitialTab();
        if (initial === 'linear') {
            setMeasureMode({ active: true, firstPoint: null });
        }
        
        return () => {
            setMeasureMode(null);
            setMeasureEdgesActive(false);
            clearEdgeSelection();
            setMeasureFaceAnglesActive(false);
            clearFaceSelection();
            closeMiterSawMode();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Styles ──
    const labelStyle = {
        fontSize: '0.64rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--accent-color, #ff7a00)',
        display: 'block',
        marginBottom: '4px',
    };

    const selectStyle = {
        width: '100%',
        padding: '4px 8px',
        background: 'var(--bg-color, #1a1a1a)',
        color: 'var(--text-main, #ffffff)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
        borderRadius: '6px',
        outline: 'none',
        fontSize: '0.72rem',
        cursor: 'pointer',
    };

    const optionStyle = {
        background: 'var(--menu-bg, #0d0f12)',
        color: 'var(--text-main, #f0f0f0)',
    };

    const hintStyle = {
        fontSize: '0.62rem',
        color: 'var(--text-muted, #888)',
        marginTop: '4px',
        lineHeight: '1.3',
    };

    const tabButtonStyle = (tab) => ({
        padding: '8px 4px',
        borderRadius: '6px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
        background: activeTab === tab ? 'var(--accent-color, #ff7a00)' : 'transparent',
        color: activeTab === tab ? '#ffffff' : 'var(--text-muted, #888)',
        fontWeight: 'bold',
        fontSize: '0.66rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
    });

    // ── Evaluate Miter/Bevel cuts if a board is selected and prepared ──
    const selectedBoard = boards.find(b => selectedItemIds.includes(b.id.toString()));
    let filteredCuts = [];
    let upFace = 'top';

    if (activeTab === 'miter' && selectedBoard && selectedBoard.id.toString() === miterSawBoardId && miterSawCuts) {
        const [rx, ry, rz] = selectedBoard.orientation || [0, 0, 0];
        const euler = new THREE.Euler(rx, ry, rz, 'YXZ');
        const upVectors = {
            top: new THREE.Vector3(0, 1, 0).applyEuler(euler).y,
            bottom: new THREE.Vector3(0, -1, 0).applyEuler(euler).y,
            front: new THREE.Vector3(0, 0, 1).applyEuler(euler).y,
            back: new THREE.Vector3(0, 0, -1).applyEuler(euler).y,
        };

        let maxVal = upVectors.top;
        for (const [face, val] of Object.entries(upVectors)) {
            if (val > maxVal) {
                maxVal = val;
                upFace = face;
            }
        }

        filteredCuts = miterSawCuts.filter(cut => {
            if (cut.isEndCut) return true;
            const cy = cut.centerY !== undefined ? cut.centerY : cut.positionY;
            const cz = cut.centerZ !== undefined ? cut.centerZ : cut.positionZ;
            if (upFace === 'top') return cy > 0.05;
            if (upFace === 'bottom') return cy < -0.05;
            if (upFace === 'front') return cz > 0.05;
            if (upFace === 'back') return cz < -0.05;
            return false;
        });

        // Recalculate cut order: lowest cut dimension (distance from left) first in the list
        filteredCuts.sort((a, b) => {
            const aData = getLabelAndDist(selectedBoard, a);
            const bData = getLabelAndDist(selectedBoard, b);
            const aIsLeft = aData.label === 'Left End';
            const bIsLeft = bData.label === 'Left End';
            if (aIsLeft && !bIsLeft) return -1;
            if (!aIsLeft && bIsLeft) return 1;

            const aIsRight = aData.label === 'Right End';
            const bIsRight = bData.label === 'Right End';
            if (aIsRight && !bIsRight) return 1;
            if (!aIsRight && bIsRight) return -1;

            return aData.distFromLeft - bData.distFromLeft;
        });
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px',
            color: 'var(--text-main)'
        }}>
            {/* Tab switch buttons */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px'
            }}>
                <button style={tabButtonStyle('linear')} onClick={() => switchTab('linear')}>
                    📏 Linear
                </button>
                <button style={tabButtonStyle('edge')} onClick={() => switchTab('edge')}>
                    📐 Edge
                </button>
                <button style={tabButtonStyle('face')} onClick={() => switchTab('face')}>
                    📐 Face Angle
                </button>
                <button style={tabButtonStyle('miter')} onClick={() => switchTab('miter')}>
                    🪓 Miter/Bevel
                </button>
            </div>

            {/* ── Tab Cards ── */}

            {activeTab === 'linear' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Linear Measure</label>
                    <p className="hint" style={{ ...hintStyle, marginTop: 0 }}>
                        Click snaps or surfaces in the viewport to measure distances.
                    </p>
                </div>
            )}

            {activeTab === 'edge' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Edge Relations</label>
                    <p className="hint" style={{ ...hintStyle, marginTop: 0 }}>
                        Hover and click any two edges in the viewport to get their angle, length, and relation.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Edge 1 details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Edge 1:</span>
                                <span style={{ fontWeight: 'bold', color: selectedEdges[0] ? '#c084fc' : 'var(--text-muted)' }}>
                                    {selectedEdges[0] ? (() => {
                                        const board = boards.find(b => b.id.toString() === selectedEdges[0].boardId);
                                        return board ? board.name : 'Unknown Board';
                                    })() : 'Click an edge...'}
                                </span>
                            </div>
                            {selectedEdges[0] && (() => {
                                const start = new THREE.Vector3(...selectedEdges[0].edgeStart);
                                const end = new THREE.Vector3(...selectedEdges[0].edgeEnd);
                                const len = start.distanceTo(end);
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                                        <span>Length:</span>
                                        <span>{formatUnit(len, units, imperialFormat)}</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Edge 2 details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Edge 2:</span>
                                <span style={{ fontWeight: 'bold', color: selectedEdges[1] ? '#ffd60a' : 'var(--text-muted)' }}>
                                    {selectedEdges[1] ? (() => {
                                        const board = boards.find(b => b.id.toString() === selectedEdges[1].boardId);
                                        return board ? board.name : 'Unknown Board';
                                    })() : 'Click an edge...'}
                                </span>
                            </div>
                            {selectedEdges[1] && (() => {
                                const start = new THREE.Vector3(...selectedEdges[1].edgeStart);
                                const end = new THREE.Vector3(...selectedEdges[1].edgeEnd);
                                const len = start.distanceTo(end);
                                return (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                                        <span>Length:</span>
                                        <span>{formatUnit(len, units, imperialFormat)}</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {selectedEdges.length === 2 && (() => {
                        const board1 = boards.find(b => b.id.toString() === selectedEdges[0].boardId);
                        const board2 = boards.find(b => b.id.toString() === selectedEdges[1].boardId);
                        if (!board1 || !board2) return null;

                        const pts1 = getWorldEdgePoints(selectedEdges[0], board1);
                        const pts2 = getWorldEdgePoints(selectedEdges[1], board2);

                        const dir1 = new THREE.Vector3().subVectors(pts1.worldEnd, pts1.worldStart);
                        const dir2 = new THREE.Vector3().subVectors(pts2.worldEnd, pts2.worldStart);

                        const { acute, obtuse, isParallel, isPerpendicular } = calculateAngleBetweenVectors(dir1, dir2);
                        const distance = getDistanceBetweenSegments(pts1.worldStart, pts1.worldEnd, pts2.worldStart, pts2.worldEnd);

                        return (
                            <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(175, 64, 255, 0.08)', borderRadius: '6px', border: '1px solid rgba(175, 64, 255, 0.25)', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.64rem', textTransform: 'uppercase', fontWeight: 'bold', color: '#c084fc' }}>Relationship</div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#e9d5ff' }}>{acute}°</div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Angle Between Edges</div>
                                </div>
                                
                                {acute !== obtuse && (
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        Supplementary: {obtuse}°
                                    </div>
                                )}

                                <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#f3e8ff' }}>
                                        {distance < 0.01 ? 'Touching / Intersecting' : formatUnit(distance, units, imperialFormat)}
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Minimum Gap</div>
                                </div>

                                {(isParallel || isPerpendicular) && (
                                    <div style={{
                                        marginTop: '4px',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.08)',
                                        color: '#c084fc',
                                        fontSize: '0.64rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {isParallel ? 'Parallel' : 'Perpendicular'}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {selectedEdges.length > 0 && (
                        <button
                            onClick={clearEdgeSelection}
                            style={{
                                marginTop: '4px',
                                width: '100%',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'face' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Face Angles</label>
                    <p className="hint" style={{ ...hintStyle, marginTop: 0 }}>
                        Hover and click any two faces on a board to measure the angle between them.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Face 1:</span>
                            <span style={{ fontWeight: 'bold', color: selectedFaces[0] ? '#c084fc' : 'var(--text-muted)' }}>
                                {selectedFaces[0] ? selectedFaces[0].label : 'Click a face...'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Face 2:</span>
                            <span style={{ fontWeight: 'bold', color: selectedFaces[1] ? '#ffd60a' : 'var(--text-muted)' }}>
                                {selectedFaces[1] ? selectedFaces[1].label : 'Click a face...'}
                            </span>
                        </div>
                    </div>

                    {selectedFaces.length === 2 && (() => {
                        const { acute, obtuse } = calculateAngleBetweenNormals(selectedFaces[0].normal, selectedFaces[1].normal);
                        return (
                            <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(175, 64, 255, 0.08)', borderRadius: '6px', border: '1px solid rgba(175, 64, 255, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.64rem', textTransform: 'uppercase', fontWeight: 'bold', color: '#c084fc' }}>Angle Between Faces</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#e9d5ff' }}>
                                    {acute}°
                                </div>
                                {acute !== obtuse && (
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        Supplementary: {obtuse}°
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {selectedFaces.length > 0 && (
                        <button
                            onClick={clearFaceSelection}
                            style={{
                                marginTop: '4px',
                                width: '100%',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'miter' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Miter/Bevel saw angles</label>
                    {!selectedBoard ? (
                        <p className="hint" style={{ ...hintStyle, marginTop: 0 }}>
                            Select a single board in the workspace.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                                Board: <span style={{ color: 'var(--accent-color)' }}>{selectedBoard.name}</span>
                            </div>

                            {selectedBoard.id.toString() !== miterSawBoardId ? (
                                <button
                                    className="primary-btn"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: 'var(--accent-color)',
                                        color: '#ffffff',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => prepareBoardForMiterSaw(selectedBoard.id)}
                                >
                                    📐 Clone & Align
                                </button>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: '0.72rem' }}>
                                            UP: <strong style={{ color: 'var(--accent-color)', textTransform: 'capitalize' }}>{upFace}</strong>
                                        </div>
                                        <button
                                            className="nav-btn"
                                            style={{ padding: '3px 8px', fontSize: '0.7rem', border: '1px solid var(--border-color)' }}
                                            onClick={() => incrementRotation(0, 90)}
                                        >
                                            🔄 Rotate 90°
                                        </button>
                                    </div>

                                    <div style={{ marginTop: '4px' }}>
                                        <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                                            Cuts on {upFace} face & Ends
                                        </div>
                                        {filteredCuts.length === 0 ? (
                                            <div className="hint" style={{ marginTop: 0 }}>No cuts on this face. Rotate the board.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {filteredCuts.map((cut, idx) => {
                                                    const originalIdx = miterSawCuts.indexOf(cut);
                                                    const isCutSelected = selectedMiterCutIndex === originalIdx;

                                                    // Calculate miter/bevel saw angles dynamically based on orientation
                                                    const { miter, bevel } = getDynamicAngles(selectedBoard, cut);

                                                    // Describe cut type
                                                    let desc = 'Square';
                                                    if (miter !== 0 && bevel !== 0) {
                                                        desc = 'Compound';
                                                    } else if (miter !== 0) {
                                                        desc = 'Miter';
                                                    } else if (bevel !== 0) {
                                                        desc = 'Bevel';
                                                    }

                                                    // Custom label supporting metric & imperial formatting reactively
                                                    const { label, distFromLeft } = getLabelAndDist(selectedBoard, cut);
                                                    let displayLabel = label;
                                                    if (!['Left End', 'Right End'].includes(label)) {
                                                        if (units === 'metric') {
                                                            displayLabel = `Cut at ${(distFromLeft * 25.4).toFixed(0)} mm`;
                                                        } else {
                                                            displayLabel = `Cut at ${formatUnit(distFromLeft, 'imperial', imperialFormat)}`;
                                                        }
                                                    }

                                                    const isMiterLarge = Math.abs(miter) > 60;
                                                    const isBevelLarge = Math.abs(bevel) > 60;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setSelectedMiterCutIndex(isCutSelected ? null : originalIdx)}
                                                            style={{
                                                                padding: '8px 10px',
                                                                background: isCutSelected ? 'rgba(188,138,95,0.18)' : 'rgba(255, 255, 255, 0.03)',
                                                                border: isCutSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                                                borderRadius: '6px',
                                                                fontSize: '0.72rem',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '4px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                                                <span style={{ color: 'var(--accent-color)' }}>{displayLabel}</span>
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{desc}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '12px', color: 'var(--text-main)' }}>
                                                                <div>
                                                                    <span style={{ color: 'var(--text-muted)' }}>M: </span>
                                                                    <strong style={{ color: isMiterLarge ? '#ff3b30' : 'inherit' }}>{miter}°</strong>
                                                                </div>
                                                                <div>
                                                                    <span style={{ color: 'var(--text-muted)' }}>B: </span>
                                                                    <strong style={{ color: isBevelLarge ? '#ff3b30' : 'inherit' }}>{bevel}°</strong>
                                                                </div>
                                                            </div>
                                                            {(isMiterLarge || isBevelLarge) && (
                                                                <div style={{ fontSize: '0.58rem', color: '#ff3b30', marginTop: '2px', fontWeight: 'bold' }}>
                                                                    ⚠️ Angle exceeds 60°
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Measurement System Expandable Card ── */}
            <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                <div 
                    onClick={() => setSystemExpanded(!systemExpanded)}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }} htmlFor="measure-panel-units-select">Measurement System</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>{units === 'imperial' ? 'Imperial' : 'Metric'}</span>
                        <span style={{ fontSize: '0.6rem' }}>{systemExpanded ? '⏷' : '⏵'}</span>
                    </div>
                </div>
                {systemExpanded && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <select 
                            id="measure-panel-units-select"
                            value={units} 
                            onChange={(e) => setUnits(e.target.value)} 
                            style={selectStyle}
                        >
                            <option value="imperial" style={optionStyle}>Imperial (Inches)</option>
                            <option value="metric" style={optionStyle}>Metric (Millimeters)</option>
                        </select>
                        <p className="hint" style={hintStyle}>
                            Toggle standard imperial inches vs metric millimeters.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Display Format Card ── */}
            {units === 'imperial' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div 
                        onClick={() => setFormatExpanded(!formatExpanded)}
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }} htmlFor="imperial-format-select">Display Format</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span>{imperialFormat === 'fraction' ? 'Fraction' : 'Decimal'}</span>
                            <span style={{ fontSize: '0.6rem' }}>{formatExpanded ? '⏷' : '⏵'}</span>
                        </div>
                    </div>
                    {formatExpanded && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <select 
                                id="imperial-format-select"
                                value={imperialFormat} 
                                onChange={(e) => setImperialFormat(e.target.value)} 
                                style={selectStyle}
                            >
                                <option value="fraction" style={optionStyle}>Fraction (e.g. 2 3/4")</option>
                                <option value="decimal" style={optionStyle}>Decimal (e.g. 2.75")</option>
                            </select>
                            <p className="hint" style={hintStyle}>
                                Choose how imperial dimensions are formatted in the workspace.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MeasurePanel;
