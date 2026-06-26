export function resolveMoveAxis(lower) {
  let axis = 'y';
  if (
    lower.includes('red') ||
    lower.includes('left') ||
    lower.includes('right') ||
    /\bx\b/.test(lower)
  ) {
    axis = 'x';
  }
  if (
    lower.includes('blue') ||
    lower.includes('forward') ||
    lower.includes('back') ||
    /\bz\b/.test(lower)
  ) {
    axis = 'z';
  }
  if (
    lower.includes('green') ||
    lower.includes('up') ||
    lower.includes('down') ||
    /\by\b/.test(lower)
  ) {
    axis = 'y';
  }
  return axis;
}

export function resolveSignedMoveAmount(lower, parseMeasurementToken) {
  let value = 1;
  if (
    lower.includes('down') ||
    lower.includes('left') ||
    lower.includes('back')
  ) {
    value = -1;
  }

  const match = lower.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?[\d.]+)/);
  if (match) {
    value = parseMeasurementToken(match[1]) * (value < 0 ? -1 : 1);
  }

  return value;
}

export function resolveResizeDimension(lower) {
  const isTall = /(taller|tall)/.test(lower) && !/(length|longer|long)/.test(lower);
  const isShorter = /\bshorter\b/.test(lower) && !/(length|longer|long)/.test(lower);
  const isLength = !isTall && !isShorter && /(long|length|longer)/.test(lower);
  const isWidth = /(wide|narrow|width|wider)/.test(lower);
  const isThickness = /(thick|thin|thicker|thinner|thickness)/.test(lower);

  if (isTall || isShorter) return 'height';
  if (isLength) return 'length';
  if (isWidth) return 'width';
  if (isThickness) return 'thickness';
  if (/(right|left)/.test(lower) || lower.includes('red') || /\bx\b/.test(lower)) return 'length';
  if (/(up|down|top|bottom)/.test(lower) || lower.includes('green') || /\by\b/.test(lower)) return 'height';
  if (/(front|back)/.test(lower) || lower.includes('blue') || /\bz\b/.test(lower)) return 'width';
  return 'thickness';
}

export function resolveResizeDelta(lower, value) {
  const isShorter = /\bshorter\b/.test(lower) && !/(length|longer|long)/.test(lower);
  const isNegative =
    isShorter ||
    /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
  return isNegative ? -value : value;
}

export function resolveRotateAxis(lower) {
  let axis = 'y';
  if (/(right|left|red|\bx\b)/.test(lower)) axis = 'x';
  else if (/(front|back|blue|\bz\b)/.test(lower)) axis = 'z';
  return axis;
}
