/**
 * Smart panel placement — avoids overlapping other open panels.
 *
 * Uses a persistent registry where DraggablePanel components register their
 * actual position + size on mount and unregister on unmount.  getSmartPosition
 * reads from this registry to find free space.
 */

// ── Panel registry (shared mutable state) ────────────────────────────────────
// Map<panelId, { x, y, w, h }>
const _registry = new Map();
let _nextId = 0;

/**
 * Register a panel's position. Called by DraggablePanel on mount.
 * @returns {number} A unique panel ID for later unregistration.
 */
export function registerPanel(x, y, w, h) {
    const id = _nextId++;
    _registry.set(id, { x, y, w, h });
    return id;
}

/**
 * Update a panel's recorded position (e.g. after drag or resize).
 */
export function updatePanel(id, x, y, w, h) {
    if (_registry.has(id)) _registry.set(id, { x, y, w, h });
}

/**
 * Unregister a panel. Called by DraggablePanel on unmount.
 */
export function unregisterPanel(id) {
    _registry.delete(id);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, pad) {
    return (
        ax < bx + bw + pad &&
        ax + aw + pad > bx &&
        ay < by + bh + pad &&
        ay + ah + pad > by
    );
}

/**
 * Computes a smart starting position for a draggable panel that avoids
 * existing open panels.
 *
 * @param {number} width      - The width of the panel to be spawned.
 * @param {number} heightHint - An estimated height of the panel.
 * @param {'center'|'left'|'right'} preference - The preferred spawning region.
 * @returns {{x: number, y: number}} The best computed coordinate.
 */
export function getSmartPosition(width = 250, heightHint = 300, preference = 'left', topMargin = 100) {
    if (typeof window === 'undefined') return { x: 0, y: 0 };

    if (preference === 'force-center') {
        const vWidth = window.innerWidth;
        const vHeight = window.innerHeight;
        const x = Math.round((vWidth - width) / 2);
        const y = Math.max(topMargin, Math.round((vHeight - heightHint) / 2) - 50);
        return { x, y };
    }

    const PADDING = 14;
    const TOP_MARGIN = topMargin;
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    // Gather all occupied rectangles from the registry
    const occupied = [];
    for (const rect of _registry.values()) {
        occupied.push(rect);
    }

    // ── Compute starting anchor ─────────────────────────────────────────────
    let startX, startY = TOP_MARGIN;

    if (preference === 'center') {
        startX = Math.round((vWidth - width) / 2);
        startY = Math.max(TOP_MARGIN, Math.round((vHeight - heightHint) / 2) - 50);
    } else if (preference === 'right') {
        startX = vWidth - width - 20;
    } else if (preference === 'inspector') {
        // Offset by 240 to clear the default OutlinerPanel position (200w + 20pad + 20gap)
        startX = vWidth - width - 240;
    } else {
        startX = 20;
    }

    // ── Search for a free slot ──────────────────────────────────────────────
    let x = startX;
    let y = startY;
    const MAX_ATTEMPTS = 25;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        // Check if this candidate overlaps any occupied rect
        let hit = null;
        for (const rect of occupied) {
            if (rectsOverlap(x, y, width, heightHint, rect.x, rect.y, rect.w, rect.h, PADDING)) {
                hit = rect;
                break;
            }
        }

        if (!hit) {
            return { x, y };
        }

        // ── Resolve the collision ───────────────────────────────────────────
        if (preference === 'center') {
            x += 40;
            y += 40;
        } else {
            // Try below the panel we hit
            y = hit.y + hit.h + PADDING;

            // If we'd go off the bottom, wrap to a new column
            if (y + heightHint > vHeight - 20) {
                y = TOP_MARGIN;
                if (preference === 'left') {
                    x = hit.x + hit.w + PADDING;
                } else {
                    x = hit.x - width - PADDING;
                }
            }
        }

        // Clamp to viewport edges
        if (x < 0) x = 0;
        if (x + width > vWidth) x = vWidth - width;
        if (y < TOP_MARGIN) y = TOP_MARGIN;
    }

    // Fallback
    return { x: startX, y: startY };
}
