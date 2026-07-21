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

// transitionend bubbles: a descendant of the flip sheet (e.g. a hovered
// child element with its own transform transition) firing one must not be
// mistaken for the sheet's own rotation finishing. Only an event whose
// target IS the sheet itself, for the "transform" property, counts.
export function isSheetTransformEnd(event, sheet) {
  return event.target === sheet && event.propertyName === 'transform';
}
