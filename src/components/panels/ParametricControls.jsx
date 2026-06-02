import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';

const ParametricControls = ({ groupId, meta }) => {
    const { buildCabinet, buildBox, buildShakerDoor, buildDrawers, setDrawerDialog, setCabinetDialog, setShakerDoorDialog, setShelvingDialog, gridSnap, units, generateSmartMeasurements, clearSmartMeasurements, measurements, groups } = useStore();
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

        const activeSmart = measurements.some(m => m.id.startsWith('smart_') && m.id.endsWith(groupId));
        if (activeSmart) {
            setTimeout(() => {
                const { generateSmartMeasurements } = useStore.getState();
                if (generateSmartMeasurements) generateSmartMeasurements(groupId);
            }, 0);
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
        const hasSmartMeas = measurements.some(m => m.id.startsWith('smart_') && m.id.endsWith(groupId));
        controls = (
            <>
                <button
                    className="primary-btn"
                    style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '10px 12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => {
                        if (setCabinetDialog) {
                            setCabinetDialog({
                                ...meta.params,
                                editGroupId: groupId
                            });
                        }
                    }}
                >
                    🗄️ Open Cabinet Builder Panel
                </button>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className="primary-btn"
                        onClick={() => generateSmartMeasurements(groupId)}
                        style={{
                            flex: 1, padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                            fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '4px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px'
                        }}
                    >
                        📐 Smart Measure
                    </button>
                    {hasSmartMeas && (
                        <button
                            className="nav-btn"
                            onClick={() => clearSmartMeasurements(groupId)}
                            style={{
                                padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '4px', background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '6px'
                            }}
                            title="Clear smart measurements"
                        >
                            🗑️ Clear
                        </button>
                    )}
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
        const hasSmartMeas = measurements.some(m => m.id.startsWith('smart_') && m.id.endsWith(groupId));
        controls = (
            <>
                <button
                    className="primary-btn"
                    style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '10px 12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => {
                        if (setShakerDoorDialog) {
                            setShakerDoorDialog({
                                ...meta.params,
                                editGroupId: groupId
                            });
                        }
                    }}
                >
                    🚪 Open Door Builder Panel
                </button>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className="primary-btn"
                        onClick={() => generateSmartMeasurements(groupId)}
                        style={{
                            flex: 1, padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                            fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '4px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px'
                        }}
                    >
                        📐 Smart Measure
                    </button>
                    {hasSmartMeas && (
                        <button
                            className="nav-btn"
                            onClick={() => clearSmartMeasurements(groupId)}
                            style={{
                                padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '4px', background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '6px'
                            }}
                            title="Clear smart measurements"
                        >
                            🗑️ Clear
                        </button>
                    )}
                </div>
            </>
        );
    } else if (meta.builder === 'drawerStack') {
        const hasSmartMeas = measurements.some(m => m.id.startsWith('smart_') && m.id.endsWith(groupId));
        controls = (
            <>
                <button
                    className="primary-btn"
                    style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '10px 12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => {
                        let updatedParams = { ...meta.params };
                        const parentId = groups[groupId]?.parentId;
                        const parentGroup = parentId ? groups[parentId] : null;
                        if (parentGroup && (parentGroup.meta?.builder === 'cabinet' || parentGroup.meta?.builder === 'box')) {
                            const parentParams = parentGroup.meta?.params || {};
                            const w = parseFloat(parentParams.width || 24);
                            const h = parseFloat(parentParams.height || 30);
                            const d = parseFloat(parentParams.depth || 14);
                            
                            let tSide = 0.75;
                            let tTB = 0.75;
                            let tBack = 0.25;
                            let tFront = 0.5;
                            
                            if (parentGroup.meta?.builder === 'cabinet') {
                                tSide = parseFloat(parentParams.thicknessSide || 0.75);
                                tTB = parseFloat(parentParams.thicknessTB || 0.75);
                                tBack = parseFloat(parentParams.thicknessBack || 0.25);
                                const cabCoreDepth = d - tBack;
                                
                                updatedParams.width = w - 2 * tSide;
                                updatedParams.height = h - 2 * tTB;
                                updatedParams.depth = cabCoreDepth;
                            } else {
                                tSide = parseFloat(parentParams.thicknessSide || 0.5);
                                tTB = parseFloat(parentParams.thicknessTB || 0.5);
                                tFront = parseFloat(parentParams.thicknessFront || 0.5);
                                tBack = parseFloat(parentParams.thicknessBack || 0.5);
                                
                                updatedParams.width = w - 2 * tSide;
                                updatedParams.height = h - 2 * tTB;
                                updatedParams.depth = d - tFront - tBack;
                            }
                        }
                        setDrawerDialog({
                            ...updatedParams,
                            editGroupId: groupId
                        });
                    }}
                >
                    🗃️ Open Drawer Builder Panel
                </button>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className="primary-btn"
                        onClick={() => generateSmartMeasurements(groupId)}
                        style={{
                            flex: 1, padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                            fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '4px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px'
                        }}
                    >
                        📐 Smart Measure
                    </button>
                    {hasSmartMeas && (
                        <button
                            className="nav-btn"
                            onClick={() => clearSmartMeasurements(groupId)}
                            style={{
                                padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '4px', background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '6px'
                            }}
                            title="Clear smart measurements"
                        >
                            🗑️ Clear
                        </button>
                    )}
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
        const hasSmartMeas = measurements.some(m => m.id.startsWith('smart_') && m.id.endsWith(groupId));
        const parentId = groups[groupId]?.parentId;
        const parentGroup = parentId ? groups[parentId] : null;
        const hasParent = parentGroup && (parentGroup.meta?.builder === 'cabinet' || parentGroup.meta?.builder === 'box');
        controls = (
            <>
                <button
                    className="primary-btn"
                    style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '10px 12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                    }}
                    onClick={() => {
                        if (setShelvingDialog) {
                            let updatedParams = { ...meta.params };
                            const parentId = groups[groupId]?.parentId;
                            const parentGroup = parentId ? groups[parentId] : null;
                            if (parentGroup && (parentGroup.meta?.builder === 'cabinet' || parentGroup.meta?.builder === 'box')) {
                                const parentParams = parentGroup.meta?.params || {};
                                const w = parseFloat(parentParams.width || 24);
                                const h = parseFloat(parentParams.height || 30);
                                const d = parseFloat(parentParams.depth || 14);
                                
                                let tSide = 0.75;
                                let tTB = 0.75;
                                let tBack = 0.25;
                                let tFront = 0.5;
                                
                                if (parentGroup.meta?.builder === 'cabinet') {
                                    tSide = parseFloat(parentParams.thicknessSide || 0.75);
                                    tTB = parseFloat(parentParams.thicknessTB || 0.75);
                                    tBack = parseFloat(parentParams.thicknessBack || 0.25);
                                    const cabCoreDepth = d - tBack;
                                    
                                    updatedParams.width = w - 2 * tSide;
                                    updatedParams.height = h - 2 * tTB;
                                    updatedParams.depth = cabCoreDepth;
                                } else {
                                    tSide = parseFloat(parentParams.thicknessSide || 0.5);
                                    tTB = parseFloat(parentParams.thicknessTB || 0.5);
                                    tFront = parseFloat(parentParams.thicknessFront || 0.5);
                                    tBack = parseFloat(parentParams.thicknessBack || 0.5);
                                    
                                    updatedParams.width = w - 2 * tSide;
                                    updatedParams.height = h - 2 * tTB;
                                    updatedParams.depth = d - tFront - tBack;
                                }
                            }
                            setShelvingDialog({
                                ...updatedParams,
                                editGroupId: groupId
                            });
                        }
                    }}
                >
                    📚 Open Shelving Builder Panel
                </button>
                {hasParent && (
                    <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Cumulative Measure Reference</div>
                        <select 
                            value={params.measureRef || 'top'} 
                            onChange={e => handleChange('measureRef', e.target.value)}
                            style={{ 
                                width: '100%', padding: '5px 8px', 
                                background: 'var(--bg-color)', color: 'var(--text-main)', 
                                border: '1px solid var(--border-color)', borderRadius: '6px', 
                                outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
                            }}
                        >
                            <option value="top">Top (Underside of Top)</option>
                            <option value="bottom">Bottom (Absolute / Floor)</option>
                            <option value="top-of-bottom">Top of Bottom (Inside Cabinet)</option>
                        </select>
                    </div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className="primary-btn"
                        onClick={() => generateSmartMeasurements(groupId)}
                        style={{
                            flex: 1, padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                            fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '4px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px'
                        }}
                    >
                        📐 Smart Measure
                    </button>
                    {hasSmartMeas && (
                        <button
                            className="nav-btn"
                            onClick={() => clearSmartMeasurements(groupId)}
                            style={{
                                padding: '8px 12px', fontWeight: 'bold', cursor: 'pointer',
                                fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '4px', background: 'rgba(255,59,48,0.15)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '6px'
                            }}
                            title="Clear smart measurements"
                        >
                            🗑️ Clear
                        </button>
                    )}
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
