# Study Diary Adaptive Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make single-image and single-video diary pages adopt the media's real orientation and a safe bounded aspect ratio while always showing the complete frame.

**Architecture:** Pure helpers in `diary-state.mjs` validate intrinsic dimensions, classify orientation, and clamp display ratios. The settled diary page listens for image/video metadata, applies a class and CSS custom property to its single-media container, and leaves multi-image collages on their stable existing grid. CSS owns the visual sizes and full-frame presentation.

**Tech Stack:** Browser JavaScript ES modules, CSS Grid, CSS custom properties, Node's built-in test runner.

## Global Constraints

- Images and videos must use complete-frame presentation; content must not be cropped.
- Single horizontal media is capped at `16:9`; square media uses `1:1`; portrait media is bounded to a page-friendly `3:4`.
- Multi-image collages retain the existing fixed grid.
- Invalid or unavailable intrinsic dimensions fall back to `3:4`.
- Existing upload storage, media limits, video controls, flip geometry, mobile behavior, and Supabase schema remain unchanged.
- Reduced-motion mode must not animate aspect-ratio changes.

---

### Task 1: Pure media-ratio model

**Files:**
- Modify: `js/diary-state.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Produces: `resolveMediaLayout(width: number, height: number): { orientation: 'landscape' | 'square' | 'portrait' | 'unknown', aspectRatio: number }`
- Consumers: Task 2 imports the function into `js/diary.js`.

- [ ] **Step 1: Write failing classification and clamping tests**

Append tests that import `resolveMediaLayout` and assert:

```js
assert.deepEqual(resolveMediaLayout(1600, 900), {
  orientation: 'landscape',
  aspectRatio: 16 / 9,
});
assert.deepEqual(resolveMediaLayout(1200, 1000), {
  orientation: 'landscape',
  aspectRatio: 1.2,
});
assert.deepEqual(resolveMediaLayout(1000, 1000), {
  orientation: 'square',
  aspectRatio: 1,
});
assert.deepEqual(resolveMediaLayout(900, 1200), {
  orientation: 'portrait',
  aspectRatio: 3 / 4,
});
assert.deepEqual(resolveMediaLayout(800, 1000), {
  orientation: 'portrait',
  aspectRatio: 0.8,
});
assert.deepEqual(resolveMediaLayout(900, 1600), {
  orientation: 'portrait',
  aspectRatio: 3 / 4,
});
assert.deepEqual(resolveMediaLayout(0, 900), {
  orientation: 'unknown',
  aspectRatio: 3 / 4,
});
```

Also cover the exact `0.9` and `1.1` boundaries as square.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: FAIL because `resolveMediaLayout` is not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add:

```js
const DEFAULT_MEDIA_ASPECT_RATIO = 3 / 4;
const MIN_PORTRAIT_ASPECT_RATIO = 3 / 4;
const MAX_LANDSCAPE_ASPECT_RATIO = 16 / 9;

export function resolveMediaLayout(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { orientation: 'unknown', aspectRatio: DEFAULT_MEDIA_ASPECT_RATIO };
  }

  const ratio = width / height;
  if (ratio > 1.1) {
    return {
      orientation: 'landscape',
      aspectRatio: Math.min(ratio, MAX_LANDSCAPE_ASPECT_RATIO),
    };
  }
  if (ratio < 0.9) {
    return {
      orientation: 'portrait',
      aspectRatio: Math.max(ratio, MIN_PORTRAIT_ASPECT_RATIO),
    };
  }
  return { orientation: 'square', aspectRatio: 1 };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: all diary-state tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Model adaptive diary media ratios"
```

---

### Task 2: Apply intrinsic media dimensions to the settled page

**Files:**
- Modify: `js/diary.js:1-190`
- Modify: `js/diary.js:196-220`
- Modify: `css/pages.css:709-734`
- Test: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: `resolveMediaLayout(width, height)` from Task 1.
- Produces: `.diary-page__media--single`, `.diary-page__media--landscape`, `.diary-page__media--square`, `.diary-page__media--portrait`, `.diary-page__media--unknown`, and `--diary-media-aspect`.

- [ ] **Step 1: Write a failing source-contract test**

Add a test that reads `diary.js` and asserts the settled-page integration contains both intrinsic-dimension paths:

```js
assert.match(diarySource, /naturalWidth/);
assert.match(diarySource, /videoWidth/);
assert.match(diarySource, /loadedmetadata/);
assert.match(diarySource, /resolveMediaLayout/);
```

The test must also assert `mediaGridStyle(1)` no longer emits a fixed inline `aspect-ratio:3/4`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: FAIL because intrinsic dimension listeners and the imported helper do not exist.

- [ ] **Step 3: Add stable single-media markup**

Update `mediaGridStyle` so a single item only emits the one-cell grid declaration. Add a single-media class and a default orientation marker in `rightPageHTML`:

```js
const mediaClass = urls.length === 1
  ? 'diary-page__media diary-page__media--single diary-page__media--unknown'
  : 'diary-page__media';
