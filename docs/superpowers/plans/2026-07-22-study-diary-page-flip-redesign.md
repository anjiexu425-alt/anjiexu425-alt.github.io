# Study Diary Page-Flip Animation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Study Diary flip sheet's two-state CSS `transition` rotation with a `@keyframes` animation that adds an arc lift and a mid-rotation opacity dip, masking the Safari text/photo rendering artifact confirmed via systematic-debugging (three targeted performance fixes — image preloading, `contain`, `-webkit-font-smoothing` — all failed to resolve it, and disabling the animation entirely eliminates the symptom, confirming it's inherent to the live `rotateY` rotation itself).

**Architecture:** `.diary-flip-sheet--next.is-flipped` / `.diary-flip-sheet--prev.is-flipped` switch from a `transition: transform` two-point interpolation to an `animation: <name> var(--diary-flip-duration) ... forwards;` referencing new `@keyframes diary-flip-next` / `@keyframes diary-flip-prev` rules with four waypoints each (0%, 40%, 60%, 100%) that animate `transform` (rotateY + a `translateY` lift) and `opacity` together. `js/diary.js`'s completion-detection switches from listening for `transitionend` to `animationend` accordingly. `js/diary-state.mjs`'s pure `isSheetTransformEnd` predicate is replaced with `isSheetAnimationEnd`, matching `AnimationEvent`'s shape (no `propertyName`) instead of `TransitionEvent`'s.

**Tech Stack:** Vanilla HTML/CSS/JS (no build tools — unchanged project constraint). Pure CSS `@keyframes`, no new JS libraries.

## Global Constraints

- No build tools, no new dependencies.
- Animation duration and easing stay exactly as they are today: driven by the existing `--diary-flip-duration: 0.7s` CSS custom property (defined on `.diary`) and `cubic-bezier(0.25, 1, 0.5, 1)` — do not change either value, only how they're applied (animation instead of transition).
- Keyframe values (exact, from the spec): 0% = `rotateY(0deg)`, no lift, `opacity: 1`. 40% = `rotateY(±72deg)`, lifted `-16px`, `opacity: 0.65`. 60% = `rotateY(±108deg)`, lifted `-16px`, `opacity: 0.65`. 100% = `rotateY(±180deg)`, no lift, `opacity: 1`. (`±` = negative for `diary-flip-next`, positive for `diary-flip-prev`, matching the existing rotation directions.)
- Remove `contain: layout paint style;` and `-webkit-font-smoothing: antialiased;` from `.diary-flip-sheet__face` — both were added as earlier attempted fixes for this exact bug, both failed, neither serves a documented purpose under the new design (the fix here is masking via opacity, not fighting the rendering behavior).
- Keep the existing `void sheet.offsetHeight; requestAnimationFrame(() => sheet.classList.add('is-flipped'));` two-step timing in `playFlip()` unchanged, even though it may not be strictly required for a CSS `animation` the way it was for `transition` — deliberately conservative, not in scope for this change (per spec's "范围之外").
- Do not touch the shadow effects (`.diary-underlay-shadow`, `.diary-flip-shadow` and their `@keyframes`) — they already use `animation`, are unrelated to this bug, and are out of scope per the spec.
- Pure logic (`isSheetAnimationEnd`) gets `node:test` coverage; the animation's visual behavior (lift smoothness, whether the opacity dip actually masks the Safari artifact) can only be verified manually in a real Safari browser — this project has never unit-tested `diary.js`'s DOM/animation-wiring code.

---

## Task 1: Replace `isSheetTransformEnd` with `isSheetAnimationEnd`

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Produces: `isSheetAnimationEnd(event, sheet)` (boolean) — replaces `isSheetTransformEnd`, consumed by `js/diary.js` in Task 2.

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
  isSheetTransformEnd,
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
  isSheetAnimationEnd,
} from './diary-state.mjs';
```

Then replace the three existing `isSheetTransformEnd` tests at the bottom of the file:

```js
test('isSheetTransformEnd is true only for the sheet element itself finishing its transform', () => {
  const sheet = {};
  assert.equal(isSheetTransformEnd({ target: sheet, propertyName: 'transform' }, sheet), true);
});

test('isSheetTransformEnd rejects a transitionend bubbled up from a child element', () => {
  const sheet = {};
  const childElement = {};
  assert.equal(isSheetTransformEnd({ target: childElement, propertyName: 'transform' }, sheet), false);
});

test('isSheetTransformEnd rejects the sheet transitioning a property other than transform', () => {
  const sheet = {};
  assert.equal(isSheetTransformEnd({ target: sheet, propertyName: 'opacity' }, sheet), false);
});
```

with:

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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test js/diary-state.test.mjs`
Expected: FAIL — `isSheetAnimationEnd is not a function` (or similar import error), since `diary-state.mjs` doesn't export it yet.

- [ ] **Step 3: Update the implementation**

In `js/diary-state.mjs`, replace:

