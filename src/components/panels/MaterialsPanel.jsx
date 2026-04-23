import React, { useState, useCallback } from 'react';
import useStore from '../../store/useStore';
import { WOOD_CATALOGUE, PAINT_PALETTE, normalizeMaterial, getMaterialDisplayColor } from '../../utils/materialCatalogue';

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const sectionLabel = {
    fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.6px', fontWeight: 700, marginBottom: '6px', display: 'block',
};
const tabBtn = (active) => ({
    flex: 1, padding: '6px', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
    background: active ? 'rgba(188,138,95,0.2)' : 'transparent',
    border: active ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
    color: active ? 'var(--accent-color)' : 'var(--text-muted)',
    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
});

// ─── Wood swatch card ─────────────────────────────────────────────────────────
const WoodSwatch = ({ id, spec, isActive, onClick }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            onClick={() => onClick({ type: 'wood', id })}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            title={spec.label}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                cursor: 'pointer', padding: '6px', borderRadius: '8px',
                background: isActive ? 'rgba(188,138,95,0.12)' : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--accent-color)' : hov ? 'rgba(188,138,95,0.35)' : 'var(--border-color)'}`,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-1px)' : 'none',
            }}
        >
            {/* Grain swatch square with subtle grain-like gradient */}
            <div style={{
                width: '100%', aspectRatio: '1.4 / 1', borderRadius: '5px', overflow: 'hidden',
                background: spec.grainColor,
                boxShadow: isActive ? `0 0 0 2px var(--accent-color)` : 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                position: 'relative',
            }}>
                {/* Faint vertical grain lines via repeating-linear-gradient */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `repeating-linear-gradient(
                        ${90 + (id.charCodeAt(0) % 20 - 10)}deg,
                        transparent 0px,
                        rgba(0,0,0,0.06) 1px,
                        transparent 2px,
                        transparent ${4 + (id.charCodeAt(1) % 4)}px
                    )`,
                    opacity: 0.7,
                }} />
                {isActive && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>✓</span>
                    </div>
                )}
            </div>
            <span style={{ fontSize: '0.62rem', color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: isActive ? 700 : 400, textAlign: 'center', lineHeight: 1.2 }}>
                {spec.label}
            </span>
        </div>
    );
};

