import * as THREE from "three";
import { propagateMove } from "../../utils/constraintSolver";
import { calculateProceduralBoxWalls } from "../../utils/procedural";
import { WOOD_CATALOGUE, PAINT_PALETTE } from "../../utils/materialCatalogue";
import { processSiCommand } from "../../services/siCommandProcessor";
import { generateSmartMeasurementsHelper } from "../../utils/measurementUpdaters";
import {
  createMaterialCommand,
  createMoveCommand,
  createResizeCommand,
  createRotateCommand,
  executeCommands,
} from "../../commands";
import {
  appendAiMessage,
  replaceThinkingWithAiError,
  replaceThinkingWithAiMessage,
  showAiThinking,
} from "../../utils/aiChatMessaging";
import { applyGeminiLegacyAction } from "../../utils/geminiLegacyActions";
import { materialPayloadFromGeminiAction } from "../../utils/materialIntents";
import { resolveLegacyAiTargetIds } from "../../utils/workspaceTargets";
import {
  ACTIVE_WORKSPACE_KEY,
  RECENT_FILES_KEY,
  buildWorkspacePayload,
  loadWorkspaceStorage,
  parseWorkspaceString,
  sanitizeWorkspacePayload,
  saveWorkspaceStorage,
  stringifyWorkspacePayload,
} from "../../utils/workspaceSerialization";
import {
  clearActiveWorkspace,
  persistActiveWorkspace,
  persistRecentFiles,
  removeSavedWorkspace,
  updateRecentFilesList,
} from "../../utils/workspaceFiles";

