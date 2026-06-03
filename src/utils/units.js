/**
 * Format a numeric value (in inches) for display based on the active unit system.
 * Rounds to the nearest 1/16" for imperial (standard woodworking precision).
 * @param {number} val - The value in inches
 * @param {string} units - 'imperial' or 'metric'
 * @returns {string} Formatted string with unit suffix
 */
export const formatUnit = (val, units) => {
    if (units === 'metric') return `${(val * 25.4).toFixed(1)}mm`;
    
    let whole = Math.floor(val);
    let num = Math.round((val % 1) * 16); // 1/16" precision
    let den = 16;
    
    if (num === 16) {
        whole += 1;
        num = 0;
    }
    
    if (num === 0) {
        return `${whole}"`;
    }
    
    // Simplify: 2/16 → 1/8, 4/16 → 1/4, 8/16 → 1/2, etc.
    while (num % 2 === 0 && den > 1) {
        num /= 2;
        den /= 2;
    }
    
    if (whole === 0) {
        return `${num}/${den}"`;
    }
    
    return `${whole} ${num}/${den}"`;
};

/**
 * Get the decimal inch value for a given grid snapping string.
 * @param {string} gridSnap - The snapping preset string
 * @param {string} units - 'imperial' or 'metric'
 * @returns {number} Grid step in decimal inches (or 0 if off)
 */
export const getGridStep = (gridSnap, units) => {
    if (gridSnap === 'off') return 0;
    if (units === 'metric') {
        if (gridSnap === '1 mm') return 1 / 25.4;
        if (gridSnap === '2 mm') return 2 / 25.4;
        if (gridSnap === '5 mm') return 5 / 25.4;
        if (gridSnap === '10 mm') return 10 / 25.4;
        if (gridSnap.includes('in')) {
            const impVal = getGridStep(gridSnap, 'imperial');
            return impVal;
        }
        const val = parseFloat(gridSnap);
        return isNaN(val) ? 5 / 25.4 : val / 25.4;
    } else {
        if (gridSnap === '1/16 in') return 0.0625;
        if (gridSnap === '1/8 in') return 0.125;
        if (gridSnap === '1/4 in') return 0.25;
        if (gridSnap === '1/2 in') return 0.5;
        if (gridSnap === '1 in') return 1.0;
        if (gridSnap.includes('mm')) {
            const metVal = parseFloat(gridSnap);
            return isNaN(metVal) ? 0.25 : metVal / 25.4;
        }
        return 0.125;
    }
};

/**
 * Convert a value from the active unit system (inches or mm) to the internal decimal inch store.
 * @param {number|string} val - The input value (display value)
 * @param {string} units - 'imperial' or 'metric'
 * @returns {number} The value in decimal inches
 */
export const toImperial = (val, units) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return units === 'metric' ? num / 25.4 : num;
};

/**
 * Convert an internal decimal inch value to the active unit system's display value.
 * @param {number|string} val - The value in decimal inches
 * @param {string} units - 'imperial' or 'metric'
 * @returns {number} The display value (in inches or mm)
 */
export const toDisplay = (val, units) => {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return units === 'metric' ? num * 25.4 : num;
};

/**
 * Parse a value into a float, falling back to a default value if undefined/null/empty or NaN.
 * @param {any} val - The input value to parse
 * @param {number} def - The default value if parsing fails (defaults to 0)
 * @returns {number} The parsed number or default
 */
export const parseNum = (val, def = 0) => {
    if (val === undefined || val === null || val === '') return def;
    const n = parseFloat(val);
    return isNaN(n) ? def : n;
};


