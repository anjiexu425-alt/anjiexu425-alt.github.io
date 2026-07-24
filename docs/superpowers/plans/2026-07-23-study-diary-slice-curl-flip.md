# Study Diary Slice-Curl Page Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Study Diary's single-sheet `rotateY` page flip with a 16-slice curling silhouette (ported from a reference implementation), driven by one shared progress-to-geometry pipeline used by both the click/keyboard flip and the press-and-drag flip.

**Architecture:** New pure geometry functions in `js/diary-state.mjs` turn a `progress` value (0–1) into per-slice rotation angles, 3D positions, and a shared "how mid-curl" intensity. `js/diary.js` builds 16 real (front+back) DOM slices per flip, each showing its own strip of the actual page content, and drives them every frame — either from a `requestAnimationFrame` loop (click/keyboard, and drag settle) or directly from live pointer position (drag in progress).

**Tech Stack:** Vanilla JS (ES modules, no bundler), CSS 3D transforms, `node:test` for pure-function unit tests. No new dependencies.

## Global Constraints

- Slice count is a single constant, `SLICE_COUNT = 16` (spec: "风险与兜底" — must be a standalone, easily-tunable constant).
- Curl only renders on the desktop/tablet two-page spread; `prefersInstantTransition()` (unchanged) continues to gate mobile (≤768px) and `prefers-reduced-motion` to the existing instant page-swap.
- Reuse the existing `--diary-flip-duration` CSS custom property (declared on `.diary`, currently `0.7s`) as the animation's timing source — do not hardcode a duration.
- Drag-to-flip completion threshold stays `progress >= 0.5` (`shouldCompleteFlip`, unchanged) — do not adopt the reference's velocity/lower-threshold behavior.
- Do not add window-resize handling mid-flip, and do not make `SLICE_COUNT` responsive — out of scope per spec.
- Do not change the lightbox / mood-button / weather-button / discard-button drag-exclusion logic in `handleStagePointerDown`.
- No overall `translateY` "arc lift" on the sheet — the per-slice curl geometry replaces it (spec: "视觉参数").

Every task's requirements implicitly include the constraints above.

---

## Task 1: `computeCurlMotion` and `easeInOutCubic`

**Files:**
- Modify: `js/diary-state.mjs` (add two new exported functions)
- Modify: `js/diary-state.test.mjs` (add imports + tests)

**Interfaces:**
- Produces: `computeCurlMotion(progress: number): number` — single-peaked curve, 0 at `progress` 0/1, 1 at `progress` 0.5. Used by later tasks to drive shade/highlight/shadow intensity.
- Produces: `easeInOutCubic(t: number): number` — standard ease-in-out-cubic, 0→1. Used by Task 5's `runFlipAnimation`.

- [ ] **Step 1: Write the failing tests**

Add to `js/diary-state.test.mjs`, replacing the existing import block:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
} from './diary-state.mjs';
```

Append these tests at the end of the file:

```js
test('computeCurlMotion is 0 at both ends of the flip', () => {
  assert.ok(Math.abs(computeCurlMotion(0)) < 1e-9);
  assert.ok(Math.abs(computeCurlMotion(1)) < 1e-9);
});

test('computeCurlMotion peaks at progress 0.5', () => {
  assert.equal(computeCurlMotion(0.5), 1);
});

test('computeCurlMotion clamps progress outside 0..1', () => {
  assert.ok(Math.abs(computeCurlMotion(-0.5)) < 1e-9);
  assert.ok(Math.abs(computeCurlMotion(1.5)) < 1e-9);
});

test('easeInOutCubic passes through the endpoints and midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `computeCurlMotion`/`easeInOutCubic` are not exported yet (import will resolve to `undefined`, calling them throws `TypeError: computeCurlMotion is not a function`).

- [ ] **Step 3: Implement**

Add to `js/diary-state.mjs`, after the existing `shouldCompleteFlip` function (end of file):

```js

// A single-peaked curve (0 at both ends, 1 at the midpoint) that drives
// how strongly the "mid-curl" visual effects show: the per-slice shade
// overlay (masks a confirmed Safari bug where live text/photos inside a
// rotating preserve-3d element render garbled near edge-on angles — the
// same fix validated in the previous single-sheet design, now continuous
// and per-slice instead of one fixed opacity value), the curl-edge
// highlight, and the cast shadow.
export function computeCurlMotion(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return Math.sin(Math.PI * clamped) + 0;
}

// Standard ease-in-out-cubic, used by the click/keyboard flip's
// requestAnimationFrame loop (js/diary.js: runFlipAnimation) to advance
// progress from 0 to 1 (or, for the drag-release settle, from wherever
// the drag left off to 0 or 1).
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: PASS, `ℹ tests 23` (19 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add computeCurlMotion and easeInOutCubic for the slice-curl flip"
```

---

## Task 2: `computeSliceThetas`

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `computeSliceThetas(progress: number, sliceCount: number, direction: 'next' | 'prev'): number[]` — an array of length `sliceCount`, each entry the rotation angle **in degrees** for the slice at that walk-index (0 = the slice nearest the spine/hinge, `sliceCount - 1` = the slice nearest the free/curling edge). `direction: 'next'` rotates negative (matches the sign already used and tested for the old single-sheet flip — `-180deg` at `progress` 1); `'prev'` rotates positive, mirroring it. Consumed by Task 3's `computeSliceLayout` and Task 5's `updateCurl`.

- [ ] **Step 1: Write the failing tests**

Update the import block in `js/diary-state.test.mjs` (replace the block from Task 1):

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
  computeSliceThetas,
} from './diary-state.mjs';
```

Append these tests:

```js
test('computeSliceThetas is flat (all zero) at progress 0', () => {
  const thetas = computeSliceThetas(0, 16, 'next');
  assert.equal(thetas.length, 16);
  assert.ok(thetas.every((deg) => deg === 0));
});

