export function createDiaryState(totalPages) {
  return { current: 0, totalPages, isOpen: false };
}

export function openBook(state) {
  return { ...state, isOpen: true };
}

export function goToNext(state) {
  if (state.current >= state.totalPages - 1) return state;
  return { ...state, current: state.current + 1 };
}

export function goToPrevious(state) {
  if (state.current <= 0) return state;
  return { ...state, current: state.current - 1 };
}

export function canGoNext(state) {
  return state.current < state.totalPages - 1;
}

export function canGoPrevious(state) {
  return state.current > 0;
}

export function goToPage(state, index) {
  const clamped = Math.max(0, Math.min(state.totalPages - 1, index));
  return { ...state, current: clamped };
}

// deltaX is the pixel distance dragged in the direction that progresses
// the flip (the caller is responsible for giving this the right sign
// based on which way the page is being dragged) — always returns a value
// clamped to [0, 1].
export function computeDragProgress(deltaX, pageWidth) {
  if (pageWidth <= 0) return 0;
  return Math.max(0, Math.min(1, deltaX / pageWidth));
}

function computeDirectionalDragDistance(startX, currentX, direction) {
  const deltaX = direction === 'next' ? startX - currentX : currentX - startX;
  return Math.max(0, deltaX);
}

export function computeDirectionalDragProgress(startX, currentX, pageWidth, direction) {
  const distance = computeDragProgress(
    computeDirectionalDragDistance(startX, currentX, direction),
    pageWidth,
  );
  return direction === 'next' ? distance : 1 - distance;
}

export function shouldActivateDirectionalDrag(startX, currentX, direction, thresholdPx) {
  return computeDirectionalDragDistance(startX, currentX, direction) >= thresholdPx;
}

export function isFlipInteractionLocked(isFlipping, dragFlip) {
  return isFlipping || dragFlip !== null;
}

export function ownsDragInteraction(currentDrag, candidateDrag, pointerId) {
  return (
    currentDrag !== null
    && currentDrag === candidateDrag
    && currentDrag.pointerId === pointerId
  );
}

export function computeCurlMotion(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return Math.sin(Math.PI * clamped) + 0;
}

export function computeUnderlayOpacities(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    leftIn: 0.6 * clamped,
    rightOut: 0.7 * (1 - clamped),
  };
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function computeSliceThetas(progress, sliceCount) {
  const clamped = Math.max(0, Math.min(1, progress));
  const base = -Math.PI * clamped;
  const motion = Math.sin(Math.PI * clamped);
  const curl = motion * (0.4 + 0.1 * motion);
  const thetas = [];
  for (let k = 0; k < sliceCount; k++) {
    const t = (k + 0.5) / sliceCount;
    const profile = Math.sin(Math.PI * t) * (0.3 + 0.7 * t);
    const counterCurl = 0.08 * motion * Math.sin(2 * Math.PI * t);
    const radians = base + curl * profile + counterCurl;
    thetas.push(((radians * 180) / Math.PI) + 0);
  }
  return thetas;
}

export function computeSliceLayout(thetasDeg, sliceWidthPx) {
  let x = 0;
  let z = 0;
  const positions = [];
  for (const theta of thetasDeg) {
    const radians = (theta * Math.PI) / 180;
    positions.push({ x, z });
    x += sliceWidthPx * Math.cos(radians);
    z -= sliceWidthPx * Math.sin(radians);
  }
  return {
    positions,
    tip: {
      x,
      z,
      rotateDeg: thetasDeg.length ? thetasDeg[thetasDeg.length - 1] : 0,
    },
  };
}

export function contentOffsetForSlice(k, sliceCount, face) {
  return face === 'back' ? sliceCount - 1 - k : k;
}

export function createFlipTransition(currentIndex, direction) {
  return direction === 'next'
    ? { fromIndex: currentIndex, toIndex: currentIndex + 1, startProgress: 0, targetProgress: 1 }
    : { fromIndex: currentIndex - 1, toIndex: currentIndex, startProgress: 1, targetProgress: 0 };
}

export function shouldCompleteDirectionalFlip(progress, direction) {
  return direction === 'next' ? progress >= 0.5 : progress < 0.5;
}

export function resolveDragSettle({
  progress,
  direction,
  startProgress,
  targetProgress,
  cancelled = false,
}) {
  const completes = !cancelled && shouldCompleteDirectionalFlip(progress, direction);
  return {
    completes,
    settleProgress: completes ? targetProgress : startProgress,
  };
}
