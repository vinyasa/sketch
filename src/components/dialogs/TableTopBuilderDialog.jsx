import React from 'react';
import useStore from '../../store/useStore';
import { collectChildBoards } from '../../utils/sceneGraph';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const TableTopBuilderDialog = () => {
    const { tableTopDialog: dialog, setTableTopDialog: setDialog, buildTableTop, boards, groups, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const boardWidth_in = parseNum(dialog.boardWidth, 5.5);
    const thickness_in = parseNum(dialog.thickness, 1.0);
    const widthOverhang_in = parseNum(dialog.widthOverhang, 2.0);
    const depthOverhang_in = parseNum(dialog.depthOverhang, 2.0);
    const tenonSpacing_in = parseNum(dialog.tenonSpacing, 10.0);
    const jointType = dialog.jointType || 'loose-tenon';

    // Scan for base group to determine dimensions feedback
    let hasBase = false;
    let baseWidth = 48;
    let baseDepth = 30;
    const baseGroupId = Object.keys(groups).find(gid => groups[gid].meta?.builder === 'table-base');
    if (baseGroupId) {
        const baseBoards = collectChildBoards(baseGroupId, boards, groups);
        if (baseBoards.length > 0) {
            hasBase = true;
            // Get sizing directly for visual feedback
            const xCoords = baseBoards.flatMap(b => [b.position[0] - b.size[0]/2, b.position[0] + b.size[0]/2]);
            const zCoords = baseBoards.flatMap(b => [b.position[2] - b.size[2]/2, b.position[2] + b.size[2]/2]);
            baseWidth = Math.max(...xCoords) - Math.min(...xCoords);
            baseDepth = Math.max(...zCoords) - Math.min(...zCoords);
        }
    }

    const W_in = hasBase ? (baseWidth + 2 * widthOverhang_in) : parseNum(dialog.width, 52);
    const D_in = hasBase ? (baseDepth + 2 * depthOverhang_in) : parseNum(dialog.depth, 34);

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const D = isMetric ? parseFloat((D_in * 25.4).toFixed(1)) : D_in;
    const boardWidth = isMetric ? parseFloat((boardWidth_in * 25.4).toFixed(1)) : boardWidth_in;
    const thickness = isMetric ? parseFloat((thickness_in * 25.4).toFixed(1)) : thickness_in;
    const widthOverhang = isMetric ? parseFloat((widthOverhang_in * 25.4).toFixed(1)) : widthOverhang_in;
    const depthOverhang = isMetric ? parseFloat((depthOverhang_in * 25.4).toFixed(1)) : depthOverhang_in;
    const tenonSpacing = isMetric ? parseFloat((tenonSpacing_in * 25.4).toFixed(1)) : tenonSpacing_in;

    const valid = boardWidth_in > 0 && thickness_in > 0 && W_in > 0 && D_in > 0;

    // Helper to format fraction nicely
    const formatFraction = (val) => {
        if (isMetric) {
            return `${val.toFixed(1)}mm`;
        }
        const whole = Math.floor(val);
        const frac = val - whole;
        if (frac < 0.005) return `${whole}"`;
        // Find closest 16th
        const sixteenths = Math.round(frac * 16);
        if (sixteenths === 16) return `${whole + 1}"`;
        if (sixteenths === 0) return `${whole}"`;
        
        let num = sixteenths;
        let den = 16;
        const gcd = (a, b) => b ? gcd(b, a % b) : a;
        const divisor = gcd(num, den);
        num /= divisor;
        den /= divisor;
        
        return whole > 0 ? `${whole}-${num}/${den}"` : `${num}/${den}"`;
    };

    // Calculate slat count and actual adjusted slat width
    const slatCount = valid ? Math.max(1, Math.round(D_in / boardWidth_in)) : 0;
    const adjSlatWidth_in = valid ? D_in / slatCount : 0;
    const adjSlatWidth = isMetric ? adjSlatWidth_in * 25.4 : adjSlatWidth_in;
    const isPerfectFit = valid ? Math.abs(adjSlatWidth_in - boardWidth_in) < 0.015 : false;

    // Generate suggestions close to current slat count
    const suggestions = [];
    if (valid) {
        const countsToTry = [slatCount - 2, slatCount - 1, slatCount, slatCount + 1, slatCount + 2];
        const seen = new Set();
        countsToTry.forEach(n => {
            if (n <= 0) return;
            const w_in = D_in / n;
            const w = isMetric ? w_in * 25.4 : w_in;
            const nearestMetric = Math.round(w);
            const nearestImperial = Math.round(w_in * 16) / 16;
            const diff = isMetric ? Math.abs(w - nearestMetric) : Math.abs(w_in - nearestImperial);
            const isClean = isMetric ? diff < 0.1 : diff < 0.005;
            const isStandard = isMetric ? Math.abs(w - Math.round(w / 5) * 5) < 0.1 : Math.abs(w_in - Math.round(w_in * 4) / 4) < 0.005;
            
            if (!seen.has(n)) {
                seen.add(n);
                suggestions.push({
                    slatCount: n,
                    width_in: w_in,
                    width: w,
                    formatted: formatFraction(w),
                    isClean,
                    isStandard,
                    isSelected: n === slatCount
                });
            }
        });
    }

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const selectStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem', cursor: 'pointer'
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const unitFmtLabel = isMetric ? 'mm' : 'in';
    const unitLabel = isMetric ? 'mm' : '"';
    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : (isMetric ? 1 : 3));

    const handleBuild = () => {
        if (!valid) return;
        if (buildTableTop) buildTableTop(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '450px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>➖</span> Table Top Builder
                </h2>

                {/* Base Detection Banner */}
                {hasBase ? (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px dashed rgba(52, 199, 89, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                        lineHeight: 1.4
                    }}>
                        <strong>✓ Active Table Base Group Detected</strong><br/>
                        Top will align exactly on top of the base at origin X/Z. Dimensions are computed automatically using your overhang offsets below.
                    </div>
                ) : (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Table Base detected in Workspace.</strong><br/>
                        Building a standalone top. You can input custom width/depth dimensions directly below.
                    </div>
                )}

                {/* Slats Configuration */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Slat Sizing</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Slat Width ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "5" : "0.125"} min={isMetric ? "50" : "2"} value={boardWidth}
                                onChange={val => setDialog(p => ({ ...p, boardWidth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Top Thickness ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.125"} min={isMetric ? "10" : "0.5"} value={thickness}
                                onChange={val => setDialog(p => ({ ...p, thickness: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* 📏 Slat Fit Guidance */}
                {valid && (
                    <div className="inspector-card" style={{
                        margin: 0,
                        border: isPerfectFit ? '1px dashed rgba(52, 199, 89, 0.4)' : '1px dashed rgba(255, 149, 0, 0.4)',
                        background: isPerfectFit ? 'rgba(52, 199, 89, 0.03)' : 'rgba(255, 149, 0, 0.03)',
                        padding: '12px',
                        borderRadius: '8px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1rem' }}>{isPerfectFit ? '✨' : '⚠️'}</span>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', color: isPerfectFit ? '#34c759' : '#ff9500' }}>
                                {isPerfectFit ? 'Perfect Slat Width Alignment!' : 'Slat Width Adjustment Required'}
                            </h4>
                        </div>

                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 10px 0' }}>
                            {isPerfectFit ? (
                                `Your chosen ${fmt(boardWidth)}${unitLabel} slat width divides the overall ${fmt(D)}${unitLabel} depth perfectly into exactly ${slatCount} boards!`
                            ) : (
                                <span>
                                    A <strong>{fmt(boardWidth)}{unitLabel}</strong> board width does not divide the overall <strong>{fmt(D)}{unitLabel}</strong> depth evenly.
                                    The builder will adjust each of the <strong>{slatCount}</strong> boards to <strong>{formatFraction(adjSlatWidth)}</strong> ({fmt(adjSlatWidth)}{unitLabel}) to fit perfectly.
                                </span>
                            )}
                        </p>

                        <div style={{ fontSize: '0.68rem', color: 'var(--text-main)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Click a perfect-fit width for a {fmt(D)}{unitLabel} depth:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {suggestions.map(s => {
                                    const borderStyle = s.isSelected
                                        ? (isPerfectFit ? '1px solid #34c759' : '1px solid #ff9500')
                                        : '1px solid var(--border-color)';
                                    const bgStyle = s.isSelected
                                        ? (isPerfectFit ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 149, 0, 0.15)')
                                        : 'rgba(255, 255, 255, 0.02)';
                                    const colorStyle = s.isSelected
                                        ? (isPerfectFit ? '#34c759' : '#ff9500')
                                        : 'var(--text-main)';

                                    return (
                                        <div
                                            key={s.slatCount}
                                            onClick={() => {
                                                setDialog(p => ({ ...p, boardWidth: s.width_in.toFixed(4) }));
                                            }}
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: borderStyle,
                                                background: bgStyle,
                                                color: colorStyle,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                transition: 'all 0.1s ease',
                                                flex: '1 0 30%',
                                            }}
                                            title={`Set board width to ${fmt(s.width)}${unitLabel}`}
                                        >
                                            <span style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                                                {s.formatted} {s.isStandard && '⭐'}
                                            </span>
                                            <span style={{ fontSize: '0.58rem', opacity: 0.8 }}>
                                                {s.slatCount} slats
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                                {isMetric ? '⭐ Standard 5mm increments' : '⭐ Standard 1/4" increments'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Overhangs or Standalone sizes */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Dimensions & Overhangs</h4>
                    {hasBase ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={labelStyle}>Width Overhang ({unitFmtLabel})</div>
                                <NumericInput step={isMetric ? "5" : "0.125"} min="0" value={widthOverhang}
                                    onChange={val => setDialog(p => ({ ...p, widthOverhang: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <div style={labelStyle}>Depth Overhang ({unitFmtLabel})</div>
                                <NumericInput step={isMetric ? "5" : "0.125"} min="0" value={depthOverhang}
                                    onChange={val => setDialog(p => ({ ...p, depthOverhang: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={labelStyle}>Total Width ({unitFmtLabel})</div>
                                <NumericInput step={isMetric ? "10" : "0.125"} min="6" value={W}
                                    onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <div style={labelStyle}>Total Depth ({unitFmtLabel})</div>
                                <NumericInput step={isMetric ? "10" : "0.125"} min="6" value={D}
                                    onChange={val => setDialog(p => ({ ...p, depth: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Joinery Details */}
                {(() => {
                    const slatLength = W;
                    const dynamicTenonCount = Math.max(1, Math.floor(slatLength / tenonSpacing));
                    return (
                        <>
                            <div className="inspector-card" style={{ margin: 0 }}>
                                <h4>Woodworking Details</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <div style={labelStyle}>Mating Edge Joint</div>
                                        <select value={jointType}
                                            onChange={e => setDialog(p => ({ ...p, jointType: e.target.value }))}
                                            style={selectStyle}>
                                            <option value="loose-tenon">Virtual Loose Tenon Glue-up</option>
                                            <option value="dowels">Dowel Pins Glue-up</option>
                                            <option value="butt">Standard Flush Slat Edge-Glue</option>
                                        </select>
                                    </div>
                                    {(jointType === 'loose-tenon' || jointType === 'dowels') && (
                                        <div>
                                            <div style={labelStyle}>Fastener Spacing ({unitFmtLabel})</div>
                                            <NumericInput step={isMetric ? "50" : "0.5"} min={isMetric ? "50" : "2"} max={isMetric ? "900" : "36"} value={tenonSpacing}
                                                onChange={val => setDialog(p => ({ ...p, tenonSpacing: isMetric ? val / 25.4 : val }))}
                                                style={inputStyle} />
                                        </div>
                                    )}
                                </div>
                                {(jointType === 'loose-tenon' || jointType === 'dowels') && valid && (
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Produces <strong>{dynamicTenonCount}</strong> {jointType === 'loose-tenon' ? 'tenons' : 'dowels'} per joint based on the {fmt(slatLength)}{unitLabel} slat length.
                                    </div>
                                )}
                            </div>

                            {/* Top Summary Feedback */}
                            <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                                <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Table Top Summary' : '⚠ Invalid Configuration'}</h4>
                                {valid ? (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                        <div><strong>Overall Size:</strong> {fmt(W)}{unitLabel} Wide × {fmt(D)}{unitLabel} Deep</div>
                                        <div><strong>Thickness:</strong> {fmt(thickness)}{unitLabel} stock</div>
                                        <div><strong>Joinery:</strong> {jointType === 'loose-tenon' ? `Loose tenons (Dominoes) × ${dynamicTenonCount} (spaced every ${fmt(tenonSpacing)}${unitLabel})` : jointType === 'dowels' ? `Dowel pins × ${dynamicTenonCount} (spaced every ${fmt(tenonSpacing)}${unitLabel})` : 'Standard edge-glue'}</div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                                        Adjust slats and dimensions to generate valid board listings.
                                    </div>
                                )}
                            </div>
                        </>
                    );
                })()}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="nav-btn" style={{ flex: 1, padding: '10px' }}
                        onClick={() => setDialog(null)}>
                        Cancel
                    </button>
                    <button className="primary-btn" style={{
                        flex: 1, padding: '10px',
                        opacity: valid ? 1 : 0.4,
                        cursor: valid ? 'pointer' : 'default',
                    }}
                        disabled={!valid}
                        onClick={handleBuild}>
                        ➖ Build Table Top
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableTopBuilderDialog;