```js
// transitionend bubbles: a descendant of the flip sheet (e.g. a hovered
// child element with its own transform transition) firing one must not be
// mistaken for the sheet's own rotation finishing. Only an event whose
// target IS the sheet itself, for the "transform" property, counts.
export function isSheetTransformEnd(event, sheet) {
  return event.target === sheet && event.propertyName === 'transform';
}
```

with:

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test js/diary-state.test.mjs`
Expected: `pass 10`, `fail 0` (was 11 tests with the 3 old ones; now 10 with 2 new ones replacing them).

- [ ] **Step 5: Run the full project test suite**

Run: `node --test js/*.test.mjs`
Expected: all pass. `js/diary.js` still imports `isSheetTransformEnd` at this point (Task 2 fixes that) — this won't break `node --test` since `diary.js` isn't itself a test target, but note it for Task 2.

- [ ] **Step 6: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Replace isSheetTransformEnd with isSheetAnimationEnd for the flip redesign"
```

---

## Task 2: Switch the flip sheet to a keyframe animation with arc lift + opacity dip

**Files:**
- Modify: `css/pages.css`
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `isSheetAnimationEnd(event, sheet)` from `js/diary-state.mjs` (Task 1).

- [ ] **Step 1: Replace the flip sheet's CSS**

In `css/pages.css`, replace:

```css
.diary-flip-sheet {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  z-index: 20;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  will-change: transform;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  pointer-events: none;
  transition: transform var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1);
}

/* translate3d(0,0,0) alongside the rotation forces this onto its own GPU
   layer for the whole transition instead of only once the rotation makes
   it "3D enough" to qualify — avoids a layer-promotion hitch right as the
   flip starts. */
.diary-flip-sheet--next {
  left: 50%;
  transform-origin: left center;
  transform: translate3d(0, 0, 0) rotateY(0deg);
}

.diary-flip-sheet--next.is-flipped {
  transform: translate3d(0, 0, 0) rotateY(-180deg);
}

.diary-flip-sheet--prev {
  left: 0;
  transform-origin: right center;
  transform: translate3d(0, 0, 0) rotateY(0deg);
}

.diary-flip-sheet--prev.is-flipped {
  transform: translate3d(0, 0, 0) rotateY(180deg);
}
```

with:

```css
.diary-flip-sheet {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  z-index: 20;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  will-change: transform, opacity;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  pointer-events: none;
}

/* translate3d(0,0,0) alongside the rotation forces this onto its own GPU
   layer from the start instead of only once the rotation makes it "3D
   enough" to qualify — avoids a layer-promotion hitch right as the flip
   starts. */
.diary-flip-sheet--next {
  left: 50%;
  transform-origin: left center;
  transform: translate3d(0, 0, 0) rotateY(0deg);
}

.diary-flip-sheet--prev {
  left: 0;
  transform-origin: right center;
  transform: translate3d(0, 0, 0) rotateY(0deg);
}

/* Real 3D page-turn, redesigned: instead of a plain two-point rotateY
   transition, an @keyframes animation adds an arc lift (the page rises
   as it turns, like being picked up rather than pivoting flat) and dips
   opacity through the ~40%-60% window where the rotation is nearest
   edge-on to the viewer. That window is exactly where Safari renders
   live text/photos inside a preserve-3d rotation as garbled/broken (a
   WebKit text-rasterization quirk, confirmed via systematic-debugging —
   not a paint-performance problem, which is why contain/font-smoothing
   didn't fix it) — fading the content there masks the artifact instead
   of fighting it, and reads naturally since a real page mid-turn isn't
   legible either. */
