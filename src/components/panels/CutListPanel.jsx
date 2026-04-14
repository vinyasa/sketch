import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { normalizeMaterial, WOOD_CATALOGUE } from '../../utils/materialCatalogue';

const fmt4 = (v) => parseFloat(v.toFixed(4));

const matLabel = (material) => {
    const m = normalizeMaterial(material);
    if (m.type === 'color') return `Paint ${m.hex}`;
    return WOOD_CATALOGUE[m.id]?.label ?? m.id;
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-main)' };
const tdMono = { ...td, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' };

const CutListPanel = () => {
    const { boards } = useStore();
    const [mode, setMode] = useState('detail'); // 'detail' | 'grouped'

    // ── Grouped data ─────────────────────────────────────────────────────────
    const grouped = useMemo(() => {
        const map = new Map();
        boards.forEach(b => {
            const label = matLabel(b.material);
            const dims = [...b.size].sort((a, c) => c - a).map(fmt4); // L × W × T
            const key = `${label}|||${dims.join('|')}`;
            if (!map.has(key)) {
                map.set(key, { label, dims, count: 0, names: [] });
            }
            const entry = map.get(key);
            entry.count++;
            entry.names.push(b.name);
        });
        // Sort: material name first, then by largest dim desc
        return [...map.values()].sort((a, b) =>
            a.label.localeCompare(b.label) || b.dims[0] - a.dims[0]
        );
    }, [boards]);

    const btnBase = {
        padding: '5px 14px', borderRadius: '5px', fontSize: '0.75rem',
        fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)',
        transition: 'all 0.15s',
    };
    const btnActive = { ...btnBase, background: 'rgba(188,138,95,0.2)', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' };
    const btnIdle   = { ...btnBase, background: 'transparent', color: 'var(--text-muted)' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Toggle ── */}
            <div style={{ display: 'flex', gap: '6px', padding: '10px 16px 0', flexShrink: 0 }}>
                <button style={mode === 'detail'  ? btnActive : btnIdle} onClick={() => setMode('detail')}>
                    Detail
                </button>
                <button style={mode === 'grouped' ? btnActive : btnIdle} onClick={() => setMode('grouped')}>
                    Grouped
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                    {boards.length} piece{boards.length !== 1 ? 's' : ''}
                    {mode === 'grouped' && ` → ${grouped.length} line${grouped.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {/* ── Table ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 16px' }}>
                {mode === 'detail' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={th}>Lumber</th>
                                <th style={th}>Component</th>
                                <th style={{ ...th, textAlign: 'right' }}>Length</th>
                                <th style={{ ...th, textAlign: 'right' }}>Width</th>
                                <th style={{ ...th, textAlign: 'right' }}>Thickness</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boards.map(b => {
                                const dims = [...b.size].sort((a, c) => c - a).map(fmt4);
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={td}>{matLabel(b.material)}</td>
                                        <td style={td}>{b.name}</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[0]}"</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[1]}"</td>
                                        <td style={{ ...tdMono, textAlign: 'right' }}>{dims[2]}"</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ ...th, textAlign: 'center', width: '36px' }}>Qty</th>
                                <th style={th}>Lumber</th>
                                <th style={th}>Dimensions (L × W × T)</th>
                                <th style={th}>Components</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((g, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.9rem' }}>
                                        {g.count}×
                                    </td>
                                    <td style={td}>{g.label}</td>
                                    <td style={tdMono}>
                                        {g.dims[0]}" × {g.dims[1]}" × {g.dims[2]}"
                                    </td>
                                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                        {g.names.join(', ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default CutListPanel;
