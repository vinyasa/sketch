import React, { useState } from 'react';
import useStore from '../../store/useStore';

const ASSEMBLIES = [
    {
        id: 'cabinet',
        label: 'Cabinet',
        icon: '🗄',
        description: 'Box with top, bottom, sides, front & back — ready for dados',
        color: '#b08855',
    },
    {
        id: 'shakerDoor',
        label: 'Shaker Door',
        icon: '🚪',
        description: 'Five-piece door with frame and central panel',
        color: '#a07850',
    },
    {
        id: 'drawerStack',
        label: 'Drawer Stack',
        icon: '🗃️',
        description: 'Stack of drawer boxes with optional faces',
        color: '#8d6d53',
    },
];

const AssemblyCard = ({ item, onSelect }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            className="inspector-card"
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            onClick={() => onSelect(item)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                background: hov ? 'rgba(255,255,255,0.08)' : undefined,
                borderColor: hov ? item.color + '80' : undefined,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-1px)' : 'none',
                boxShadow: hov ? '0 4px 12px rgba(0,0,0,0.25)' : 'none',
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: item.color + '22',
                border: `1px solid ${item.color}55`,
                fontSize: '1.1rem',
            }}>
                {item.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {item.label}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {item.description}
                </div>
            </div>

            <div style={{
                fontSize: '0.7rem', fontWeight: 700, color: item.color,
                opacity: hov ? 1 : 0.5, transition: 'opacity 0.15s',
                flexShrink: 0,
            }}>
                + Add
            </div>
        </div>
    );
};

const AssembliesPanel = () => {
    const { setCabinetDialog, setShakerDoorDialog, setDrawerDialog } = useStore();

    const handleSelect = (item) => {
        if (item.id === 'cabinet') {
            setCabinetDialog({
                width: 24, height: 30, depth: 14,
                thicknessTB: 0.75, thicknessSide: 0.75,
                thicknessFront: 0.75, thicknessBack: 0.25,
            });
        } else if (item.id === 'shakerDoor') {
            setShakerDoorDialog({});
        } else if (item.id === 'drawerStack') {
            setDrawerDialog({});
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
                fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.6px', fontWeight: 700, marginBottom: '2px',
            }}>
                Parametric Builders
            </div>
            {ASSEMBLIES.map(item => (
                <AssemblyCard key={item.id} item={item} onSelect={handleSelect} />
            ))}
            <p style={{
                fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center',
                marginTop: '4px', lineHeight: 1.4,
            }}>
                Added to your selected assembly,<br />or Workspace if nothing is selected.
            </p>
        </div>
    );
};

export default AssembliesPanel;
