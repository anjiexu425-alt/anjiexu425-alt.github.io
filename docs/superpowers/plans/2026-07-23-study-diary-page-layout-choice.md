# Study Diary Page Layout Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each diary entry persistently choose whether text or media appears on the physical left page, with the same mapping preserved during every flip state.

**Architecture:** A pure page-layout module normalizes the stored value and maps an entry to physical left/right content roles. The existing `media` JSON stores `layout`, so no database migration is required. Form code reads and writes the normalized field, while static and curl rendering consume the same role mapping instead of assuming text is always left.

**Tech Stack:** Browser JavaScript ES modules, Supabase JSON data, semantic HTML radio inputs, CSS, Node built-in test runner.

## Global Constraints

- Valid stored values are exactly `text-left` and `media-left`.
- Missing or invalid values normalize to `text-left`.
- Layout is stored inside the existing `media` JSON; no Supabase schema or RLS migration.
- Write and Edit both expose the choice; Write and form reset default to `text-left`.
- Static, target underlay, front/back faces, and all 16 slices use the same physical page-role mapping.
- Adaptive media ratio, Polaroid orientation, media cache lifecycle, video controls, and `object-fit: contain` remain unchanged on either physical page.
- Upload logic, file limits, curl geometry, pointer behavior, and Supabase APIs remain unchanged.
- The separate Chinese filename `InvalidKey` issue is out of scope.

---

### Task 1: Normalize and persist page layout

**Files:**
- Create: `js/diary-layout.mjs`
- Create: `js/diary-layout.test.mjs`
- Modify: `js/diary-validation.mjs`
- Modify: `js/diary-validation.test.mjs`

**Interfaces:**
- Produces: `normalizePageLayout(value): 'text-left' | 'media-left'`
- Produces: `pageRolesForEntry(entry): { left: 'text' | 'media', right: 'text' | 'media' }`
- Consumers: Tasks 2 and 3.

- [ ] **Step 1: Write failing layout-model tests**

Create tests:

```js
assert.equal(normalizePageLayout('text-left'), 'text-left');
assert.equal(normalizePageLayout('media-left'), 'media-left');
assert.equal(normalizePageLayout(undefined), 'text-left');
assert.equal(normalizePageLayout('sideways'), 'text-left');

assert.deepEqual(pageRolesForEntry({ media: { layout: 'text-left' } }), {
  left: 'text',
  right: 'media',
});
assert.deepEqual(pageRolesForEntry({ media: { layout: 'media-left' } }), {
  left: 'media',
  right: 'text',
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
node --test js/diary-layout.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure model**

Create:

```js
export function normalizePageLayout(value) {
  return value === 'media-left' ? 'media-left' : 'text-left';
}

export function pageRolesForEntry(entry) {
  const layout = normalizePageLayout(entry?.media?.layout);
  return layout === 'media-left'
    ? { left: 'media', right: 'text' }
    : { left: 'text', right: 'media' };
}
```

- [ ] **Step 4: Write failing persistence tests**

Update validation tests to assert:

- `supabaseRowToEntry` adds `media.layout: 'text-left'` for old rows.
- valid `media-left` survives row-to-entry mapping.
- `entryToSupabaseRow` normalizes invalid layout.
- `buildEditPatch` retains the normalized layout.
- other media fields are unchanged.

- [ ] **Step 5: Run persistence tests and verify RED**

Run:

```bash
node --test js/diary-validation.test.mjs
```

Expected: FAIL because validation mapping does not normalize layout.

- [ ] **Step 6: Normalize media at storage boundaries**

Import `normalizePageLayout` and add a focused helper:

```js
function normalizeMedia(media = {}) {
  return {
    ...media,
    layout: normalizePageLayout(media.layout),
  };
}
```

Use it in `supabaseRowToEntry`, `entryToSupabaseRow`, and `buildEditPatch`.
Do not mutate input objects.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
node --test js/diary-layout.test.mjs js/diary-validation.test.mjs
git diff --check
```

Expected: all focused tests pass.

Commit:

```bash
git add js/diary-layout.mjs js/diary-layout.test.mjs js/diary-validation.mjs js/diary-validation.test.mjs
git commit -m "Persist diary page layout choices"
```

---

### Task 2: Add accessible Write/Edit layout controls

**Files:**
- Modify: `study-diary.html:64-142`
- Modify: `css/pages.css:1314-1390`
- Modify: `js/diary.js:756-825`
- Modify: `js/diary.js:843-914`
- Modify: `js/diary-state.test.mjs`

**Interfaces:**
- Consumes: `normalizePageLayout`.
- Produces: form field `name="pageLayout"` with values `text-left` and `media-left`.
- Produces: new/edit media object containing `layout`.

- [ ] **Step 1: Write failing form-contract and state tests**

Add tests that read the real HTML/JS and assert:

```js
assert.match(html, /name="pageLayout"[^>]*value="text-left"[^>]*checked/);
assert.match(html, /name="pageLayout"[^>]*value="media-left"/);
assert.match(diarySource, /form\.pageLayout\.value\s*=\s*normalizePageLayout/);
assert.match(diarySource, /layout:\s*pageLayout/);
```

Add a pure helper in `diary-layout.mjs`:

```js
export function mediaWithPageLayout(media, value) {
  return { ...media, layout: normalizePageLayout(value) };
}
```

