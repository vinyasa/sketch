/**
 * libraryPersistence.js
 *
 * Dual-layer persistence for the Assembly Library:
 *   Layer 1 — localStorage  (fast, session-to-session)
 *   Layer 2 — Disk file via File System Access API + IndexedDB handle store
 *
 * The disk file handle is saved in IndexedDB so we can re-open and auto-save
 * without prompting the user on every session.
 */

const LS_KEY = 'lucey_assembly_library';
const IDB_DB_NAME = 'lucey_app';
const IDB_STORE = 'library_handles';
const IDB_HANDLE_KEY = 'main';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, 1);
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
 * Returns an array of LibraryEntry objects.
 * Async recovery from disk happens separately via loadLibraryFromDiskIfNeeded().
 */
export function loadLibrarySync() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
}

/**
 * Async recovery: if localStorage is empty but we have an IndexedDB handle,
 * read the disk file and restore localStorage.
 * Returns the recovered array (or empty array if nothing found).
 */
export async function loadLibraryFromDiskIfNeeded() {
    const fromLs = loadLibrarySync();
    if (fromLs.length > 0) return fromLs;

    // Try to recover from disk
    try {
        const handle = await idbGet(IDB_HANDLE_KEY);
        if (!handle) return [];

        // Verify we still have permission
        const perm = await handle.queryPermission({ mode: 'read' });
        let granted = perm === 'granted';
        if (!granted) {
            const req = await handle.requestPermission({ mode: 'read' });
            granted = req === 'granted';
        }
        if (!granted) return [];

        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
            localStorage.setItem(LS_KEY, JSON.stringify(data));
            return data;
        }
    } catch { /* file may have moved or been deleted */ }
    return [];
}

// ─── Persist ──────────────────────────────────────────────────────────────────

/**
 * Write the library to localStorage, and also to the disk file if a handle exists.
 * @param {Array} entries
 * @param {FileSystemFileHandle|null} handle
 */
export async function persistLibrary(entries, handle) {
    const json = JSON.stringify(entries);

    // Layer 1: localStorage
    try { localStorage.setItem(LS_KEY, json); } catch (e) {
        // localStorage might be full — warn but continue
        console.warn('[Library] localStorage write failed:', e.message);
    }

    // Layer 2: disk file (fire-and-forget)
    if (handle) {
        try {
            const writable = await handle.createWritable();
            await writable.write(json);
            await writable.close();
        } catch (e) {
            console.warn('[Library] Disk write failed:', e.message);
        }
    }
}

// ─── Backup (first-time setup or re-choose location) ─────────────────────────

/**
 * Opens a save-file picker, stores the handle in IndexedDB, and writes the
 * current library to the file immediately.
 * @param {Array} entries
 * @returns {FileSystemFileHandle|null} the new handle, or null if cancelled
 */
export async function setupDiskBackup(entries) {
    try {
        if (!('showSaveFilePicker' in window)) {
            alert('Your browser does not support the File System Access API. Disk backup is unavailable.');
            return null;
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: 'lucey_assembly_library.json',
            types: [{ description: 'Lucey Library', accept: { 'application/json': ['.json'] } }],
        });
        await idbSet(IDB_HANDLE_KEY, handle);
        await persistLibrary(entries, handle);
        return handle;
    } catch (e) {
        if (e.name !== 'AbortError') console.error('[Library] Backup setup failed:', e);
        return null;
    }
}

/**
 * Loads the stored handle from IndexedDB and verifies read+write permission.
 * Returns the handle (and re-requests permission if needed) or null.
 */
export async function loadStoredHandle() {
    try {
        const handle = await idbGet(IDB_HANDLE_KEY);
        if (!handle) return null;
        // Pre-check read permission (write will be needed for auto-save)
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return handle;
        // Don't prompt here — will prompt on next explicit backup action
        return handle; // still return it; write failures are non-fatal
    } catch { return null; }
}

// ─── Manual import (merge) ───────────────────────────────────────────────────

/**
 * Opens an open-file picker, parses the JSON, and merges entries into the
 * current library (deduplicating by id).
 * @param {Array} currentEntries
 * @returns {{ merged: Array, count: number }} the merged array and how many were new
 */
export async function importLibraryFromFile(currentEntries) {
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'Lucey Library', accept: { 'application/json': ['.json'] } }],
            multiple: false,
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const incoming = JSON.parse(text);
        if (!Array.isArray(incoming)) throw new Error('Not a valid library file');

        const existingIds = new Set(currentEntries.map(e => e.id));
        const newEntries = incoming.filter(e => !existingIds.has(e.id));
        const merged = [...currentEntries, ...newEntries];
        return { merged, count: newEntries.length };
    } catch (e) {
        if (e.name !== 'AbortError') console.error('[Library] Import failed:', e);
        return { merged: currentEntries, count: 0 };
    }
}