.diary-flip-sheet--next.is-flipped {
  animation: diary-flip-next var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

.diary-flip-sheet--prev.is-flipped {
  animation: diary-flip-prev var(--diary-flip-duration) cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

@keyframes diary-flip-next {
  0% { transform: translate3d(0, 0, 0) rotateY(0deg); opacity: 1; }
  40% { transform: translate3d(0, -16px, 0) rotateY(-72deg); opacity: 0.65; }
  60% { transform: translate3d(0, -16px, 0) rotateY(-108deg); opacity: 0.65; }
  100% { transform: translate3d(0, 0, 0) rotateY(-180deg); opacity: 1; }
}

@keyframes diary-flip-prev {
  0% { transform: translate3d(0, 0, 0) rotateY(0deg); opacity: 1; }
  40% { transform: translate3d(0, -16px, 0) rotateY(72deg); opacity: 0.65; }
  60% { transform: translate3d(0, -16px, 0) rotateY(108deg); opacity: 0.65; }
  100% { transform: translate3d(0, 0, 0) rotateY(180deg); opacity: 1; }
}
```

- [ ] **Step 2: Remove the two disproven fix attempts from `.diary-flip-sheet__face`**

In `css/pages.css`, replace:

```css
.diary-flip-sheet__face {
  position: absolute;
  inset: 0;
  transform: translate3d(0, 0, 0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  overflow: hidden;
  background: var(--color-surface);
  /* Each face renders a full page's worth of text/photo content while
     being 3D-rotated — containment tells the browser this subtree's
     layout/paint can't affect anything outside it, so it can isolate and
     cache the repaint instead of re-rasterizing the whole face on every
     animation frame (a common source of visible jank/stutter for complex
     content inside a rotating 3D transform). */
  contain: layout paint style;
  /* Safari-specific: text inside a live CSS 3D rotation can render
     garbled/broken mid-transform and only resolve to normal once the
     transform settles flat — a known WebKit text-rasterization quirk
     during preserve-3d animations, not a paint-performance problem (which
     is why contain/preloading above didn't fix it). Forcing grayscale
     antialiasing avoids Safari's subpixel/LCD text-smoothing pipeline,
     which is what struggles to keep up during the live rotation. */
  -webkit-font-smoothing: antialiased;
}
```

with:

```css
.diary-flip-sheet__face {
  position: absolute;
  inset: 0;
  transform: translate3d(0, 0, 0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  overflow: hidden;
  background: var(--color-surface);
}
```

- [ ] **Step 3: Run a CSS brace-balance check**

Run: `python3 -c "s = open('css/pages.css').read(); print('open', s.count('{'), 'close', s.count('}'))"`
Expected: the two counts are equal, confirming the file is still syntactically balanced after Steps 1-2.

- [ ] **Step 4: Update `js/diary.js`'s import**

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
  isSheetTransformEnd,
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
  isSheetAnimationEnd,
} from './diary-state.mjs';
```

- [ ] **Step 5: Update the completion-detection block in `playFlip()`**

In `js/diary.js`, replace:

```js
  // Completing the flip must happen exactly once, triggered by whichever
  // comes first: the sheet's own rotation finishing, or (if that event
  // never arrives — observed in some WebKit/embedded-WebView builds) a
  // fallback timeout. isSheetTransformEnd rejects transitionend events
  // bubbled up from a descendant (transitionend bubbles like any other DOM
  // event), so a child's unrelated transition can't end the flip early.
  let flipFinished = false;
  function finishFlip() {
    if (flipFinished) return;
    flipFinished = true;
    sheet.removeEventListener('transitionend', onSheetTransitionEnd);
    clearTimeout(fallbackTimer);
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    isFlipping = false;
    renderStatic();
    updateChrome();
  }

  function onSheetTransitionEnd(event) {
    if (isSheetTransformEnd(event, sheet)) finishFlip();
  }

  sheet.addEventListener('transitionend', onSheetTransitionEnd);

  // Read the duration straight off the sheet's own computed style rather
  // than hardcoding a second copy of it — this can never drift out of
  // sync with --diary-flip-duration (the CSS custom property that also
  // drives the shadow animations' duration) however that value changes.
  const flipDurationMs = parseFloat(getComputedStyle(sheet).transitionDuration) * 1000 || 700;
  const fallbackTimer = setTimeout(finishFlip, flipDurationMs + 150);
}
```

with:

```js
  // Completing the flip must happen exactly once, triggered by whichever
  // comes first: the sheet's own flip animation finishing, or (if that
  // event never arrives — observed in some WebKit/embedded-WebView builds)
  // a fallback timeout. isSheetAnimationEnd rejects animationend events
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
    if (isSheetAnimationEnd(event, sheet)) finishFlip();
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

- [ ] **Step 6: Run the syntax check and full test suite**

Run: `node --check js/diary.js && node --test js/*.test.mjs`
Expected: syntax check passes silently; all tests pass (same count as after Task 1 — this task touched no `.mjs` module).

- [ ] **Step 7: Verify manually in Safari**

1. Start a local server: `python3 -m http.server 8000`, open `http://localhost:8000/study-diary.html` in Safari (not a narrow/mobile-width window — that path skips the animation entirely via `prefersInstantTransition()` and won't exercise this change).
2. Open the diary book, flip forward and backward through several pages, including ones with real photos and ones with placeholder cards.
3. Expected: the page visibly lifts/arcs slightly as it turns rather than pivoting flat; content fades down partway through the turn and fades back in as it completes; **no garbled/broken text or photos are visible at any point** — specifically re-check the two things originally reported (text breaking up when flipping forward into a text-heavy entry, photos breaking up when flipping backward into a photo entry).
4. Flip rapidly several times in a row (click next/prev repeatedly without waiting). Expected: no stuck/frozen state, no double-firing of the completion logic (each flip lands on the correct page).
5. Confirm the first/last page boundaries still correctly disable the prev/next buttons, and that dot-navigation (clicking a pagination dot) still works (this task didn't touch that code path, but confirm no regression).

- [ ] **Step 8: Commit**

```bash
git add css/pages.css js/diary.js
git commit -m "Redesign Study Diary page-flip: arc lift + opacity dip masks Safari text-rendering artifact"
```
