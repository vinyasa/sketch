import React, { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';

const TutorialRecorderPanel = () => {
    const {
        isRecording,
        recordedSteps,
        startRecording,
        stopRecording,
        clearRecordedSteps,
        showToast
    } = useStore();

    const scrollRef = useRef(null);

    // Auto-scroll to bottom of steps list when a new step is added
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [recordedSteps]);

    const handleCopy = () => {
        if (recordedSteps.length === 0) {
            showToast('⚠️ No steps recorded yet!');
            return;
        }

        // Format as an ordered markdown list
        const formatted = recordedSteps
            .map((step, idx) => `${idx + 1}.  ${step}`)
            .join('\n\n');

        navigator.clipboard.writeText(formatted);
        showToast('📋 Copied tutorial steps to clipboard!');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', color: 'var(--text-main)' }}>
            
            {/* Header / Recording Status Banner */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px', border: '1px solid var(--border-color)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isRecording ? (
                        <>
                            <span className="rec-dot-pulse" style={{
                                width: '10px', height: '10px', background: '#ff3b30', borderRadius: '50%',
                                display: 'inline-block', boxShadow: '0 0 8px #ff3b30'
                            }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ff3b30' }}>RECORDING STEP ACTIVE</span>
                        </>
                    ) : (
                        <>
                            <span style={{ width: '10px', height: '10px', background: 'var(--text-muted)', borderRadius: '50%', display: 'inline-block' }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Recorder Idle</span>
                        </>
                    )}
                </div>
                
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {recordedSteps.length} step{recordedSteps.length !== 1 ? 's' : ''} logged
                </span>
            </div>

            {/* Steps Container */}
            <div 
                ref={scrollRef}
                style={{
                    flex: 1, overflowY: 'auto', maxHeight: '350px', minHeight: '180px',
                    background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
                }}
            >
                {recordedSteps.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '8px', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '20px'
                    }}>
                        <span style={{ fontSize: '1.8rem' }}>🔴</span>
                        <span style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                            Click <strong>Start Recording</strong>, then design inside the viewport. Every sizing edit, board addition, or floor snap will be written down automatically.
                        </span>
                    </div>
                ) : (
                    recordedSteps.map((step, idx) => (
                        <div 
                            key={idx}
                            style={{
                                display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px',
                                padding: '8px 10px', animation: 'fadeIn 0.25s ease-out'
                            }}
                        >
                            <span style={{
                                flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                                background: 'rgba(188, 138, 95, 0.15)', color: 'var(--accent-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.72rem', fontWeight: 'bold'
                            }}>
                                {idx + 1}
                            </span>
                            <div 
                                style={{ fontSize: '0.78rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}
                                dangerouslySetInnerHTML={{ 
                                    __html: step
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                        .replace(/`(.*?)`/g, '<code style="background: rgba(188,138,95,0.12); color: var(--accent-color); padding: 1px 4px; borderRadius: 4px; font-size: 0.72rem">$1</code>')
                                }}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {isRecording ? (
                    <button 
                        className="nav-btn"
                        style={{
                            padding: '8px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer',
                            background: 'rgba(255, 59, 48, 0.1)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)'
                        }}
                        onClick={stopRecording}
                    >
                        ⏹ Stop Recording
                    </button>
                ) : (
                    <button 
                        className="primary-btn"
                        style={{ padding: '8px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={startRecording}
                    >
                        🔴 Start Recording
                    </button>
                )}

                <button 
                    className="primary-btn"
                    style={{
                        padding: '8px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer',
                        background: 'var(--accent-color)', color: '#fff', border: 'none'
                    }}
                    onClick={handleCopy}
                    disabled={recordedSteps.length === 0}
                >
                    📋 Copy Markdown
                </button>

                {recordedSteps.length > 0 && (
                    <button 
                        className="nav-btn"
                        style={{
                            gridColumn: '1 / -1', padding: '6px', fontSize: '0.72rem', cursor: 'pointer',
                            borderColor: 'var(--border-color)', color: 'var(--text-muted)'
                        }}
                        onClick={clearRecordedSteps}
                    >
                        🗑️ Clear Recorded Steps
                    </button>
                )}
            </div>

            <p className="hint" style={{ fontSize: '0.65rem', textAlign: 'center', marginTop: '2px' }}>
                Open woodshop files, add joints, drop items to floor. Once completed, copy steps and paste directly into `user_manual.md`.
            </p>
        </div>
    );
};

export default TutorialRecorderPanel;
