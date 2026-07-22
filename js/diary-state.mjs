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

// Both animationend (the click/keyboard flip's @keyframes) and
// transitionend (the drag flip's post-release settle transition) bubble:
// a descendant firing one must not be mistaken for the sheet's own flip
// finishing. Only an event whose target IS the sheet itself counts.
export function isSheetEventTarget(event, sheet) {
  return event.target === sheet;
}

// deltaX is the pixel distance dragged in the direction that progresses
// the flip (the caller is responsible for giving this the right sign
// based on which way the page is being dragged) — always returns a value
// clamped to [0, 1].
export function computeDragProgress(deltaX, pageWidth) {
  if (pageWidth <= 0) return 0;
  return Math.max(0, Math.min(1, deltaX / pageWidth));
}

// A continuous curve (not fixed keyframe stops) driven directly by live
// drag progress: rotation is linear in progress, lift and opacity each
// follow a single-peaked sine curve (zero/full at both ends, peak at the
// midpoint) so there's no plateau or velocity discontinuity of the kind
// that caused stutter in the earlier @keyframes-based design.
export function computeFlipVisualState(progress, direction) {
  const sign = direction === 'next' ? -1 : 1;
  return {
    rotateDeg: (sign * progress * 180) || 0,
    liftPx: (-16 * Math.sin(progress * Math.PI)) || 0,
    opacity: 1 - 0.35 * Math.sin(progress * Math.PI),
  };
}

export function shouldCompleteFlip(progress) {
  return progress >= 0.5;
}
