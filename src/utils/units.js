/**
 * Format a numeric value (in inches) for display based on the active unit system.
 * @param {number} val - The value in inches
 * @param {string} units - 'imperial' or 'metric'
 * @returns {string} Formatted string with unit suffix
 */
export const formatUnit = (val, units) => {
    if (units === 'metric') return `${(val * 25.4).toFixed(1)}mm`;
    
    let whole = Math.floor(val);
    let num = Math.round((val % 1) * 8);
    let den = 8;
    
    if (num === 8) {
        whole += 1;
        num = 0;
    }
    
    if (num === 0) {
        return `${whole}"`;
    }
    
    while (num % 2 === 0 && den > 1) {
        num /= 2;
        den /= 2;
    }
    
    if (whole === 0) {
        return `${num}/${den}"`;
    }
    
    return `${whole} ${num}/${den}"`;
};
