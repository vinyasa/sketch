import React from 'react';
import useStore from '../../store/useStore';
import { collectChildBoards } from '../../utils/sceneGraph';
import { parseNum } from '../../utils/units';

const TableTopBuilderDialog = () => {
    const { tableTopDialog: dialog, setTableTopDialog: setDialog, buildTableTop, boards, groups } = useStore();
    if (!dialog) return null;

    const boardWidth = parseNum(dialog.boardWidth, 5.5);
    const thickness = parseNum(dialog.thickness, 1.0);
    const widthOverhang = parseNum(dialog.widthOverhang, 2.0);
    const depthOverhang = parseNum(dialog.depthOverhang, 2.0);
    const tenonSpacing = parseNum(dialog.tenonSpacing, 10.0);
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

    const W = hasBase ? (baseWidth + 2 * widthOverhang) : parseNum(dialog.width, 52);
    const D = hasBase ? (baseDepth + 2 * depthOverhang) : parseNum(dialog.depth, 34);

    const valid = boardWidth > 0 && thickness > 0 && W > 0 && D > 0;

    // Helper to format fraction nicely
    const formatFraction = (val) => {
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
    const slatCount = valid ? Math.max(1, Math.round(D / boardWidth)) : 0;
    const adjSlatWidth = valid ? D / slatCount : 0;
    const isPerfectFit = valid ? Math.abs(adjSlatWidth - boardWidth) < 0.015 : false;

    // Generate suggestions close to current slat count
    const suggestions = [];
    if (valid) {
        const countsToTry = [slatCount - 2, slatCount - 1, slatCount, slatCount + 1, slatCount + 2];
        const seen = new Set();
        countsToTry.forEach(n => {
            if (n <= 0) return;
            const w = D / n;
            const nearest16 = Math.round(w * 16) / 16;
            const diff = Math.abs(w - nearest16);
            const isClean = diff < 0.005;
            const isStandard = Math.abs(w - Math.round(w * 4) / 4) < 0.005;
            
            if (!seen.has(n)) {
                seen.add(n);
                suggestions.push({
                    slatCount: n,
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
                            <div style={labelStyle}>Slat Width (in)</div>
                            <input type="number" step="0.125" min="2" value={boardWidth}
                                onChange={e => setDialog(p => ({ ...p, boardWidth: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Top Thickness (in)</div>
                            <input type="number" step="0.125" min="0.5" value={thickness}
                                onChange={e => setDialog(p => ({ ...p, thickness: e.target.value }))}
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
                                `Your chosen ${boardWidth.toFixed(2)}" slat width divides the overall ${D.toFixed(2)}" depth perfectly into exactly ${slatCount} boards!`
                            ) : (
                                <span>
                                    A <strong>{boardWidth.toFixed(2)}"</strong> board width does not divide the overall <strong>{D.toFixed(2)}"</strong> depth evenly.
                                    The builder will adjust each of the <strong>{slatCount}</strong> boards to <strong>{formatFraction(adjSlatWidth)}</strong> ({adjSlatWidth.toFixed(3)}") to fit perfectly.
                                </span>
                            )}
                        </p>

                        <div style={{ fontSize: '0.68rem', color: 'var(--text-main)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Click a perfect-fit width for a {D.toFixed(2)}" depth:
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
                                                setDialog(p => ({ ...p, boardWidth: s.width.toFixed(3) }));
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
                                            title={`Set board width to ${s.width.toFixed(3)}"`}
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
                                ⭐ Standard 1/4" increments
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
                                <div style={labelStyle}>Width Overhang (X)</div>
                                <input type="number" step="0.125" min="0" value={widthOverhang}
                                    onChange={e => setDialog(p => ({ ...p, widthOverhang: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <div style={labelStyle}>Depth Overhang (Z)</div>
                                <input type="number" step="0.125" min="0" value={depthOverhang}
                                    onChange={e => setDialog(p => ({ ...p, depthOverhang: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={labelStyle}>Total Width (X in)</div>
                                <input type="number" step="0.125" min="6" value={W}
                                    onChange={e => setDialog(p => ({ ...p, width: e.target.value }))}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <div style={labelStyle}>Total Depth (Z in)</div>
                                <input type="number" step="0.125" min="6" value={D}
                                    onChange={e => setDialog(p => ({ ...p, depth: e.target.value }))}
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
                                            <div style={labelStyle}>Fastener Spacing (in)</div>
                                            <input type="number" step="0.5" min="2" max="36" value={tenonSpacing}
                                                onChange={e => setDialog(p => ({ ...p, tenonSpacing: e.target.value }))}
                                                style={inputStyle} />
                                        </div>
                                    )}
                                </div>
                                {(jointType === 'loose-tenon' || jointType === 'dowels') && valid && (
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Produces <strong>{dynamicTenonCount}</strong> {jointType === 'loose-tenon' ? 'tenons' : 'dowels'} per joint based on the {slatLength.toFixed(2)}" slat length.
                                    </div>
                                )}
                            </div>

                            {/* Top Summary Feedback */}
                            <div className="inspector-card" style={{ margin: 0, background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)', border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)' }}>
                                <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>{valid ? '✓ Table Top Summary' : '⚠ Invalid Configuration'}</h4>
                                {valid ? (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                        <div><strong>Overall Size:</strong> {W.toFixed(2)}" Wide × {D.toFixed(2)}" Deep</div>
                                        <div><strong>Thickness:</strong> {thickness}" stock</div>
                                        <div><strong>Joinery:</strong> {jointType === 'loose-tenon' ? `Loose tenons (Dominoes) × ${dynamicTenonCount} (spaced every ${tenonSpacing}")` : jointType === 'dowels' ? `Dowel pins × ${dynamicTenonCount} (spaced every ${tenonSpacing}")` : 'Standard edge-glue'}</div>
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
