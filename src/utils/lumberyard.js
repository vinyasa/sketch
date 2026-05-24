/**
 * Utility for parsing standard lumberyard nominal sizing and converting to actual woodworking dimensions.
 * For softwoods:
 * - 1" nominal -> 0.75" actual
 * - 2" nominal -> 1.5" actual
 * - 3" nominal -> 2.5" actual
 * - 4" nominal -> 3.5" actual
 * - 5" nominal -> 4.5" actual
 * - 6" nominal -> 5.5" actual
 * - 8" nominal -> 7.25" actual
 * - 10" nominal -> 9.25" actual
 * - 12" nominal -> 11.25" actual
 */

const NOMINAL_TO_ACTUAL = {
    1: 0.75,
    2: 1.5,
    3: 2.5,
    4: 3.5,
    5: 4.5,
    6: 5.5,
    8: 7.25,
    10: 9.25,
    12: 11.25
};

export function parseLumberyardNominal(text) {
    if (!text) return null;
    
    // Clean string: remove spaces, lowercase
    const clean = text.trim().toLowerCase();
    
    // Match patterns like "2x4", "1 x 6", "2x4x96" or "2x4x8'" or "2x4x8ft"
    // Group 1: Thickness
    // Group 2: Width
    // Group 3: Length (optional)
    const match = clean.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)(?:\s*[xX]\s*(\d+(?:\.\d+)?))?/);
    if (!match) return null;
    
    const nomT = parseFloat(match[1]);
    const nomW = parseFloat(match[2]);
    const nomLText = match[3];
    
    const actualT = NOMINAL_TO_ACTUAL[nomT];
    const actualW = NOMINAL_TO_ACTUAL[nomW];
    
    if (actualT === undefined || actualW === undefined) return null;
    
    const result = {
        thickness: actualT,
        width: actualW
    };
    
    if (nomLText !== undefined) {
        let nomL = parseFloat(nomLText);
        if (!isNaN(nomL)) {
            // Check if user explicitly wrote feet or a single quote for feet, or if they wrote a small integer
            // E.g. "2x4x8'" or "2x4x8ft" or "2x4x8"
            // If length is less than or equal to 16, it is standard woodshop representation of feet length.
            // If they wrote something like "2x4x96", it is in inches.
            const hasFeetSuffix = clean.includes("'") || clean.includes("ft") || clean.includes("feet");
            if (hasFeetSuffix || nomL <= 16) {
                result.length = nomL * 12;
            } else {
                result.length = nomL;
            }
        }
    }
    
    return result;
}
