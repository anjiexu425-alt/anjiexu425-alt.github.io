# Study Diary Drag Page-Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add press-and-hold/drag-driven page flipping to Study Diary (mouse and touch, via Pointer Events), additive to the existing click/keyboard flip, with the flip's visual state computed directly from live pointer position (no CSS `@keyframes` during the active drag) so it can't reintroduce the keyframe-timing stutter this project has been fighting.

**Architecture:** Three layers. (1) Pure functions in `js/diary-state.mjs` compute drag progress, the resulting rotate/lift/opacity visual state (a continuous sine curve, not fixed keyframe stops), and whether a released drag should complete or revert. (2) The existing `playFlip()`'s DOM-construction logic (the static halves + the flip sheet with front/back faces and shadows) is extracted into a shared `buildFlipDOM()` helper so both the click/keyboard flip and the new drag flip build the identical visual structure. (3) New Pointer Event handlers on `.diary-stage` drive the sheet's `transform`/`opacity` directly during an active drag, then hand off to a single 2-point CSS transition (not `@keyframes`) to settle to the final state on release.

**Tech Stack:** Vanilla HTML/CSS/JS (no build tools — unchanged project constraint). Pointer Events API (unifies mouse + touch, no separate touch handlers needed).

## Global Constraints

- No build tools, no new dependencies.
- Existing click/keyboard flip (`playFlip()`, the `diary-flip-next`/`diary-flip-prev` `@keyframes`) must keep working exactly as it does today — this plan is additive, not a replacement.
- Drag-to-flip only activates when `!prefersInstantTransition()` (the existing helper — `>768px` width and no `prefers-reduced-motion`) — the same condition that already gates the animated click-flip. Below that, there's no side-by-side spread to drag across.
- Grab targets: pressing anywhere on `.diary-page--right` starts a "next" drag; anywhere on `.diary-page--left` starts a "prev" drag — except within `.diary-page__discard`, `.diary-mood-btn`, or `.diary-page__photo`, which must keep working as plain clicks (checked via `event.target.closest(...)` before starting to track a drag).
- Drag threshold: 8px of pointer movement before a pointerdown is treated as a real drag (not a click that happens to jitter slightly).
- Release threshold: `progress >= 0.5` completes the flip; below that, it reverts to the original page.
- Visual state during an active drag, for `progress` in `[0, 1]`: `rotateDeg = (direction === 'next' ? -1 : 1) * progress * 180`, `liftPx = -16 * Math.sin(progress * Math.PI)`, `opacity = 1 - 0.35 * Math.sin(progress * Math.PI)` — a continuous curve, not discrete keyframe stops, so there's no plateau/discontinuity of the kind that caused the earlier stutter.
- The post-release settle animates via a single-interval CSS `transition` (start = wherever the drag left the sheet, end = fully open or fully reverted) — never a multi-stop `@keyframes` — using the same `--diary-flip-duration` and `cubic-bezier(0.25, 1, 0.5, 1)` as the rest of the flip system.
- Pure logic (`computeDragProgress`, `computeFlipVisualState`, `shouldCompleteFlip`) gets full `node:test` coverage. Pointer-event wiring and DOM construction are not unit-tested — this project has never unit-tested `diary.js`'s DOM/gesture-wiring code, only manually verified in a real browser.

---

## Task 1: Pure drag-flip math + rename the shared "event is from the sheet" check

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Produces: `computeDragProgress(deltaX, pageWidth)` (number, clamped 0-1), `computeFlipVisualState(progress, direction)` (`{ rotateDeg, liftPx, opacity }`), `shouldCompleteFlip(progress)` (boolean), `isSheetEventTarget(event, sheet)` (boolean, renamed from `isSheetAnimationEnd` — same logic, reused for both `animationend` in the existing click-flip and `transitionend` in Task 3's drag-settle, so the name should no longer imply one specific event type). All consumed by `js/diary.js` in Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**

In `js/diary-state.test.mjs`, replace the import line:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetAnimationEnd,
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
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
} from './diary-state.mjs';
```

Then replace the two existing `isSheetAnimationEnd` tests at the bottom of the file:

```js
test('isSheetAnimationEnd is true only for the sheet element itself', () => {
  const sheet = {};
  assert.equal(isSheetAnimationEnd({ target: sheet }, sheet), true);
});

