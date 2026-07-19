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
 * Builds an SVG stroke-dasharray for a circle of the given radius, leaving
 * a gap centered on each item's angle so the dashed ring reads as "broken"
 * by the label text sitting on it, rather than the dashes running
 * underneath the words. `gapWidth` is the caller-measured pixel width the
 * gap needs (e.g. from SVGTextContentElement.getComputedTextLength() on
 * the actual rendered label) — this function only handles the geometry.
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
