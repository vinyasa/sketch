/**
 * Format a numeric value (in inches) for display based on the active unit system.
 * @param {number} val - The value in inches
 * @param {string} units - 'imperial' or 'metric'
 * @returns {string} Formatted string with unit suffix
 */
export const formatUnit = (val, units) => {
    if (units === 'metric') return `${(val * 25.4).toFixed(1)}mm`;
    const frac = val % 1;
    let label = `${Math.floor(val)}`;
    if (frac > 0) label += ` ${Math.round(frac * 8)}/8`;
    return `${label}"`;
};
