import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

const ParametricControls = ({ groupId, meta }) => {
    const { buildCabinet, buildBox, buildShakerDoor, buildDrawers, gridSnap } = useStore();
    const [params, setParams] = useState(meta.params || {});

    let defaultStep = 0.5;
    if (gridSnap === '1/16 in') defaultStep = 0.0625;
    else if (gridSnap === '1/8 in') defaultStep = 0.125;
    else if (gridSnap === '1/4 in') defaultStep = 0.25;
    else if (gridSnap === '1/2 in') defaultStep = 0.5;
    else if (gridSnap === '1 in') defaultStep = 1.0;
    else if (gridSnap === 'off') defaultStep = 0.125;

    // Keep local state in sync when selecting different assemblies
    useEffect(() => {
        setParams(meta.params || {});
    }, [groupId, meta.params]);

    const handleChange = (key, value) => {
        const numVal = parseFloat(value);
        // We allow string while typing, but pass number to the builder if possible
        const newParams = { ...params, [key]: isNaN(numVal) && value !== '' ? value : value };
        setParams(newParams);

        // Only call builder if we have a valid parsed number or empty (the builder has fallbacks)
        const cfg = { ...newParams, editGroupId: groupId };
        if (meta.builder === 'cabinet') buildCabinet(cfg);
        else if (meta.builder === 'box') buildBox(cfg);
        else if (meta.builder === 'shaker-door') buildShakerDoor(cfg);
        else if (meta.builder === 'drawerStack') buildDrawers(cfg);
        else if (meta.builder === 'face-frame') {
            const { buildFaceFrame } = useStore.getState();
            if (buildFaceFrame) buildFaceFrame(cfg);
        } else if (meta.builder === 'shelving') {
            const { buildShelving } = useStore.getState();
            if (buildShelving) buildShelving(cfg);
        }
    };

    const renderInput = (key, label, customStep, customMin) => {
        const step = customStep !== undefined ? customStep : defaultStep;
        const min = customMin !== undefined ? customMin : 0.0625;
        return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</div>
            <input 
                type="number" 
                step={step} 
                min={min} 
                value={params[key] ?? ''} 
                onChange={e => handleChange(key, e.target.value)}
                style={{ 
                    width: '100%', padding: '5px 8px', 
                    background: 'var(--bg-color)', color: 'var(--text-main)', 
                    border: '1px solid var(--border-color)', borderRadius: '6px', 
                    outline: 'none', fontSize: '0.9rem' 
                }} 
            />
        </div>
    );
};

    let controls = null;

    if (meta.builder === 'cabinet' || meta.builder === 'box') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('thicknessTB', 'Top/Bottom (in)')}
                    {renderInput('thicknessSide', 'Sides (in)')}
                    {renderInput('thicknessFront', 'Front (in)')}
                    {renderInput('thicknessBack', 'Back (in)')}
                </div>
            </>
        );
    } else if (meta.builder === 'shaker-door') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('thicknessFrame', 'Frame Thick')}
                    {renderInput('thicknessPanel', 'Panel Thick')}
                    {renderInput('widthStileRail', 'Stile Width')}
                    {renderInput('grooveDepth', 'Groove Depth')}
                </div>
            </>
        );
    } else if (meta.builder === 'drawerStack') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('count', 'Drawer Count', 1, 1)}
                    {renderInput('clearance', 'Clearance')}
                    {renderInput('thickness', 'Material')}
                    {renderInput('slideWidth', 'Slide Width')}
                </div>
            </>
        );
    } else if (meta.builder === 'face-frame') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('stileWidth', 'Stiles')}
                    {renderInput('railWidth', 'Rails')}
                    {renderInput('thickness', 'Thickness')}
                </div>
            </>
        );
    } else if (meta.builder === 'shelving') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('count', 'Shelf Count', 1, 1)}
                    {renderInput('thickness', 'Thickness')}
                </div>
            </>
        );
    }

    if (!controls) return null;

    return (
        <div className="inspector-section" style={{ background: 'rgba(60, 150, 255, 0.05)', border: '1px solid rgba(60, 150, 255, 0.2)' }}>
            <h4 style={{ color: 'var(--accent-color)' }}>Parametric Controls</h4>
            <div style={{ marginTop: '8px' }}>
                {controls}
            </div>
            <p className="hint" style={{ marginTop: '8px' }}>Changes update geometry instantly.</p>
        </div>
    );
};

export default ParametricControls;