test('isSheetAnimationEnd rejects an animationend bubbled up from a child element', () => {
  const sheet = {};
  const childElement = {};
  assert.equal(isSheetAnimationEnd({ target: childElement }, sheet), false);
});
```

with:

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

test('computeDragProgress returns 0 when there is no movement', () => {
  assert.equal(computeDragProgress(0, 300), 0);
});

test('computeDragProgress returns a fraction of pageWidth dragged', () => {
  assert.equal(computeDragProgress(150, 300), 0.5);
});

test('computeDragProgress clamps below 0 to 0', () => {
  assert.equal(computeDragProgress(-50, 300), 0);
});

test('computeDragProgress clamps above 1 to 1', () => {
  assert.equal(computeDragProgress(400, 300), 1);
});

test('computeDragProgress returns 0 for a non-positive pageWidth', () => {
  assert.equal(computeDragProgress(150, 0), 0);
});

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

test('shouldCompleteFlip is false below the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.49), false);
});

test('shouldCompleteFlip is true at or above the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.5), true);
  assert.equal(shouldCompleteFlip(0.9), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `isSheetEventTarget`, `computeDragProgress`, `computeFlipVisualState`, `shouldCompleteFlip` are not exported by `diary-state.mjs` yet.

- [ ] **Step 3: Update the implementation**

In `js/diary-state.mjs`, replace:

```js
// animationend bubbles: a descendant of the flip sheet (e.g. a child
// element with its own CSS animation) firing one must not be mistaken for
// the sheet's own flip animation finishing. Only an event whose target IS
// the sheet itself counts — AnimationEvent has no propertyName the way
// TransitionEvent does, so there's no second property to check here.
export function isSheetAnimationEnd(event, sheet) {
  return event.target === sheet;
}
```

with:

```js
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
    rotateDeg: sign * progress * 180,
    liftPx: -16 * Math.sin(progress * Math.PI),
    opacity: 1 - 0.35 * Math.sin(progress * Math.PI),
  };
}

