import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { getOverlappingBoards } from '../utils/collisions';

export function useOverlapWarnings({
    boards,
    enableCollisions,
    overlappingBoardIds,
    setOverlappingBoardIds,
}) {
    const prevOverlappingRef = useRef(0);

    useEffect(() => {
        if (!enableCollisions) {
            if (overlappingBoardIds.length > 0) setOverlappingBoardIds([]);
            prevOverlappingRef.current = 0;
            return;
        }

        const timer = setTimeout(() => {
            const { overlappingIds } = getOverlappingBoards(boards);
            setOverlappingBoardIds(overlappingIds);

            if (overlappingIds.length > 0 && prevOverlappingRef.current === 0) {
                useStore.getState().showToast('⚠️ Warning: Boards are occupying the same space!');
            }

            prevOverlappingRef.current = overlappingIds.length;
        }, 500);

        return () => clearTimeout(timer);
    }, [boards, enableCollisions, overlappingBoardIds.length, setOverlappingBoardIds]);
}
