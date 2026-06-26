import { useEffect } from "react";
import useStore from "../store/useStore";
import {
  ACTIVE_WORKSPACE_KEY,
  buildWorkspacePayload,
  saveWorkspaceStorage,
} from "../utils/workspaceSerialization";

export function useAutosave(autosaveInterval) {
  useEffect(() => {
    if (autosaveInterval === "off") return;

    const ms = parseInt(autosaveInterval, 10) * 60 * 1000;
    const id = setInterval(() => {
      const payload = buildWorkspacePayload(useStore.getState());
      saveWorkspaceStorage(ACTIVE_WORKSPACE_KEY, payload);
    }, ms);

    return () => clearInterval(id);
  }, [autosaveInterval]);
}
