/**
 * hardwareLibraryPersistence.js
 *
 * Dual-layer persistence for the Hardware Library:
 *   Layer 1 — localStorage  (fast, session-to-session)
 *   Layer 2 — Disk file via File System Access API + IndexedDB handle store
 *
 * Follows the same pattern as libraryPersistence.js for the Assembly Library.
 */

const LS_KEY = 'lucey_hardware_library';
const IDB_DB_NAME = 'lucey_app';
const IDB_STORE = 'library_handles';
const IDB_HANDLE_KEY = 'hardware_main';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, 2); // bump version to add store if needed
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function idbGet(key) {
    try {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch { return null; }
}

async function idbSet(key, value) {
    try {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const req = tx.objectStore(IDB_STORE).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch { /* non-fatal */ }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Synchronous load for initial store hydration.
 * Returns an array of hardware catalogue entry objects.
 */
export function loadHardwareLibrarySync() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

/**
 * Async recovery: if localStorage is empty but we have an IndexedDB handle,
 * read the disk file and restore localStorage.
 */
export async function loadHardwareLibraryFromDiskIfNeeded() {
    const fromLs = loadHardwareLibrarySync();
    if (fromLs.length > 0) return { entries: fromLs, handle: null };

    try {
        const handle = await idbGet(IDB_HANDLE_KEY);
        if (!handle) return { entries: [], handle: null };

        const perm = await handle.queryPermission({ mode: 'read' });
        let granted = perm === 'granted';
        if (!granted) {
            const req = await handle.requestPermission({ mode: 'read' });
            granted = req === 'granted';
        }
        if (!granted) return { entries: [], handle };

        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
            localStorage.setItem(LS_KEY, JSON.stringify(data));
            return { entries: data, handle };
        }
    } catch { /* file may have moved or been deleted */ }
    return { entries: [], handle: null };
}

// ─── Persist ──────────────────────────────────────────────────────────────────

/**
 * Write the hardware library to localStorage, and also to the disk file if a handle exists.
 */
export async function persistHardwareLibrary(entries, handle) {
    const json = JSON.stringify(entries);

    // Layer 1: localStorage
    try { localStorage.setItem(LS_KEY, json); } catch (e) {
        console.warn('[HardwareLibrary] localStorage write failed:', e.message);
    }

    // Layer 2: disk file (fire-and-forget)
    if (handle) {
        try {
            const writable = await handle.createWritable();
            await writable.write(json);
            await writable.close();
        } catch (e) {
            console.warn('[HardwareLibrary] Disk write failed:', e.message);
        }
    }
}

// ─── Backup (first-time setup or re-choose location) ─────────────────────────

/**
 * Opens a save-file picker, stores the handle in IndexedDB, and writes the
 * current hardware library to the file immediately.
 */
export async function setupHardwareDiskBackup(entries) {
    try {
        if (!('showSaveFilePicker' in window)) {
            alert('Your browser does not support the File System Access API. Disk backup is unavailable.');
            return null;
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: 'lucey_hardware_library.json',
            types: [{ description: 'Lucey Hardware Library', accept: { 'application/json': ['.json'] } }],
        });
        await idbSet(IDB_HANDLE_KEY, handle);
        await persistHardwareLibrary(entries, handle);
        return handle;
    } catch (e) {
        if (e.name !== 'AbortError') console.error('[HardwareLibrary] Backup setup failed:', e);
        return null;
    }
}

/**
 * Loads the stored handle from IndexedDB.
 */
export async function loadStoredHardwareHandle() {
    try {
        const handle = await idbGet(IDB_HANDLE_KEY);
        if (!handle) return null;
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return handle;
        return handle;
    } catch { return null; }
}

// ─── Manual import (merge) ───────────────────────────────────────────────────

/**
 * Opens an open-file picker, parses the JSON, and merges entries into the
 * current hardware library (deduplicating by id).
 */
export async function importHardwareLibraryFromFile(currentEntries) {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'Lucey Hardware Library', accept: { 'application/json': ['.json'] } }],
            multiple: false,
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const incoming = JSON.parse(text);
        if (!Array.isArray(incoming)) throw new Error('Not a valid hardware library file');

        const existingIds = new Set(currentEntries.map(e => e.id));
        const newEntries = incoming.filter(e => !existingIds.has(e.id));
        const merged = [...currentEntries, ...newEntries];
        return { merged, count: newEntries.length };
    } catch (e) {
        if (e.name !== 'AbortError') console.error('[HardwareLibrary] Import failed:', e);
        return { merged: currentEntries, count: 0 };
    }
}

// ─── GLB to base64 conversion ────────────────────────────────────────────────

/**
 * Read a File object and return a data URI string.
 */
export function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
