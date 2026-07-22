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

// animationend bubbles: a descendant of the flip sheet (e.g. a child
// element with its own CSS animation) firing one must not be mistaken for
// the sheet's own flip animation finishing. Only an event whose target IS
// the sheet itself counts — AnimationEvent has no propertyName the way
// TransitionEvent does, so there's no second property to check here.
export function isSheetAnimationEnd(event, sheet) {
  return event.target === sheet;
}