export function shouldCompleteFlip(progress) {
  return progress >= 0.5;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: `pass 19`, `fail 0` (was 8 tests; 2 renamed + 11 new = 19).

- [ ] **Step 5: Run the full project test suite**

Run: `node --test js/*.test.mjs`
Expected: all pass except that `js/diary.js` still imports the now-removed `isSheetAnimationEnd` at this point — that's fine, `diary.js` isn't itself a `node:test` target, Task 2 fixes the import.

- [ ] **Step 6: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add drag-flip math and rename isSheetAnimationEnd to isSheetEventTarget"
```

---

## Task 2: Extract buildFlipDOM() and switch playFlip() to use it

**Files:**
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `isSheetEventTarget(event, sheet)` from `js/diary-state.mjs` (Task 1).
- Produces: `buildFlipDOM(direction, oldEntry, newEntry)` — builds the static halves (with underlay shadows) and the flip sheet (with front/back faces and curl shadows), appends everything to `.diary-stage`, and returns the `sheet` element. Consumed by `playFlip()` in this task and by the drag handlers in Task 3.

This task is a pure refactor — `playFlip()`'s observable behavior (the click/keyboard flip) must be identical before and after. No new feature yet.

- [ ] **Step 1: Update the import**

Replace:

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetAnimationEnd,
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
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
} from './diary-state.mjs';
```

(`computeDragProgress`, `computeFlipVisualState`, and `shouldCompleteFlip` aren't used until Task 3, but importing them now avoids a second import-line edit next task.)

- [ ] **Step 2: Extract `buildFlipDOM()` and rewrite `playFlip()` to use it**

Replace the whole `playFlip` function in `js/diary.js` — from its header comment (`// A real 3D page-turn: ...`) through its closing `}` — with:

```js
// Builds the static halves (with underlay shadows) and the flip sheet
// (with front/back faces and curl shadows) for a flip in progress, and
// appends everything to .diary-stage. Shared by the click/keyboard-
// triggered animated flip (playFlip) and the pointer-driven drag flip —
// both need the identical visual structure, they just drive the sheet's
// transform/opacity differently afterward (a CSS animation vs. live
// pointer tracking). Returns the sheet element.
function buildFlipDOM(direction, oldEntry, newEntry) {
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

  const front = document.createElement('div');
  front.className = 'diary-flip-sheet__face diary-flip-sheet__face--front';
  const back = document.createElement('div');
  back.className = 'diary-flip-sheet__face diary-flip-sheet__face--back';

  if (direction === 'next') {
    front.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(oldEntry, false)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(newEntry)}</div>`;
  } else {
    front.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(oldEntry)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(newEntry, false)}</div>`;
  }

  // Curl shadow riding the turning sheet itself: strongest near the spine
  // it's pivoting on, easing off across the transition (deepens, then
  // settles — not a flat fade) on the front face; the back face starts
  // partly shadowed and clears as it comes fully face-up. The gradient
  // direction is fixed per face in local (pre-rotation) space — the back
  // face's own static rotateY(180deg) mirrors it back to the correct side
  // once flipped, so front/back keep the same two directions regardless of
  // next/prev... except next/prev mount the sheet at opposite spines, so
  // the directions swap between the two directions too.
  const frontShadow = document.createElement('div');
  frontShadow.className = 'diary-flip-shadow diary-flip-shadow--front';
  frontShadow.style.background = direction === 'next'
    ? 'linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)'
    : 'linear-gradient(to left, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)';
  front.appendChild(frontShadow);

  const backShadow = document.createElement('div');
  backShadow.className = 'diary-flip-shadow diary-flip-shadow--back';
  backShadow.style.background = direction === 'next'
    ? 'linear-gradient(to left, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)'
    : 'linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)';
  back.appendChild(backShadow);

  sheet.appendChild(front);
  sheet.appendChild(back);
  stage.appendChild(sheet);

  return sheet;
}

// A real 3D page-turn: a half-width "sheet" with two faces (front = the page
// currently showing, back = the page it reveals) sits over the static pages
// beneath it and rotates -180deg/180deg around the book's spine, with an
// arc lift and mid-rotation opacity dip layered on via the diary-flip-next/
// diary-flip-prev @keyframes. Both faces use backface-visibility:hidden so
// only one is ever shown at a time as it turns through profile. Driven by
// requestAnimationFrame + animationend (not framer-motion, which needs a
// bundler) — the initial state is committed to layout before the
// is-flipped class (which starts the @keyframes animation) is added, kept
// from the transition-based version out of caution even though a CSS
// animation doesn't strictly require it the way a transition did.
function playFlip(direction) {
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
  const sheet = buildFlipDOM(direction, oldEntry, newEntry);

  // Force layout so the un-flipped starting transform is committed before
  // the target class gets added on the next frame.
  void sheet.offsetHeight;

  requestAnimationFrame(() => {
    sheet.classList.add('is-flipped');
  });

  // Completing the flip must happen exactly once, triggered by whichever
  // comes first: the sheet's own flip animation finishing, or (if that
  // event never arrives — observed in some WebKit/embedded-WebView builds)
  // a fallback timeout. isSheetEventTarget rejects animationend events
  // bubbled up from a descendant (animationend bubbles like any other DOM
  // event), so a child's unrelated animation can't end the flip early.
  let flipFinished = false;
  function finishFlip() {
    if (flipFinished) return;
    flipFinished = true;
    sheet.removeEventListener('animationend', onSheetAnimationEnd);
    clearTimeout(fallbackTimer);
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    isFlipping = false;
    renderStatic();
    updateChrome();
  }

  function onSheetAnimationEnd(event) {
    if (isSheetEventTarget(event, sheet)) finishFlip();
  }

  sheet.addEventListener('animationend', onSheetAnimationEnd);

  // Read the duration straight off the sheet's own computed style rather
  // than hardcoding a second copy of it — this can never drift out of
  // sync with --diary-flip-duration (the CSS custom property that also
  // drives the shadow animations' duration) however that value changes.
  const flipDurationMs = parseFloat(getComputedStyle(sheet).animationDuration) * 1000 || 700;
  const fallbackTimer = setTimeout(finishFlip, flipDurationMs + 150);
}
```

- [ ] **Step 3: Run the syntax check and full test suite**

Run: `node --check js/diary.js && node --test js/*.test.mjs`
Expected: syntax check passes silently; all 19 tests from Task 1 (and everything else) still pass — this task touched no `.mjs` module.

- [ ] **Step 4: Verify manually in a browser**

1. Start a local server: `python3 -m http.server 8000`, open `http://localhost:8000/study-diary.html`.
2. Open the book, click next/prev several times, use the arrow keys too.
3. Expected: identical behavior to before this task — same arc-lift-and-fade animation, no stutter (assuming the prior fix held), no console errors. This is a pure refactor; if anything looks different, something in the extraction is wrong.

- [ ] **Step 5: Commit**

```bash
git add js/diary.js
git commit -m "Extract buildFlipDOM() from playFlip() as a shared helper"
```

---

## Task 3: Add pointer-driven drag-to-flip

**Files:**
- Modify: `css/pages.css`
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `buildFlipDOM(direction, oldEntry, newEntry)` (Task 2), `computeDragProgress(deltaX, pageWidth)`, `computeFlipVisualState(progress, direction)`, `shouldCompleteFlip(progress)`, `isSheetEventTarget(event, sheet)` (all Task 1).

- [ ] **Step 1: Add the CSS**

In `css/pages.css`, add this right after the `.diary-flip-sheet__face--back` rule:

```css
/* Cursor affordance: grab-able while idle, grabbing while an active drag
   is in progress (the class is toggled on .diary-stage itself, which
   never gets replaced by buildFlipDOM — only its children do — so it's a
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

/* The post-release settle: a single-interval transition (start = wherever
   the drag left the sheet, end = fully open or fully reverted) — not
   @keyframes, so it can't reintroduce the multi-stop stutter problem.
   Toggled on only for the settle phase; during an active drag the sheet's
   transform/opacity are written directly with no transition running. */
.diary-flip-sheet--settling {
  transition: transform var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1),
    opacity var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1);
}
```

- [ ] **Step 2: Run a CSS brace-balance check**

Run: `python3 -c "s = open('css/pages.css').read(); print('open', s.count('{'), 'close', s.count('}'))"`
Expected: the two counts are equal.

- [ ] **Step 3: Add the drag-flip state and handlers to `js/diary.js`**

Add this right after `playFlip`'s closing `}` (i.e., right after Task 2's rewritten `playFlip` function, before `function openCover`):

