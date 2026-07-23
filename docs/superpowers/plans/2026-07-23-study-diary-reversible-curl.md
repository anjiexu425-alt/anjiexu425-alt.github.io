# Study Diary Reversible Curl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the previous-page animation turn the left page naturally toward the right by playing one canonical physical curl backward instead of constructing a separate mirrored geometry.

**Architecture:** Pure functions in `js/diary-state.mjs` define one direction-independent page curve and transition descriptor. `js/diary.js` always builds the same physical sheet (old right face to new left face), then plays progress 0 → 1 for next and 1 → 0 for previous. Slice z-order changes at the midpoint so overlapping strips paint in physical depth order.

**Tech Stack:** Vanilla JavaScript ES modules, CSS 3D transforms, `requestAnimationFrame`, Node.js `node:test`, local HTTP browser verification.

## Global Constraints

- Preserve the existing DOM-rendered diary pages; do not migrate them to Canvas.
- Preserve instant transitions at widths up to 768px and for `prefers-reduced-motion`.
- Preserve the existing 50% drag completion threshold.
- Preserve discard, mood, photo, editing, upload, lightbox, and authentication behavior.
- Do not add velocity-based flick completion.
- Keep `SLICE_COUNT = 16`.

---

### Task 1: Canonical reversible geometry and transition descriptors

**Files:**
- Modify: `js/diary-state.mjs`
- Test: `js/diary-state.test.mjs`

**Interfaces:**
- Produces: `computeSliceThetas(progress: number, sliceCount: number): number[]`
- Produces: `computeSliceLayout(thetasDeg: number[], sliceWidthPx: number): { positions: {x:number,z:number}[], tip:{x:number,z:number,rotateDeg:number} }`
- Produces: `contentOffsetForSlice(k: number, sliceCount: number, face: 'front'|'back'): number`
- Produces: `createFlipTransition(currentIndex: number, direction: 'next'|'prev'): { fromIndex:number, toIndex:number, startProgress:number, targetProgress:number }`
- Produces: `shouldCompleteDirectionalFlip(progress: number, direction: 'next'|'prev'): boolean`

- [ ] **Step 1: Write failing tests for canonical geometry**

Update imports in `js/diary-state.test.mjs` to include
`createFlipTransition` and `shouldCompleteDirectionalFlip`. Replace
direction-dependent geometry expectations with:

```js
test('canonical slice geometry is flat right at 0 and flat left at 1', () => {
  assert.deepEqual(computeSliceThetas(0, 16), Array(16).fill(0));
  computeSliceThetas(1, 16).forEach((deg) => {
    assert.ok(Math.abs(deg + 180) < 1e-6);
  });
});

test('canonical layout starts at the spine and needs no direction mirror', () => {
  const result = computeSliceLayout([0, 0, 0, 0], 10);
  assert.deepEqual(result.positions, [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 20, z: 0 },
    { x: 30, z: 0 },
  ]);
  assert.deepEqual(result.tip, { x: 40, z: 0, rotateDeg: 0 });
});

test('content strips depend on paper face, not navigation direction', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'front'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'front'), 15);
  assert.equal(contentOffsetForSlice(0, 16, 'back'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'back'), 0);
});
```

- [ ] **Step 2: Write failing tests for transition direction**

```js
test('next transition plays canonical curl forward', () => {
  assert.deepEqual(createFlipTransition(2, 'next'), {
    fromIndex: 2,
    toIndex: 3,
    startProgress: 0,
    targetProgress: 1,
  });
});

test('previous transition plays the same canonical curl backward', () => {
  assert.deepEqual(createFlipTransition(2, 'prev'), {
    fromIndex: 1,
    toIndex: 2,
    startProgress: 1,
    targetProgress: 0,
  });
});

test('directional completion uses opposite sides of the midpoint', () => {
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'next'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'next'), false);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'prev'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'prev'), false);
});
```

- [ ] **Step 3: Run tests and verify the expected failure**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: FAIL because the existing geometry still accepts `direction`, and
`createFlipTransition` / `shouldCompleteDirectionalFlip` are not exported.

- [ ] **Step 4: Implement the canonical curve**

Replace the direction-dependent pure functions in `js/diary-state.mjs` with:

```js
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
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Make Study Diary curl geometry reversible"
```

---

### Task 2: Play one physical sheet forward and backward

**Files:**
- Modify: `js/diary.js`

**Interfaces:**
- Consumes all Task 1 functions.
- Changes: `buildCurlDOM(fromEntry, toEntry)` no longer accepts direction.
- Changes: `updateCurl(progress, elements)` no longer accepts direction.
- Changes: `runFlipAnimation(elements, fromProgress, toProgress)` no longer accepts direction.

- [ ] **Step 1: Update imports and construct one canonical sheet**

Import `createFlipTransition` and `shouldCompleteDirectionalFlip`. Remove the
old `shouldCompleteFlip` import.

Change `buildCurlDOM` so it always renders:

```js
const leftEntry = fromEntry;
const rightEntry = toEntry;
const frontHTML = rightPageHTML(fromEntry, false);
const backHTML = leftPageHTML(toEntry);
const frontClass = 'diary-page--right';
const backClass = 'diary-page--left';
```

Place the sheet at the centre spine with `diary-flip-sheet--next`, and call:

```js
contentOffsetForSlice(k, SLICE_COUNT, 'front');
contentOffsetForSlice(k, SLICE_COUNT, 'back');
```

- [ ] **Step 2: Make the animation geometry direction-independent**

