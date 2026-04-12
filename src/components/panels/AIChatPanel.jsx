import React from 'react';

import useStore from '../../store/useStore';

const AIChatPanel = () => {
    const { chatMessages, chatInput, setChatInput, submitChat } = useStore();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="chat-window" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {chatMessages.map((m, i) => (
                    <div key={i} className={`chat-message ${m.role}`} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? 'var(--bg-color)' : 'rgba(188, 138, 95, 0.1)',
                        borderLeft: m.role === 'user' ? 'none' : '3px solid var(--accent-color)',
                        borderRight: m.role === 'user' ? '3px solid var(--text-muted)' : 'none',
                        maxWidth: '85%',
                        padding: '6px 10px',
                        fontSize: '0.75rem'
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