```

Keep multi-image inline grid definitions unchanged.

- [ ] **Step 4: Resolve and apply intrinsic dimensions**

Import `resolveMediaLayout`. Add helpers with these responsibilities:

```js
function applySingleMediaLayout(container, width, height) {
  const layout = resolveMediaLayout(width, height);
  container.classList.remove(
    'diary-page__media--unknown',
    'diary-page__media--landscape',
    'diary-page__media--square',
    'diary-page__media--portrait',
  );
  container.classList.add(`diary-page__media--${layout.orientation}`);
  container.style.setProperty('--diary-media-aspect', String(layout.aspectRatio));
}

function hydrateSingleMediaLayouts(root) {
  root.querySelectorAll('.diary-page__media--single').forEach((container) => {
    const media = container.querySelector('img, video');
    if (!media) return;

    if (media instanceof HTMLImageElement) {
      const apply = () => applySingleMediaLayout(container, media.naturalWidth, media.naturalHeight);
      if (media.complete) apply();
      else media.addEventListener('load', apply, { once: true });
      return;
    }

    const apply = () => applySingleMediaLayout(container, media.videoWidth, media.videoHeight);
    if (media.readyState >= HTMLMediaElement.HAVE_METADATA) apply();
    else media.addEventListener('loadedmetadata', apply, { once: true });
  });
}
```

Call hydration only after the stable page DOM is installed by `renderStatic`. Flip-layer duplicates inherit the already rendered dimensions and must not attach independent listeners.

- [ ] **Step 5: Add adaptive CSS and complete-frame video**

Use:

```css
.diary-page__media--single {
  aspect-ratio: var(--diary-media-aspect, 3 / 4);
  max-height: min(430px, 58vh);
  margin-inline: auto;
  background: color-mix(in srgb, var(--color-surface) 88%, #d8cdbb);
  transition: aspect-ratio 220ms ease, width 220ms ease;
}

.diary-page__media--landscape {
  width: 100%;
}

.diary-page__media--square {
  width: min(100%, 410px);
}

.diary-page__media--portrait,
.diary-page__media--unknown {
  width: min(100%, 330px);
}

.diary-page__video,
.diary-page__photo {
  object-fit: contain;
}

@media (prefers-reduced-motion: reduce) {
  .diary-page__media--single {
    transition: none;
  }
}
```

If existing project tokens make `color-mix` inconsistent with surrounding paper, use the existing Polaroid background color instead.

- [ ] **Step 6: Run syntax, focused, and full tests**

Run:

```bash
node --check js/diary.js
node --test js/diary-state.test.mjs
node --test js/*.test.mjs
git diff --check
```

Expected: syntax passes, all tests pass, and no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add js/diary.js css/pages.css js/diary-state.test.mjs
git commit -m "Adapt diary pages to intrinsic media ratios"
```

---

### Task 3: Browser verification and regression pass

**Files:**
- Modify only if browser evidence reveals a defect: `js/diary.js`, `css/pages.css`, `js/diary-state.mjs`, `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: complete implementation from Tasks 1 and 2.
- Produces: verified desktop/mobile behavior with no console errors.

- [ ] **Step 1: Prepare representative local fixtures in browser memory**

Use data URLs or existing project assets for:

- landscape image at `1600×900`
- square image at `1000×1000`
- portrait image at `900×1200`
- very wide image above `16:9`
- landscape video with metadata
- a mixed-orientation multi-image entry

Do not commit generated fixture files.

- [ ] **Step 2: Verify settled-page layout**

For each single-media case inspect:

- applied orientation class
- computed container aspect ratio
- `object-fit: contain`
- full visible media bounds within the container
- video controls remain enabled

Expected: landscape, square, and portrait frames visibly differ; extreme ratios are bounded; no media is cropped.

- [ ] **Step 3: Verify flip stability**

Test Next, Previous, left/right drag, and cancel while moving between differently oriented media pages.

Expected: no mid-flip relayout, blank sheet, stale slices, or incorrect settled ratio.

- [ ] **Step 4: Verify multi-image, mobile, and reduced motion**

Expected:

- multi-image collage retains its existing grid dimensions
- mobile page remains within the viewport
- reduced-motion mode switches ratios without transition
- console contains no errors

- [ ] **Step 5: Run final automated verification**

Run:

```bash
node --check js/diary.js
node --test js/*.test.mjs
git diff --check
git status --short
```

Expected: all tests pass; only intentional project files are modified or committed.

- [ ] **Step 6: Commit any browser-found corrections**

If corrections were necessary:

```bash
git add js/diary.js css/pages.css js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Polish adaptive diary media layout"
```

If no corrections were necessary, do not create an empty commit.
