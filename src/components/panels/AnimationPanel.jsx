import React, { useState, useCallback } from 'react';
import useStore from '../../store/useStore';

const EASING_OPTIONS = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In-Out' },
];

const fmt = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');
const fmtDeg = (rad) => typeof rad === 'number' ? (rad * 180 / Math.PI).toFixed(1) + '°' : '—';

const AnimationPanel = () => {
    const {
        animation, setAnimation,
        boards, selectedItemIds, setBoards,
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

    // ── Board animation ──────────────────────────────────────────────────
    const selectedBoard = selectedItemIds.length === 1
        ? boards.find(b => b.id.toString() === selectedItemIds[0])
        : null;

    const canCapture = !!selectedBoard;
    const hasStart = !!boardAnim.start;
    const hasEnd = !!boardAnim.end;
    const canPlay = hasStart && hasEnd && !!boardAnim.boardId;

    // Flash feedback state
    const [flashStart, setFlashStart] = useState(false);
    const [flashEnd, setFlashEnd] = useState(false);

    const captureStart = () => {
        if (!selectedBoard) return;
        setBoardAnim({
            boardId: selectedBoard.id.toString(),
            start: {
                orientation: [...(selectedBoard.orientation || [0, 0, 0])],
                pivot: selectedBoard.pivot ? [...selectedBoard.pivot] : undefined,
            },
            progress: 0,
            playing: false,
        });
        setFlashStart(true);
        setTimeout(() => setFlashStart(false), 600);
    };

    const captureEnd = () => {
        if (!selectedBoard) return;
        // Must be same board as start
        if (boardAnim.boardId && boardAnim.boardId !== selectedBoard.id.toString()) {
            alert('Select the same board you used for "Set Start".');
            return;
        }
        setBoardAnim({
            boardId: selectedBoard.id.toString(),
            end: {
                orientation: [...(selectedBoard.orientation || [0, 0, 0])],
                pivot: selectedBoard.pivot ? [...selectedBoard.pivot] : undefined,
            },
            progress: 0,
            playing: false,
        });
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
            setBoards(prev => prev.map(b => {
                if (b.id.toString() !== boardAnim.boardId) return b;
                return {
                    ...b,
                    orientation: [...boardAnim.start.orientation],
                    pivot: boardAnim.start.pivot ? [...boardAnim.start.pivot] : undefined,
                };
            }));
        }
    };

    const clearKeyframes = () => {
        stopAnim();
        setBoardAnim({ boardId: null, start: null, end: null, playing: false, progress: 0 });
    };

    // ── Styles ───────────────────────────────────────────────────────────
    const sectionClass = 'inspector-card';
    const rowStyle = { display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' };
    const sliderRow = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' };
    const labelStyle = { fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '55px' };
    const btnStyle = { flex: 1, padding: '6px 0', fontSize: '0.78rem' };

    // Board name for display
    const animBoardName = boardAnim.boardId
        ? (boards.find(b => b.id.toString() === boardAnim.boardId)?.name || 'Unknown')
        : null;

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
                        title="Capture the selected board's current orientation as the start state"
                    >
                        {flashStart ? '✓ Captured!' : '📍 Set Start'}
                    </button>
                    <button
                        className={`nav-btn${flashEnd ? ' flash-confirm' : ''}`}
                        key={flashEnd ? 'end-flash' : 'end'}
                        style={{ ...btnStyle, background: flashEnd ? 'rgba(60, 150, 255, 0.35)' : hasEnd ? 'rgba(60, 150, 255, 0.15)' : undefined, border: flashEnd ? '1px solid rgba(60, 150, 255, 0.8)' : hasEnd ? '1px solid rgba(60, 150, 255, 0.4)' : '1px solid var(--border-color)', transition: 'all 0.3s' }}
                        onClick={captureEnd}
                        disabled={!canCapture}
                        title="Capture the selected board's current orientation as the end state"
                    >
                        {flashEnd ? '✓ Captured!' : '📍 Set End'}
                    </button>
                </div>

                {/* Status */}
                {animBoardName && (
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Target: <strong style={{ color: 'var(--accent-color)' }}>{animBoardName}</strong>
                        {hasStart && (
                            <span style={{ marginLeft: '8px' }}>
                                Start: [{boardAnim.start.orientation.map(fmtDeg).join(', ')}]
                            </span>
                        )}
                        {hasEnd && (
                            <span style={{ marginLeft: '8px' }}>
                                End: [{boardAnim.end.orientation.map(fmtDeg).join(', ')}]
                            </span>
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