Test that it returns a new object and preserves type, URLs, and caption.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test js/diary-layout.test.mjs js/diary-state.test.mjs
```

Expected: FAIL because the controls and helper do not exist.

- [ ] **Step 3: Add semantic radio controls**

Inside the Write/Edit form add:

```html
<fieldset class="diary-form__layout">
  <legend>Page layout</legend>
  <label class="diary-form__layout-option">
    <input type="radio" name="pageLayout" value="text-left" checked />
    <span>Text Left · Media Right</span>
  </label>
  <label class="diary-form__layout-option">
    <input type="radio" name="pageLayout" value="media-left" />
    <span>Media Left · Text Right</span>
  </label>
</fieldset>
```

Style the two options as a responsive segmented choice with visible
`:focus-visible` and checked state. Do not hide the native input from assistive
technology.

- [ ] **Step 4: Wire new, edit, save, and reset**

- On edit: `form.pageLayout.value = normalizePageLayout(entry.media.layout)`.
- On submit: read `normalizePageLayout(data.get('pageLayout'))`.
- Include it in both edit and new media objects through
  `mediaWithPageLayout`.
- After `form.reset()`, explicitly set `form.pageLayout.value = 'text-left'`.
- Do not let changing Image/Video tabs reset the layout.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
node --check js/diary.js
node --test js/diary-layout.test.mjs js/diary-state.test.mjs js/diary-validation.test.mjs
git diff --check
```

Expected: all focused tests pass.

Commit:

```bash
git add study-diary.html css/pages.css js/diary.js js/diary-layout.mjs js/diary-layout.test.mjs js/diary-state.test.mjs
git commit -m "Add diary page layout controls"
```

---

### Task 3: Render text and media on either physical page

**Files:**
- Modify: `js/diary.js:90-205`
- Modify: `js/diary.js:411-480`
- Modify: `js/diary-layout.mjs`
- Modify: `js/diary-layout.test.mjs`
- Modify: `js/diary-state.test.mjs`
- Modify: `css/pages.css` only for role-specific alignment fixes

**Interfaces:**
- Consumes: `pageRolesForEntry(entry)`.
- Produces: `pageContentHTML(entry, role, { active }): string`.
- Produces: `spreadHTMLForEntry(entry, { active }): { leftHTML: string, rightHTML: string }`.

- [ ] **Step 1: Write failing executable content-mapping tests**

Extract testable content boundaries and assert:

- `text-left` returns text markup for physical left and media markup for right.
- `media-left` returns media markup for left and text markup for right.
- old entries behave like `text-left`.
- media markup on the left includes the same cached Polaroid orientation class.
- text markup retains date/title/body/discard; media markup retains
  caption/mood/weather.

Create transitions between entries with opposite layouts and assert the actual
current/target page HTML selected for:

- settled left/right
- Next target underlay
- Next front current physical right
- Next back target physical left
- Previous source/target mappings

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test js/diary-layout.test.mjs js/diary-state.test.mjs
```

Expected: FAIL because rendering assumes text-left.

- [ ] **Step 3: Separate role from physical side**

Rename content functions by role:

```js
function textPageHTML(entry) { ... }
function mediaPageHTML(entry, active = true) { ... }
```

Add:

```js
function pageContentHTML(entry, role, active = true) {
  return role === 'media'
    ? mediaPageHTML(entry, active)
    : textPageHTML(entry);
}

function spreadHTMLForEntry(entry, active = true) {
  const roles = pageRolesForEntry(entry);
  return {
    leftHTML: pageContentHTML(entry, roles.left, active),
    rightHTML: pageContentHTML(entry, roles.right, active),
  };
}
```

Physical `.diary-page--left` and `--right` wrappers remain unchanged.

- [ ] **Step 4: Make static rendering consume the spread**

`renderStatic` must call `spreadHTMLForEntry(entry)` once and place
`leftHTML/rightHTML` into physical wrappers. Hydrate media after insertion
regardless of side; the existing stage-wide query supports either page.

- [ ] **Step 5: Make curl rendering consume physical page content**

For each transition, derive physical page HTML from each entry:

```js
const fromSpread = spreadHTMLForEntry(fromEntry, false);
const toSpread = spreadHTMLForEntry(toEntry, false);
```

Use:

- settled/underlay physical left and right from the appropriate spread.
- front face from the source physical right.
- back face from the target physical left.

Do not choose front/back by text/media role. Preserve the existing canonical
curl and direction reversal.

- [ ] **Step 6: Add minimal role-specific CSS**

If media on the physical left inherits text-only overflow or spacing, add
content-role classes such as `.diary-page--media-content`. Keep physical
left/right binding shadows and padding intact. Do not duplicate the Polaroid
responsive width rules.

- [ ] **Step 7: Run full automated verification**

Run:

```bash
node --check js/diary.js
node --check js/diary-layout.mjs
node --check js/diary-media.mjs
node --test js/*.test.mjs
git diff --check
```

Expected: all tests pass.

- [ ] **Step 8: Browser acceptance**

Use an untracked fixture with real production CSS/modules and two entries with
opposite layouts. Verify:

- static text-left and media-left swaps
- cached media sizing works on the physical left
- Next and Previous front/back/underlay remain physically correct
- Edit form loads and switches the radio choice
- reset returns to text-left
- desktop and mobile containment
- no console errors

- [ ] **Step 9: Commit**

```bash
git add js/diary.js js/diary-layout.mjs js/diary-layout.test.mjs js/diary-state.test.mjs css/pages.css
git commit -m "Render diary content on either page"
```