test('computeSliceThetas rotates next to -180deg at progress 1', () => {
  const thetas = computeSliceThetas(1, 16, 'next');
  thetas.forEach((deg) => {
    assert.ok(Math.abs(deg - -180) < 1e-6);
  });
});

test('computeSliceThetas rotates prev to +180deg at progress 1', () => {
  const thetas = computeSliceThetas(1, 16, 'prev');
  thetas.forEach((deg) => {
    assert.ok(Math.abs(deg - 180) < 1e-6);
  });
});

test('computeSliceThetas mirrors sign between next and prev at the same progress', () => {
  const next = computeSliceThetas(0.5, 16, 'next');
  const prev = computeSliceThetas(0.5, 16, 'prev');
  next.forEach((deg, k) => {
    assert.ok(Math.abs(deg + prev[k]) < 1e-9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `computeSliceThetas is not a function`.

- [ ] **Step 3: Implement**

Add to `js/diary-state.mjs`, after `easeInOutCubic`:

```js

// Per-slice rotation angles for the curling page, in degrees, indexed by
// walk-distance from the hinge (k=0 nearest the spine, k=sliceCount-1
// nearest the free/curling edge — see computeSliceLayout for how this
// walk-index maps to actual screen position for each direction).
// Each slice's angle is the overall flip rotation (base, identical for
// every slice) plus two small per-slice perturbations, ported from a
// reference implementation: edgeLag makes slices further from the hinge
// lag slightly behind the overall rotation, and softBow makes the
// mid-length slices bow out slightly — together these turn a flat
// rotating rectangle into a genuine curling silhouette.
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
    // `+ 0` normalizes a possible -0 result (e.g. at progress 0) to 0 —
    // node:assert/strict's equal() treats -0 and 0 as unequal.
    thetas.push(((radians * 180) / Math.PI) + 0);
  }
  return thetas;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: PASS, `ℹ tests 27` (23 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add computeSliceThetas for per-slice curl rotation angles"
```

---

## Task 3: `computeSliceLayout`

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: an array of per-slice angles in degrees (the shape `computeSliceThetas` produces), a slice width in pixels, and a direction.
- Produces: `computeSliceLayout(thetasDeg: number[], sliceWidthPx: number, direction: 'next' | 'prev'): { positions: {x: number, z: number}[], tip: {x: number, z: number, rotateDeg: number} }`. `positions[k]` is the `{x, z}` to use in `translate3d(x, 0, z)` for the slice at walk-index `k`. `tip` is the position/angle of the page's free (curling) edge, for the highlight strip and cast shadow. For `direction: 'next'` the hinge sits at the sheet's own local x=0 and walk-index increases left-to-right. For `'prev'` the whole chain is mirrored left-to-right around the sheet's own width, so the hinge still lands at the spine but the free edge sweeps the opposite way. Consumed by Task 5's `updateCurl`.

- [ ] **Step 1: Write the failing tests**

Update the import block in `js/diary-state.test.mjs`:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
} from './diary-state.mjs';
```

Append these tests:

```js
test('computeSliceLayout lays out flat slices left-to-right for next', () => {
  const { positions, tip } = computeSliceLayout([0, 0, 0, 0], 10, 'next');
  assert.deepEqual(positions, [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 20, z: 0 },
    { x: 30, z: 0 },
  ]);
  assert.equal(tip.x, 40);
  assert.equal(tip.z, 0);
  assert.equal(tip.rotateDeg, 0);
});

test('computeSliceLayout mirrors flat slices right-to-left for prev', () => {
  const { positions, tip } = computeSliceLayout([0, 0, 0, 0], 10, 'prev');
  assert.deepEqual(positions, [
    { x: 30, z: 0 },
    { x: 20, z: 0 },
    { x: 10, z: 0 },
    { x: 0, z: 0 },
  ]);
  assert.equal(tip.x, 0);
  assert.equal(tip.z, 0);
});

test('computeSliceLayout carries curl depth (z) into the tip', () => {
  const { tip } = computeSliceLayout([-30], 10, 'next');
  const radians = (-30 * Math.PI) / 180;
  assert.ok(Math.abs(tip.x - 10 * Math.cos(radians)) < 1e-9);
  assert.ok(Math.abs(tip.z - -10 * Math.sin(radians)) < 1e-9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `computeSliceLayout is not a function`.

- [ ] **Step 3: Implement**

Add to `js/diary-state.mjs`, after `computeSliceThetas`:

```js

// Turns per-slice rotation angles into on-screen 3D positions, treating
// the page as a chain of small rigid links hinged at the spine: each
// slice's position is the sum of every previous slice's width, projected
// through that slice's own rotation. `direction` only affects where this
// chain is anchored on screen, not the chain's own math — see the design
// doc (docs/superpowers/specs/2026-07-23-study-diary-slice-curl-flip-
// design.md) for the full reasoning.
export function computeSliceLayout(thetasDeg, sliceWidthPx, direction) {
  let x = 0;
  let z = 0;
  const raw = [];
  for (let k = 0; k < thetasDeg.length; k++) {
    const radians = (thetasDeg[k] * Math.PI) / 180;
    raw.push({ x, z });
    x += sliceWidthPx * Math.cos(radians);
    z -= sliceWidthPx * Math.sin(radians);
  }
  const lastTheta = thetasDeg.length > 0 ? thetasDeg[thetasDeg.length - 1] : 0;

  if (direction === 'next') {
    return { positions: raw, tip: { x, z, rotateDeg: lastTheta } };
  }

  // 'prev' mirrors the whole chain left-to-right around the sheet's own
  // width: a slice that would sit at local x in the 'next' shape sits at
  // (sheetWidth - sliceWidth - x) in the mirrored 'prev' shape. Depth (z)
  // is untouched by a left-right mirror.
  const sheetWidthPx = thetasDeg.length * sliceWidthPx;
  const positions = raw.map((p) => ({ x: (sheetWidthPx - sliceWidthPx - p.x) + 0, z: p.z }));
  const lastRaw = raw.length > 0 ? raw[raw.length - 1] : { x: 0, z: 0 };
  return {
    positions,
    tip: { x: (sheetWidthPx - sliceWidthPx - lastRaw.x) + 0, z, rotateDeg: lastTheta },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: PASS, `ℹ tests 30` (27 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add computeSliceLayout for per-slice 3D positions"
```

---

## Task 4: `contentOffsetForSlice`

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `contentOffsetForSlice(k: number, sliceCount: number, direction: 'next' | 'prev', face: 'front' | 'back'): number` — which strip (0 = leftmost) of the full page content the slice at walk-index `k` should show, for a given face. Consumed by Task 5's `buildCurlDOM` to position each slice's content canvas.

- [ ] **Step 1: Write the failing tests**

Update the import block in `js/diary-state.test.mjs`:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
  contentOffsetForSlice,
} from './diary-state.mjs';
```

Append these tests:

```js
test('contentOffsetForSlice front face reads next slices left-to-right', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'next', 'front'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'next', 'front'), 15);
});

test('contentOffsetForSlice front face reads prev slices right-to-left', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'prev', 'front'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'prev', 'front'), 0);
});

