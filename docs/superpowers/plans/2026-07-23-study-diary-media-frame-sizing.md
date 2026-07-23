# Study Diary Media Frame Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make landscape diary media use a wider Polaroid frame than square and portrait media without changing media cropping, book geometry, or gallery sizing.

**Architecture:** `diary-media.mjs` remains the source of media-orientation markup and hydration behavior. It will serialize and update a direction class on the owning Polaroid at the same time as the media container, so settled pages and cached flip copies stay identical. CSS maps those classes to responsive frame widths.

**Tech Stack:** Browser JavaScript ES modules, CSS, Node built-in test runner.

## Global Constraints

- Desktop single-media widths: landscape `380px`, square `350px`, portrait and unknown `330px`.
- Multi-image gallery remains `330px`.
- Images and videos remain `object-fit: contain`; video controls remain unchanged.
- Tablet and mobile layouts must remain inside the diary page and viewport.
- Flip current, target, and slices inherit cached frame orientation without temporary hydration.
- Reduced-motion mode does not animate width changes.
- Do not modify book geometry, upload logic, Supabase schema, or media-ratio thresholds.
- The separate Supabase `InvalidKey` filename issue is out of scope.

---

### Task 1: Synchronize Polaroid orientation with media layout

**Files:**
- Modify: `js/diary-media.mjs`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: existing `resolveMediaLayout`, `createMediaLayoutCache`, `mediaContainerHTML`, and `hydrateSingleMediaLayouts`.
- Produces: Polaroid modifier classes `diary-polaroid--landscape`, `--square`, `--portrait`, `--unknown`, and `--gallery`.

- [ ] **Step 1: Write failing behavior tests**

Add executable tests asserting:

```js
const landscapeHTML = mediaContainerHTML(landscapeEntry, options);
assert.match(landscapeHTML, /diary-polaroid--landscape/);

const unknownHTML = mediaContainerHTML(uncachedEntry, options);
assert.match(unknownHTML, /diary-polaroid--unknown/);

const galleryHTML = mediaContainerHTML(galleryEntry, options);
assert.match(galleryHTML, /diary-polaroid--gallery/);
```

For hydration, use the existing fake DOM helpers with a container whose
`closest('.diary-polaroid')` returns a fake frame. Assert that applying a square
layout removes the old frame orientation and adds
`diary-polaroid--square`.

Also assert cached current/target flip HTML serializes the correct frame class.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: FAIL because the frame modifier classes are not emitted or hydrated.

- [ ] **Step 3: Add a single frame-class helper**

Add a shared list and helper:

```js
const POLAROID_ORIENTATION_CLASSES = [
  'diary-polaroid--unknown',
  'diary-polaroid--landscape',
  'diary-polaroid--square',
  'diary-polaroid--portrait',
  'diary-polaroid--gallery',
];

function applyPolaroidOrientation(frame, orientation) {
  if (!frame) return;
  frame.classList.remove(...POLAROID_ORIENTATION_CLASSES);
  frame.classList.add(`diary-polaroid--${orientation}`);
}
```

Use the same orientation source for serialized HTML and hydration. If the
current architecture returns only the media container markup, extend its return
boundary or introduce a focused `polaroidClassForEntry(entry, cache)` export;
do not duplicate cache lookup logic in `diary.js`.

- [ ] **Step 4: Update `diary.js` only if the module boundary requires it**

If `mediaContainerHTML` cannot own the outer frame class because the Polaroid is
created by `rightPageHTML`, export:

```js
export function polaroidClassForEntry(entry, layoutCache) {
  if (entry.media.urls.length > 1) return 'diary-polaroid--gallery';
  const layout = layoutCache.get(entry);
  return `diary-polaroid--${layout?.orientation ?? 'unknown'}`;
}
```

Consume it once in `rightPageHTML`. Hydration still updates the closest frame
using the same class helper.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --check js/diary-media.mjs
node --check js/diary.js
node --test js/diary-state.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add js/diary-media.mjs js/diary.js js/diary-state.test.mjs
git commit -m "Synchronize diary Polaroid media orientation"
```

---

### Task 2: Responsive frame widths and browser verification

**Files:**
- Modify: `css/pages.css`
- Modify: `js/diary-state.test.mjs` only if a source-contract assertion is needed

**Interfaces:**
- Consumes: Polaroid modifier classes from Task 1.
- Produces: responsive frame sizing for desktop, tablet, and mobile.

- [ ] **Step 1: Write a failing CSS contract test**

Add a focused source assertion that requires all five frame classes and the
desktop values:

```js
assert.match(cssSource, /\.diary-polaroid--landscape[\s\S]*width:\s*380px/);
assert.match(cssSource, /\.diary-polaroid--square[\s\S]*width:\s*350px/);
assert.match(cssSource, /\.diary-polaroid--portrait[\s\S]*width:\s*330px/);
assert.match(cssSource, /\.diary-polaroid--unknown[\s\S]*width:\s*330px/);
assert.match(cssSource, /\.diary-polaroid--gallery[\s\S]*width:\s*330px/);
```

Also assert a reduced-motion rule removes frame width transition.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test js/diary-state.test.mjs
```

Expected: FAIL because directional Polaroid widths do not exist.

- [ ] **Step 3: Add desktop width rules**

Keep the base frame fallback at `330px`, then add:

```css
.diary-polaroid--landscape { width: 380px; }
.diary-polaroid--square { width: 350px; }
.diary-polaroid--portrait,
.diary-polaroid--unknown,
.diary-polaroid--gallery { width: 330px; }
```

Include `width` in the frame transition and disable it in the existing
reduced-motion block.

- [ ] **Step 4: Add tablet and mobile rules**

Within `769px–1024px`, keep all frames within the page:

```css
.diary-polaroid--landscape { width: min(350px, 100%); }
.diary-polaroid--square { width: min(330px, 100%); }
.diary-polaroid--portrait,
.diary-polaroid--unknown,
.diary-polaroid--gallery { width: min(310px, 100%); }
```

Within `max-width: 768px`:

```css
.diary-polaroid--landscape { width: min(360px, 100%); }
.diary-polaroid--square { width: min(320px, 100%); }
.diary-polaroid--portrait,
.diary-polaroid--unknown,
.diary-polaroid--gallery { width: min(270px, 100%); }
```

- [ ] **Step 5: Run automated verification**

Run:

```bash
node --check js/diary.js
node --check js/diary-media.mjs
node --test js/*.test.mjs
git diff --check
```

Expected: all tests and checks pass.

- [ ] **Step 6: Verify in the browser**

Use the existing adaptive-media fixture or an untracked equivalent that loads
production CSS and modules. Record:

- landscape frame width is approximately `380px`
- square is approximately `350px`
- portrait is approximately `330px`
- gallery remains approximately `330px`
- video media uses `contain` and controls are present
- all frames remain inside their page/fixture column
- current, target, and slices preserve the same Polaroid orientation class
- mobile layout remains within the viewport

Then open the real `study-diary.html` page and verify no console errors and no
regression in Next/Previous.

- [ ] **Step 7: Commit**

```bash
git add css/pages.css js/diary-state.test.mjs
git commit -m "Scale diary frames by media orientation"
```
