import React, { useState, useCallback } from 'react';
import useStore from '../../store/useStore';
import { PRESETS, PRESET_KEYS, clonePreset } from '../../utils/lightingPresets';

// ─── Shared styles ────────────────────────────────────────────────────────────
const label = {
    fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: '3px', display: 'block', fontWeight: 600,
};
const inputSm = {
    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px',
    padding: '4px 6px', color: 'var(--text-main)', fontSize: '0.75rem',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
};

// ─── Intensity slider row ─────────────────────────────────────────────────────
const IntensitySlider = ({ value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
            type="range" min={0} max={3} step={0.05} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-main)', width: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {value.toFixed(2)}
        </span>
    </div>
);

// ─── XYZ vector input ─────────────────────────────────────────────────────────
const Vec3Input = ({ value, onChange, label: lbl }) => (
    <div>
        <span style={label}>{lbl}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
            {['X', 'Y', 'Z'].map((axis, i) => (
                <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '0.6rem', color: ['#ff3b30', '#34c759', '#007aff'][i], fontWeight: 700, width: '10px' }}>{axis}</span>
                    <input
                        type="number" step={1}
                        value={value?.[i] ?? 0}
                        onChange={e => {
                            const v = [...(value ?? [0, 0, 0])];
                            v[i] = parseFloat(e.target.value) || 0;
                            onChange(v);
                        }}
                        style={{ ...inputSm, padding: '3px 4px' }}
                    />
                </div>
            ))}
        </div>
    </div>
);

// ─── TYPE badge ───────────────────────────────────────────────────────────────
const TYPE_COLORS = {
    ambient: '#8e8e93', hemisphere: '#5ac8fa', directional: '#ffd60a',
    point: '#ff9f0a', spot: '#bf5af2', rectarea: '#32d74b',
};
const TypeBadge = ({ type }) => (
    <span style={{
        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.4px',
        padding: '2px 6px', borderRadius: '8px',
        background: `${TYPE_COLORS[type] ?? '#888'}22`,
        color: TYPE_COLORS[type] ?? '#888',
        border: `1px solid ${TYPE_COLORS[type] ?? '#888'}55`,
        textTransform: 'uppercase', flexShrink: 0,
    }}>
        {type}
    </span>
);