test('contentOffsetForSlice back face mirrors the front face within the slice count', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'next', 'back'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'next', 'back'), 0);
  assert.equal(contentOffsetForSlice(0, 16, 'prev', 'back'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'prev', 'back'), 15);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `contentOffsetForSlice is not a function`.

- [ ] **Step 3: Implement**

Add to `js/diary-state.mjs`, after `computeSliceLayout`:

```js

// Which strip of the full page's content a slice's canvas should show.
// The front face reads left-to-right for 'next' (walk-index k IS the
// content strip, since the hinge is the right page's own left edge) and
// right-to-left for 'prev' (the hinge is the left page's own right edge,
// so k=0 shows the rightmost strip). The back face is always the mirror
// of the front face within the slice count — the same reason a sheet of
// paper's back side reads mirrored relative to its front.
export function contentOffsetForSlice(k, sliceCount, direction, face) {
  const frontOffset = direction === 'next' ? k : sliceCount - 1 - k;
  return face === 'back' ? sliceCount - 1 - frontOffset : frontOffset;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: PASS, `ℹ tests 33` (30 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add contentOffsetForSlice for per-slice content mapping"
```

---

## Task 5: Wire the slice-curl DOM, CSS, and animation driver

**Files:**
- Modify: `css/pages.css:890-1080` (replace the single-sheet flip CSS with the slice/tip/cast-shadow CSS)
- Modify: `css/pages.css:450-458` (update the `--diary-flip-duration` comment)
- Modify: `js/diary.js:1-13` (imports)
- Modify: `js/diary.js:394-478` (replace `buildFlipDOM` with `buildCurlDOM` + `readFlipDurationMs` + `updateCurl` + `runFlipAnimation`)
- Modify: `js/diary.js:491-549` (replace `playFlip`)
- Modify: `js/diary.js:551-678` (replace the drag-flip block; `handleStagePointerCancel` right after it is unchanged)

**Interfaces:**
- Consumes: `computeSliceThetas`, `computeSliceLayout`, `computeCurlMotion`, `contentOffsetForSlice`, `easeInOutCubic` from Tasks 1–4; `computeDragProgress`, `shouldCompleteFlip` (unchanged, from the existing module).
- Produces: `buildCurlDOM(direction, oldEntry, newEntry): { slices, tipEl, castShadowEl, segWidth, sheetWidthPx }` — consumed by `playFlip` and the drag handlers below. `updateCurl(progress, direction, elements)` and `runFlipAnimation(direction, elements, fromProgress, toProgress): Promise<void>` — internal to this task, also called from the drag handlers.

