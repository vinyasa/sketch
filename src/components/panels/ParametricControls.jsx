import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

const ParametricControls = ({ groupId, meta }) => {
    const { buildCabinet, buildBox, buildShakerDoor, buildDrawers, gridSnap, units } = useStore();
    const [params, setParams] = useState(meta.params || {});

    let defaultStep = 0.5;
    if (units === 'metric') {
        if (gridSnap === '1 mm') defaultStep = 1;
        else if (gridSnap === '2 mm') defaultStep = 2;
        else if (gridSnap === '5 mm') defaultStep = 5;
        else if (gridSnap === '10 mm') defaultStep = 10;
        else if (gridSnap === 'off') defaultStep = 5;
        else defaultStep = 5;
    } else {
        if (gridSnap === '1/16 in') defaultStep = 0.0625;
        else if (gridSnap === '1/8 in') defaultStep = 0.125;
        else if (gridSnap === '1/4 in') defaultStep = 0.25;
        else if (gridSnap === '1/2 in') defaultStep = 0.5;
        else if (gridSnap === '1 in') defaultStep = 1.0;
        else if (gridSnap === 'off') defaultStep = 0.125;
        else defaultStep = 0.25;
    }

    // Keep local state in sync when selecting different assemblies
    useEffect(() => {
        setParams(meta.params || {});
    }, [groupId, meta.params]);

    const handleChange = (key, value) => {
        let numVal = parseFloat(value);
        // Scale display input back to internal decimal inches
        if (units === 'metric' && key !== 'count' && !isNaN(numVal)) {
            numVal = numVal / 25.4;
        }
        const newParams = { ...params, [key]: isNaN(numVal) ? value : numVal };
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
        } else if (meta.builder === 'table-base') {
            const { buildTableBase } = useStore.getState();
            if (buildTableBase) buildTableBase(cfg);
        } else if (meta.builder === 'table-top') {
            const { buildTableTop } = useStore.getState();
            if (buildTableTop) buildTableTop(cfg);
        }
    };

    const renderInput = (key, label, customStep, customMin, fallbackVal) => {
        const step = customStep !== undefined ? customStep : defaultStep;
        const min = customMin !== undefined ? customMin : 0;
        
        let displayVal = params[key] ?? fallbackVal ?? '';
        if (units === 'metric' && key !== 'count' && displayVal !== '') {
            displayVal = (parseFloat(displayVal) * 25.4).toFixed(1);
        }

        return (
            <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</div>
                <input 
                    type="number" 
                    step={step} 
                    min={min} 
                    value={displayVal} 
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

    if (meta.builder === 'cabinet') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('thicknessTB', `Top/Bottom (${units === 'metric' ? 'mm' : 'in'})`)}
                    {renderInput('thicknessSide', `Sides (${units === 'metric' ? 'mm' : 'in'})`)}
                    {renderInput('thicknessBack', `Back (${units === 'metric' ? 'mm' : 'in'})`)}
                </div>
            </>
        );
    } else if (meta.builder === 'box') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('thicknessTB', `Top/Bottom (${units === 'metric' ? 'mm' : 'in'})`)}
                    {renderInput('thicknessSide', `Sides (${units === 'metric' ? 'mm' : 'in'})`)}
                    {renderInput('thicknessFront', `Front (${units === 'metric' ? 'mm' : 'in'})`)}
                    {renderInput('thicknessBack', `Back (${units === 'metric' ? 'mm' : 'in'})`)}
                </div>
            </>
        );
    } else if (meta.builder === 'shaker-door') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)', undefined, undefined, 18)}
                    {renderInput('height', 'Height (Y)', undefined, undefined, 30)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Door Style</div>
                        <select 
                            value={params.doorStyle || 'overlay'} 
                            onChange={e => handleChange('doorStyle', e.target.value)}
                            style={{ 
                                width: '100%', padding: '5px 8px', 
                                background: 'var(--bg-color)', color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', borderRadius: '6px', 
                                outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                            }}
                        >
                            <option value="overlay">Overlay</option>
                            <option value="inset">Inset</option>
                        </select>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Door Type</div>
                        <select 
                            value={params.doorConstruction || 'shaker'} 
                            onChange={e => handleChange('doorConstruction', e.target.value)}
                            style={{ 
                                width: '100%', padding: '5px 8px', 
                                background: 'var(--bg-color)', color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', borderRadius: '6px', 
                                outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                            }}
                        >
                            <option value="shaker">Shaker</option>
                            <option value="flat">Flat / Slab</option>
                        </select>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '8px' }}>
                    {params.doorStyle === 'inset' 
                        ? renderInput('insetClearance', 'Reveal Clearance', 0.03125, 0, 0.125) 
                        : renderInput('overlayReveal', 'Overlay Reveal', 0.1, 0, 0.25)
                    }
                </div>
                {params.doorConstruction === 'flat' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                        {renderInput('thicknessFrame', 'Door Thickness', undefined, undefined, 0.75)}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {renderInput('thicknessFrame', 'Frame Thick', undefined, undefined, 0.75)}
                        {renderInput('thicknessPanel', 'Panel Thick', undefined, undefined, 0.25)}
                        {renderInput('widthStileRail', 'Stile Width', undefined, undefined, 2)}
                        {renderInput('grooveDepth', 'Groove Depth', undefined, undefined, 0.375)}
                    </div>
                )}
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
    } else if (meta.builder === 'table-base') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('width', 'Width (X)')}
                    {renderInput('height', 'Height (Y)')}
                    {renderInput('depth', 'Depth (Z)')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('legSize', 'Leg Size')}
                    {renderInput('legTaperAngle', 'Taper Angle')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {renderInput('apronHeight', 'Apron H')}
                    {renderInput('apronThickness', 'Apron T')}
                    {renderInput('apronInset', 'Inset')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('stringerWidth', 'Stringer W')}
                    {renderInput('stringerThickness', 'Stringer T')}
                </div>
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Apron-to-Leg Joint</div>
                    <select 
                        value={params.apronJoint || 'pocket-hole'} 
                        onChange={e => handleChange('apronJoint', e.target.value)}
                        style={{ 
                            width: '100%', padding: '5px 8px', 
                            background: 'var(--bg-color)', color: 'var(--text-main)', 
                            border: '1px solid var(--border-color)', borderRadius: '6px', 
                            outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                        }}
                    >
                        <option value="pocket-hole">Pocket Holes</option>
                        <option value="loose-tenon">Loose Tenons (Dominoes)</option>
                        <option value="dowels">Dowel Pins</option>
                    </select>
                </div>
            </>
        );
    } else if (meta.builder === 'table-top') {
        controls = (
            <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {renderInput('boardWidth', 'Slat Width')}
                    {renderInput('thickness', 'Thickness')}
                </div>
                {params.width !== undefined && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {renderInput('width', 'Width (X)')}
                        {renderInput('depth', 'Depth (Z)')}
                    </div>
                )}
                {params.widthOverhang !== undefined && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {renderInput('widthOverhang', 'X Overhang')}
                        {renderInput('depthOverhang', 'Z Overhang')}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Joint Type</div>
                        <select 
                            value={params.jointType || 'loose-tenon'} 
                            onChange={e => handleChange('jointType', e.target.value)}
                            style={{ 
                                width: '100%', padding: '5px 8px', 
                                background: 'var(--bg-color)', color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', borderRadius: '6px', 
                                outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                            }}
                        >
                            <option value="loose-tenon">Loose Tenon</option>
                            <option value="dowels">Dowel Pins</option>
                            <option value="butt">Edge-Glue (Butt)</option>
                        </select>
                    </div>
                    {params.jointType !== 'butt' && renderInput('tenonSpacing', 'Joint Spacing (in)', 0.5, 2)}
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
