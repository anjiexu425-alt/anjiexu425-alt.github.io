export function createExperienceState(cardCount, activeIndex = 0) {
  return { cardCount, activeIndex, flipped: false };
}

// Clicking the already-active card flips it (to reveal detail text later);
// clicking any other card makes it active instead, unflipped.
export function selectCard(state, index) {
  if (index === state.activeIndex) {
    return { ...state, flipped: !state.flipped };
  }
  return { ...state, activeIndex: index, flipped: false };
}

// Coverflow layout: each card's position is relative to how far it sits
// from the active card (diff), not a fixed slot — so the whole fan
// reflows around whichever card is active. Ported from the reference
// TimelineCard.tsx: rotation and horizontal spread grow linearly with
// diff, vertical position follows an arch (diff^2), the active card lifts
// up and scales up, everything else scales down and sits further back.
const FAN_ROTATE_STEP_DEG = 11;
const FAN_TRANSLATE_STEP_PX = 140;
const FAN_ARCH_COEFFICIENT_PX = 10;
const FAN_ACTIVE_LIFT_PX = 32;
const FAN_ACTIVE_SCALE = 1.05;
const FAN_INACTIVE_SCALE = 0.94;

export function computeCoverflowOffsets(cardCount, activeIndex) {
  const offsets = [];
  for (let i = 0; i < cardCount; i += 1) {
    const diff = i - activeIndex;
    const isActive = i === activeIndex;
    const archY = diff * diff * FAN_ARCH_COEFFICIENT_PX;
    offsets.push({
      index: i,
      isActive,
      rotateDeg: diff * FAN_ROTATE_STEP_DEG,
      translateX: diff * FAN_TRANSLATE_STEP_PX,
      translateY: isActive ? archY - FAN_ACTIVE_LIFT_PX : archY,
      scale: isActive ? FAN_ACTIVE_SCALE : FAN_INACTIVE_SCALE,
      zIndex: isActive ? 50 : 20 - Math.abs(diff),
    });
  }
  return offsets;
}

// Compass dial: `count` ticks spread evenly across a 112deg arc centered on
// straight up (-90deg), ported from the reference TimelineArc.tsx (112deg
// span / 4 gaps = 28deg apart for 5 points). Angle convention matches
// x = cx + r*cos(angleDeg), y = cy + r*sin(angleDeg): -90deg is up.
const ARC_SPAN_DEG = 112;
const ARC_START_DEG = -90 - ARC_SPAN_DEG / 2;

export function computeCompassTickAngles(count) {
  const step = count > 1 ? ARC_SPAN_DEG / (count - 1) : 0;
  const angles = [];
  for (let i = 0; i < count; i += 1) {
    angles.push({ index: i, angleDeg: ARC_START_DEG + i * step });
  }
  return angles;
}

// The fixed pointer always points straight up (-90deg). This is how far the
// whole dial must turn so the active tick's mark ends up under it.
const COMPASS_POINTER_ANGLE_DEG = -90;

export function computeCompassRotation(tickAngles, activeIndex) {
  return COMPASS_POINTER_ANGLE_DEG - tickAngles[activeIndex].angleDeg;
}
