import * as THREE from "three";
import { computeWorldAABB, collectChildBoards } from "../utils/sceneGraph";
import {
  createMaterialCommand,
  createMoveCommand,
  createResizeCommand,
  createRotateCommand,
  executeCommand,
} from "../commands";
import { appendAiMessage } from "../utils/aiChatMessaging";
import { appendOperationToBoards } from "../utils/boardOperations";
import {
  createCubeAssembly,
  createProceduralBoxAssembly,
  createSimpleLeg,
  createTopBoard,
} from "../utils/siBuilders";
import {
  findMaterialIntent,
  formatMaterialLabel,
  toMaterialPayload,
} from "../utils/materialIntents";
import {
  createPartialTaperedLegAssembly,
  createStandaloneTaperedLeg,
  createTaperSpec,
} from "../utils/siTaperedLeg";
import { extractSiMeasurement, parseSiMeasurement } from "../utils/siParsing";
import { resolveSelectionOrNamedTarget } from "../utils/workspaceTargets";

export function processSiCommand(text, set, get) {
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
  let reply = "I've processed your request.";
  let updated = false;

  // ── Help / Cheat Sheet ───────────────────────────────────────────────
  if (
    /(help|what can you do|cheat sheet|command|syntax|\bhow \b)/.test(lower)
  ) {
    setShowAiHelpDialog(true);
    reply = "I've popped open the command cheat sheet for you!";
    setTimeout(() => {
      appendAiMessage(setChatMessages, reply);
    }, 300);
    return;
  }

  // ── Material change ──────────────────────────────────────────────────
  const matchedMat = findMaterialIntent(lower);
  if (matchedMat) {
    const matDesc = toMaterialPayload(matchedMat);
    pushHistory();
    executeCommand(
      createMaterialCommand({
        target:
          selectedItemIds.length > 0 ? { scope: "selected" } : { scope: "all" },
        material: matDesc,
      }),
      get,
    );
    const displayLabel = formatMaterialLabel(matchedMat.label);
    reply =
      selectedItemIds.length > 0
        ? `Changed selected to ${displayLabel}.`
        : `Changed all to ${displayLabel}.`;
    updated = true;

    // ── Move / Nudge (color-based or directional) ────────────────────────
  } else if (
    (lower.includes("nudge") || lower.includes("move")) &&
    selectedItemIds.length > 0
  ) {
    // Determine axis from color names or direction words
    let axis = "y";
    if (
      lower.includes("red") ||
      lower.includes("left") ||
      lower.includes("right") ||
      /\bx\b/.test(lower)
    )
      axis = "x";
    if (
      lower.includes("blue") ||
      lower.includes("forward") ||
      lower.includes("back") ||
      /\bz\b/.test(lower)
    )
      axis = "z";
    if (
      lower.includes("green") ||
      lower.includes("up") ||
      lower.includes("down") ||
      /\by\b/.test(lower)
    )
      axis = "y";
    let val = 1;
    if (
      lower.includes("down") ||
      lower.includes("left") ||
      lower.includes("back")
    )
      val = -1;
    const match = lower.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?[\d.]+)/);
    if (match) val = parseSiMeasurement(match[1]) * (val < 0 ? -1 : 1);
    pushHistory();
    const moved = executeCommand(
      createMoveCommand({
        target: { scope: "selected" },
        axis,
        delta: val,
      }),
      get,
    );
    const axisName = {
      x: "red (X)",
      y: "green (Y)",
      z: "blue (Z)",
    }[axis];
    reply = moved
      ? `Moved selected component(s) by ${val}" along ${axisName}.`
      : `I couldn't move the selected component(s) along ${axisName}.`;
    updated = true;

    // ── Tapered leg — add / convert / partial ──────────────────────────
  } else if (
    (lower.includes("taper") || lower.includes("tapered")) &&
    (lower.includes("leg") ||
      lower.includes("add") ||
      lower.includes("make") ||
      lower.includes("convert"))
  ) {
    const angleMatch = lower.match(/(\d*\.?\d+)\s*(?:deg|°|degree)/i);
    const az = angleMatch ? parseFloat(angleMatch[1]) : 2;
    const ax = /dual|both|side/.test(lower) ? az : 0;
    if (/halfway|half way|partial|lower half|bottom half/.test(lower)) {
      const newGroupId = "Tapered Leg " + Math.floor(Math.random() * 1000);
      const upperId = Date.now();
      const lowerId = upperId + 1;
      const glueId = (upperId + 2).toString();
      const partialAssembly = createPartialTaperedLegAssembly({
        groupId: newGroupId,
        upperId,
        lowerId,
        defaultMaterial,
        ax,
        az,
      });
      setGroups((prev) => ({
        ...prev,
        ...partialAssembly.group,
      }));
      setBoards((prev) => [...prev, ...partialAssembly.boards]);
      get().setConstraints((prev) => ({
        ...prev,
        [glueId]: partialAssembly.constraint,
      }));
      setSelectedItemIds([newGroupId]);
      reply =
        "Partial-tapered leg: " +
        partialAssembly.halfHeight +
        '" straight upper + ' +
        partialAssembly.halfHeight +
        '" tapered lower (' +
        az +
        "° back), glued as one unit.";
      updated = true;
    } else if (
      /make|convert|change/.test(lower) &&
      selectedItemIds.length > 0
    ) {
      setBoards((prev) =>
        prev.map((b) =>
          selectedItemIds.includes(b.id.toString())
            ? {
                ...b,
                shape: "taper",
                taper: createTaperSpec(ax, az),
              }
            : b,
        ),
      );
      reply =
        "Converted to tapered — back " +
        az +
        "°" +
        (ax > 0 ? ", side " + ax + "°" : "") +
        ".";
      updated = true;
    } else {
      const newId = Date.now();
      setBoards((prev) => [
        ...prev,
        createStandaloneTaperedLeg({
          id: newId,
          defaultMaterial,
          ax,
          az,
        }),
      ]);
      setSelectedItemIds([newId.toString()]);
      reply =
        'Added 1.5×30×1.5" tapered leg — back ' +
        az +
        "°" +
        (ax > 0 ? ", side " + ax + "°" : "") +
        ". Bounding box unchanged.";
      updated = true;
    }

    // ── Add leg ──────────────────────────────────────────────────────────
    // ── Add/drill hole operation on selected board ───────────────────────
  } else if (
    selectedItemIds.length > 0 &&
    /(drill|bore|add).*(hole|pocket)|(hole|pocket).*(drill|bore|add)/i.test(
      lower,
    )
  ) {
    const r = extractSiMeasurement(lower) ?? 1;
    let axis = "y";
    if (/(through x|along x|\bx axis\b)/.test(lower)) axis = "x";
    else if (/(through z|along z|\bz axis\b)/.test(lower)) axis = "z";
    const op = {
      id: Date.now(),
      type: "hole",
      radius: Math.abs(r),
      offsetX: 0,
      offsetY: 0,
      axis,
    };
    setBoards((prev) => appendOperationToBoards(prev, selectedItemIds, op));
    reply = `Added ${r}" radius hole (${axis}-axis) to ${selectedItemIds.length} board(s). Adjust offset in the Inspector.`;
    updated = true;

    // ── Add cove operation on selected board ──────────────────────────────
  } else if (
    selectedItemIds.length > 0 &&
    /(add|cut|make).*(cove|hollow)|(cove|hollow).*(add|cut|make)/i.test(lower)
  ) {
    const depth = extractSiMeasurement(lower) ?? 1;
    let edge = "top";
    if (/bottom/.test(lower)) edge = "bottom";
    else if (/left/.test(lower)) edge = "left";
    else if (/right/.test(lower)) edge = "right";
    let axis = "y";
    if (/(\bx axis\b|along x)/.test(lower)) axis = "x";
    else if (/(\bz axis\b|along z)/.test(lower)) axis = "z";
    const op = {
      id: Date.now(),
      type: "cove",
      edge,
      depth: Math.abs(depth),
      axis,
    };
    setBoards((prev) => appendOperationToBoards(prev, selectedItemIds, op));
    reply = `Added ${depth}" ${edge}-edge cove to ${selectedItemIds.length} board(s).`;
    updated = true;

    // ── Add arc operation on selected board ───────────────────────────────
  } else if (
    selectedItemIds.length > 0 &&
    /(add|make|cut).*(arc|curve|cutout)|(arc|curve|cutout).*(add|make|cut)/i.test(
      lower,
    )
  ) {
    const angleMatch = lower.match(/(\d+)\s*(?:to|-|through)\s*(\d+)/);
    const startAngle = angleMatch ? parseInt(angleMatch[1]) : 0;
    const endAngle = angleMatch ? parseInt(angleMatch[2]) : 90;
    let axis = "y";
    if (/(\bx axis\b|along x)/.test(lower)) axis = "x";
    else if (/(\bz axis\b|along z)/.test(lower)) axis = "z";
    const op = {
      id: Date.now(),
      type: "arc",
      startAngle,
      endAngle,
      innerRadius: 0,
      axis,
    };
    setBoards((prev) => appendOperationToBoards(prev, selectedItemIds, op));
    reply = `Added arc modifier (${startAngle}°–${endAngle}°, ${axis}-axis) to ${selectedItemIds.length} board(s).`;
    updated = true;
  } else if (lower.includes("add") && lower.includes("leg")) {
    const newId = Date.now();
    setBoards((prev) => [
      ...prev,
      createSimpleLeg({ id: newId, defaultMaterial }),
    ]);
    setSelectedItemIds([newId.toString()]);
    reply = `Added a new 1.5×12×1.5 leg at origin, sitting on floor.`;
    updated = true;

    // ── Add top ──────────────────────────────────────────────────────────
  } else if (
    lower.includes("top") &&
    (lower.includes("add") || lower.includes("put"))
  ) {
    let targets = [];
    if (selectedItemIds.length === 0 || selectedItemIds.includes("Workspace")) {
      targets = boards;
    } else {
      const validBoards = new Set();
      const traverse = (pId) => {
        boards
          .filter((b) => b.parentId === pId)
          .forEach((b) => validBoards.add(b));
        Object.keys(groups)
          .filter((k) => groups[k].parentId === pId)
          .forEach((k) => traverse(k));
      };
      selectedItemIds.forEach((id) => {
        if (Object.keys(groups).includes(id)) {
          traverse(id);
        } else {
          const b = boards.find((x) => x.id.toString() === id);
          if (b) validBoards.add(b);
        }
      });
      targets = Array.from(validBoards);
    }
    if (targets.length === 0) {
      reply =
        "I need some existing geometry to calculate where a top should go!";
    } else {
      const newId = Date.now();
      const topResult = createTopBoard({
        id: newId,
        targets,
        defaultMaterial,
      });
      setBoards((prev) => [...prev, topResult.board]);
      setSelectedItemIds([newId.toString()]);
      reply = `Generated top at Y=${topResult.y.toFixed(2)}".`;
      updated = true;
    }

    // ── Build cube ───────────────────────────────────────────────────────
    // All 6 panels are identical 12×12×0.75".
    // Outer extent is 12" in every axis; 3 panels overlap at every corner.
  } else if (/(build|create|make).+cube/i.test(lower)) {
    const newGroupId = "Cube " + Math.floor(Math.random() * 1000);
    const cubeAssembly = createCubeAssembly({
      groupId: newGroupId,
      defaultMaterial,
      idBase: Date.now(),
    });
    setGroups((prev) => ({
      ...prev,
      ...cubeAssembly.group,
    }));
    setBoards((prev) => [...prev, ...cubeAssembly.boards]);
    setSelectedItemIds([newGroupId]);
    reply = `Built a 12" cube — 6 panels, each 12×12×0.75", overlapping at every corner.`;
    updated = true;

    // ── Build box ────────────────────────────────────────────────────────
  } else if (/(build|create|make).+box/i.test(lower)) {
    let newWidth = 24,
      newDepth = 16;
    const thickness = 0.75;
    let newHeight = 12;
    let newX = 0,
      newZ = 0,
      baseY = 0;
    const hMatch = lower.match(
      /(\d*\.?\d+)\s*(?:inch|in|"|'')\s*(tall|high|deep|box)/i,
    );
    if (hMatch && hMatch[1]) {
      newHeight = parseFloat(hMatch[1]);
    }
    if (
      /(bounding box|workspace box|workspace bounds|global bounds)/.test(
        lower,
      ) &&
      globalBounds &&
      globalBounds.enabled
    ) {
      newWidth = globalBounds.x;
      newDepth = globalBounds.z;
    }
    const newGroupId = "Assembly " + Math.floor(Math.random() * 1000);
    const boxAssembly = createProceduralBoxAssembly({
      groupId: newGroupId,
      defaultMaterial,
      width: newWidth,
      depth: newDepth,
      height: newHeight,
      idBase: Date.now(),
    });
    setGroups((prev) => ({
      ...prev,
      ...boxAssembly.group,
    }));
    setBoards((prev) =>
      [...prev, ...boxAssembly.boards].map((board) =>
        board.parentId === newGroupId
          ? {
              ...board,
              position: [
                board.position[0] + newX,
                board.position[1] + baseY,
                board.position[2] + newZ,
              ],
            }
          : board,
      ),
    );
    setSelectedItemIds([newGroupId]);
    reply = `Generated ${newHeight}" box (${newWidth}×${newDepth}) sitting on floor.`;
    updated = true;

    // ── Resize (cut/add/length/width/thickness) ──────────────────────────
  } else if (
    /(cut|add|trim|extend|shave|chop|short|shorter|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease|wider|thicker|longer|tall|taller)/.test(
      lower,
    )
  ) {
    const val = extractSiMeasurement(lower);
    if (val !== null) {
      const isTall =
        /(taller|tall)/.test(lower) && !/(length|longer|long)/.test(lower);
      const isShorter =
        /\bshorter\b/.test(lower) && !/(length|longer|long)/.test(lower);
      const isNegative =
        isShorter ||
        /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(
          lower,
        );
      const delta = isNegative ? -val : val;

      const isLength =
        !isTall && !isShorter && /(long|length|longer)/.test(lower);
      const isWidth = /(wide|narrow|width|wider)/.test(lower);
      const isThickness = /(thick|thin|thicker|thinner|thickness)/.test(lower);
      let dimension = "thickness";
      if (isTall || isShorter) dimension = "height";
      else if (isLength) dimension = "length";
      else if (isWidth) dimension = "width";
      else if (isThickness) dimension = "thickness";
      else if (
        /(right|left)/.test(lower) ||
        lower.includes("red") ||
        /\bx\b/.test(lower)
      )
        dimension = "length";
      else if (
        /(up|down|top|bottom)/.test(lower) ||
        lower.includes("green") ||
        /\by\b/.test(lower)
      )
        dimension = "height";
      else if (
        /(front|back)/.test(lower) ||
        lower.includes("blue") ||
        /\bz\b/.test(lower)
      )
        dimension = "width";

      const target = resolveSelectionOrNamedTarget(
        selectedItemIds,
        boards,
        lower,
      );
      if (target) {
        pushHistory();
        const resized = executeCommand(
          createResizeCommand({
            target,
            dimension,
            delta,
          }),
          get,
        );
        const dimLabel = dimension === "height" ? "height (Y)" : dimension;
        reply = resized
          ? `Adjusted ${dimLabel} of the target component(s) by ${delta > 0 ? "+" : ""}${delta}".`
          : `I couldn't resize the target component(s).`;
        updated = true;
      } else {
        reply =
          "I don't know which board to resize! Please select a component or say its name.";
        updated = true;
      }
    } else {
      reply = "I didn't detect a number! Try 'make this 1 inch wider'.";
      updated = true;
    }
    // ── Rotate ───────────────────────────────────────────────────────────
  } else if (/(rotat|spin|turn|flip|orient)/.test(lower)) {
    const target = resolveSelectionOrNamedTarget(
      selectedItemIds,
      boards,
      lower,
    );
    if (!target) {
      reply = "Select a board first, or name it — e.g. 'rotate Leg A 90 on Y'.";
      updated = true;
    } else if (/reset/.test(lower)) {
      let axis = "y";
      if (/(right|left|red|\bx\b)/.test(lower)) axis = "x";
      else if (/(front|back|blue|\bz\b)/.test(lower)) axis = "z";
      pushHistory();
      const rotated = executeCommand(
        createRotateCommand({
          target,
          axis,
          reset: true,
        }),
        get,
      );
      reply = rotated
        ? "Rotation reset to 0° on the target board(s)."
        : "I could not reset rotation on the target board(s).";
      updated = true;
    } else {
      const degrees = extractSiMeasurement(lower);
      if (degrees !== null || /flip/.test(lower)) {
        let axis = "y";
        if (/(right|left|red|\bx\b)/.test(lower)) axis = "x";
        else if (/(front|back|blue|\bz\b)/.test(lower)) axis = "z";
        pushHistory();
        const rotated = executeCommand(
          createRotateCommand({
            target,
            axis,
            degrees: degrees ?? 180,
            flip: /flip/.test(lower),
          }),
          get,
        );
        const axisLabel = {
          x: "X (Red)",
          y: "Y (Green)",
          z: "Z (Blue)",
        }[axis];
        reply = rotated
          ? `Rotated target board(s) ${/flip/.test(lower) ? "180° (flipped)" : `${degrees}°`} on ${axisLabel}.`
          : `I couldn't rotate the target board(s) on ${axisLabel}.`;
        updated = true;
      } else {
        reply =
          "I didn't detect an angle! Try 'rotate 90 on Y' or 'rotate 45 on red'.";
        updated = true;
      }
    }
  }
  if (!updated) {
    reply =
      "I need clearer instructions. Try 'move this 3 along red' or 'make this 1 inch wider'.";
  }
  setTimeout(() => {
    appendAiMessage(get().setChatMessages, reply);
  }, 500);
}
