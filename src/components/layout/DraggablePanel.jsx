import React, { useState, useRef, useEffect } from 'react';
import { registerPanel, updatePanel, unregisterPanel } from '../../utils/panelLayout';

const DraggablePanel = ({ title, defaultPosition, onFocusCapture, onClose, children, defaultSize = { width: 250 } }) => {
    const [pos, setPos] = useState(defaultPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const panelRef = useRef(null);
    const registryId = useRef(null);

    // Register on mount, unregister on unmount
    useEffect(() => {
        registryId.current = registerPanel(
            defaultPosition.x, defaultPosition.y,
            defaultSize.width, 400 // height estimate
        );
        return () => {
            if (registryId.current !== null) unregisterPanel(registryId.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep registry in sync whenever position changes
    useEffect(() => {
        if (registryId.current !== null && panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect();
            updatePanel(registryId.current, pos.x, pos.y, rect.width || defaultSize.width, rect.height || 400);
        }
    }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const clampToViewport = () => {
            if (!panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();

            setPos(currentPos => {
                let newX = currentPos.x;
                let newY = currentPos.y;

                if (newX + rect.width > window.innerWidth)  newX = window.innerWidth  - rect.width;
                if (newX < 0) newX = 0;

                if (newY + rect.height > window.innerHeight) newY = window.innerHeight - rect.height;
                if (newY < 0) newY = 0;

                if (newX !== currentPos.x || newY !== currentPos.y) return { x: newX, y: newY };
                return currentPos;
            });
        };

        // Clamp on window resize
        window.addEventListener('resize', clampToViewport);

        // Also clamp whenever the panel itself grows (e.g. Inspector expanding after selection)
        const ro = new ResizeObserver(() => {
            clampToViewport();
            // Update registry when panel resizes
            if (registryId.current !== null && panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                updatePanel(registryId.current, pos.x, pos.y, rect.width, rect.height);
            }
        });
        if (panelRef.current) ro.observe(panelRef.current);

        // Fire once on mount to ensure starting position is safe
        clampToViewport();

        return () => {
            window.removeEventListener('resize', clampToViewport);
            ro.disconnect();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onPointerDown = (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
            setIsDragging(true);
            dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
            e.target.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    };

    const onPointerMove = (e) => {
        if (!isDragging || !dragRef.current || !panelRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        
        let newX = dragRef.current.posX + dx;
        let newY = dragRef.current.posY + dy;
        
        const rect = panelRef.current.getBoundingClientRect();
        
        if (newX + rect.width > window.innerWidth) newX = window.innerWidth - rect.width;
        if (newX < 0) newX = 0;
        if (newY + rect.height > window.innerHeight) newY = window.innerHeight - rect.height;
        if (newY < 0) newY = 0;
        
        setPos({ x: newX, y: newY });
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    return (
        <div ref={panelRef} className="glass-panel" onFocusCapture={onFocusCapture} style={{
            position: 'absolute', left: pos.x, top: pos.y, width: defaultSize.width, maxHeight: '80%',
            padding: '10px', display: 'flex', flexDirection: 'column', borderRadius: '8px',
            zIndex: 100, pointerEvents: 'auto', resize: 'both', overflow: 'hidden', minWidth: '200px', minHeight: '100px',
            boxShadow: isDragging ? '0 16px 32px rgba(0,0,0,0.4)' : 'var(--shadow)'
        }}>
            <div
                className="draggable-handle"
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontWeight: 600, fontSize: '0.85rem', cursor: isDragging ? 'grabbing' : 'grab',
                    margin: '-10px -10px 10px -10px', padding: '8px 10px', backgroundColor: 'var(--title-bg)', color: 'var(--accent-color)',
                    borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--border-color)', userSelect: 'none'
                }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            >
                <span>{title}</span>
                {onClose && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 2px', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.target.style.color = '#ff3b30'}
                        onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                        title="Close panel"
                    >✕</button>
                )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default DraggablePanel;