export const createIoSlice = (set, get) => ({
  newWorkspace: () => {
    const {
      setBoards,
      setGroups,
      setConstraints,
      setSelectedItemIds,
      setCurrentFileName,
      resetHistory,
      setMeasurements,
      setHardwareInstances,
    } = get();
    setBoards([]);
    setGroups({
      Workspace: {
        isExpanded: true,
        parentId: null,
        visible: true,
        name: "Workspace",
      },
    });
    setConstraints({});
    setSelectedItemIds([]);
    setMeasurements([]);
    if (setHardwareInstances) setHardwareInstances([]);
    setCurrentFileName(null);
    if (resetHistory) resetHistory();

    // Clear active page-reload cache to prevent the deleted/cleared design from returning
    clearActiveWorkspace();
  },
  saveWorkspace: (customName = null) => {
    const {
      boards,
      groups,
      constraints,
      theme,
      units,
      gridSnap,
      defaultMaterial,
      showEdges,
      showDimensions,
      showBoundingBox,
      globalBounds,
      lighting,
      recentColors,
      autosaveInterval,
      cameraState,
      measurements,
      showMeasurements,
      currentFileName,
      recentFiles,
      setRecentFiles,
      showToast,
      panelLayoutMode,
      workspaceLayout,
      lumberyardSnapEnabled,
      measurementStyle,
      imperialFormat,
      setCurrentFileName,
    } = get();

    const name = customName || currentFileName || "My Design";

    if (boards.length === 0) {
      if (currentFileName && !customName) {
        removeSavedWorkspace(name);
        const newRecents = recentFiles.filter((r) => r.name !== name);
        persistRecentFiles(setRecentFiles, newRecents);
        setCurrentFileName(
          newRecents.length > 0 ? newRecents[0].name : "Untitled",
        );
        clearActiveWorkspace();
        showToast(`Removed "${name}" file`);
        return true;
      }
      showToast("Cannot save empty workspace");
      return false;
    }

    const payload = buildWorkspacePayload({
      boards,
      groups,
      constraints,
      theme,
      units,
      gridSnap,
      defaultMaterial,
      showEdges,
      showDimensions,
      showBoundingBox,
      globalBounds,
      lighting,
      recentColors,
      autosaveInterval,
      cameraState,
      measurements,
      showMeasurements,
      panelLayoutMode,
      workspaceLayout,
      lumberyardSnapEnabled,
      measurementStyle,
      imperialFormat,
    });
    saveWorkspaceStorage("lucey_save_" + name, payload);
    // Also update the active autosave buffer so manual saves survive page reloads immediately
    persistActiveWorkspace(payload);

    const newRecents = updateRecentFilesList(recentFiles, name);
    persistRecentFiles(setRecentFiles, newRecents);
    setCurrentFileName(name);

    showToast(customName ? `Saved as "${name}"` : `Saved "${name}"`);
    return true;
  },
  loadWorkspace: (name) => {
    const {
      setBoards,
      setGroups,
      setConstraints,
      setTheme,
      setUnits,
      setGridSnap,
      setDefaultMaterial,
      setShowEdges,
      setShowDimensions,
      setLighting,
      setRecentColors,
      setAutosaveInterval,
      setCurrentFileName,
      setMeasurements,
      setShowMeasurements,
      setPanelLayoutMode,
      setWorkspaceLayout,
      setLumberyardSnapEnabled,
      setMeasurementStyle,
      setImperialFormat,
    } = get();
    const key = name ? "lucey_save_" + name : ACTIVE_WORKSPACE_KEY;
    const p = loadWorkspaceStorage(key);
    if (p) {
      if (p.boards && p.groups) {
        setBoards(p.boards);
        setGroups(p.groups);
        setConstraints(p.constraints || {});
        if (p.theme) setTheme(p.theme);
        if (p.units) setUnits(p.units);
        if (p.gridSnap) setGridSnap(p.gridSnap);
        if (p.defaultMaterial) setDefaultMaterial(p.defaultMaterial);
        if (p.showEdges !== undefined) setShowEdges(p.showEdges);
        if (p.showDimensions !== undefined) setShowDimensions(p.showDimensions);
        if (p.lighting) setLighting(p.lighting);
        if (p.recentColors) setRecentColors(p.recentColors);
        if (p.autosaveInterval) setAutosaveInterval(p.autosaveInterval);
        if (p.cameraState) get().setCameraState(p.cameraState);
        if (p.measurements) setMeasurements(p.measurements);
        if (p.showMeasurements !== undefined)
          setShowMeasurements(p.showMeasurements);
        if (p.panelLayoutMode && setPanelLayoutMode)
          setPanelLayoutMode(p.panelLayoutMode);
        if (p.workspaceLayout && setWorkspaceLayout)
          setWorkspaceLayout(p.workspaceLayout);
        if (p.lumberyardSnapEnabled !== undefined && setLumberyardSnapEnabled)
          setLumberyardSnapEnabled(p.lumberyardSnapEnabled);
        if (p.measurementStyle && setMeasurementStyle)
          setMeasurementStyle(p.measurementStyle);
        if (p.imperialFormat && setImperialFormat)
          setImperialFormat(p.imperialFormat);
        if (name) setCurrentFileName(name);

        // Persist the loaded project to the active reload buffer so it survives page reloads
        persistActiveWorkspace(p);
      }
    } else if (name) {
      alert("Project load failed.");
    }
  },
  exportWorkspace: async () => {
    const { boards, groups, showToast } = get();
    const payload = stringifyWorkspacePayload(
      {
        boards,
        groups,
      },
      2,
      { versioned: true },
    );
    try {
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: "my_design.json",
          types: [
            {
              description: "Little Lucey Project",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(payload);
        await writable.close();
        set({
          currentFileName: handle.name.replace(/\.json$/i, ""),
        });
        showToast("Successfully saved to disk");
      } else {
        const dataStr =
          "data:text/json;charset=utf-8," + encodeURIComponent(payload);
        const dlNode = document.createElement("a");
        dlNode.setAttribute("href", dataStr);
        dlNode.setAttribute("download", "my_design.json");
        dlNode.click();
        showToast("Successfully saved to disk");
      }
      return true;
    } catch (err) {
      if (err.name !== "AbortError") showToast("Failed to save file.");
      return false;
    }
  },
  exportGLB: async () => {
    const { threeModelGroup, currentFileName, showToast } = get();

    if (!threeModelGroup) {
      showToast("No 3D model group available to export.");
      return false;
    }

    showToast("Exporting 3D Model...");

    try {
      const { GLTFExporter } =
        await import("three/examples/jsm/exporters/GLTFExporter.js");

      // Helper function to recursively clone only the actual boards and hardware parts
      const cleanModelForExport = (source) => {
        if (source.userData?.isBoard) {
          // Shallow clone the mesh so we don't bring along any UI helpers (Edges, axesHelper, hover planes, text)
          const meshClone = source.clone(false);
          if (source.geometry) {
            meshClone.geometry = source.geometry.clone();
          }
          if (source.material) {
            meshClone.material = Array.isArray(source.material)
              ? source.material.map((m) => m.clone())
              : source.material.clone();

            const mats = Array.isArray(meshClone.material)
              ? meshClone.material
              : [meshClone.material];
            mats.forEach((mat) => {
              if (mat.emissive) mat.emissive.set("#000000");
              if (mat.emissiveIntensity !== undefined)
                mat.emissiveIntensity = 0;
            });
          }
          // Process children: we ONLY export children that are hardware attachments
          source.children.forEach((child) => {
            if (child.userData?.isHardware) {
              meshClone.add(cleanModelForExport(child));
            }
          });
          return meshClone;
        }

        if (source.userData?.isHardware) {
          // Deep clone hardware attachments because they are loaded GLTF models (no helpers)
          const hwClone = source.clone(true);
          // Strip emissive selection highlight
          hwClone.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
              if (child.material.emissive)
                child.material.emissive.set("#000000");
              if (child.material.emissiveIntensity !== undefined)
                child.material.emissiveIntensity = 0;
            }
          });
          return hwClone;
        }

        // If it's a general Group (like root groups or sub-groups representing assemblies), we clone it (shallow)
        if (source.isGroup || source.type === "Group") {
          const groupClone = source.clone(false);
          source.children.forEach((child) => {
            const cleanedChild = cleanModelForExport(child);
            if (cleanedChild) {
              groupClone.add(cleanedChild);
            }
          });
          if (groupClone.children.length > 0) {
            return groupClone;
          }
        }

        return null;
      };

      const exportRoot = new THREE.Group();
      exportRoot.name = "Woodcraft Assembly";

      // If the root threeModelGroup has children, process them
      threeModelGroup.children.forEach((child) => {
        const cleanedChild = cleanModelForExport(child);
        if (cleanedChild) {
          exportRoot.add(cleanedChild);
        }
      });

      // Scale root group from inches to meters (1 inch = 0.0254 meters)
      // since glTF/GLB specification expects spatial units to be in meters.
      exportRoot.scale.set(0.0254, 0.0254, 0.0254);

      if (exportRoot.children.length === 0) {
        showToast("No components found to export.");
        return false;
      }

      const exporter = new GLTFExporter();
      exporter.parse(
        exportRoot,
        async (gltf) => {
          try {
            const blob = new Blob([gltf], { type: "application/octet-stream" });
            const defaultName = `${currentFileName || "woodcraft"}.glb`;

            if ("showSaveFilePicker" in window) {
              const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [
                  {
                    description: "GLB 3D Model",
                    accept: {
                      "model/gltf-binary": [".glb"],
                    },
                  },
                ],
              });
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              showToast("Successfully exported GLB");
            } else {
              const url = URL.createObjectURL(blob);
              const dlNode = document.createElement("a");
              dlNode.href = url;
              dlNode.download = defaultName;
              dlNode.click();
              URL.revokeObjectURL(url);
              showToast("Successfully exported GLB");
            }
          } catch (err) {
            if (err.name !== "AbortError")
              showToast("Failed to save GLB file.");
          }
        },
        (error) => {
          console.error("GLTFExporter failed:", error);
          showToast("Failed to export GLB model.");
        },
        { binary: true },
      );
      return true;
    } catch (err) {
      console.error("Failed to run GLB export:", err);
      showToast("Failed to export GLB.");
      return false;
    }
  },
  importWorkspace: (e) => {
    const {
      setBoards,
      setGroups,
      setConstraints,
      resetHistory,
      setCurrentFileName,
    } = get();
    const file = e.target.files[0];
    if (!file) return;
    const { showToast } = get();
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const p = parseWorkspaceString(event.target.result);
        if (p?.boards && p?.groups) {
          setBoards(p.boards);
          setGroups(p.groups);
          if (p.constraints) setConstraints(p.constraints);
          setCurrentFileName(file.name.replace(/\.json$/i, ""));
          resetHistory();

          // Persist the imported project to the active reload buffer so it survives page reloads
          persistActiveWorkspace(p);
        }
      } catch (e) {
        const message = e?.message || "Failed to parse project file.";
        showToast(message);
        alert(message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  },
  // ─── Legacy SI Processor ─────────────────────────────────────────────────
  processSiCommand: (text) => {
    processSiCommand(text, set, get);
  },
  submitChat: () => {
    const { chatInput, setChatMessages, setChatInput, aiEngine } = get();
    if (chatInput.trim()) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: chatInput,
        },
      ]);
      if (aiEngine === "si") {
        get().processSiCommand(chatInput);
      } else {
        get().processGeminiCommand(chatInput);
      }
      setChatInput("");
    }
  },
  // ─── Gemini AI Processor ──────────────────────────────────────────────────
  processGeminiCommand: async (text) => {
    const {
      pushHistory,
      selectedItemIds,
      setBoards,
      setGroups,
      setSelectedItemIds,
      boards,
      groups,
      constraints,
      defaultMaterial,
      globalBounds,
      setChatMessages,
      setShowAiHelpDialog,
    } = get();
    const lower = text.toLowerCase();
    if (
      /(help|what can you do|cheat sheet|command|syntax|\bhow \b)/.test(lower)
    ) {
      setShowAiHelpDialog(true);
      appendAiMessage(
        setChatMessages,
        "I've popped open the command cheat sheet for you!",
      );
      return;
    }
    showAiThinking(setChatMessages);
    try {
      const { parseUserIntent } = await import("../../services/geminiService");

      // Pass a minimal snapshot for context
      const workspaceContext = {
        selectedItemIds,
        boards: boards.map((b) => ({
          id: b.id,
          name: b.name,
          size: b.size,
          position: b.position,
        })),
      };
      const result = await parseUserIntent(text, workspaceContext);
      pushHistory(); // Commit to history before executing actions
      let processedActions = 0;
      if (result.actions && Array.isArray(result.actions)) {
        const normalizedCommands = result.actions.flatMap((action) => {
          const target = action.target
            ? action.target === "all" || action.target === "selected"
              ? { scope: action.target }
              : { scope: "name", value: action.target }
            : null;

          switch (action.type) {
            case "move":
              return [
                createMoveCommand({
                  target,
                  axis: action.axis,
                  delta: action.delta,
                }),
              ];
            case "resize":
              return [
                createResizeCommand({
                  target,
                  dimension: action.dimension,
                  delta: action.delta,
                }),
              ];
            case "rotate":
              return [
                createRotateCommand({
                  target,
                  axis: action.axis,
                  degrees: action.degrees,
                  flip: action.flip,
                  reset: action.reset,
                  pivot: action.pivot,
                }),
              ];
            case "material":
              return [
                createMaterialCommand({
                  target,
                  material: materialPayloadFromGeminiAction(action),
                }),
              ];
            default:
              return [];
          }
        });

        processedActions += executeCommands(normalizedCommands, get);

        for (const action of result.actions) {
          const targetIds = resolveLegacyAiTargetIds(
            action.target,
            get().boards,
            get().groups,
            get().selectedItemIds,
          );

          const legacyResult = applyGeminiLegacyAction(action, {
            boards: get().boards,
            defaultMaterial,
            targetIds,
          });

          if (legacyResult) {
            setBoards((prev) => [...prev, ...legacyResult.addedBoards]);
            if (legacyResult.selectedItemIds) {
              setSelectedItemIds(legacyResult.selectedItemIds);
            }
            processedActions++;
          }
        }
      }

      // Replace thinking bubble with results
      replaceThinkingWithAiMessage(setChatMessages, result.reply || "Done!");
    } catch (e) {
      replaceThinkingWithAiError(setChatMessages, e);
    }
  },
  // ─── Measurement Actions ────────────────────────────────────────────────────────────

  addMeasurement: (pointA, pointB, offset, offsetDir) => {
    const { pushHistory, setMeasurements } = get();
    pushHistory();
    const m = {
      id: "m_" + Date.now(),
      pointA,
      pointB,
      color: "#ff9f0a",
      offset: offset || 0,
      offsetDir: offsetDir || null,
    };
    setMeasurements((prev) => [...prev, m]);
  },
  removeMeasurement: (id) => {
    const { pushHistory, setMeasurements } = get();
    pushHistory();
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  },
  clearAllMeasurements: () => {
    const { pushHistory, setMeasurements } = get();
    pushHistory();
    setMeasurements([]);
  },
  generateSmartMeasurements: (groupId) => {
    const { boards, groups, setMeasurements, pushHistory } = get();
    pushHistory();
    const newMeasurements = generateSmartMeasurementsHelper(
      groupId,
      boards,
      groups,
    );
    setMeasurements((prev) => {
      const filtered = prev.filter(
        (m) => !m.id.startsWith("smart_") || !m.id.endsWith(groupId),
      );
      return [...filtered, ...newMeasurements];
    });
  },
  clearSmartMeasurements: (groupId) => {
    const { setMeasurements, pushHistory } = get();
    pushHistory();
    setMeasurements((prev) =>
      prev.filter((m) => !m.id.startsWith("smart_") || !m.id.endsWith(groupId)),
    );
  },
});
