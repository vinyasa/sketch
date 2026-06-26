import {
  ACTIVE_WORKSPACE_KEY,
  saveRecentFiles,
  saveWorkspaceStorage,
} from './workspaceSerialization';

export function updateRecentFilesList(recentFiles, name) {
  const next = recentFiles.filter((entry) => entry.name !== name);
  next.unshift({
    name,
    timestamp: Date.now(),
  });
  return next.slice(0, 5);
}

export function persistRecentFiles(setRecentFiles, recentFiles) {
  setRecentFiles(recentFiles);
  saveRecentFiles(recentFiles);
}

export function persistActiveWorkspace(payload) {
  return saveWorkspaceStorage(ACTIVE_WORKSPACE_KEY, payload);
}

export function clearActiveWorkspace() {
  localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}

export function removeSavedWorkspace(name) {
  localStorage.removeItem('lucey_save_' + name);
}
