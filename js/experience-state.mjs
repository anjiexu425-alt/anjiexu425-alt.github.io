export function createExperienceState(cardCount) {
  return { cardCount, flippedIndex: null };
}

export function toggleFlip(state, index) {
  return { ...state, flippedIndex: state.flippedIndex === index ? null : index };
}

// Rotation only — the fan's overlap comes from CSS negative margin-left on
// cards laid out in normal flex flow, each with transform-origin set to its
// own bottom-center. Because the cards overlap so heavily, those pivot
// points sit close together, so rotating each card by an evenly-increasing
// angle reads as one shared hinge, like a fanned hand of photos, rather
// than cards spinning independently around their own centers.
export function computeFanRotations(cardCount, stepDeg = 10) {
  const center = (cardCount - 1) / 2;
  const rotations = [];
  for (let i = 0; i < cardCount; i += 1) {
    rotations.push({ index: i, rotateDeg: Math.round((i - center) * stepDeg) });
  }
  return rotations;
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