This task has no automated tests of its own (DOM-building/animation-driving code, per this project's existing convention of testing pure logic only) — it ends with a manual verification pass (Step 8) instead of a `node --test` run.

- [ ] **Step 1: Replace the flip CSS block**

In `css/pages.css`, replace lines 890–1080 (from the comment `/* Real 3D page-turn: a half-width sheet...` through the end of the `@keyframes diary-face-shadow-back` block) with:

```css
/* Real page-turn via a curling silhouette: each page is split into
   SLICE_COUNT (see js/diary.js) thin vertical slices, each rotating at a
   slightly different angle so the turning page's edge genuinely curls
   instead of pivoting as one flat rectangle. Both the click/keyboard flip
   and the press-and-drag flip drive the same slices through the same
   progress-to-geometry math (js/diary-state.mjs: computeSliceThetas,
   computeSliceLayout) — see js/diary.js's updateCurl/runFlipAnimation for
   how progress becomes each slice's transform. */
.diary-flip-sheet {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  z-index: 20;
  pointer-events: none;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}

.diary-flip-sheet--next {
  left: 50%;
}

.diary-flip-sheet--prev {
  left: 0;
}

.diary-flip-slice {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transform-origin: left center;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  will-change: transform;
}

.diary-flip-slice__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  background: var(--color-surface);
}

.diary-flip-slice__face--back {
  transform: rotateY(180deg);
}

.diary-flip-slice__canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* Rotation-dependent shading, one per face: opacity is driven every frame
   by computeCurlMotion (js/diary-state.mjs), peaking when a slice is
   nearest edge-on to the viewer. This both reads as natural shading on a
   curling page AND — carried over from the previous single-sheet design —
   masks a confirmed Safari bug where live text/photos inside a rotating
   preserve-3d element render garbled near edge-on angles. */
.diary-flip-slice__shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
}

/* Highlight riding the curling edge, and a soft shadow it casts on the
   page underneath — both positioned/sized every frame from the same
   slice geometry (see updateCurl in js/diary.js), tracking the curl's
   leading edge in real time. */
.diary-flip-tip {
  position: absolute;
  top: 1.5%;
  height: 97%;
  width: 3px;
  z-index: 25;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(70, 60, 45, 0.32), rgba(255, 255, 255, 0.12));
  box-shadow: 0 0 12px rgba(30, 25, 18, 0.25);
}

.diary-flip-castshadow {
  position: absolute;
  top: 1.5%;
  height: 97%;
  z-index: 18;
  pointer-events: none;
  opacity: 0;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(20, 17, 12, 0.28) 0%, rgba(25, 20, 15, 0.12) 45%, transparent 75%);
  filter: blur(2px);
}

/* Cursor affordance: grab-able while idle, grabbing while an active drag
   is in progress (the class is toggled on .diary-stage itself, which
   never gets replaced by buildCurlDOM — only its children do — so it's a
   stable place to hang drag-state styling). */
.diary.is-open .diary-page--left,
.diary.is-open .diary-page--right {
  cursor: grab;
}

.diary-stage--dragging,
.diary-stage--dragging .diary-page--left,
.diary-stage--dragging .diary-page--right {
  cursor: grabbing;
}

/* Static halves beneath the turning sheet: one side darkens as the page
   lifts off it, the other brightens as it's revealed. Duration shares
   --diary-flip-duration with the flip's own runFlipAnimation (js/diary.js)
   so they always finish at exactly the same moment. */
.diary-underlay-shadow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

.diary-underlay-shadow--in {
  background: rgba(0, 0, 0, 0.15);
  animation: diary-underlay-in var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

.diary-underlay-shadow--out {
  background: rgba(0, 0, 0, 0.25);
  animation: diary-underlay-out var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

@keyframes diary-underlay-in {
  from { opacity: 0; }
  to { opacity: 0.6; }
}

@keyframes diary-underlay-out {
  from { opacity: 0.7; }
  to { opacity: 0; }
}
```

- [ ] **Step 2: Update the `--diary-flip-duration` comment**

In `css/pages.css`, inside the `.diary` rule (around line 448), replace:

```css
  /* Single source of truth for the page-flip's timing: the flip sheet's
     own rotation and every shadow effect that accompanies it read from
     this one value, so they can never drift out of sync with each other
     (they previously ran 0.7s vs 0.9s, so the DOM got torn down and
     rebuilt at 0.7s while the shadows still had 0.2s left to fade,
     reading as a flicker/snap). js/diary.js also reads this duration off
     the sheet's computed style for its completion-timeout fallback.
     Change this one value to retime the whole flip; nothing else needs
     to change. */
  --diary-flip-duration: 0.7s;
```

with:

```css
  /* Single source of truth for the page-flip's timing: js/diary.js reads
     this directly (readFlipDurationMs) to time its requestAnimationFrame
     loop, and the static-page underlay shadows below read it too, so
     they can never drift out of sync with each other (they previously
     ran 0.7s vs 0.9s, so the DOM got torn down and rebuilt at 0.7s while
     the shadows still had 0.2s left to fade, reading as a flicker/snap).
     Change this one value to retime the whole flip; nothing else needs
     to change. */
  --diary-flip-duration: 0.7s;
```

- [ ] **Step 3: Update `js/diary.js` imports**

Replace lines 1–13:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
} from './diary-state.mjs';
```

with:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  computeDragProgress,
  shouldCompleteFlip,
  computeSliceThetas,
  computeSliceLayout,
  computeCurlMotion,
  contentOffsetForSlice,
  easeInOutCubic,
} from './diary-state.mjs';
```

