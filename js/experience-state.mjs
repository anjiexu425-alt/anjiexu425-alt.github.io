export function createExperienceState(cardCount) {
  return { cardCount, flippedIndex: null };
}

export function toggleFlip(state, index) {
  return { ...state, flippedIndex: state.flippedIndex === index ? null : index };
}

// Exact per-card offsets for the 5 real Experience entries: horizontal
// spread widening toward the edges, vertical arc lifting the middle card
// highest (translateY least/most negative there) and dropping the outer
// cards lower, rotation widening outward on the same side as translateX.
const FAN_OFFSETS = [
  { translateX: -230, translateY: 24, rotateDeg: -35 },
  { translateX: -115, translateY: -30, rotateDeg: -17 },
  { translateX: 0, translateY: -52, rotateDeg: 0 },
  { translateX: 115, translateY: -30, rotateDeg: 17 },
  { translateX: 230, translateY: 24, rotateDeg: 35 },
];

export function computeFanOffsets() {
  return FAN_OFFSETS.map((offset, index) => ({ index, ...offset }));
}

// Distributes `count` points along the bottom half of a circle of the given
// radius (angle 180deg at the left edge, through 90deg at the lowest point
// of the dip, to 0deg at the right edge), so a timeline reads left-to-right
// in a shallow downward arc. y=0 at the two edges, y=radius at the deepest
// point in the middle.
export function computeArcTimelinePositions(count, radius) {
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angleDeg = 180 - t * 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    positions.push({
      index: i,
      x: radius + radius * Math.cos(angleRad),
      y: radius * Math.sin(angleRad),
      angleDeg,
    });
  }
  return positions;
}