```js
const DRAG_THRESHOLD_PX = 8;

// Tracks an in-progress drag-to-flip gesture; null when no drag is active.
// `moved` distinguishes "pointer is down but hasn't crossed the drag
// threshold yet" (still could be a click on something inside the page)
// from "definitely dragging, the flip sheet exists and is being driven by
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
  const progress = computeDragProgress(signedDeltaX, dragFlip.pageWidth);
  const { rotateDeg, liftPx, opacity } = computeFlipVisualState(progress, dragFlip.direction);
  dragFlip.sheet.style.transform = `translate3d(0, ${liftPx}px, 0) rotateY(${rotateDeg}deg)`;
  dragFlip.sheet.style.opacity = String(opacity);
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
    sheet: null,
    pageWidth: 0,
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
    dragFlip.sheet = buildFlipDOM(dragFlip.direction, oldEntry, newEntry);
    dragFlip.pageWidth = dragFlip.sheet.getBoundingClientRect().width;
  }

  scheduleDragFlipUpdate();
}

function settleDragFlip() {
  const { direction, sheet, progress } = dragFlip;
  const completing = shouldCompleteFlip(progress);
  const finalRotateDeg = completing ? (direction === 'next' ? -180 : 180) : 0;

  document.querySelector('.diary-stage').classList.remove('diary-stage--dragging');
  sheet.classList.add('diary-flip-sheet--settling');

  let settled = false;
  function finishDragFlip() {
    if (settled) return;
    settled = true;
    sheet.removeEventListener('transitionend', onSettleTransitionEnd);
    clearTimeout(settleFallbackTimer);
    if (completing) {
      state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    }
    isFlipping = false;
    renderStatic();
    updateChrome();
  }

  function onSettleTransitionEnd(event) {
    if (isSheetEventTarget(event, sheet)) finishDragFlip();
  }

  sheet.addEventListener('transitionend', onSettleTransitionEnd);

  requestAnimationFrame(() => {
    sheet.style.transform = `translate3d(0, 0, 0) rotateY(${finalRotateDeg}deg)`;
    sheet.style.opacity = '1';
  });

  const settleDurationMs = parseFloat(getComputedStyle(sheet).transitionDuration) * 1000 || 700;
  const settleFallbackTimer = setTimeout(finishDragFlip, settleDurationMs + 150);
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

function handleStagePointerCancel(event) {
  handleStagePointerUp(event);
}
```

