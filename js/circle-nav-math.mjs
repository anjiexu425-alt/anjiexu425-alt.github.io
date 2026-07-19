export function computeRingPositions(labels, radius) {
  const count = labels.length;
  return labels.map((label, i) => {
    const angleDeg = (360 / count) * i - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = radius * Math.cos(angleRad);
    const y = radius * Math.sin(angleRad);
    const rotateDeg = angleDeg + 90;
    return { label, angleDeg, x, y, rotateDeg };
  });
}

/**
 * Builds an SVG stroke-dasharray for a circle of the given radius, leaving
 * a gap centered on each label's angle (from computeRingPositions) so the
 * dashed ring reads as "broken" by the label text sitting on it, rather
 * than the dashes running underneath the words.
 */
export function computeOrbitDashArray(labels, radius, options = {}) {
  const charWidthPx = options.charWidthPx ?? 7;
  const paddingPx = options.paddingPx ?? 14;
  const count = labels.length;
  const circumference = 2 * Math.PI * radius;

  const gaps = labels
    .map((label, i) => {
      const angleDeg = (360 / count) * i - 90;
      const normalizedDeg = ((angleDeg % 360) + 360) % 360;
      const arcCenter = (normalizedDeg / 360) * circumference;
      const gapWidth = label.length * charWidthPx + paddingPx;
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
