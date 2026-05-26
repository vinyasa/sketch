import React, { useState } from 'react';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import useStore from '../../store/useStore';

// Round to ≤4 decimal places, stripping trailing zeros
const fmt4 = (v) => parseFloat(v.toFixed(4));

const MultiSelectInspector = () => {
    const [bulkAngleZ, setBulkAngleZ] = useState(2);
    const [bulkAngleX, setBulkAngleX] = useState(2); // Kept in state for safety and future parity

    const {
        boards, groups, selectedItemIds,
        setBoards, pushHistory, dropSelectionToFloor, handleMultiDelete,
        constraintTargetMode, setConstraintTargetMode
    } = useStore();

    // Collect all boards that are part of this selection (direct boards + children of selected groups)
    const selectedBoardSet = new Set();
    selectedItemIds.forEach(id => {
        const board = boards.find(b => b.id.toString() === id);
        if (board) {
            selectedBoardSet.add(board);
        } else if (groups[id]) {
            collectChildBoards(id, boards, groups).forEach(b => selectedBoardSet.add(b));
        }
    });

    const selBoards = Array.from(selectedBoardSet);
    let aabb = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    let multiSize = [0, 0, 0];
    if (selBoards.length > 0) {
        aabb = computeWorldAABB(selBoards);
        multiSize = [
            fmt4(Math.abs(aabb.maxX - aabb.minX)),
            fmt4(Math.abs(aabb.maxY - aabb.minY)),
            fmt4(Math.abs(aabb.maxZ - aabb.minZ))
        ];
    }

    // For each axis: which boards have both extents touching the group AABB?
    const SNAP = 0.01;
    const aabbMins = [aabb.minX, aabb.minY, aabb.minZ];
    const aabbMaxs = [aabb.maxX, aabb.maxY, aabb.maxZ];
    const spanningBoards = [0, 1, 2].map(i =>
        selBoards.filter(b => {
            const bMin = b.position[i] - b.size[i] / 2;
            const bMax = b.position[i] + b.size[i] / 2;
            return Math.abs(bMin - aabbMins[i]) < SNAP && Math.abs(bMax - aabbMaxs[i]) < SNAP;
        })
    );
    const axisEditable = spanningBoards.map(s => s.length > 0);

    const handleBBSizeChange = (i, newVal) => {
        const v = parseFloat(newVal);
        if (isNaN(v) || v <= 0) return;
        pushHistory();
        const spanIds = new Set(spanningBoards[i].map(b => b.id));
        setBoards(prev => prev.map(b => {
            if (!spanIds.has(b.id)) return b;
            const newSize = [...b.size];
            newSize[i] = v;
            const newPos = [...b.position];
            newPos[i] = aabbMins[i] + v / 2; // anchor to min-extent side
            return { ...b, size: newSize, position: newPos };
        }));
    };

    const bbRowStyle = (editable) => ({
        opacity: editable ? 1 : 0.4,
        transition: 'opacity 0.15s',
    });

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
            <div className="inspector-title" style={{ marginBottom: '16px' }}>
                <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{selectedItemIds.length} Items Selected</span>
            </div>
            <div className="inspector-section">
                <h4>Bounding Box (in)</h4>
                <p className="hint" style={{ marginTop: '2px', marginBottom: '6px' }}>
                    Editable axes span all selected boards.
                </p>
                <div className="vec3-inputs">
                    <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)', ...bbRowStyle(axisEditable[0]) }}>
                        X<input type="number" step="0.125" value={multiSize[0]}
                            disabled={!axisEditable[0]}
                            onChange={e => handleBBSizeChange(0, e.target.value)} />
                    </div>
                    <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)', ...bbRowStyle(axisEditable[1]) }}>
                        Y<input type="number" step="0.125" value={multiSize[1]}
                            disabled={!axisEditable[1]}
                            onChange={e => handleBBSizeChange(1, e.target.value)} />
                    </div>
                    <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)', ...bbRowStyle(axisEditable[2]) }}>
                        Z<input type="number" step="0.125" value={multiSize[2]}
                            disabled={!axisEditable[2]}
                            onChange={e => handleBBSizeChange(2, e.target.value)} />
                    </div>
                </div>
                {axisEditable.some(Boolean) && (
                    <div style={{ marginTop: '5px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {['X', 'Y', 'Z'].map((label, i) => axisEditable[i]
                            ? <span key={i} style={{ marginRight: '8px' }}>{label}: {spanningBoards[i].length} board{spanningBoards[i].length !== 1 ? 's' : ''}</span>
                            : null
                        )}
                    </div>
                )}
            </div>
            <div className="inspector-section">
                <h4>Position (in)</h4>
                <p className="hint" style={{ marginTop: '2px', marginBottom: '6px' }}>
                    Selection centroid — changes move all selected items.
                </p>
                {(() => {
                    // Compute centroid of all selected boards
                    const cx = fmt4(selBoards.reduce((s, b) => s + b.position[0], 0) / selBoards.length);
                    const cy = fmt4(selBoards.reduce((s, b) => s + b.position[1], 0) / selBoards.length);
                    const cz = fmt4(selBoards.reduce((s, b) => s + b.position[2], 0) / selBoards.length);
                    const centroid = [cx, cy, cz];

                    const handleCentroidChange = (axis, newVal) => {
                        const v = parseFloat(newVal);
                        if (isNaN(v)) return;
                        const delta = v - centroid[axis];
                        if (Math.abs(delta) < 0.0001) return;
                        pushHistory();
                        const selIds = new Set(selBoards.map(b => b.id));
                        setBoards(prev => prev.map(b => {
                            if (!selIds.has(b.id)) return b;
                            const newPos = [...b.position];
                            newPos[axis] += delta;
                            return { ...b, position: newPos };
                        }));
                    };

                    return (
                        <div className="vec3-inputs">
                            <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>
                                X<input type="number" step="0.125" value={centroid[0]}
                                    onChange={e => handleCentroidChange(0, e.target.value)} />
                            </div>
                            <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>
                                Y<input type="number" step="0.125" value={centroid[1]}
                                    onChange={e => handleCentroidChange(1, e.target.value)} />
                            </div>
                            <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>
                                Z<input type="number" step="0.125" value={centroid[2]}
                                    onChange={e => handleCentroidChange(2, e.target.value)} />
                            </div>
                        </div>
                    );
                })()}
            </div>
            <div className="inspector-section">
                <p className="hint">{selBoards.length} board{selBoards.length !== 1 ? 's' : ''} in selection. Use AI Chat for bulk transforms.</p>
                <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropSelectionToFloor}>↓ Set on Floor</button>
            </div>
            {selBoards.length >= 2 && (() => {
                const areVertical = selBoards.every(b => b.size[1] > b.size[0] && b.size[1] > b.size[2]);
                if (!areVertical) return null;

                // Centroid across all selected boards in X and Z
                const cx = selBoards.reduce((s, b) => s + b.position[0], 0) / selBoards.length;
                const cz = selBoards.reduce((s, b) => s + b.position[2], 0) / selBoards.length;

                // Determine which sides face inward toward the centroid
                const applyTaper = (angle) => {
                    pushHistory();
                    const selIds = new Set(selBoards.map(b => b.id));
                    setBoards(prev => prev.map(b => {
                        if (!selIds.has(b.id)) return b;
                        // Each leg gets inward-facing sides tapered
                        const taper = {
                            angleLeft:  b.position[0] > cx ? angle : 0,
                            angleRight: b.position[0] < cx ? angle : 0,
                            angleFront: b.position[2] < cz ? angle : 0,
                            angleBack:  b.position[2] > cz ? angle : 0,
                        };
                        return { ...b, shape: 'taper', taper };
                    }));
                };

                const removeTaper = () => {
                    pushHistory();
                    const selIds = new Set(selBoards.map(b => b.id));
                    setBoards(prev => prev.map(b =>
                        selIds.has(b.id) ? { ...b, shape: undefined, taper: undefined } : b
                    ));
                };

                const allTapered = selBoards.every(b => b.shape === 'taper');

                return (
                    <div className="inspector-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                        <h4>Bulk Shape</h4>
                        <p className="hint" style={{ marginTop: '2px', marginBottom: '8px' }}>
                            Inward-facing sides are auto-detected from each board's position relative to the group centroid.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Taper angle (°)</div>
                                <input
                                    type="number" min="0" max="89" step="0.5"
                                    value={bulkAngleZ}
                                    onChange={e => setBulkAngleZ(Math.max(0, Math.min(89, parseFloat(e.target.value) || 0)))}
                                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button className="primary-btn" onClick={() => applyTaper(bulkAngleZ)}>
                                ◢ Taper as Legs ({bulkAngleZ}°)
                            </button>
                            {allTapered && (
                                <button className="nav-btn" style={{ border: '1px solid var(--border-color)', marginTop: '2px' }} onClick={removeTaper}>
                                    ■ Remove Taper → Box
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}
            <div style={{ marginTop: '16px' }}>
                <button
                    className="nav-btn"
                    style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                    onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                    onClick={handleMultiDelete}
                >
                    Delete {selectedItemIds.length} Selected Items
                </button>
            </div>
        </>
    );
};

export default MultiSelectInspector;