- [ ] **Step 4: Wire the pointer event listeners**

In `js/diary.js`'s `DOMContentLoaded` handler, add these lines right after the existing `.diary-nav--prev` click listener block (right before the `document.addEventListener('keydown', ...)` block):

```js
  const dragStageEl = document.querySelector('.diary-stage');
  dragStageEl.addEventListener('pointerdown', handleStagePointerDown);
  dragStageEl.addEventListener('pointermove', handleStagePointerMove);
  dragStageEl.addEventListener('pointerup', handleStagePointerUp);
  dragStageEl.addEventListener('pointercancel', handleStagePointerCancel);
```

- [ ] **Step 5: Run the syntax check and full test suite**

Run: `node --check js/diary.js && node --test js/*.test.mjs`
Expected: syntax check passes silently; all 19 tests pass (this task added no new `.mjs` module changes beyond what Task 1 already covered).

- [ ] **Step 6: Verify manually in a browser (mouse)**

1. Start a local server, open `study-diary.html` in a desktop browser, window wider than 768px.
2. Open the book. Press and hold the mouse down on the right page, drag left slowly.
3. Expected: the page visibly lifts and rotates following the mouse in real time, opacity dips around the midpoint, cursor shows a "grabbing" hand.
4. Drag less than halfway across, release.
5. Expected: the page smoothly settles back to the original page (does not advance).
6. Repeat, this time dragging more than halfway before releasing.
7. Expected: the page smoothly completes the turn to the next entry.
8. Try dragging the left page to go back (same checks, opposite direction).
9. Try pressing down directly on a Discard button, a Mood/Weather button, or a photo, then dragging — expected: the button/photo's own click behavior fires normally (opens the mood modal / lightbox / confirms discard), no page flip is triggered.
10. Confirm click-to-flip (nav buttons) and keyboard arrows still work correctly, including alongside drag (e.g. drag once, then click a button — no stuck state).
11. Confirm dragging past the first or last page's edge does nothing (no drag starts).

- [ ] **Step 7: Verify manually in a browser (touch)**

1. Open the same page on a touch device or a browser's device-emulation mode with touch enabled.
2. Repeat the same checks as Step 6 using a finger/touch drag instead of a mouse.
3. Expected: identical behavior — Pointer Events unify mouse and touch, so no separate touch-specific code path should be needed, but this confirms it in practice.

- [ ] **Step 8: Commit**

```bash
git add css/pages.css js/diary.js
git commit -m "Add pointer-driven press-and-hold drag-to-flip for Study Diary"
```
