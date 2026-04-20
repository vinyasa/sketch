import React, { useState } from 'react';
import useStore from '../../store/useStore';

// ─── Shape catalogue — add new entries here as shapes are implemented ─────────
const SHAPES = [
    {
        id: 'box',
        label: 'Board',
        icon: '📐',
        description: 'Flat rectangular board or panel',
        color: '#bc8a5f',
    },
    {
        id: 'taper',
        label: 'Tapered Leg',
        icon: '📏',
        description: 'Classic furniture leg with angled faces',
        color: '#7a9e7e',
    },
    {
        id: 'cylinder',
        label: 'Cylinder',
        icon: '○',
        description: 'Round leg, post, disc — set radius & height in the dialog',
        color: '#7ea0bc',
    },
    {
        id: 'cabinet',
        label: 'Cabinet',
        icon: '🗄',
        description: 'Box with top, bottom, sides, front & back — ready for dados',
        color: '#b08855',
    },
];


// ─── Shape card ───────────────────────────────────────────────────────────────
const ShapeCard = ({ shape, onAdd }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            className="inspector-card"
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onAdd(shape)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', margin: 0, marginBottom: '6px',
                background: hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hov ? shape.color + '80' : 'var(--border-color)'}`,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-2px)' : 'none',
                boxShadow: hov ? `0 6px 16px rgba(0,0,0,0.3)` : 'none',
            }}
        >
            {/* Icon bubble */}
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: shape.color + '22',
                border: `1px solid ${shape.color}55`,
                fontSize: '1.1rem',
            }}>
                {shape.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {shape.label}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {shape.description}
                </div>
            </div>

            <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: shape.color,
                opacity: hov ? 1 : 0.5, transition: 'opacity 0.15s',
                flexShrink: 0,
            }}>
                + Add
            </div>
        </div>
    );
};

// ─── Panel ────────────────────────────────────────────────────────────────────
const AddComponentPanel = () => {
    const { manualAddBoard, manualAddCylinder, manualAddTaper, setCabinetDialog } = useStore();

    const handleAdd = (shape) => {
        if (shape.id === 'box') {
            manualAddBoard();
        } else if (shape.id === 'taper') {
            manualAddTaper();
        } else if (shape.id === 'cylinder') {
            manualAddCylinder();
        } else if (shape.id === 'cabinet') {
            setCabinetDialog({
                width: 24, height: 30, depth: 14,
                thicknessTB: 0.5, thicknessSide: 0.5,
                thicknessFront: 0.5, thicknessBack: 0.25,
            });
        }
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Section label */}
            <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.6px', fontWeight: 700, marginBottom: '2px',
            }}>
                Select a shape to add
            </div>

            {SHAPES.map(shape => (
                <ShapeCard key={shape.id} shape={shape} onAdd={handleAdd} />
            ))}

            {/* Hint */}
            <p style={{
                fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center',
                marginTop: '4px', lineHeight: 1.4,
            }}>
                Added to your selected assembly,<br />or Workspace if nothing is selected.
            </p>
        </div>
    );
};

export default AddComponentPanel;
