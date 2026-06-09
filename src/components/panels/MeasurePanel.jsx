import React, { useEffect, useState } from 'react';
import useStore from '../../store/useStore';

const MeasurePanel = () => {
    const {
        measureMode,
        setMeasureMode,
        units,
        setUnits,
        imperialFormat,
        setImperialFormat,
        measureFaceAnglesActive,
        setMeasureFaceAnglesActive,
        selectedFaces,
        clearFaceSelection,
    } = useStore();

    const [systemExpanded, setSystemExpanded] = useState(false);
    const [formatExpanded, setFormatExpanded] = useState(false);

    useEffect(() => {
        setMeasureMode({ active: true, firstPoint: null });
        return () => {
            setMeasureMode(null);
            setMeasureFaceAnglesActive(false);
            clearFaceSelection();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const labelStyle = {
        fontSize: '0.64rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--accent-color, #ff7a00)',
        display: 'block',
        marginBottom: '4px',
    };

    const selectStyle = {
        width: '100%',
        padding: '4px 8px',
        background: 'var(--bg-color, #1a1a1a)',
        color: 'var(--text-main, #ffffff)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
        borderRadius: '6px',
        outline: 'none',
        fontSize: '0.72rem',
        cursor: 'pointer',
    };

    const optionStyle = {
        background: 'var(--menu-bg, #0d0f12)',
        color: 'var(--text-main, #f0f0f0)',
    };

    const hintStyle = {
        fontSize: '0.62rem',
        color: 'var(--text-muted, #888)',
        marginTop: '4px',
        lineHeight: '1.3',
    };

    const isMeasureOn = !!measureMode?.active;

    const handleToggleMeasure = () => {
        if (isMeasureOn) {
            setMeasureMode(null);
        } else {
            setMeasureMode({ active: true, firstPoint: null });
            setMeasureFaceAnglesActive(false);
            clearFaceSelection();
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px',
            color: 'var(--text-main)'
        }}>
            <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Measure Tool</label>
                <button
                    id="measure-toggle-button"
                    onClick={handleToggleMeasure}
                    style={{
                        width: '100%',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isMeasureOn ? '#30d158' : '#ff453a', // Rich green / red
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, transform 0.1s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                >
                    <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 0 6px #ffffff',
                        display: 'inline-block',
                    }} />
                    {isMeasureOn ? 'ON' : 'OFF'}
                </button>
                <p className="hint" style={hintStyle}>
                    Click points in the viewport to measure distances.
                </p>
            </div>

            <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                <div 
                    onClick={() => setSystemExpanded(!systemExpanded)}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }} htmlFor="measure-panel-units-select">Measurement System</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>{units === 'imperial' ? 'Imperial' : 'Metric'}</span>
                        <span style={{ fontSize: '0.6rem' }}>{systemExpanded ? '⏷' : '⏵'}</span>
                    </div>
                </div>
                {systemExpanded && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <select 
                            id="measure-panel-units-select"
                            value={units} 
                            onChange={(e) => setUnits(e.target.value)} 
                            style={selectStyle}
                        >
                            <option value="imperial" style={optionStyle}>Imperial (Inches)</option>
                            <option value="metric" style={optionStyle}>Metric (Millimeters)</option>
                        </select>
                        <p className="hint" style={hintStyle}>
                            Toggle standard imperial inches vs metric millimeters.
                        </p>
                    </div>
                )}
            </div>

            {units === 'imperial' && (
                <div className="inspector-card" style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div 
                        onClick={() => setFormatExpanded(!formatExpanded)}
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }} htmlFor="imperial-format-select">Display Format</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span>{imperialFormat === 'fraction' ? 'Fraction' : 'Decimal'}</span>
                            <span style={{ fontSize: '0.6rem' }}>{formatExpanded ? '⏷' : '⏵'}</span>
                        </div>
                    </div>
                    {formatExpanded && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <select 
                                id="imperial-format-select"
                                value={imperialFormat} 
                                onChange={(e) => setImperialFormat(e.target.value)} 
                                style={selectStyle}
                            >
                                <option value="fraction" style={optionStyle}>Fraction (e.g. 2 3/4")</option>
                                <option value="decimal" style={optionStyle}>Decimal (e.g. 2.75")</option>
                            </select>
                            <p className="hint" style={hintStyle}>
                                Choose how imperial dimensions are formatted in the workspace.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MeasurePanel;