Update the animation functions:

```js
function updateCurl(progress, elements) {
  const { slices, tipEl, castShadowEl, segWidth, sheetWidthPx } = elements;
  const thetas = computeSliceThetas(progress, SLICE_COUNT);
  const { positions, tip } = computeSliceLayout(thetas, segWidth);
  const motion = computeCurlMotion(progress);

  slices.forEach(({ el, frontShade, backShade }, k) => {
    const { x, z } = positions[k];
    el.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${thetas[k]}deg)`;
    el.style.zIndex = progress < 0.5 ? String(k + 1) : String(SLICE_COUNT - k);
    frontShade.style.opacity = String(motion * 0.35);
    backShade.style.opacity = String(motion * 0.3);
  });

  tipEl.style.opacity = String(motion * 0.85);
  tipEl.style.transform = `translate3d(${tip.x}px, 0, ${tip.z}px) rotateY(${tip.rotateDeg}deg)`;
  const shadowWidth = sheetWidthPx * 0.4;
  castShadowEl.style.width = `${shadowWidth}px`;
  castShadowEl.style.opacity = String(motion * 0.48);
  castShadowEl.style.transform =
    `translate3d(${tip.x - shadowWidth / 2}px, 0, 0) scaleX(${0.72 + motion * 0.55})`;
}

function runFlipAnimation(elements, fromProgress, toProgress) {
  // Keep the existing requestAnimationFrame body, calling
  // updateCurl(progress, elements) without a direction argument.
}
```

- [ ] **Step 3: Rework button and keyboard transitions**

In `playFlip(direction)`:

```js
const descriptor = createFlipTransition(state.current, direction);
if (descriptor.fromIndex < 0 || descriptor.toIndex >= state.totalPages) return;
const elements = buildCurlDOM(
  ENTRIES[descriptor.fromIndex],
  ENTRIES[descriptor.toIndex],
);
await runFlipAnimation(
  elements,
  descriptor.startProgress,
  descriptor.targetProgress,
);
state = direction === 'next' ? goToNext(state) : goToPrevious(state);
```

- [ ] **Step 4: Rework drag progress and settling**

When dragging starts, build the descriptor and canonical sheet. Store
`startProgress` and `targetProgress` in `dragFlip`.

Map pointer movement with:

```js
const directionalDeltaX = dragFlip.direction === 'next'
  ? dragFlip.startX - dragFlip.currentX
  : dragFlip.currentX - dragFlip.startX;
const distance = computeDragProgress(
  Math.max(0, directionalDeltaX),
  dragFlip.elements.sheetWidthPx,
);
const progress = dragFlip.direction === 'next' ? distance : 1 - distance;
updateCurl(progress, dragFlip.elements);
```

Settle with:

```js
const completing = shouldCompleteDirectionalFlip(progress, direction);
const target = completing
  ? dragFlip.targetProgress
  : dragFlip.startProgress;
await runFlipAnimation(elements, progress, target);
```

- [ ] **Step 5: Check syntax and stale APIs**

Run:

```bash
node --check js/diary.js
rg -n "computeSliceThetas\\([^)]*,[^)]*,|computeSliceLayout\\([^)]*,[^)]*,|contentOffsetForSlice\\([^)]*,[^)]*,[^)]*,|buildCurlDOM\\([^)]*direction|updateCurl\\([^)]*direction|runFlipAnimation\\([^)]*direction" js
```

Expected: syntax check succeeds and `rg` returns no stale direction-dependent
geometry calls.

- [ ] **Step 6: Commit**

```bash
git add js/diary.js
git commit -m "Play the physical page curl backward for previous navigation"
```

---

### Task 3: Verify both directions and preserve the live preview

**Files:**
- Verify: `js/*.test.mjs`
- Verify: `study-diary.html`
- Verify: `css/pages.css`

**Interfaces:**
- Consumes the completed reversible curl.
- Produces no new code unless verification exposes a defect.

- [ ] **Step 1: Run all automated checks**

```bash
node --check js/diary.js
node --test js/*.test.mjs
git diff --check
```

Expected: syntax succeeds, all tests pass, and no whitespace errors are
reported.

- [ ] **Step 2: Reload the existing local preview**

Reload `http://localhost:8011/study-diary.html` in the in-app browser and open
the diary.

- [ ] **Step 3: Verify left-arrow previous navigation**

Navigate to at least spread 3, then click the left arrow. Confirm:

- the left page lifts from its outer edge and turns toward the right;
- the centre-spine hinge stays fixed;
- text is not mirrored;
- the back face reveals the correct prior spread;
- no strip paints above another strip incorrectly after the midpoint;
- the highlight and shadow follow the free edge;
- the final page counter decreases by one.

- [ ] **Step 4: Verify next, keyboard, and dragging**

Confirm:

- the right arrow remains correct;
- `ArrowLeft` and `ArrowRight` match button behavior;
- dragging the left page right decreases progress smoothly;
- releasing before and after halfway returns or completes correctly;
- dragging the right page left remains correct;
- no console errors occur.

- [ ] **Step 5: Verify the instant-transition boundary**

At a viewport no wider than 768px, confirm buttons swap spreads without
building `.diary-flip-slice` elements.

- [ ] **Step 6: Final commit if verification required no code changes**

No additional commit is necessary. If verification required a targeted
correction, rerun Steps 1–5 and commit only that correction with:

```bash
git add js/diary.js css/pages.css js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Polish reversible Study Diary page curl"
```
