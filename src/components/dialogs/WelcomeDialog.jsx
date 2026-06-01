import React, { useState, useEffect } from 'react';

const WelcomeDialog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [welcomeText, setWelcomeText] = useState('');

    useEffect(() => {
        const hasSeen = localStorage.getItem('lucey_welcome_seen');
        if (!hasSeen) {
            setIsOpen(true);
        }

        // Fetch welcome.txt dynamically from the server
        fetch('./welcome.txt')
            .then(res => {
                if (!res.ok) throw new Error('File not found');
                return res.text();
            })
            .then(text => {
                if (text && text.trim()) {
                    setWelcomeText(text.trim());
                }
            })
            .catch(() => {
                // Fallback to the standard default message if welcome.txt is missing or offline
                setWelcomeText(
                    `Welcome to Luceysketch. This is a clean woodworking canvas where you can design your own furniture. We recommend opening the **Builders panel** (🧱 icon in the header) to generate a Table, Cabinet, Shaker Door, drawer, or shelving unit in one click to jump right in and experiment!\n\nThere is also a User's Guide toward the bottom of the Settings Panel. I recommend you take a look at that. There is a five or ten minute starter project that helps show you some of the features of Luceysketch.\n\nThis software is a project of love, made open source, with no ads, no tracking, and completely free from one woodworker to another. It is brand new, probably full of bugs, but with the help of the woodworking community, I hope it can continue to improve. Have fun.`
                );
            });
    }, []);

    const handleClose = () => {
        localStorage.setItem('lucey_welcome_seen', 'true');
        setIsOpen(false);
    };

    const parseText = (str) => {
        // Simple inline parser for bold **text** markdown
        const parts = str.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    if (!isOpen || !welcomeText) return null;

    return (
        <div 
            className="app-overlay" 
            style={{ 
                background: 'rgba(0, 0, 0, 0.7)', 
                zIndex: 15000, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                position: 'fixed', 
                inset: 0,
                padding: '20px',
                pointerEvents: 'auto'
            }}
            onClick={handleClose}
        >
            <div 
                className="glass-panel" 
                style={{ 
                    padding: '32px', 
                    maxWidth: '550px', 
                    width: '100%', 
                    borderRadius: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    color: 'var(--text-main)', 
                    gap: '24px', 
                    border: '1px solid var(--border-color)', 
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)', 
                    background: 'var(--panel-bg)',
                    position: 'relative',
                    animation: 'fadeIn 0.3s ease-out'
                }} 
                onClick={e => e.stopPropagation()}
            >
                {/* Accent line */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, var(--accent-color) 0%, #ff5100 100%)',
                    borderRadius: '16px 16px 0 0'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '2rem' }}>🪵</span>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                        Welcome to Luceysketch
                    </h2>
                </div>

                <div style={{ 
                    fontSize: '0.92rem', 
                    lineHeight: '1.65', 
                    color: 'var(--text-main)', 
                    opacity: 0.95,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {welcomeText.split(/\n\s*\n/).map((para, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        if (isLast) {
                            return (
                                <p key={idx} style={{ margin: 0, fontStyle: 'italic', background: 'rgba(188, 138, 95, 0.05)', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid var(--accent-color)' }}>
                                    {parseText(para)}
                                </p>
                            );
                        }
                        return (
                            <p key={idx} style={{ margin: 0 }}>
                                {parseText(para)}
                            </p>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button 
                        className="nav-btn primary" 
                        style={{ 
                            padding: '10px 28px', 
                            background: 'var(--accent-color)', 
                            color: '#fff', 
                            border: 'none', 
                            fontWeight: 'bold', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(188, 138, 95, 0.25)'
                        }} 
                        onClick={handleClose}
                    >
                        Let's Go!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WelcomeDialog;
