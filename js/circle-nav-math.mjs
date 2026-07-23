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
 * Degrees each semicircle path extends past its nominal 180/0deg boundary,
 * on both ends. A label anchored (text-anchor: middle) near a path's true
 * endpoint has no path left for the half of its text past that anchor —
 * SVG simply doesn't render characters that would fall beyond the path's
 * length, so the word appears to be cut in half. The buffer gives every
 * anchor room for the longest label's half-width before it runs out of
 * path, without affecting orientation (a single continuously-authored arc
 * never flips orientation partway through, only switching arcs does).
 *
 * `bufferDeg` is caller-supplied rather than a hardcoded guess, because
 * the right amount depends on the longest label's actual rendered width —
 * which depends on the font actually in use. A fixed constant tuned for
 * one font (e.g. a fallback font in an environment that can't load the
 * real webfont) silently stops being enough in another.
 */
export function resolveArcPlacement(angleDeg, radius, bufferDeg) {
  const normalizedDeg = ((angleDeg % 360) + 360) % 360;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const bufferArc = radius * toRad(bufferDeg);

  if (normalizedDeg >= 180) {
    return { path: 'top', offset: radius * toRad(normalizedDeg - 180) + bufferArc };
  }
  return { path: 'bottom', offset: radius * toRad(180 - normalizedDeg) + bufferArc };
}

/**
 * Converts a required arc-length buffer (typically: the longest label's
 * rendered half-width, plus a safety margin, both in px) into the degrees
 * of extra path length resolveArcPlacement's `bufferDeg` needs on each end.
 */
export function bufferDegForArcLength(bufferLengthPx, radius) {
  return (bufferLengthPx / radius) * (180 / Math.PI);
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
