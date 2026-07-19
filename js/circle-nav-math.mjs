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
 */
export const ARC_BUFFER_DEG = 35;

/**
 * A single circular <textPath> can only render one half of the circle with
 * upright text — the other half is necessarily mirrored (this is inherent
 * to how SVG orients glyphs along a path, not a bug in a specific browser).
 * So label text is split across two static, buffer-extended semicircle
 * paths, each authored in the direction that keeps its half upright:
 *   - "top" path: (leftmost - buffer) -> (rightmost + buffer), over the top
 *   - "bottom" path: (leftmost + buffer) -> (rightmost - buffer), under the bottom
 * Both paths' nominal (unbuffered) endpoints are the leftmost/rightmost
 * points, so a label's offset transitions continuously as it crosses from
 * one half to the other (offset = 0 at the shared leftmost boundary of the
 * unbuffered path is now offset = bufferArc on the buffered one, applied
 * uniformly to both paths so the seam-crossing math still lines up).
 */
export function resolveArcPlacement(angleDeg, radius) {
  const normalizedDeg = ((angleDeg % 360) + 360) % 360;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const bufferArc = radius * toRad(ARC_BUFFER_DEG);

  if (normalizedDeg >= 180) {
    return { path: 'top', offset: radius * toRad(normalizedDeg - 180) + bufferArc };
  }
  return { path: 'bottom', offset: radius * toRad(180 - normalizedDeg) + bufferArc };
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
