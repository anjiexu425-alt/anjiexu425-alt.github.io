// Fixed jitter patterns (not Math.random) so the scatter is deterministic
// and testable, while still reading as an irregular, hand-tossed spread of
// photos. Cycled by index % length if there are ever more cards than entries.
const ROTATE_JITTER_DEG = [-18, 12, -24, 20, -9, 16, -22, 8];
const OFFSET_X_JITTER_PX = [-14, 10, -8, 16, -12, 6, -18, 14];
const OFFSET_Y_JITTER_PX = [10, -18, 14, -6, 18, -14, 8, -20];
const CARD_SPACING_PX = 120;

export function createExperienceState(cardCount) {
  return { cardCount, flippedIndex: null };
}

export function toggleFlip(state, index) {
  return { ...state, flippedIndex: state.flippedIndex === index ? null : index };
}

export function computeScatterOffsets(cardCount) {
  const center = (cardCount - 1) / 2;
  const offsets = [];
  for (let i = 0; i < cardCount; i += 1) {
    const baseX = (i - center) * CARD_SPACING_PX;
    offsets.push({
      index: i,
      rotateDeg: ROTATE_JITTER_DEG[i % ROTATE_JITTER_DEG.length],
      translateX: Math.round(baseX + OFFSET_X_JITTER_PX[i % OFFSET_X_JITTER_PX.length]),
      translateY: OFFSET_Y_JITTER_PX[i % OFFSET_Y_JITTER_PX.length],
      zIndex: i + 1,
    });
  }
  return offsets;
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
