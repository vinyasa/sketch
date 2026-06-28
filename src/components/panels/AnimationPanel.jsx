import React, { useState, useCallback } from 'react';
import useStore from '../../store/useStore';
import { collectChildBoards } from '../../utils/sceneGraph';

const EASING_OPTIONS = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In-Out' },
];

const fmt = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');
const fmtDeg = (rad) => typeof rad === 'number' ? (rad * 180 / Math.PI).toFixed(1) + '°' : '—';
const fmtInches = (v) => typeof v === 'number' ? v.toFixed(1) + '"' : '—';

const AnimationPanel = () => {
    const {
        animation, setAnimation,
        boards, selectedItemIds, setBoards, groups,
    } = useStore();

    const { boardAnim, turntable } = animation || {
        boardAnim: { boardId: null, start: null, end: null, playing: false, progress: 0, speed: 1, duration: 2, loop: false, bounce: false, easing: 'ease-in-out' },
        turntable: { playing: false, speed: 6, height: 20 },
    };

    // ── Helpers for deep-updating sub-slices ─────────────────────────────
    const setBoardAnim = (patch) => setAnimation(prev => ({
        ...prev,
        boardAnim: { ...prev.boardAnim, ...(typeof patch === 'function' ? patch(prev.boardAnim) : patch) },
    }));
    const setTurntable = (patch) => setAnimation(prev => ({
        ...prev,
        turntable: { ...prev.turntable, ...(typeof patch === 'function' ? patch(prev.turntable) : patch) },
    }));

    // ── Board/Assembly animation ───────────────────────────────────────────
    const selectedBoard = selectedItemIds.length === 1
        ? boards.find(b => b.id.toString() === selectedItemIds[0])
        : null;
    const selectedGroup = selectedItemIds.length === 1
        ? Object.keys(groups).find(k => k === selectedItemIds[0])
        : null;

    const canCapture = !!selectedBoard || !!selectedGroup;
    const hasStart = !!boardAnim.start;
    const hasEnd = !!boardAnim.end;
    const canPlay = hasStart && hasEnd && !!boardAnim.boardId;

    // Flash feedback state
    const [flashStart, setFlashStart] = useState(false);
    const [flashEnd, setFlashEnd] = useState(false);

    const captureStart = () => {
        if (selectedBoard) {
            setBoardAnim({
                boardId: selectedBoard.id.toString(),
                isGroup: false,
                start: {
                    position: [...selectedBoard.position],
                    orientation: [...(selectedBoard.orientation || [0, 0, 0])],
                    pivot: selectedBoard.pivot ? [...selectedBoard.pivot] : undefined,
                },
                end: null, // Clear stale end keyframe
                progress: 0,
                playing: false,
            });
        } else if (selectedGroup) {
            const childBoards = collectChildBoards(selectedGroup, boards, groups);
            setBoardAnim({
                boardId: selectedGroup,
                isGroup: true,
                start: {
                    boards: childBoards.map(b => ({
                        id: b.id.toString(),
                        position: [...b.position],
                        orientation: [...(b.orientation || [0, 0, 0])],
                        pivot: b.pivot ? [...b.pivot] : undefined,
                    })),
                },
                end: null, // Clear stale end keyframe
                progress: 0,
                playing: false,
            });
        } else {
            return;
        }
        setFlashStart(true);
        setTimeout(() => setFlashStart(false), 600);
    };

    const captureEnd = () => {
        const targetId = selectedBoard ? selectedBoard.id.toString() : selectedGroup;
        if (!targetId) return;

        // Must be same board/group as start
        if (boardAnim.boardId && boardAnim.boardId !== targetId) {
            const typeLabel = boardAnim.isGroup ? 'assembly' : 'board';
            alert(`Select the same ${typeLabel} you used for "Set Start".`);
            return;
        }

        if (selectedBoard) {
            setBoardAnim({
                boardId: selectedBoard.id.toString(),
                isGroup: false,
                end: {
                    position: [...selectedBoard.position],
                    orientation: [...(selectedBoard.orientation || [0, 0, 0])],
                    pivot: selectedBoard.pivot ? [...selectedBoard.pivot] : undefined,
                },
                progress: 0,
                playing: false,
            });
        } else if (selectedGroup) {
            const childBoards = collectChildBoards(selectedGroup, boards, groups);
            setBoardAnim({
                boardId: selectedGroup,
                isGroup: true,
                end: {
                    boards: childBoards.map(b => ({
                        id: b.id.toString(),
                        position: [...b.position],
                        orientation: [...(b.orientation || [0, 0, 0])],
                        pivot: b.pivot ? [...b.pivot] : undefined,
                    })),
                },
                progress: 0,
                playing: false,
            });
        }
        setFlashEnd(true);
        setTimeout(() => setFlashEnd(false), 600);
    };

    const togglePlay = () => {
        if (!canPlay) return;
        setBoardAnim(prev => ({
            playing: !prev.playing,
            progress: !prev.playing ? (prev.progress >= 1 ? 0 : prev.progress) : prev.progress,
        }));
    };

    const stopAnim = () => {
        setBoardAnim({ playing: false, progress: 0 });
        // Restore to start state
        if (boardAnim.start && boardAnim.boardId) {
            if (boardAnim.isGroup) {
                const startBoards = boardAnim.start.boards || [];
                const startMap = {};
                startBoards.forEach(sb => {
                    startMap[sb.id] = sb;
                });
                setBoards(prev => prev.map(b => {
                    const sb = startMap[b.id.toString()];
                    if (!sb) return b;
                    return {
                        ...b,
                        position: [...sb.position],
                        orientation: [...sb.orientation],
                        pivot: sb.pivot ? [...sb.pivot] : undefined,
                    };
                }));
            } else {
                setBoards(prev => prev.map(b => {
                    if (b.id.toString() !== boardAnim.boardId) return b;
                    return {
                        ...b,
                        position: boardAnim.start.position ? [...boardAnim.start.position] : b.position,
                        orientation: [...boardAnim.start.orientation],
                        pivot: boardAnim.start.pivot ? [...boardAnim.start.pivot] : undefined,
                    };
                }));
            }
        }
    };

    const clearKeyframes = () => {
        stopAnim();
        setBoardAnim({ boardId: null, isGroup: false, start: null, end: null, playing: false, progress: 0 });
    };

    // ── Styles ───────────────────────────────────────────────────────────
    const sectionClass = 'inspector-card';
    const rowStyle = { display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' };
    const sliderRow = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' };
    const labelStyle = { fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '55px' };
    const btnStyle = { flex: 1, padding: '6px 0', fontSize: '0.78rem' };

    // Board or Assembly name for display
    const animBoardName = boardAnim.boardId
        ? (boards.find(b => b.id.toString() === boardAnim.boardId)?.name || groups[boardAnim.boardId]?.name || boardAnim.boardId)
        : null;

    // Helper to calculate statistics (centroid position and rotation) for display
    const getStats = (state) => {
        if (!state) return null;
        if (boardAnim.isGroup) {
            const capturedBoards = state.boards || [];
            if (capturedBoards.length === 0) return null;
            // Position: centroid of all child boards (matching AssemblyInspector math)
            const cx = capturedBoards.reduce((s, b) => s + b.position[0], 0) / capturedBoards.length;
            const cy = capturedBoards.reduce((s, b) => s + b.position[1], 0) / capturedBoards.length;
            const cz = capturedBoards.reduce((s, b) => s + b.position[2], 0) / capturedBoards.length;
            // Rotation: orientation of the first board in the assembly
            const orientation = capturedBoards[0]?.orientation || [0, 0, 0];
            return { position: [cx, cy, cz], orientation };
        } else {
            return { position: state.position, orientation: state.orientation };
        }
    };

    const startStats = getStats(boardAnim.start);
    const endStats = getStats(boardAnim.end);

    return (
        <div style={{ padding: '12px', fontSize: '0.85rem', maxHeight: '70vh', overflowY: 'auto' }}>

            {/* ── Board Animation ────────────────────────────────────── */}
            <div className={sectionClass}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
                    🔄 Board Animation
                </h4>
                <p className="hint" style={{ margin: '0 0 8px 0' }}>
                    Capture two orientation states and smoothly animate between them.
                </p>

                {/* Capture buttons */}
                <div style={rowStyle}>
                    <button
                        className={`nav-btn${flashStart ? ' flash-confirm' : ''}`}
                        key={flashStart ? 'start-flash' : 'start'}
                        style={{ ...btnStyle, background: flashStart ? 'rgba(60, 200, 90, 0.35)' : hasStart ? 'rgba(60, 200, 90, 0.15)' : undefined, border: flashStart ? '1px solid rgba(60, 200, 90, 0.8)' : hasStart ? '1px solid rgba(60, 200, 90, 0.4)' : '1px solid var(--border-color)', transition: 'all 0.3s' }}
                        onClick={captureStart}
                        disabled={!canCapture}
                        title="Capture the selected item's current transform as the start state"
                    >
                        {flashStart ? '✓ Captured!' : '📍 Set Start'}
                    </button>
                    <button
                        className={`nav-btn${flashEnd ? ' flash-confirm' : ''}`}
                        key={flashEnd ? 'end-flash' : 'end'}
                        style={{ ...btnStyle, background: flashEnd ? 'rgba(60, 150, 255, 0.35)' : hasEnd ? 'rgba(60, 150, 255, 0.15)' : undefined, border: flashEnd ? '1px solid rgba(60, 150, 255, 0.8)' : hasEnd ? '1px solid rgba(60, 150, 255, 0.4)' : '1px solid var(--border-color)', transition: 'all 0.3s' }}
                        onClick={captureEnd}
                        disabled={!canCapture}
                        title="Capture the selected item's current transform as the end state"
                    >
                        {flashEnd ? '✓ Captured!' : '📍 Set End'}
                    </button>
                </div>

                {/* Status */}
                {animBoardName && (
                    <div style={{ 
                        marginTop: '12px', 
                        padding: '10px', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '0.72rem' 
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                            <strong style={{ color: 'var(--accent-color)', fontWeight: '600' }}>{animBoardName}</strong>
                        </div>
                        {hasStart && startStats && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Start State:</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', borderLeft: '2px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Position:</span>
                                        <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.68rem' }}>
                                            {startStats.position ? `[${startStats.position.map(fmtInches).join(', ')}]` : '—'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Rotation:</span>
                                        <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.68rem' }}>
                                            {startStats.orientation ? `[${startStats.orientation.map(fmtDeg).join(', ')}]` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {hasEnd && endStats && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>End State:</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', borderLeft: '2px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Position:</span>
                                        <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.68rem' }}>
                                            {endStats.position ? `[${endStats.position.map(fmtInches).join(', ')}]` : '—'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Rotation:</span>
                                        <span style={{ fontFamily: 'monospace', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.68rem' }}>
                                            {endStats.orientation ? `[${endStats.orientation.map(fmtDeg).join(', ')}]` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Playback controls */}
                <div style={rowStyle}>
                    <button
                        className="nav-btn"
                        style={{ ...btnStyle, background: boardAnim.playing ? 'rgba(255, 180, 60, 0.2)' : 'rgba(60, 200, 90, 0.15)', fontWeight: 'bold' }}
                        onClick={togglePlay}
                        disabled={!canPlay}
                    >
                        {boardAnim.playing ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button className="nav-btn" style={btnStyle} onClick={stopAnim} disabled={!canPlay}>
                        ⏹ Reset
                    </button>
                    <button className="nav-btn" style={btnStyle} onClick={clearKeyframes}>
                        🗑 Clear
                    </button>
                </div>

                {/* Loop / Bounce */}
                <div style={rowStyle}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={boardAnim.loop} onChange={e => setBoardAnim({ loop: e.target.checked })}
                            style={{ accentColor: 'var(--accent-color)', width: '13px', height: '13px' }} />
                        Loop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={boardAnim.bounce} onChange={e => setBoardAnim({ bounce: e.target.checked })}
                            style={{ accentColor: 'var(--accent-color)', width: '13px', height: '13px' }} />
                        Bounce
                    </label>
                </div>

                {/* Duration slider */}
                <div style={sliderRow}>
                    <span style={labelStyle}>Duration</span>
                    <input type="range" min="0.5" max="10" step="0.5" value={boardAnim.duration}
                        onChange={e => setBoardAnim({ duration: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '0.72rem', minWidth: '32px', textAlign: 'right' }}>{boardAnim.duration}s</span>
                </div>

                {/* Easing */}
                <div style={sliderRow}>
                    <span style={labelStyle}>Easing</span>
                    <select value={boardAnim.easing} onChange={e => setBoardAnim({ easing: e.target.value })}
                        style={{ flex: 1, background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 6px', fontSize: '0.78rem' }}>
                        {EASING_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* Progress bar */}
                {canPlay && (
                    <div style={{ marginTop: '10px', background: 'rgba(128,128,128,0.15)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${(boardAnim.progress * 100).toFixed(1)}%`,
                            height: '100%',
                            background: 'var(--accent-color)',
                            borderRadius: '4px',
                            transition: boardAnim.playing ? 'none' : 'width 0.2s',
                        }} />
                    </div>
                )}
            </div>

            {/* ── Camera Turntable ──────────────────────────────────── */}
            <div className={sectionClass}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.82rem', color: 'var(--accent-color)' }}>
                    🎥 Camera Turntable
                </h4>
                <p className="hint" style={{ margin: '0 0 8px 0' }}>
                    Orbit the camera around the scene for a showcase view.
                </p>

                <div style={rowStyle}>
                    <button
                        className="nav-btn"
                        style={{ ...btnStyle, background: turntable.playing ? 'rgba(255, 180, 60, 0.2)' : 'rgba(60, 200, 90, 0.15)', fontWeight: 'bold' }}
                        onClick={() => setTurntable({ playing: !turntable.playing })}
                    >
                        {turntable.playing ? '⏹ Stop Orbit' : '▶ Start Orbit'}
                    </button>
                </div>

                {/* Speed slider */}
                <div style={sliderRow}>
                    <span style={labelStyle}>Speed</span>
                    <input type="range" min="1" max="30" step="1" value={turntable.speed}
                        onChange={e => setTurntable({ speed: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '0.72rem', minWidth: '45px', textAlign: 'right' }}>{turntable.speed} RPM</span>
                </div>

                {/* Height slider */}
                <div style={sliderRow}>
                    <span style={labelStyle}>Height</span>
                    <input type="range" min="5" max="80" step="1" value={turntable.height}
                        onChange={e => setTurntable({ height: parseInt(e.target.value) })}
                        style={{ flex: 1, accentColor: 'var(--accent-color)' }} />
                    <span style={{ fontSize: '0.72rem', minWidth: '32px', textAlign: 'right' }}>{turntable.height}"</span>
                </div>
            </div>
        </div>
    );
};

export default AnimationPanel;
