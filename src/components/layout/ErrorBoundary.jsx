import React from 'react';

/**
 * Error Boundary — catches JS errors in the component tree below and 
 * shows a friendly recovery UI instead of unmounting everything.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    background: 'var(--bg-color, #0d0f12)', color: 'var(--text-main, #f0f0f0)',
                    zIndex: 9999, gap: '16px', fontFamily: 'Inter, Roboto, sans-serif',
                }}>
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <h2 style={{ margin: 0, color: '#bc8a5f' }}>Something went wrong</h2>
                    <p style={{ fontSize: '0.85rem', color: '#8892b0', maxWidth: '400px', textAlign: 'center', lineHeight: 1.5 }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            style={{
                                padding: '8px 20px', borderRadius: '6px', border: '1px solid #bc8a5f',
                                background: 'rgba(188,138,95,0.15)', color: '#bc8a5f',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                            }}
                            onClick={() => this.setState({ hasError: false, error: null })}
                        >
                            Retry
                        </button>
                        <button
                            style={{
                                padding: '8px 20px', borderRadius: '6px', border: '1px solid rgba(255,59,48,0.4)',
                                background: 'rgba(255,59,48,0.1)', color: '#ff3b30',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                            }}
                            onClick={() => {
                                localStorage.removeItem('lucey_save');
                                window.location.reload();
                            }}
                        >
                            Reset & Reload
                        </button>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '8px' }}>
                        "Reset & Reload" clears saved data and starts fresh.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
