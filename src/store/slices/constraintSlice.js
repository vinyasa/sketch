import { checkConstraintConflict, solveFlushSnap, faceToAxis, propagateMove } from '../../utils/constraintSolver';

export const createConstraintSlice = (set, get) => ({
  // ─── Add / remove / toggle constraints ──────────────────────────────────
  removeConstraint: constraintId => {
    const {
      pushHistory,
      setConstraints
    } = get();
    pushHistory();
    setConstraints(prev => {
      const next = {
        ...prev
      };
      delete next[constraintId];
      return next;
    });
  },
  toggleConstraint: constraintId => {
    const {
      setConstraints
    } = get();
    setConstraints(prev => ({
      ...prev,
      [constraintId]: {
        ...prev[constraintId],
        enabled: prev[constraintId].enabled === false ? true : false
      }
    }));
  }
});