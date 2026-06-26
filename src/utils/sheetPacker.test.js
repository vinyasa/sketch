import { describe, expect, it } from "vitest";
import { getSortedDims, packPlywoodSheets } from "./sheetPacker";

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? "Board",
    size: overrides.size ?? [30, 0.75, 20],
    lumberType: overrides.lumberType ?? "plywood",
    material: overrides.material ?? "pine",
    grainDirection: overrides.grainDirection ?? "length",
    visible: overrides.visible,
    ...overrides,
  };
}

describe("sheetPacker", () => {
  describe("getSortedDims", () => {
    it("sorts dimensions from largest to smallest", () => {
      expect(getSortedDims([0.75, 48, 24])).toEqual([48, 24, 0.75]);
    });

    it("falls back for invalid size input", () => {
      expect(getSortedDims(null)).toEqual([1, 1, 1]);
    });
  });

  describe("packPlywoodSheets", () => {
    it("ignores non-plywood and hidden boards", () => {
      const results = packPlywoodSheets([
        makeBoard({ id: 1, lumberType: "solid" }),
        makeBoard({ id: 2, visible: false }),
      ]);

      expect(results).toEqual([]);
    });

    it("groups plywood by thickness and material", () => {
      const results = packPlywoodSheets([
        makeBoard({ id: 1, material: "pine", size: [30, 0.75, 20] }),
        makeBoard({ id: 2, material: "pine", size: [18, 0.75, 12] }),
        makeBoard({ id: 3, material: "walnut", size: [18, 0.5, 12] }),
      ]);

      expect(results).toHaveLength(2);
      expect(
        results.map((group) => group.thickness).sort((a, b) => a - b),
      ).toEqual([0.5, 0.75]);
    });

    it("preserves wood grain orientation for wood materials", () => {
      const lengthGroup = packPlywoodSheets([
        makeBoard({
          id: 1,
          material: "pine",
          grainDirection: "length",
          size: [30, 0.75, 20],
        }),
      ]);
      const widthGroup = packPlywoodSheets([
        makeBoard({
          id: 2,
          material: "pine",
          grainDirection: "width",
          size: [30, 0.75, 20],
        }),
      ]);

      const lengthPlacement = lengthGroup[0].sheets[0].placements[0];
      const widthPlacement = widthGroup[0].sheets[0].placements[0];

      expect(lengthPlacement.w).toBe(20);
      expect(lengthPlacement.h).toBe(30);
      expect(lengthPlacement.rotated).toBe(false);

      expect(widthPlacement.w).toBe(30);
      expect(widthPlacement.h).toBe(20);
      expect(widthPlacement.rotated).toBe(true);
    });

    it("allows painted parts to rotate to fit a sheet better", () => {
      const results = packPlywoodSheets(
        [
          makeBoard({
            id: 1,
            material: { type: "color", hex: "#ffffff" },
            size: [70, 0.75, 40],
          }),
        ],
        "5x5",
      );

      const placement = results[0].sheets[0].placements[0];

      expect(placement.w).toBe(40);
      expect(placement.h).toBe(70);
      expect(placement.rotated).toBe(false);
    });

    it("creates multiple sheets when kerf prevents parts from sharing a single sheet", () => {
      const results = packPlywoodSheets([
        makeBoard({ id: 1, size: [96, 0.75, 24] }),
        makeBoard({ id: 2, size: [96, 0.75, 24] }),
        makeBoard({ id: 3, size: [96, 0.75, 24] }),
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].sheets).toHaveLength(3);
      expect(
        results[0].sheets.every((sheet) => Array.isArray(sheet.placements)),
      ).toBe(true);
      expect(results[0].sheets.map((sheet) => sheet.placements.length)).toEqual(
        [1, 1, 1],
      );
    });

    it("computes sheet efficiency metrics", () => {
      const results = packPlywoodSheets([
        makeBoard({ id: 1, size: [48, 0.75, 24] }),
      ]);

      const sheet = results[0].sheets[0];
      expect(sheet.usedArea).toBe(48 * 24);
      expect(sheet.totalArea).toBe(48 * 96);
      expect(sheet.efficiency).toBeCloseTo(25);
    });
  });
});