// ─── Individual light editor ──────────────────────────────────────────────────
const LightEditor = ({ light, onUpdate, onRemove }) => {
    const hasPosition = !['ambient', 'hemisphere'].includes(light.type);
    const hasTarget = ['directional', 'spot'].includes(light.type);
    const canShadow = ['directional', 'spot'].includes(light.type);
    const isSpot = light.type === 'spot';
    const isHemi = light.type === 'hemisphere';
    const isRectArea = light.type === 'rectarea';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '0 0 6px 6px', border: '1px solid var(--border-color)', borderTop: 'none', margin: 0, marginTop: '-1px' }}>
            {/* Name */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                    value={light.name}
                    onChange={e => onUpdate({ name: e.target.value })}
                    style={{ ...inputSm, flex: 1, fontWeight: 600 }}
                />
                <TypeBadge type={light.type} />
                <button
                    onClick={onRemove}
                    title="Remove this light"
                    style={{ background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.3)', color: '#ff3b30', borderRadius: '4px', padding: '3px 7px', fontSize: '0.75rem', cursor: 'pointer' }}
                >🗑</button>
            </div>

            {/* Color + Intensity */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div>
                    <span style={label}>Color</span>
                    <input
                        type="color" value={light.color ?? '#ffffff'}
                        onChange={e => onUpdate({ color: e.target.value })}
                        style={{ width: '40px', height: '28px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', padding: '1px' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <span style={label}>Intensity</span>
                    <IntensitySlider value={light.intensity ?? 1} onChange={v => onUpdate({ intensity: v })} />
                </div>
            </div>

            {/* Hemisphere ground color */}
            {isHemi && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div>
                        <span style={label}>Ground</span>
                        <input
                            type="color" value={light.groundColor ?? '#333333'}
                            onChange={e => onUpdate({ groundColor: e.target.value })}
                            style={{ width: '40px', height: '28px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', padding: '1px' }}
                        />
                    </div>
                </div>
            )}

            {/* Position */}
            {hasPosition && <Vec3Input label="Position" value={light.position} onChange={v => onUpdate({ position: v })} />}

            {/* Target */}
            {hasTarget && <Vec3Input label="Target" value={light.target} onChange={v => onUpdate({ target: v })} />}

            {/* Spot-specific */}
            {isSpot && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                        <span style={label}>Angle (rad)</span>
                        <input type="number" step={0.02} min={0} max={1.57}
                            value={light.angle ?? 0.4}
                            onChange={e => onUpdate({ angle: parseFloat(e.target.value) || 0 })}
                            style={inputSm}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <span style={label}>Penumbra</span>
                        <input type="number" step={0.05} min={0} max={1}
                            value={light.penumbra ?? 0.3}
                            onChange={e => onUpdate({ penumbra: parseFloat(e.target.value) || 0 })}
                            style={inputSm}
                        />
                    </div>
                </div>
            )}

            {/* RectArea size */}
            {isRectArea && (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                        <span style={label}>Width</span>
                        <input type="number" step={1} min={1}
                            value={light.width ?? 10}
                            onChange={e => onUpdate({ width: parseFloat(e.target.value) || 1 })}
                            style={inputSm}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <span style={label}>Height</span>
                        <input type="number" step={1} min={1}
                            value={light.height ?? 10}
                            onChange={e => onUpdate({ height: parseFloat(e.target.value) || 1 })}
                            style={inputSm}
                        />
                    </div>
                </div>
            )}

            {/* Shadow controls */}
            {canShadow && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <input
                            type="checkbox"
                            checked={light.castShadow ?? false}
                            onChange={e => onUpdate({ castShadow: e.target.checked })}
                            style={{ accentColor: 'var(--accent-color)' }}
                        />
                        Cast shadow
                    </label>
                    {light.castShadow && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={label}>Map</span>
                            <select
                                value={light.shadowMapSize ?? 1024}
                                onChange={e => onUpdate({ shadowMapSize: parseInt(e.target.value) })}
                                style={{ ...inputSm, width: 'auto' }}
                            >
                                <option value={512}>512</option>
                                <option value={1024}>1024</option>
                                <option value={2048}>2048</option>
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Add light menu ───────────────────────────────────────────────────────────
const LIGHT_TYPES = [
    { type: 'ambient',     label: 'Ambient',       defaults: { color: '#ffffff', intensity: 0.4 } },
    { type: 'hemisphere',  label: 'Hemisphere',    defaults: { color: '#c8d8ff', groundColor: '#3a2a1a', intensity: 0.5 } },
    { type: 'directional', label: 'Directional',   defaults: { color: '#ffffff', intensity: 1.0, position: [10, 30, 10], target: [0, 0, 0], castShadow: false, shadowMapSize: 1024 } },
    { type: 'point',       label: 'Point',         defaults: { color: '#ffffff', intensity: 1.0, position: [0, 20, 0], decay: 2 } },
    { type: 'spot',        label: 'Spot',          defaults: { color: '#ffffff', intensity: 2.0, position: [10, 30, 10], target: [0, 0, 0], castShadow: false, shadowMapSize: 1024, angle: 0.42, penumbra: 0.3, decay: 1.5 } },
    { type: 'rectarea',    label: 'Rect Area',     defaults: { color: '#ffffff', intensity: 4.0, position: [0, 20, 0], width: 10, height: 10 } },
];

// ─── Main Panel ───────────────────────────────────────────────────────────────
const LightingPanel = () => {
    const { lighting, setLighting, addRecordedStep } = useStore();
    const [expandedId, setExpandedId] = useState(null);
    const [showAddMenu, setShowAddMenu] = useState(false);

    const lights = lighting?.lights ?? [];
    const shadowsOn = lighting?.shadows ?? false;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const patchLight = useCallback((id, patch) => {
        setLighting(prev => ({
            ...prev,
            lights: prev.lights.map(l => l.id === id ? { ...l, ...patch } : l),
        }));
    }, [setLighting]);

    const toggleEnabled = useCallback((id) => {
        setLighting(prev => ({
            ...prev,
            lights: prev.lights.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l),
        }));
    }, [setLighting]);

    const removeLight = useCallback((id) => {
        setLighting(prev => ({ ...prev, lights: prev.lights.filter(l => l.id !== id) }));
        setExpandedId(e => e === id ? null : e);
    }, [setLighting]);

    const applyPreset = useCallback((key) => {
        const p = clonePreset(key);
        setLighting({ presetKey: key, shadows: p.shadows, lights: p.lights });
        setExpandedId(null);
        if (addRecordedStep) {
            const label = PRESETS[key]?.label || key;
            addRecordedStep(`In the **Lighting** panel, select the **${label}** lighting preset.`);
        }
    }, [setLighting, addRecordedStep]);

    const toggleShadows = useCallback(() => {
        setLighting(prev => ({ ...prev, shadows: !prev.shadows }));
        if (addRecordedStep) {
            addRecordedStep(shadowsOn ? 'In the **Lighting** panel, turn **Shadows OFF**.' : 'In the **Lighting** panel, turn **Shadows ON**.');
        }
    }, [setLighting, shadowsOn, addRecordedStep]);

    const addLight = useCallback((typeEntry) => {
        const newLight = {
            id: `${typeEntry.type}-${Date.now()}`,
            name: typeEntry.label,
            type: typeEntry.type,
            enabled: true,
            ...typeEntry.defaults,
        };
        setLighting(prev => ({ ...prev, lights: [...prev.lights, newLight] }));
        setExpandedId(newLight.id);
        setShowAddMenu(false);
        if (addRecordedStep) {
            addRecordedStep(`In the **Lighting** panel, click **+ Add Light** and add a **${typeEntry.label}** light.`);
        }
    }, [setLighting, addRecordedStep]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>

            {/* ── Preset row ── */}
            <div className="inspector-card">
                <span style={label}>Preset</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {PRESET_KEYS.map(key => (
                        <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            style={{
                                padding: '4px 10px', fontSize: '0.72rem', borderRadius: '4px', cursor: 'pointer',
                                background: lighting?.presetKey === key ? 'rgba(188,138,95,0.25)' : 'rgba(0,0,0,0.2)',
                                border: `1px solid ${lighting?.presetKey === key ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                color: lighting?.presetKey === key ? 'var(--accent-color)' : 'var(--text-muted)',
                                fontWeight: lighting?.presetKey === key ? 700 : 400,
                                transition: 'all 0.15s',
                            }}
                        >
                            {PRESETS[key].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Global shadow toggle ── */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', background: shadowsOn ? 'rgba(188,138,95,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: '6px', border: `1px solid ${shadowsOn ? 'var(--accent-color)' : 'var(--border-color)'}`, transition: 'all 0.15s' }}>
                <input
                    type="checkbox" checked={shadowsOn} onChange={toggleShadows}
                    style={{ accentColor: 'var(--accent-color)', width: '14px', height: '14px' }}
                />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: shadowsOn ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                    {shadowsOn ? '🌑 Shadows: ON' : '○ Shadows: OFF'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {shadowsOn ? 'Real-time' : 'Faster'}
                </span>
            </label>

            {/* ── Light list ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                {lights.map(light => (
                    <div key={light.id}>
                        {/* Summary row — always visible */}
                        <div
                            className="inspector-card"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px',
                                background: expandedId === light.id ? 'rgba(188,138,95,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${expandedId === light.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                borderRadius: expandedId === light.id ? '6px 6px 0 0' : '6px',
                                cursor: 'pointer', transition: 'all 0.15s', margin: 0
                            }}
                            onClick={() => setExpandedId(expandedId === light.id ? null : light.id)}
                        >
                            {/* Enable toggle */}
                            <button
                                onClick={e => { e.stopPropagation(); toggleEnabled(light.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1, opacity: light.enabled ? 1 : 0.35 }}
                                title={light.enabled ? 'Disable' : 'Enable'}
                            >
                                {light.enabled ? '💡' : '○'}
                            </button>

                            <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: light.enabled ? 'var(--text-main)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {light.name}
                            </span>

                            <TypeBadge type={light.type} />

                            {/* Colour swatch */}
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: light.color, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />

                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: '28px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {(light.intensity ?? 0).toFixed(1)}
                            </span>

                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
                                {expandedId === light.id ? '▲' : '▼'}
                            </span>
                        </div>

                        {/* Expanded editor */}
                        {expandedId === light.id && (
                            <div>
                                <LightEditor
                                    light={light}
                                    onUpdate={patch => patchLight(light.id, patch)}
                                    onRemove={() => removeLight(light.id)}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Add light ── */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowAddMenu(v => !v)}
                    style={{ width: '100%', padding: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(188,138,95,0.1)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '6px', cursor: 'pointer' }}
                >
                    + Add Light
                </button>
                {showAddMenu && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100 }}>
                        {LIGHT_TYPES.map(lt => (
                            <button
                                key={lt.type}
                                onClick={() => addLight(lt)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(188,138,95,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                                <TypeBadge type={lt.type} />
                                {lt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Status footer ── */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                <span>{lights.filter(l => l.enabled).length} active light{lights.filter(l => l.enabled).length !== 1 ? 's' : ''}</span>
                {shadowsOn && <span>• {lights.filter(l => l.castShadow && l.enabled).length} shadow caster{lights.filter(l => l.castShadow && l.enabled).length !== 1 ? 's' : ''}</span>}
                <span style={{ marginLeft: 'auto' }}>real-time GPU</span>
            </div>
        </div>
    );
};

export default LightingPanel;