- [ ] **Step 4: Replace `buildFlipDOM` with the slice-curl builder and animation driver**

In `js/diary.js`, replace lines 394–478 (the whole `buildFlipDOM` function, from its leading comment through its closing `}`) with:

```js
const SLICE_COUNT = 16;

// Reads the flip's timing straight off the CSS custom property (declared
// on .diary — see css/pages.css) rather than hardcoding a second copy of
// it, so it can never drift out of sync with the underlay shadows that
// also read this variable.
function readFlipDurationMs() {
  const diaryEl = document.querySelector('.diary');
  const raw = getComputedStyle(diaryEl).getPropertyValue('--diary-flip-duration').trim();
  const seconds = parseFloat(raw);
  return Number.isFinite(seconds) ? seconds * 1000 : 700;
}

// Builds the static halves (with underlay shadows) and the SLICE_COUNT
// curling slices (each with front/back faces, a content canvas showing
// its own strip of the real page, and a shade overlay) for a flip in
// progress, and appends everything to .diary-stage. Shared by the
// click/keyboard-triggered flip (playFlip) and the pointer-driven drag
// flip — both need the identical DOM, they just drive it differently
// afterward (a requestAnimationFrame loop vs. live pointer tracking).
// Returns the per-slice elements and measurements updateCurl needs.
function buildCurlDOM(direction, oldEntry, newEntry) {
  const stage = document.querySelector('.diary-stage');
  // Stop decode immediately rather than waiting on GC of the removed
  // elements — cheap insurance against multiple videos competing for the
  // hardware decoder mid-flip.
  stage.querySelectorAll('video').forEach((video) => video.pause());
  stage.innerHTML = '';

  const leftEntry = direction === 'next' ? oldEntry : newEntry;
  const rightEntry = direction === 'next' ? newEntry : oldEntry;

  // Every page rendered during the flip is transitional — none of it is the
  // settled foreground page, so media loads inactive (see mediaItemHTML).
  const leftPage = document.createElement('div');
  leftPage.className = 'diary-page diary-page--left';
  leftPage.innerHTML = leftPageHTML(leftEntry);

  const rightPage = document.createElement('div');
  rightPage.className = 'diary-page diary-page--right';
  rightPage.innerHTML = rightPageHTML(rightEntry, false);

  // The static half NOT under the moving sheet fades a shadow in (the
  // turning page casting a shadow as it lifts); the half already revealed
  // underneath fades its shadow out (was dark under the page, now landing
  // in the light). Which side is which flips with direction.
  const underlayIn = document.createElement('div');
  underlayIn.className = 'diary-underlay-shadow diary-underlay-shadow--in';
  const underlayOut = document.createElement('div');
  underlayOut.className = 'diary-underlay-shadow diary-underlay-shadow--out';
  if (direction === 'next') {
    leftPage.appendChild(underlayIn);
    rightPage.appendChild(underlayOut);
  } else {
    rightPage.appendChild(underlayIn);
    leftPage.appendChild(underlayOut);
  }

  stage.appendChild(leftPage);
  stage.appendChild(rightPage);

  const sheet = document.createElement('div');
  sheet.className = `diary-flip-sheet diary-flip-sheet--${direction}`;
  // Appended before measuring: a detached element has no real size, and
  // the slices need the sheet's actual (responsive) rendered dimensions.
  stage.appendChild(sheet);

  const sheetRect = sheet.getBoundingClientRect();
  const sheetWidthPx = sheetRect.width;
  const sheetHeightPx = sheetRect.height;
  const segWidth = sheetWidthPx / SLICE_COUNT;

  const frontHTML = direction === 'next' ? rightPageHTML(oldEntry, false) : leftPageHTML(oldEntry);
  const backHTML = direction === 'next' ? leftPageHTML(newEntry) : rightPageHTML(newEntry, false);
  const frontClass = direction === 'next' ? 'diary-page--right' : 'diary-page--left';
  const backClass = direction === 'next' ? 'diary-page--left' : 'diary-page--right';

  const slices = [];
  for (let k = 0; k < SLICE_COUNT; k++) {
    const sliceEl = document.createElement('div');
    sliceEl.className = 'diary-flip-slice';
    // +1.2px avoids hairline gaps between adjacent slices from subpixel
    // rounding during rotation.
    sliceEl.style.width = `${segWidth + 1.2}px`;
    sliceEl.style.height = `${sheetHeightPx}px`;

    const front = document.createElement('div');
    front.className = 'diary-flip-slice__face diary-flip-slice__face--front';
    const back = document.createElement('div');
    back.className = 'diary-flip-slice__face diary-flip-slice__face--back';

    const frontCanvas = document.createElement('div');
    frontCanvas.className = 'diary-flip-slice__canvas';
    frontCanvas.style.width = `${sheetWidthPx}px`;
    frontCanvas.style.height = `${sheetHeightPx}px`;
    frontCanvas.innerHTML = `<div class="diary-page ${frontClass}">${frontHTML}</div>`;
    const frontOffset = contentOffsetForSlice(k, SLICE_COUNT, direction, 'front');
    frontCanvas.style.transform = `translateX(${-frontOffset * segWidth}px)`;

    const backCanvas = document.createElement('div');
    backCanvas.className = 'diary-flip-slice__canvas';
    backCanvas.style.width = `${sheetWidthPx}px`;
    backCanvas.style.height = `${sheetHeightPx}px`;
    backCanvas.innerHTML = `<div class="diary-page ${backClass}">${backHTML}</div>`;
    const backOffset = contentOffsetForSlice(k, SLICE_COUNT, direction, 'back');
    backCanvas.style.transform = `translateX(${-backOffset * segWidth}px)`;

    const frontShade = document.createElement('div');
    frontShade.className = 'diary-flip-slice__shade';
    const backShade = document.createElement('div');
    backShade.className = 'diary-flip-slice__shade';

    front.append(frontCanvas, frontShade);
    back.append(backCanvas, backShade);
    sliceEl.append(front, back);
    sheet.appendChild(sliceEl);
    slices.push({ el: sliceEl, frontShade, backShade });
  }

  const tipEl = document.createElement('div');
  tipEl.className = 'diary-flip-tip';
  sheet.appendChild(tipEl);

  const castShadowEl = document.createElement('div');
  castShadowEl.className = 'diary-flip-castshadow';
  sheet.appendChild(castShadowEl);

  return { slices, tipEl, castShadowEl, segWidth, sheetWidthPx };
}

// Applies one progress value (0 = fully on the starting page, 1 = fully
// flipped) to every slice's transform/shade, plus the curl-edge highlight
// and cast shadow. Pure DOM writes only — computeSliceThetas/
// computeSliceLayout/computeCurlMotion (js/diary-state.mjs) do all the
// math, so this is cheap enough to call every animation frame, including
// on every pointermove while dragging.
function updateCurl(progress, direction, elements) {
  const { slices, tipEl, castShadowEl, segWidth, sheetWidthPx } = elements;
  const thetas = computeSliceThetas(progress, SLICE_COUNT, direction);
  const { positions, tip } = computeSliceLayout(thetas, segWidth, direction);
  const motion = computeCurlMotion(progress);

  // Peak shade of 0.35 matches the opacity dip (1 -> 0.65) validated in
  // the previous single-sheet design for masking the Safari text-render
  // bug — same masking strength, now expressed as a shade overlay's
  // opacity (0 -> 0.35) instead of the whole element's opacity.
  const shadeOpacity = motion * 0.35;
  for (let k = 0; k < SLICE_COUNT; k++) {
    const { el, frontShade, backShade } = slices[k];
    const { x, z } = positions[k];
    el.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${thetas[k]}deg)`;
    frontShade.style.opacity = String(shadeOpacity);
    backShade.style.opacity = String(shadeOpacity * 0.85);
  }

  tipEl.style.opacity = String(motion * 0.85);
  tipEl.style.transform = `translate3d(${tip.x}px, 0, ${tip.z}px) rotateY(${tip.rotateDeg}deg)`;

  const shadowWidth = sheetWidthPx * 0.4;
  castShadowEl.style.width = `${shadowWidth}px`;
  castShadowEl.style.opacity = String(motion * 0.48);
  castShadowEl.style.transform = `translate3d(${tip.x - shadowWidth / 2}px, 0, 0) scaleX(${0.72 + motion * 0.55})`;
}

