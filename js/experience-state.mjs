export function createExperienceState(cardCount, activeIndex = 0) {
  return { cardCount, activeIndex, flipped: false };
}

export function selectCard(state, index) {
  if (index === state.activeIndex) {
    return { ...state, flipped: !state.flipped };
  }
  return { ...state, activeIndex: index, flipped: false };
}

export function computeFanOffsets(cardCount, activeIndex) {
  const offsets = [];
  for (let i = 0; i < cardCount; i += 1) {
    const distance = i - activeIndex;
    offsets.push({
      index: i,
      isActive: i === activeIndex,
      rotateDeg: distance * 6,
      translateX: distance * 18,
      zIndex: cardCount - Math.abs(distance),
    });
  }
  return offsets;
}
