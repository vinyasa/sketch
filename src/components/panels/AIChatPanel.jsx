import React from 'react';
import useStore from '../../store/useStore';

const AIChatPanel = () => {
    const { chatMessages, chatInput, setChatInput, submitChat, aiEngine, setAiEngine } = useStore();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Engine Toggle */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginBottom: '10px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '8px' }}>
                <button
                    onClick={() => setAiEngine('si')}
                    style={{
                        flex: 1, padding: '4px 8px', fontSize: '0.65rem', fontWeight: aiEngine === 'si' ? 'bold' : 'normal',
                        border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                        background: aiEngine === 'si' ? 'var(--bg-color)' : 'transparent',
                        color: aiEngine === 'si' ? 'var(--text-main)' : 'var(--text-muted)',
                        boxShadow: aiEngine === 'si' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: aiEngine === 'si' ? '#34c759' : 'transparent' }} />
                        <span>SI Engine ⚡</span>
                    </div>
                    <span style={{ fontSize: '0.5rem', opacity: 0.7, marginTop: '1px', fontWeight: 'normal' }}>(Slightly Intelligent)</span>
                </button>
                <button
                    onClick={() => setAiEngine('ai')}
                    style={{
                        flex: 1, padding: '4px 8px', fontSize: '0.65rem', fontWeight: aiEngine === 'ai' ? 'bold' : 'normal',
                        border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                        background: aiEngine === 'ai' ? 'var(--bg-color)' : 'transparent',
                        color: aiEngine === 'ai' ? 'var(--text-main)' : 'var(--text-muted)',
                        boxShadow: aiEngine === 'ai' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: aiEngine === 'ai' ? '#0a84ff' : 'transparent' }} />
                        <span>AI Engine 🧠</span>
                    </div>
                    <span style={{ fontSize: '0.5rem', opacity: 0.7, marginTop: '1px', fontWeight: 'normal' }}>(Artificially Intelligent)</span>
                </button>
            </div>

            <div className="chat-window" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {chatMessages.map((m, i) => (
                    <div key={i} className={`chat-message ${m.role}`} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? 'var(--bg-color)' : 'rgba(188, 138, 95, 0.1)',
                        borderLeft: m.role === 'user' ? 'none' : '3px solid var(--accent-color)',
                        borderRight: m.role === 'user' ? '3px solid var(--text-muted)' : 'none',
                        maxWidth: '85%',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        opacity: m.isThinking ? 0.7 : 1,
                        animation: m.isThinking ? 'pulse 1.5s infinite' : 'none'
                    }}>
                        {m.text}
                    </div>
                ))}
            </div>
            <div className="chat-input-wrapper">
                <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitChat()}
                    placeholder="e.g. Move the top up 1 inch"
                    style={{ fontSize: '0.75rem', padding: '8px 10px' }}
                />
            </div>
        </div>
    );
};

export default AIChatPanel;