// A requestAnimationFrame loop that eases progress from fromProgress to
// toProgress over --diary-flip-duration, calling updateCurl every frame.
// Used both for the full click/keyboard flip (0 -> 1) and for the
// drag-release settle (wherever the drag left off -> 0 or 1). Resolves
// its Promise once the loop finishes — the caller awaits it directly
// instead of listening for a CSS animationend/transitionend event, so
// there's no dependency on the browser reliably firing that event.
function runFlipAnimation(direction, elements, fromProgress, toProgress) {
  return new Promise((resolve) => {
    const durationMs = readFlipDurationMs();
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const linear = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const eased = easeInOutCubic(linear);
      const progress = fromProgress + (toProgress - fromProgress) * eased;
      updateCurl(progress, direction, elements);
      if (linear < 1) {
        requestAnimationFrame(tick);
      } else {
        updateCurl(toProgress, direction, elements);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}
```

- [ ] **Step 5: Replace `playFlip`**

In `js/diary.js`, replace lines 491–549 (the whole `playFlip` function) with:

```js
// A real page-turn: SLICE_COUNT curling slices sit over the static pages
// beneath them and animate from progress 0 to 1 via runFlipAnimation,
// each slice's own transform computed by updateCurl every frame. Driven
// entirely by requestAnimationFrame (see runFlipAnimation) — no CSS
// animation/transition involved, so there's nothing that depends on a
// browser DOM event firing reliably to know when the flip is done.
async function playFlip(direction) {
  if (isFlipping) return;
  const oldIndex = state.current;
  const newIndex = direction === 'next' ? oldIndex + 1 : oldIndex - 1;
  if (newIndex < 0 || newIndex >= state.totalPages) return;

  if (prefersInstantTransition()) {
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    renderStatic();
    updateChrome();
    return;
  }

  isFlipping = true;
  updateChrome();

  const oldEntry = ENTRIES[oldIndex];
  const newEntry = ENTRIES[newIndex];
  const elements = buildCurlDOM(direction, oldEntry, newEntry);

  await runFlipAnimation(direction, elements, 0, 1);

  state = direction === 'next' ? goToNext(state) : goToPrevious(state);
  isFlipping = false;
  renderStatic();
  updateChrome();
}
```

- [ ] **Step 6: Replace the drag-flip block**

In `js/diary.js`, replace lines 551–678 (from `const DRAG_THRESHOLD_PX = 8;` through the end of the `handleStagePointerUp` function — stop right before `function handleStagePointerCancel`, which is unchanged) with:

```js
const DRAG_THRESHOLD_PX = 8;

// Tracks an in-progress drag-to-flip gesture; null when no drag is active.
// `moved` distinguishes "pointer is down but hasn't crossed the drag
// threshold yet" (still could be a click on something inside the page)
// from "definitely dragging, the slices exist and are being driven by
// pointer position." `rafScheduled` coalesces rapid pointermove events
// into at most one DOM write per animation frame.
let dragFlip = null;

function findDragDirection(target) {
  if (target.closest('.diary-page--right')) return 'next';
  if (target.closest('.diary-page--left')) return 'prev';
  return null;
}

function applyDragFlipVisualState() {
  const rawDeltaX = dragFlip.currentX - dragFlip.startX;
  const signedDeltaX = dragFlip.direction === 'next' ? -rawDeltaX : rawDeltaX;
  const progress = computeDragProgress(signedDeltaX, dragFlip.elements.sheetWidthPx);
  updateCurl(progress, dragFlip.direction, dragFlip.elements);
  dragFlip.progress = progress;
}

function scheduleDragFlipUpdate() {
  if (dragFlip.rafScheduled) return;
  dragFlip.rafScheduled = true;
  requestAnimationFrame(() => {
    if (!dragFlip) return;
    dragFlip.rafScheduled = false;
    applyDragFlipVisualState();
  });
}

function handleStagePointerDown(event) {
  if (isFlipping || !state.isOpen || prefersInstantTransition()) return;
  if (event.target.closest('.diary-page__discard, .diary-mood-btn, .diary-page__photo')) return;
  const direction = findDragDirection(event.target);
  if (!direction) return;
  const newIndex = direction === 'next' ? state.current + 1 : state.current - 1;
  if (newIndex < 0 || newIndex >= state.totalPages) return;

  event.currentTarget.setPointerCapture(event.pointerId);
  dragFlip = {
    direction,
    pointerId: event.pointerId,
    startX: event.clientX,
    currentX: event.clientX,
    moved: false,
    rafScheduled: false,
    elements: null,
    progress: 0,
    oldIndex: state.current,
    newIndex,
  };
}

function handleStagePointerMove(event) {
  if (!dragFlip || event.pointerId !== dragFlip.pointerId) return;
  dragFlip.currentX = event.clientX;

  if (!dragFlip.moved) {
    if (Math.abs(event.clientX - dragFlip.startX) < DRAG_THRESHOLD_PX) return;
    dragFlip.moved = true;
    isFlipping = true;
    updateChrome();
    document.querySelector('.diary-stage').classList.add('diary-stage--dragging');
    const oldEntry = ENTRIES[dragFlip.oldIndex];
    const newEntry = ENTRIES[dragFlip.newIndex];
    dragFlip.elements = buildCurlDOM(dragFlip.direction, oldEntry, newEntry);
  }

  scheduleDragFlipUpdate();
}

// The post-release settle reuses runFlipAnimation (the same
// requestAnimationFrame-driven progress animation the click/keyboard flip
// uses), animating from wherever the drag left off to either 1 (complete
// the flip) or 0 (spring back) — no separate CSS transition mechanism.
async function settleDragFlip() {
  const { direction, elements, progress } = dragFlip;
  const completing = shouldCompleteFlip(progress);
  const target = completing ? 1 : 0;

  document.querySelector('.diary-stage').classList.remove('diary-stage--dragging');

  await runFlipAnimation(direction, elements, progress, target);

  if (completing) {
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
  }
  isFlipping = false;
  renderStatic();
  updateChrome();
}

function handleStagePointerUp(event) {
  if (!dragFlip || event.pointerId !== dragFlip.pointerId) return;
  event.currentTarget.releasePointerCapture(event.pointerId);

  if (!dragFlip.moved) {
    dragFlip = null;
    return;
  }

  settleDragFlip();
  dragFlip = null;
}
```

- [ ] **Step 7: Verify `handleStagePointerCancel` is untouched**

Confirm `js/diary.js` still has, immediately after the block replaced in Step 6:

```js
function handleStagePointerCancel(event) {
  handleStagePointerUp(event);
}
```

No edit needed here — this function doesn't reference anything that changed.

- [ ] **Step 8: Manual verification in a real browser**

Serve the site locally (per this project's memory: serve over local HTTP, not `file://` — e.g. `python3 -m http.server 8000` from the repo root) and open `study-diary.html` at a viewport wider than 768px. Check:

1. Click the next-page button repeatedly — the turning page should visibly curl (a bulging/lagging edge, a moving highlight, a soft shadow on the page underneath), not rotate as one flat rectangle.
2. Click the previous-page button — same, and specifically confirm the curl mirrors correctly (bulges the same visual way as next, just from the opposite edge; it should not look inverted, flattened, or broken). This direction has the most involved geometry in this plan — worth a deliberate look.
3. Keyboard `→`/`←` — matches the button behavior.
4. Press-and-drag a right page slowly leftward with the mouse — the curl should track the pointer in real time with no stutter.
5. Release a drag past the halfway point — the flip completes; release before halfway — it springs back to the starting page. Repeat while dragging a left page rightward.
6. Resize the window below 768px — flipping should go back to an instant page swap, no curl.
7. If a Safari build is available, flip several times and watch specifically for garbled/broken text or photos mid-flip (the bug this design's shade overlay is meant to mask). If it reappears, the fix is a single-line tuning change: increase the `0.35` peak in `updateCurl`'s `shadeOpacity` calculation (Step 4 above) — no structural change needed.

- [ ] **Step 9: Commit**

```bash
git add css/pages.css js/diary.js
git commit -m "Replace single-sheet page flip with a 16-slice curling silhouette"
```

---

## Task 6: Remove the now-unused single-sheet functions and tests

**Files:**
- Modify: `js/diary-state.mjs` (remove `computeFlipVisualState`, `isSheetEventTarget`)
- Modify: `js/diary-state.test.mjs` (remove their tests and import entries)

**Interfaces:**
- Consumes: nothing (this task only removes code nothing else references after Task 5).
- Produces: nothing new.

- [ ] **Step 1: Remove the two functions from `js/diary-state.mjs`**

Delete this block (it directly follows `isSheetEventTarget`'s own comment, near the top-middle of the file, right before `computeDragProgress`):

```js
// Both animationend (the click/keyboard flip's @keyframes) and
// transitionend (the drag flip's post-release settle transition) bubble:
// a descendant firing one must not be mistaken for the sheet's own flip
// finishing. Only an event whose target IS the sheet itself counts.
export function isSheetEventTarget(event, sheet) {
  return event.target === sheet;
}

```

And delete this block (it directly follows `computeDragProgress`, right before `computeCurlMotion`):

```js
// A continuous curve (not fixed keyframe stops) driven directly by live
// drag progress: rotation is linear in progress, lift and opacity each
// follow a single-peaked sine curve (zero/full at both ends, peak at the
// midpoint) so there's no plateau or velocity discontinuity of the kind
// that caused stutter in the earlier @keyframes-based design.
export function computeFlipVisualState(progress, direction) {
  const sign = direction === 'next' ? -1 : 1;
  // `+ 0` normalizes a -0 result (e.g. progress === 0) to 0 — Object.is
  // (used by node:assert's strict .equal) treats -0 and 0 as unequal.
  // Adding 0 rather than `|| 0` keeps a NaN input surfacing as NaN instead
  // of silently becoming 0.
  return {
    rotateDeg: sign * progress * 180 + 0,
    liftPx: -16 * Math.sin(progress * Math.PI) + 0,
    opacity: 1 - 0.35 * Math.sin(progress * Math.PI),
  };
}

```

- [ ] **Step 2: Remove the corresponding tests and import entries from `js/diary-state.test.mjs`**

Replace the import block (final state from Task 4) with:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  computeDragProgress,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
  contentOffsetForSlice,
} from './diary-state.mjs';
```

Delete these two test blocks:

```js
test('isSheetEventTarget is true only for the sheet element itself', () => {
  const sheet = {};
  assert.equal(isSheetEventTarget({ target: sheet }, sheet), true);
});

test('isSheetEventTarget rejects an event bubbled up from a child element', () => {
  const sheet = {};
  const childElement = {};
  assert.equal(isSheetEventTarget({ target: childElement }, sheet), false);
});
```

and

```js
test('computeFlipVisualState at progress 0 is fully flat, no lift, opaque', () => {
  const result = computeFlipVisualState(0, 'next');
  assert.equal(result.rotateDeg, 0);
  assert.equal(result.liftPx, 0);
  assert.equal(result.opacity, 1);
});

test('computeFlipVisualState at progress 1 for next direction is fully rotated', () => {
  const result = computeFlipVisualState(1, 'next');
  assert.equal(Math.round(result.rotateDeg), -180);
  assert.ok(Math.abs(result.liftPx) < 1e-9);
  assert.equal(Math.round(result.opacity * 100) / 100, 1);
});

test('computeFlipVisualState at progress 1 for prev direction rotates the opposite way', () => {
  const result = computeFlipVisualState(1, 'prev');
  assert.equal(Math.round(result.rotateDeg), 180);
});

test('computeFlipVisualState peaks lift and dips opacity at progress 0.5', () => {
  const result = computeFlipVisualState(0.5, 'next');
  assert.equal(result.liftPx, -16);
  assert.equal(Math.round(result.opacity * 100) / 100, 0.65);
});
```

- [ ] **Step 3: Run the full test suite**

Run: `node --test js/diary-state.test.mjs`
Expected: PASS, `ℹ tests 27` (33 from Task 4 minus 6 removed).

- [ ] **Step 4: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Remove the single-sheet flip's computeFlipVisualState and isSheetEventTarget"
```
