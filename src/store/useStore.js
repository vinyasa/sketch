import { create } from 'zustand';
import { createActions } from './actions';

// ─── Helper: load persisted state from localStorage ──────────────────────────
const loadState = (key, def) => {
    try {
        const s = localStorage.getItem('lucey_save');
        if (s) {
            const p = JSON.parse(s);
            return p[key] !== undefined ? p[key] : def;
        }
    } catch (e) { }
    return def;
};

const loadRecentFiles = () => {
    try { return JSON.parse(localStorage.getItem('lucey_recent_files')) || []; }
    catch { return []; }
};

// ─── Store Definition ────────────────────────────────────────────────────────
const useStore = create((set, get) => ({

    // ── 2A: UI Toggle State ──────────────────────────────────────────────────
    showCutlistPanel: false,
    setShowCutlistPanel: (v) => set({ showCutlistPanel: typeof v === 'function' ? v(get().showCutlistPanel) : v }),

    showSettingsPanel: false,
    setShowSettingsPanel: (v) => set({ showSettingsPanel: typeof v === 'function' ? v(get().showSettingsPanel) : v }),

    isRightPanelOpen: true,
    setIsRightPanelOpen: (v) => set({ isRightPanelOpen: typeof v === 'function' ? v(get().isRightPanelOpen) : v }),

    fileMenuOpen: false,
    setFileMenuOpen: (v) => set({ fileMenuOpen: typeof v === 'function' ? v(get().fileMenuOpen) : v }),

    toast: null,
    setToast: (v) => set({ toast: v }),
    showToast: (msg) => {
        set({ toast: msg });
        setTimeout(() => set({ toast: null }), 3000);
    },

    newBoardDialog: null,
    setNewBoardDialog: (v) => set({ newBoardDialog: typeof v === 'function' ? v(get().newBoardDialog) : v }),

    confirmDialog: null,
    setConfirmDialog: (v) => set({ confirmDialog: typeof v === 'function' ? v(get().confirmDialog) : v }),

    recentFiles: loadRecentFiles(),
    setRecentFiles: (v) => set({ recentFiles: typeof v === 'function' ? v(get().recentFiles) : v }),

    chatInput: '',
    setChatInput: (v) => set({ chatInput: typeof v === 'function' ? v(get().chatInput) : v }),

    chatMessages: [
        { role: 'ai', text: 'Ready! Try "move this 3 along red" or "make this 1 inch wider". Select a board first!' }
    ],
    setChatMessages: (v) => set({ chatMessages: typeof v === 'function' ? v(get().chatMessages) : v }),

    // ── 2B: Settings / Preferences State ─────────────────────────────────────
    theme: loadState('theme', 'light'),
    setTheme: (v) => {
        const newTheme = typeof v === 'function' ? v(get().theme) : v;
        set({ theme: newTheme });
        if (newTheme === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    },

    units: loadState('units', 'imperial'),
    setUnits: (v) => set({ units: typeof v === 'function' ? v(get().units) : v }),

    gridSnap: loadState('gridSnap', '1/8 in'),
    setGridSnap: (v) => set({ gridSnap: typeof v === 'function' ? v(get().gridSnap) : v }),

    defaultMaterial: loadState('defaultMaterial', 'pine'),
    setDefaultMaterial: (v) => set({ defaultMaterial: typeof v === 'function' ? v(get().defaultMaterial) : v }),

    showEdges: loadState('showEdges', true),
    setShowEdges: (v) => set({ showEdges: typeof v === 'function' ? v(get().showEdges) : v }),

    showDimensions: loadState('showDimensions', true),
    setShowDimensions: (v) => set({ showDimensions: typeof v === 'function' ? v(get().showDimensions) : v }),

    showBoundingBox: loadState('showBoundingBox', true),
    setShowBoundingBox: (v) => set({ showBoundingBox: typeof v === 'function' ? v(get().showBoundingBox) : v }),

    globalBounds: loadState('globalBounds', { enabled: false, x: 18, y: 25, z: 18 }),
    setGlobalBounds: (v) => set({ globalBounds: typeof v === 'function' ? v(get().globalBounds) : v }),

    // ── 2C: Core Data State ──────────────────────────────────────────────────
    // Boards: No rotation field. All positions are world-space.
    // Size: [x, y, z] where x=width(Red), y=height(Green/up), z=depth(Blue)
    // Position: [x, y, z] = center of the board in world space
    boards: loadState('boards', [
        { id: 1, name: 'Table Top', parentId: 'Table Base', size: [36, 0.75, 24], position: [0, 12.375, 0], material: 'pine', joint: 'Butt 1', constraints: [] },
        { id: 2, name: 'Leg A', parentId: 'Table Base', size: [1.5, 12, 1.5], position: [16.5, 6, 10.5], material: 'white-oak', joint: 'Butt 1', constraints: [] },
        { id: 3, name: 'Leg B', parentId: 'Table Base', size: [1.5, 12, 1.5], position: [-16.5, 6, 10.5], material: 'white-oak', joint: 'Butt 1', constraints: [] },
        { id: 4, name: 'Leg C', parentId: 'Table Base', size: [1.5, 12, 1.5], position: [16.5, 6, -10.5], material: 'white-oak', joint: 'Butt 1', constraints: [] },
        { id: 5, name: 'Leg D', parentId: 'Table Base', size: [1.5, 12, 1.5], position: [-16.5, 6, -10.5], material: 'white-oak', joint: 'Butt 1', constraints: [] },
    ]),
    setBoards: (v) => set({ boards: typeof v === 'function' ? v(get().boards) : v }),

    // Groups: Purely organizational. No position or rotation.
    groups: loadState('groups', {
        'Workspace': { parentId: null, visible: true, isExpanded: true },
        'Table Base': { parentId: 'Workspace', visible: true, isExpanded: true },
    }),
    setGroups: (v) => set({ groups: typeof v === 'function' ? v(get().groups) : v }),

    selectedItemIds: [],
    setSelectedItemIds: (v) => set({ selectedItemIds: typeof v === 'function' ? v(get().selectedItemIds) : v }),

    constraintTargetMode: null,
    setConstraintTargetMode: (v) => set({ constraintTargetMode: typeof v === 'function' ? v(get().constraintTargetMode) : v }),

    // ── 2D: History (Undo/Redo) ───────────────────────────────────────────────
    history: [],
    redoHistory: [],

    pushHistory: () => {
        const { boards, groups, history } = get();
        set({
            redoHistory: [],
            history: [...history, { boards, groups }].slice(-25)
        });
    },

    handleUndo: () => {
        const { history, boards, groups } = get();
        if (history.length === 0) return;
        const last = history[history.length - 1];
        set({
            redoHistory: [...get().redoHistory, { boards, groups }],
            history: history.slice(0, -1),
            boards: last.boards,
            groups: last.groups
        });
    },

    handleRedo: () => {
        const { redoHistory, boards, groups } = get();
        if (redoHistory.length === 0) return;
        const next = redoHistory[redoHistory.length - 1];
        set({
            history: [...get().history, { boards, groups }],
            redoHistory: redoHistory.slice(0, -1),
            boards: next.boards,
            groups: next.groups
        });
    },

    resetHistory: () => set({ history: [], redoHistory: [] }),

    // ── 2E: Actions ──────────────────────────────────────────────────────────
    ...createActions(set, get)
}));

export default useStore;
