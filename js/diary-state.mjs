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
