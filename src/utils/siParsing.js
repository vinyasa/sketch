export function parseSiMeasurement(str) {
  if (!str) return null;

  const mixed = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const frac = parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
    return whole + (whole < 0 ? -frac : frac);
  }

  const frac = str.match(/^(-?)(\d+)\/(\d+)$/);
  if (frac) {
    return ((frac[1] === '-' ? -1 : 1) * parseInt(frac[2], 10)) / parseInt(frac[3], 10);
  }

  const value = parseFloat(str);
  return Number.isNaN(value) ? null : value;
}

export function extractSiMeasurement(text) {
  const match = text.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?\d*\.?\d+)/);
  return match ? parseSiMeasurement(match[1]) : null;
}
