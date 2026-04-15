import { create } from 'zustand';
import { createActions } from './actions';
import { loadLibrarySync, loadLibraryFromDiskIfNeeded, loadStoredHandle } from '../utils/libraryPersistence';
import { DEFAULT_LIGHTING } from '../utils/lightingPresets';

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

// Assembly library hydrated synchronously; disk recovery runs async after mount
const _initialLibrary = loadLibrarySync();

// ─── Store Definition ────────────────────────────────────────────────────────
const useStore = create((set, get) => ({

    // ── 2A: UI Toggle State ──────────────────────────────────────────────────
    showCutlistPanel: false,
    setShowCutlistPanel: (v) => set({ showCutlistPanel: typeof v === 'function' ? v(get().showCutlistPanel) : v }),

    isOrtho: false,
    setIsOrtho: (v) => set({ isOrtho: typeof v === 'function' ? v(get().isOrtho) : v }),

    showGrid: true,
    setShowGrid: (v) => set({ showGrid: typeof v === 'function' ? v(get().showGrid) : v }),

    autosaveInterval: loadState('autosaveInterval', '10'),
    setAutosaveInterval: (v) => set({ autosaveInterval: typeof v === 'function' ? v(get().autosaveInterval) : v }),

    showSettingsPanel: false,
    setShowSettingsPanel: (v) => set({ showSettingsPanel: typeof v === 'function' ? v(get().showSettingsPanel) : v }),

    showLightingPanel: false,
    setShowLightingPanel: (v) => set({ showLightingPanel: typeof v === 'function' ? v(get().showLightingPanel) : v }),

    showMaterialsPanel: false,
    setShowMaterialsPanel: (v) => set({ showMaterialsPanel: typeof v === 'function' ? v(get().showMaterialsPanel) : v }),

    showAddComponentPanel: false,
    setShowAddComponentPanel: (v) => set({ showAddComponentPanel: typeof v === 'function' ? v(get().showAddComponentPanel) : v }),

    showOutlinerPanel: true,
    setShowOutlinerPanel: (v) => set({ showOutlinerPanel: typeof v === 'function' ? v(get().showOutlinerPanel) : v }),

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

    // ── 2A-lib: Assembly Library State ──────────────────────────────────────
    // Each entry: { id, name, category, tags[], thumbnail, boards[], groups{}, constraints{} }
    assemblyLibrary: _initialLibrary,
    setAssemblyLibrary: (v) => set({ assemblyLibrary: typeof v === 'function' ? v(get().assemblyLibrary) : v }),

    showAssemblyLibrary: false,
    setShowAssemblyLibrary: (v) => set({ showAssemblyLibrary: typeof v === 'function' ? v(get().showAssemblyLibrary) : v }),

    // User-defined category list — persisted in localStorage
    assemblyCategories: loadState('assemblyCategories', ['Uncategorized', 'Cabinet', 'Box', 'Chair', 'Table', 'Leg Set', 'Shelf', 'Drawer', 'Frame', 'Other']),
    addAssemblyCategory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const { assemblyCategories } = get();
        if (assemblyCategories.includes(trimmed)) return false;
        const next = [...assemblyCategories, trimmed];
        set({ assemblyCategories: next });
        try {
            const s = localStorage.getItem('lucey_save');
            const p = s ? JSON.parse(s) : {};
            localStorage.setItem('lucey_save', JSON.stringify({ ...p, assemblyCategories: next }));
        } catch { /* non-fatal */ }
        return true;
    },

    // FileSystemFileHandle stored in IndexedDB; loaded async on mount
    libraryDiskHandle: null,
    setLibraryDiskHandle: (v) => set({ libraryDiskHandle: v }),

    chatInput: '',
    setChatInput: (v) => set({ chatInput: typeof v === 'function' ? v(get().chatInput) : v }),

    chatMessages: [
        { role: 'ai', text: 'Ready! Try "move this 3 along red" or "make this 1 inch wider". Select a board first!' }
    ],
    setChatMessages: (v) => set({ chatMessages: typeof v === 'function' ? v(get().chatMessages) : v }),

    // ── 2B: Settings / Preferences State ─────────────────────────────────────
    theme: loadState('theme', 'dark'),
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

    // ── 2B-light: Lighting State ──────────────────────────────────────────────
    // { presetKey, shadows, lights[] } — persisted in lucey_save under 'lighting'
    lighting: loadState('lighting', DEFAULT_LIGHTING),
    setLighting: (v) => set({ lighting: typeof v === 'function' ? v(get().lighting) : v }),

    // ── 2B-mat: Recent custom paint colours (last 8) ─────────────────────────
    recentColors: loadState('recentColors', []),
    setRecentColors: (v) => {
        const next = typeof v === 'function' ? v(get().recentColors) : v;
        set({ recentColors: next });
        // Auto-persist so they survive without an explicit save
        try {
            const s = localStorage.getItem('lucey_save');
            const p = s ? JSON.parse(s) : {};
            localStorage.setItem('lucey_save', JSON.stringify({ ...p, recentColors: next }));
        } catch { /* non-fatal */ }
    },

    // ── 2C: Core Data State ──────────────────────────────────────────────────
    // Boards: No rotation field. All positions are world-space.
    // Size: [x, y, z] where x=width(Red), y=height(Green/up), z=depth(Blue)
    // Position: [x, y, z] = center of the board in world space
    // Note: boards no longer carry a constraints[] array — see root `constraints` map.
    boards: loadState('boards', [
        { id: 1, name: 'Table Top', parentId: 'Table Base', size: [36, 0.75, 24], position: [0, 12.375, 0], material: 'pine', joint: 'Butt 1' },
        { id: 2, name: 'Leg A',     parentId: 'Table Base', size: [1.5, 12, 1.5], position: [16.5, 6, 10.5],   material: 'white-oak', joint: 'Butt 1' },
        { id: 3, name: 'Leg B',     parentId: 'Table Base', size: [1.5, 12, 1.5], position: [-16.5, 6, 10.5],  material: 'white-oak', joint: 'Butt 1' },
        { id: 4, name: 'Leg C',     parentId: 'Table Base', size: [1.5, 12, 1.5], position: [16.5, 6, -10.5],  material: 'white-oak', joint: 'Butt 1' },
        { id: 5, name: 'Leg D',     parentId: 'Table Base', size: [1.5, 12, 1.5], position: [-16.5, 6, -10.5], material: 'white-oak', joint: 'Butt 1' },
    ]),
    setBoards: (v) => set({ boards: typeof v === 'function' ? v(get().boards) : v }),

    // Groups: Purely organizational. No position or rotation.
    groups: loadState('groups', {
        'Workspace': { parentId: null, visible: true, isExpanded: true },
        'Table Base': { parentId: 'Workspace', visible: true, isExpanded: true },
    }),
    setGroups: (v) => set({ groups: typeof v === 'function' ? v(get().groups) : v }),

    // Central constraint index. Key = UUID string.
    // Flush: { type, boardAId, boardBId, faceA, faceB, axis, enabled }
    // Glue:  { type, boardAId, boardBId, offset: [dx,dy,dz], enabled }
    constraints: loadState('constraints', {}),
    setConstraints: (v) => set({ constraints: typeof v === 'function' ? v(get().constraints) : v }),

    selectedItemIds: [],
    setSelectedItemIds: (v) => set({ selectedItemIds: typeof v === 'function' ? v(get().selectedItemIds) : v }),

    constraintTargetMode: null,
    setConstraintTargetMode: (v) => set({ constraintTargetMode: typeof v === 'function' ? v(get().constraintTargetMode) : v }),

    // ── 2D: History (Undo/Redo) ───────────────────────────────────────────────
    history: [],
    redoHistory: [],

    pushHistory: () => {
        const { boards, groups, constraints, history } = get();
        set({
            redoHistory: [],
            history: [...history, { boards, groups, constraints }].slice(-25)
        });
    },

    handleUndo: () => {
        const { history, boards, groups, constraints } = get();
        if (history.length === 0) return;
        const last = history[history.length - 1];
        set({
            redoHistory: [...get().redoHistory, { boards, groups, constraints }],
            history: history.slice(0, -1),
            boards: last.boards,
            groups: last.groups,
            constraints: last.constraints ?? {}
        });
    },

    handleRedo: () => {
        const { redoHistory, boards, groups, constraints } = get();
        if (redoHistory.length === 0) return;
        const next = redoHistory[redoHistory.length - 1];
        set({
            history: [...get().history, { boards, groups, constraints }],
            redoHistory: redoHistory.slice(0, -1),
            boards: next.boards,
            groups: next.groups,
            constraints: next.constraints ?? {}
        });
    },

    resetHistory: () => set({ history: [], redoHistory: [] }),

    // ── 2E: Actions ──────────────────────────────────────────────────────────
    ...createActions(set, get)
}));

// ── Async disk recovery: runs once after the store is created ────────────────
// If localStorage was empty (cache cleared), tries to reload from the stored
// disk file handle and also re-hydrates libraryDiskHandle.
(async () => {
    try {
        // Restore handle regardless (needed for auto-save even if LS is populated)
        const handle = await loadStoredHandle();
        if (handle) useStore.setState({ libraryDiskHandle: handle });

        // Only attempt disk recovery when localStorage was empty
        if (_initialLibrary.length === 0) {
            const recovered = await loadLibraryFromDiskIfNeeded();
            if (recovered.length > 0) {
                useStore.setState({ assemblyLibrary: recovered });
            }
        }
    } catch { /* non-fatal */ }
})();

export default useStore;
