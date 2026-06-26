import { useEffect } from 'react';

export function useGlobalHotkeys({ setShowRecorderPanel }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                setShowRecorderPanel((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setShowRecorderPanel]);
}