// ─── Paint swatch ─────────────────────────────────────────────────────────────
const PaintSwatch = ({ hex, label, isActive, onClick, size = 'normal' }) => {
    const [hov, setHov] = useState(false);
    const isSmall = size === 'small';
    // Determine if label text should be dark or light
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const textColor = luma > 140 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';

    return (
        <div
            onClick={() => onClick({ type: 'color', hex })}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            title={label || hex}
            style={{
                background: hex,
                borderRadius: isSmall ? '4px' : '8px',
                cursor: 'pointer',
                border: `${isActive ? '2px' : '1px'} solid ${isActive ? 'var(--accent-color)' : hov ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'}`,
                transition: 'all 0.12s',
                transform: hov ? 'scale(1.06)' : 'scale(1)',
                boxShadow: hov ? '0 4px 10px rgba(0,0,0,0.3)' : 'none',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...(isSmall
                    ? { width: '28px', height: '28px' }
                    : { padding: '10px 6px', flexDirection: 'column', gap: '2px' }
                ),
            }}
        >
            {isActive && <span style={{ fontSize: isSmall ? '0.65rem' : '0.8rem', color: textColor }}>✓</span>}
            {!isSmall && !isActive && <span style={{ fontSize: '0.6rem', color: textColor, textAlign: 'center', lineHeight: 1.2, fontWeight: 500 }}>{label}</span>}
        </div>
    );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
const MaterialsPanel = () => {
    const {
        selectedItemIds, boards, groups,
        applyMaterial,
        recentColors,
        defaultMaterial,
    } = useStore();

    const [activeTab, setActiveTab] = useState('wood');
    const [customHex, setCustomHex] = useState('#bc8a5f');

    // ── Resolve what material to highlight as active ───────────────────────────
    // If one board is selected, show its material as active; else show default
    const activeMat = (() => {
        const boardIds = selectedItemIds.filter(id => boards.some(b => b.id.toString() === id));
        if (boardIds.length === 1) {
            const b = boards.find(b => b.id.toString() === boardIds[0]);
            return normalizeMaterial(b?.material);
        }
        return normalizeMaterial(defaultMaterial);
    })();

    // ── Count boards that will be affected ────────────────────────────────────
    const affectedCount = (() => {
        if (selectedItemIds.length === 0) return 0;
        const ids = new Set();
        const collectBoards = (gid) => {
            boards.filter(b => b.parentId === gid).forEach(b => ids.add(b.id));
            Object.keys(groups).filter(k => groups[k].parentId === gid).forEach(collectBoards);
        };
        selectedItemIds.forEach(id => {
            if (groups[id]) collectBoards(id);
            else if (boards.some(b => b.id.toString() === id)) ids.add(parseInt(id));
        });
        return ids.size;
    })();

    const handleApply = useCallback((matDesc) => {
        applyMaterial(matDesc);
        if (matDesc.type === 'color') setCustomHex(matDesc.hex);
    }, [applyMaterial]);

    const handleCustomApply = () => {
        if (/^#[0-9a-fA-F]{6}$/.test(customHex)) {
            handleApply({ type: 'color', hex: customHex });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: '6px' }}>
                <button style={tabBtn(activeTab === 'wood')} onClick={() => setActiveTab('wood')}>🪵 Wood</button>
                <button style={tabBtn(activeTab === 'color')} onClick={() => setActiveTab('color')}>🎨 Paint</button>
            </div>

            {/* ── Tab content ── */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* ════ WOOD TAB ════ */}
                {activeTab === 'wood' && (
                    <>
                        <div className="inspector-card">
                        <span style={sectionLabel}>12 Species — click to apply</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            {Object.entries(WOOD_CATALOGUE).map(([id, spec]) => (
                                <WoodSwatch
                                    key={id}
                                    id={id}
                                    spec={spec}
                                    isActive={activeMat.type === 'wood' && activeMat.id === id}
                                    onClick={handleApply}
                                />
                            ))}
                        </div>
                        </div>
                    </>
                )}

                {/* ════ PAINT TAB ════ */}
                {activeTab === 'color' && (
                    <>
                        {/* Custom picker */}
                        <div className="inspector-card">
                            <span style={sectionLabel}>Custom Colour</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={customHex}
                                    onChange={e => setCustomHex(e.target.value)}
                                    style={{ width: '44px', height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', padding: '2px' }}
                                />
                                <input
                                    type="text"
                                    value={customHex}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v.startsWith('#') && v.length <= 7) setCustomHex(v);
                                    }}
                                    onBlur={() => {
                                        if (!/^#[0-9a-fA-F]{6}$/.test(customHex)) setCustomHex('#bc8a5f');
                                    }}
                                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 8px', color: 'var(--text-main)', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none' }}
                                />
                                <button
                                    onClick={handleCustomApply}
                                    style={{ padding: '6px 12px', background: 'rgba(188,138,95,0.2)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        {/* Recent colours */}
                        {recentColors.length > 0 && (
                            <div className="inspector-card">
                                <span style={sectionLabel}>Recent</span>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    {recentColors.map(hex => (
                                        <PaintSwatch
                                            key={hex} hex={hex} size="small"
                                            isActive={activeMat.type === 'color' && activeMat.hex === hex}
                                            onClick={handleApply}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Curated palette */}
                        <div className="inspector-card">
                            <span style={sectionLabel}>Palette</span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                                {PAINT_PALETTE.map(({ hex, label }) => (
                                    <PaintSwatch
                                        key={hex} hex={hex} label={label}
                                        isActive={activeMat.type === 'color' && activeMat.hex === hex}
                                        onClick={handleApply}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Status bar ── */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: getMaterialDisplayColor(activeMat), border: '1px solid var(--border-color)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {activeMat.type === 'wood'
                            ? WOOD_CATALOGUE[activeMat.id]?.label ?? activeMat.id
                            : activeMat.hex}
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '1px' }}>
                        {affectedCount > 0
                            ? `Applying to ${affectedCount} board${affectedCount !== 1 ? 's' : ''}`
                            : 'Sets default material for new boards'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialsPanel;
