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

// Compass dial: `count` ticks evenly spaced around a full circle, index 0
// starting straight up (-90deg) and proceeding clockwise. Angle convention
// matches x = r + r*cos(angleDeg), y = r + r*sin(angleDeg): -90deg is up,
// 0deg is right, 90deg is down, 180deg is left.
export function computeCompassTickAngles(count) {
  const angles = [];
  for (let i = 0; i < count; i += 1) {
    angles.push({ index: i, angleDeg: (360 / count) * i - 90 });
  }
  return angles;
}

// The fixed pointer always points straight up (-90deg). This is how far the
// whole dial must turn so the active tick's mark ends up under it.
const COMPASS_POINTER_ANGLE_DEG = -90;

export function computeCompassRotation(tickAngles, activeIndex) {
  return COMPASS_POINTER_ANGLE_DEG - tickAngles[activeIndex].angleDeg;
}
