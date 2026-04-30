import { persistLibrary, setupDiskBackup, importLibraryFromFile } from '../../utils/libraryPersistence';

export const createLibrarySlice = (set, get) => ({
  // ─── Assembly Library Actions ────────────────────────────────────────────

  /**
   * Save the currently selected group (and its entire sub-tree) to the library.
   * Only intra-assembly constraints are kept; cross-assembly ones are dropped.
   *
   * @param {{ name: string, category: string, tags: string[], thumbnail: string, replaceId?: string }} meta
   *   replaceId — if set, overwrites that existing entry in-place instead of adding a new one.
   */
  saveAssemblyToLibrary: async ({
    name,
    category,
    tags,
    thumbnail,
    replaceId
  }) => {
    const {
      selectedItemIds,
      groups,
      boards,
      constraints,
      assemblyLibrary,
      libraryDiskHandle,
      setAssemblyLibrary,
      showToast
    } = get();

    // Require exactly one group selected
    const selectedGroupId = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
    if (!selectedGroupId) {
      showToast('Select a single assembly (group) to save.');
      return;
    }

    // ── Collect the full sub-tree of groups ───────────────────────────────
    const collectGroupSubTree = rootId => {
      const result = {};
      const traverse = id => {
        result[id] = {
          ...groups[id]
        };
        Object.keys(groups).filter(k => groups[k].parentId === id).forEach(traverse);
      };
      traverse(rootId);
      return result;
    };
    const snapshotGroups = collectGroupSubTree(selectedGroupId);
    const groupIdsInAssembly = new Set(Object.keys(snapshotGroups));

    // ── Collect all descendant boards ─────────────────────────────────────
    const snapshotBoards = boards.filter(b => {
      let pid = b.parentId;
      while (pid) {
        if (groupIdsInAssembly.has(pid)) return true;
        const pg = groups[pid];
        pid = pg ? pg.parentId : null;
      }
      return false;
    }).map(b => ({
      ...b
    }));
    const boardIdsInAssembly = new Set(snapshotBoards.map(b => b.id.toString()));

    // ── Filter constraints: keep only intra-assembly ones ─────────────────
    const snapshotConstraints = {};
    Object.entries(constraints).forEach(([cId, c]) => {
      if (boardIdsInAssembly.has(c.boardAId) && boardIdsInAssembly.has(c.boardBId)) {
        snapshotConstraints[cId] = {
          ...c
        };
      }
    });

    // ── Normalise: re-root the top-level group to parentId: null ──────────
    snapshotGroups[selectedGroupId] = {
      ...snapshotGroups[selectedGroupId],
      parentId: null
    };

    // ── Build the updated entry ───────────────────────────────────────────
    // When replacing, keep the original id so it stays in the same position
    // in the list and all references remain valid.
    const entryId = replaceId ?? crypto.randomUUID();
    const entry = {
      id: entryId,
      name,
      category: category || 'Uncategorized',
      tags: tags || [],
      thumbnail,
      groups: snapshotGroups,
      boards: snapshotBoards,
      constraints: snapshotConstraints,
      savedAt: Date.now()
    };
    let next;
    if (replaceId) {
      // Swap out the existing entry in-place (preserves list order)
      next = assemblyLibrary.map(e => e.id === replaceId ? entry : e);
    } else {
      next = [...assemblyLibrary, entry];
    }
    setAssemblyLibrary(next);
    await persistLibrary(next, libraryDiskHandle);
    showToast(replaceId ? `"${name}" updated in library ✓` : `"${name}" saved to library ✓`);
  },
  /**
   * Stamp a library entry back into the viewport.
   * Generates fresh UUIDs for all groups + boards; remaps all cross-references.
   * The top-level group is auto-selected.
   */
  placeAssemblyFromLibrary: assemblyId => {
    const {
      assemblyLibrary,
      boards,
      groups,
      constraints,
      setBoards,
      setGroups,
      setConstraints,
      setSelectedItemIds,
      pushHistory,
      showToast
    } = get();
    const entry = assemblyLibrary.find(e => e.id === assemblyId);
    if (!entry) return;
    pushHistory();
    const existingGroupNames = new Set(Object.keys(groups));

    // Helper: find a unique group name by appending -2, -3, …
    const uniqueGroupName = base => {
      if (!existingGroupNames.has(base)) {
        existingGroupNames.add(base);
        return base;
      }
      let n = 2;
      while (existingGroupNames.has(`${base}-${n}`)) n++;
      const name = `${base}-${n}`;
      existingGroupNames.add(name);
      return name;
    };

    // ── Find root group (parentId === null in snapshot) ───────────────────
    const oldRootId = Object.keys(entry.groups).find(id => entry.groups[id].parentId === null);

    // ── Build group ID map: old key → new readable key ────────────────────
    const groupIdMap = {};
    // Root group gets the entry.name with suffix
    groupIdMap[oldRootId] = uniqueGroupName(entry.name);
    // Sub-groups keep their original key name, suffixed if needed
    Object.keys(entry.groups).forEach(oldId => {
      if (oldId !== oldRootId) {
        groupIdMap[oldId] = uniqueGroupName(oldId);
      }
    });
    const newRootId = groupIdMap[oldRootId];

    // ── Board IDs: continue from scene max ────────────────────────────────
    let nextBoardId = Math.max(0, ...boards.map(b => parseInt(b.id) || 0)) + 1;
    const boardIdMap = {};
    entry.boards.forEach(b => {
      boardIdMap[b.id.toString()] = nextBoardId++;
    });

    // ── Remap groups ──────────────────────────────────────────────────────
    const newGroups = {};
    Object.entries(entry.groups).forEach(([oldId, g]) => {
      const newId = groupIdMap[oldId];
      const newParentId = g.parentId === null ? 'Workspace' : groupIdMap[g.parentId] ?? g.parentId;
      newGroups[newId] = {
        ...g,
        parentId: newParentId
      };
    });

    // ── Remap boards ──────────────────────────────────────────────────────
    const newBoards = entry.boards.map(b => ({
      ...b,
      id: boardIdMap[b.id.toString()],
      parentId: groupIdMap[b.parentId] ?? b.parentId
    }));

    // ── Remap constraints (keys stay as timestamps — invisible to user) ───
    const newConstraints = {};
    Object.entries(entry.constraints || {}).forEach(([, c]) => {
      const newCId = Date.now().toString() + Math.random();
      newConstraints[newCId] = {
        ...c,
        boardAId: boardIdMap[c.boardAId]?.toString() ?? c.boardAId,
        boardBId: boardIdMap[c.boardBId]?.toString() ?? c.boardBId
      };
    });

    // ── Commit ────────────────────────────────────────────────────────────
    setGroups(prev => ({
      ...prev,
      ...newGroups
    }));
    setBoards(prev => [...prev, ...newBoards]);
    setConstraints(prev => ({
      ...prev,
      ...newConstraints
    }));
    setSelectedItemIds([newRootId]);
    showToast(`Placed "${newRootId}" ✓ — move it using the Inspector or AI chat.`);
  },
  /**
   * Remove a library entry and persist the updated list.
   */
  deleteAssemblyFromLibrary: async assemblyId => {
    const {
      assemblyLibrary,
      libraryDiskHandle,
      setAssemblyLibrary,
      showToast
    } = get();
    const entry = assemblyLibrary.find(e => e.id === assemblyId);
    const next = assemblyLibrary.filter(e => e.id !== assemblyId);
    setAssemblyLibrary(next);
    await persistLibrary(next, libraryDiskHandle);
    if (entry) showToast(`"${entry.name}" removed from library.`);
  },
  /**
   * Update editable metadata on an existing library entry (name, category, tags).
   * @param {string} assemblyId
   * @param {{ name?: string, category?: string, tags?: string[] }} patch
   */
  updateAssemblyInLibrary: async (assemblyId, patch) => {
    const {
      assemblyLibrary,
      libraryDiskHandle,
      setAssemblyLibrary,
      showToast
    } = get();
    const next = assemblyLibrary.map(e => e.id === assemblyId ? {
      ...e,
      ...patch
    } : e);
    setAssemblyLibrary(next);
    await persistLibrary(next, libraryDiskHandle);
    showToast('Library entry updated ✓');
  },
  /**
   * Opens a save-file picker to choose (or re-choose) the disk backup location.
   */
  setupLibraryDiskBackup: async () => {
    const {
      assemblyLibrary,
      setLibraryDiskHandle,
      showToast
    } = get();
    const handle = await setupDiskBackup(assemblyLibrary);
    if (handle) {
      setLibraryDiskHandle(handle);
      showToast('Library backup file set ✓ — auto-saving on every change.');
    }
  },
  /**
   * Opens an open-file picker to import (merge) a library JSON file.
   */
  importLibraryFromFile: async () => {
    const {
      assemblyLibrary,
      libraryDiskHandle,
      setAssemblyLibrary,
      showToast
    } = get();
    const {
      merged,
      count
    } = await importLibraryFromFile(assemblyLibrary);
    if (count > 0) {
      setAssemblyLibrary(merged);
      await persistLibrary(merged, libraryDiskHandle);
      showToast(`Imported ${count} new assembly${count !== 1 ? 's' : ''} ✓`);
    } else {
      showToast('No new assemblies found in file.');
    }
  }
});