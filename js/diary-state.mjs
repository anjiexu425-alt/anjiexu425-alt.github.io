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

export function shouldCompleteFlip(progress) {
  return progress >= 0.5;
}

export function computeCurlMotion(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return Math.sin(Math.PI * clamped) + 0;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function computeSliceThetas(progress, sliceCount, direction) {
  const sign = direction === 'next' ? 1 : -1;
  const base = -Math.PI * progress;
  const motion = Math.sin(Math.PI * progress);
  const thetas = [];
  for (let k = 0; k < sliceCount; k++) {
    const t = (k + 0.5) / sliceCount;
    const edgeLag = 0.24 * Math.sin(2 * Math.PI * progress) * Math.pow(t, 1.3);
    const softBow = 0.045 * motion * Math.sin(Math.PI * t);
    const radians = sign * (base + edgeLag + softBow);
    thetas.push(((radians * 180) / Math.PI) + 0);
  }
  return thetas;
}

export function computeSliceLayout(thetasDeg, sliceWidthPx, direction) {
  let x = 0;
  let z = 0;
  const raw = [];
  for (const theta of thetasDeg) {
    const radians = (theta * Math.PI) / 180;
    raw.push({ x, z });
    x += sliceWidthPx * Math.cos(radians);
    z -= sliceWidthPx * Math.sin(radians);
  }
  const lastTheta = thetasDeg.length ? thetasDeg[thetasDeg.length - 1] : 0;
  if (direction === 'next') {
    return { positions: raw, tip: { x, z, rotateDeg: lastTheta } };
  }

  const sheetWidthPx = thetasDeg.length * sliceWidthPx;
  const positions = raw.map((point) => ({
    x: (sheetWidthPx - sliceWidthPx - point.x) + 0,
    z: point.z,
  }));
  const lastRaw = raw.length ? raw[raw.length - 1] : { x: 0, z: 0 };
  return {
    positions,
    tip: {
      x: (sheetWidthPx - sliceWidthPx - lastRaw.x) + 0,
      z,
      rotateDeg: lastTheta,
    },
  };
}

export function contentOffsetForSlice(k, sliceCount, direction, face) {
  const frontOffset = direction === 'next' ? k : sliceCount - 1 - k;
  return face === 'back' ? sliceCount - 1 - frontOffset : frontOffset;
}
