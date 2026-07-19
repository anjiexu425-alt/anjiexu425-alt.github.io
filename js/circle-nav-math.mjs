export function computeLabelAngles(count) {
  const angles = [];
  for (let i = 0; i < count; i += 1) {
    angles.push((360 / count) * i - 90);
  }
  return angles;
}

export function arcLengthAtAngle(angleDeg, radius) {
  const circumference = 2 * Math.PI * radius;
  const normalizedDeg = ((angleDeg % 360) + 360) % 360;
  return (normalizedDeg / 360) * circumference;
}

/**
 * A single circular <textPath> can only render one half of the circle with
 * upright text — the other half is necessarily mirrored (this is inherent
 * to how SVG orients glyphs along a path, not a bug in a specific browser).
 * So label text is split across two static semicircle paths, each authored
 * in the direction that keeps its half upright:
 *   - "top" path: leftmost -> rightmost, arcing over the top
 *   - "bottom" path: leftmost -> rightmost, arcing under the bottom
 * Both paths start at the leftmost point (offset 0) and end at the
 * rightmost point (offset = pi * radius), so a label's offset transitions
 * continuously as it crosses from one half to the other.
 */
export function resolveArcPlacement(angleDeg, radius) {
  const normalizedDeg = ((angleDeg % 360) + 360) % 360;
  const toRad = (deg) => (deg * Math.PI) / 180;

  if (normalizedDeg >= 180) {
    return { path: 'top', offset: radius * toRad(normalizedDeg - 180) };
  }
  return { path: 'bottom', offset: radius * toRad(180 - normalizedDeg) };
}

/**
 * Builds an SVG stroke-dasharray for the (separate, always-visible) dashed
 * orbit circle, leaving a gap centered on each item's current angle so the
 * dashed ring reads as "broken" by the label text sitting on it. This
 * circle uses its own default start point/direction (rightmost point,
 * clockwise) via arcLengthAtAngle — independent of the top/bottom text
 * paths above, which only exist to keep glyphs upright.
 */
export function computeOrbitDashArray(items, radius) {
  const circumference = 2 * Math.PI * radius;

  const gaps = items
    .map(({ angleDeg, gapWidth }) => {
      const arcCenter = arcLengthAtAngle(angleDeg, radius);
      return { start: arcCenter - gapWidth / 2, end: arcCenter + gapWidth / 2 };
    })
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;

  gaps.forEach((gap) => {
    const gapStart = ((gap.start % circumference) + circumference) % circumference;
    const gapEnd = gapStart + (gap.end - gap.start);
    segments.push(Math.max(gapStart - cursor, 0));
    segments.push(gap.end - gap.start);
    cursor = gapEnd;
  });

  segments.push(Math.max(circumference - cursor, 0));

  return segments;
}
