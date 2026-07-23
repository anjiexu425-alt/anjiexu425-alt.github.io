# Study Diary Edit Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Edit` button to the Study Diary page (`study-diary.html`) that lets a logged-in user edit the text, images, and video of the currently displayed diary page in place, reusing the existing "Write Diary" modal in a new edit mode.

**Architecture:** A new module-level `editingEntryId` (string id or `null`) in `js/diary.js` tracks whether the write/edit modal is in edit mode. Clicking the new `.diary-edit-btn` prefills the existing `.diary-form` from the active entry and sets `editingEntryId`; submitting branches on `editingEntryId` to call `updateEntry()` (patch in place) instead of `insertEntry()` (append). Two new pure helpers in `js/diary-validation.mjs` — `resolveMediaUrls` and `buildEditPatch` — isolate the edit-specific data logic so it's unit-testable with `node:test`, matching this file's existing pattern.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS client (`js/diary-supabase.js`), `node:test` for logic unit tests (no package.json/bundler — tests run via `node --test js/<file>.test.mjs`), plain CSS custom properties (no framework).

## Global Constraints

- Edit button (`.diary-edit-btn`) sits immediately to the left of `.diary-write-btn` inside `.diary-toolbar`, in `study-diary.html`.
- Label is `✎ Edit` — a pencil glyph plus text, following this site's existing convention of Unicode/emoji icons (no SVG/icon-font library is used anywhere in this codebase).
- Edit button visibility is gated by `isLoggedIn`, exactly like `.diary-write-btn` — hidden when logged out.
- Edit button is additionally `disabled` (not hidden) whenever `ENTRIES.length === 0` — nothing to edit.
- Modal copy swaps by mode: `"Write a Diary Entry"` / `"Insert to Abroad Diary"` (new-entry, default) vs. `"Edit Diary Entry"` / `"Save Changes"` (edit mode).
- Media rule: leaving all file inputs blank on an edit keeps the entry's existing `media.urls`; selecting any new file(s) replaces the entire media set (same replace-everything behavior new-entry creation already has — no partial replace of "just image 3").
- An edit must never modify the entry's `number`, `mood`, or `weather` fields — the edit patch sent to Supabase must not include those keys.
- `editingEntryId` must be reset to `null` on every path that closes the modal (X, Cancel, backdrop click, successful save) so a cancelled or completed edit can never leak into the next "Write Diary" draft.
- No new error-display UI — reuse the existing `.diary-form .diary-form__error` element and the existing try/catch/finally structure in `handleFormSubmit`.
- Match existing code style exactly: 2-space indentation, single quotes, `id`/`class` naming already used in this file (`diary-*` prefix, BEM-ish `__`/`--` separators).
- This project has no `package.json`; unit tests run directly via `node --test js/<file>.test.mjs` (Node v18+; confirmed available as `node` on this machine).

---

### Task 1: Add `resolveMediaUrls` and `buildEditPatch` to `js/diary-validation.mjs`

**Files:**
- Modify: `js/diary-validation.mjs` (append two new exported functions)
- Modify: `js/diary-validation.test.mjs` (append tests for both)

**Interfaces:**
- Consumes: nothing new.
- Produces: `resolveMediaUrls(uploadedUrls: string[], existingUrls: string[]): string[]` and `buildEditPatch(fields: { category, date, title, quote, body }, media: { type, urls, caption }): object`. Task 5's edit branch of `handleFormSubmit` calls both.

This is pure, DOM-free logic — the only new logic in this feature that can be unit tested without a browser, so it's written test-first.

- [ ] **Step 1: Write the failing tests**

Open `js/diary-validation.test.mjs`. Append at the end of the file (after the last `test(...)` block, before EOF):

```js

test('resolveMediaUrls keeps newly uploaded files when present', () => {
  assert.deepEqual(resolveMediaUrls(['new.jpg'], ['old.jpg']), ['new.jpg']);
});

test('resolveMediaUrls falls back to the existing urls when nothing was uploaded', () => {
  assert.deepEqual(resolveMediaUrls([], ['old.jpg', 'old2.jpg']), ['old.jpg', 'old2.jpg']);
});

test('buildEditPatch maps form fields and media into a Supabase patch, without number/mood/weather', () => {
  const patch = buildEditPatch(
    { category: 'Study', date: '2026.07.20', title: 'Edited Title', quote: 'A line that stuck.', body: 'Body text.' },
    { type: 'image', urls: ['a.jpg', 'b.jpg'], caption: 'A caption' }
  );
  assert.deepEqual(patch, {
    category: 'Study',
    entry_date: '2026.07.20',
    title: 'Edited Title',
    quote: 'A line that stuck.',
    body: 'Body text.',
    media: { type: 'image', urls: ['a.jpg', 'b.jpg'], caption: 'A caption' },
  });
});

test('buildEditPatch defaults an empty quote to null, matching entryToSupabaseRow', () => {
  const patch = buildEditPatch(
    { category: 'Study', date: '2026.07.20', title: 'Title', quote: '', body: 'Body.' },
    { type: 'video', urls: ['a.mp4'], caption: '' }
  );
  assert.equal(patch.quote, null);
});
```

Then update the import block at the top of the file (currently lines 3-10) from:

```js
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
} from './diary-validation.mjs';
```

to:

```js
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
  resolveMediaUrls,
  buildEditPatch,
} from './diary-validation.mjs';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test js/diary-validation.test.mjs`
Expected: the four new tests FAIL with an error like `resolveMediaUrls is not a function` (or a SyntaxError from the import, since the names don't exist yet in `diary-validation.mjs`) — the pre-existing tests in this file still pass.

- [ ] **Step 3: Implement the two functions**

Open `js/diary-validation.mjs`. Append at the end of the file (after `entryToSupabaseRow`):

```js

// Returns the media URLs to save for an edit: newly uploaded files replace
// the entry's existing media entirely, but an edit with no new uploads (the
// file inputs left blank) keeps whatever media the entry already had.
export function resolveMediaUrls(uploadedUrls, existingUrls) {
  return uploadedUrls.length > 0 ? uploadedUrls : existingUrls;
}

// Builds the partial-update patch for editing an existing entry. Deliberately
// omits `number`, `mood`, and `weather` — editing text/media must never touch
// those fields, so they simply aren't part of the patch Supabase applies.
export function buildEditPatch(fields, media) {
  return {
    category: fields.category,
    entry_date: fields.date,
    title: fields.title,
    quote: fields.quote || null,
    body: fields.body,
    media,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test js/diary-validation.test.mjs`
Expected: PASS — all tests in the file green, including the four new ones.

- [ ] **Step 5: Commit**

```bash
git add js/diary-validation.mjs js/diary-validation.test.mjs
git commit -m "Add resolveMediaUrls and buildEditPatch helpers for Study Diary edit feature"
```

---

### Task 2: Add `editingEntryId` state and `setWriteModalMode` helper

**Files:**
- Modify: `js/diary.js` (state variable, new helper, `closeWriteModal` update)

**Interfaces:**
- Consumes: nothing new.
- Produces: `editingEntryId` (module-level `let`, starts `null`) and `setWriteModalMode(mode: 'write' | 'edit'): void`. Task 3's `handleOpenEditor` sets `editingEntryId` and calls `setWriteModalMode('edit')`; Task 5's `handleFormSubmit` reads `editingEntryId` to branch.

This task only adds plumbing — after this task, opening/closing "Write Diary" behaves exactly as before (mode is always `'write'` since nothing sets `editingEntryId` yet).

- [ ] **Step 1: Add the `editingEntryId` state variable**

In `js/diary.js`, find (around line 42-45):

```js
let ENTRIES = [];

let state = createDiaryState(ENTRIES.length);
let isFlipping = false;
```

Replace with:

```js
let ENTRIES = [];

let state = createDiaryState(ENTRIES.length);
let isFlipping = false;

// Non-null while the write/edit modal is open in edit mode — the id of the
// entry being edited. Reset to null by closeWriteModal() so an in-progress
// or cancelled edit never leaks into the next "Write Diary" draft.
let editingEntryId = null;
```

- [ ] **Step 2: Add `setWriteModalMode` and update `closeWriteModal`**

In `js/diary.js`, find (around line 683-701):

```js
function setMediaType(type) {
  document.querySelectorAll('.diary-form__tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.mediaType === type);
  });
  document.querySelectorAll('.diary-form__media-group').forEach((group) => {
    group.hidden = group.dataset.mediaGroup !== type;
  });
}

function openWriteModal() {
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
}
```

Replace with:

```js
function setMediaType(type) {
  document.querySelectorAll('.diary-form__tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.mediaType === type);
  });
  document.querySelectorAll('.diary-form__media-group').forEach((group) => {
    group.hidden = group.dataset.mediaGroup !== type;
  });
}

// Swaps the write/edit modal's title and submit-button copy. 'edit' is used
// while editingEntryId is set; 'write' is the default, new-entry copy.
function setWriteModalMode(mode) {
  const isEdit = mode === 'edit';
  document.querySelector('.diary-modal-backdrop .diary-modal__header h3').textContent = isEdit
    ? 'Edit Diary Entry'
    : 'Write a Diary Entry';
  document.querySelector('.diary-form button[type="submit"]').textContent = isEdit
    ? 'Save Changes'
    : 'Insert to Abroad Diary';
}

function openWriteModal() {
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
  editingEntryId = null;
  setWriteModalMode('write');
}
```

- [ ] **Step 3: Verify in the browser**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
python3 -m http.server 8090
```

Open `http://localhost:8090/study-diary.html`. Open the book, log in (Prerequisites credentials), click `Write Diary`. Confirm the modal title still reads "Write a Diary Entry" and the submit button still reads "Insert to Abroad Diary" (unchanged from before this task — `setWriteModalMode('write')` on an already-write-mode modal is a no-op visually). Close it, confirm no console errors (open DevTools console).

- [ ] **Step 4: Commit**

```bash
git add js/diary.js
git commit -m "Add editingEntryId state and setWriteModalMode helper to Study Diary write modal"
```

---

### Task 3: Add the `.diary-edit-btn` button, CSS, auth-visibility wiring, and prefill

**Files:**
- Modify: `study-diary.html` (button markup)
- Modify: `css/pages.css` (button styles + disabled state)
- Modify: `js/diary.js` (`applyAuthState`, `updateChrome`, new `handleOpenEditor`, DOMContentLoaded listener)

**Interfaces:**
- Consumes: `editingEntryId`, `setWriteModalMode` (Task 2).
- Produces: `handleOpenEditor(entry): void`. Task 4 extends it to also populate the current-media preview.

- [ ] **Step 1: Add the button markup**

In `study-diary.html`, find:

```html
      <div class="diary-toolbar">
        <button type="button" class="diary-write-btn" hidden>Write Diary</button>
        <button type="button" class="diary-login-btn">Log In</button>
      </div>
```

Replace with:

```html
      <div class="diary-toolbar">
        <button type="button" class="diary-edit-btn" hidden>✎ Edit</button>
        <button type="button" class="diary-write-btn" hidden>Write Diary</button>
        <button type="button" class="diary-login-btn">Log In</button>
      </div>
```

- [ ] **Step 2: Add the CSS**

In `css/pages.css`, find (around line 1090-1104):

```css
.diary-write-btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-klein-blue);
  border-radius: 999px;
  background: none;
  color: var(--color-klein-blue);
  font-size: 0.85rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.diary-write-btn:hover {
  background: var(--color-klein-blue);
  color: #fff;
}
```

Replace with:

```css
.diary-write-btn,
.diary-edit-btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-klein-blue);
  border-radius: 999px;
  background: none;
  color: var(--color-klein-blue);
  font-size: 0.85rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.diary-write-btn:hover,
.diary-edit-btn:hover {
  background: var(--color-klein-blue);
  color: #fff;
}

.diary-edit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.diary-edit-btn:disabled:hover {
  background: none;
  color: var(--color-klein-blue);
}
```

- [ ] **Step 3: Gate visibility in `applyAuthState`**

In `js/diary.js`, find:

```js
function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  document.querySelector('.diary-write-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-login-btn').textContent = isLoggedIn ? 'Log Out' : 'Log In';
  renderStatic();
}
```

Replace with:

```js
function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  document.querySelector('.diary-write-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-edit-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-login-btn').textContent = isLoggedIn ? 'Log Out' : 'Log In';
  renderStatic();
}
```

- [ ] **Step 4: Disable the edit button when there are zero entries**

In `js/diary.js`, find:

```js
function updateChrome() {
  const countLabel = state.totalPages === 0 ? '0 / 0' : `${state.current + 1} / ${state.totalPages}`;
  document.querySelector('.diary-pagination__count').textContent = countLabel;
  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });
  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state) || isFlipping;
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state) || isFlipping;
}
```

Replace with:

```js
function updateChrome() {
  const countLabel = state.totalPages === 0 ? '0 / 0' : `${state.current + 1} / ${state.totalPages}`;
  document.querySelector('.diary-pagination__count').textContent = countLabel;
  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });
  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state) || isFlipping;
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state) || isFlipping;
  document.querySelector('.diary-edit-btn').disabled = ENTRIES.length === 0;
}
```

- [ ] **Step 5: Add `handleOpenEditor` and wire the click listener**

In `js/diary.js`, find:

```js
function openWriteModal() {
  document.querySelector('.diary-modal-backdrop').hidden = false;
}
```

Replace with:

```js
function openWriteModal() {
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

// Opens the write/edit modal pre-filled with an existing entry's text
// fields, so submitting updates that entry instead of creating a new one.
// Media (file inputs) can't be pre-filled by the browser — see Task 4 for
// the "current media" preview that covers that gap.
function handleOpenEditor(entry) {
  editingEntryId = entry.id;
  const form = document.querySelector('.diary-form');
  form.category.value = entry.category;
  form.date.value = entry.date;
  form.title.value = entry.title;
  form.quote.value = entry.quote;
  form.body.value = entry.body;
  form.caption.value = entry.media.caption;
  setMediaType(entry.media.type);
  setWriteModalMode('edit');
  document.querySelector('.diary-modal-backdrop').hidden = false;
}
```

Then, in `js/diary.js`, find (inside the `DOMContentLoaded` handler):

```js
  document.querySelector('.diary-write-btn').addEventListener('click', openWriteModal);
```

Replace with:

```js
  document.querySelector('.diary-edit-btn').addEventListener('click', () => {
    if (ENTRIES.length === 0) return;
    handleOpenEditor(ENTRIES[state.current]);
  });
  document.querySelector('.diary-write-btn').addEventListener('click', openWriteModal);
```

- [ ] **Step 6: Verify in the browser**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
python3 -m http.server 8090
```

Open `http://localhost:8090/study-diary.html`:
1. **Logged out:** confirm `Edit` is not visible next to `Write Diary` (both hidden), only `Log In` shows.
2. **Log in** (Prerequisites credentials). Confirm `Edit` now appears to the left of `Write Diary`, both enabled if the diary has at least one entry.
3. Open the book to a real page. Click `Edit`. Confirm the modal opens titled "Edit Diary Entry", submit button reads "Save Changes", and Category/Date/Title/Quote/Body/Caption fields are pre-filled with that page's content, and the Image/Video tab matches that entry's media type. Close without saving (click the `×`) — confirm the modal fully closes.
4. Re-open `Write Diary` (not Edit). Confirm the modal now reads "Write a Diary Entry" / "Insert to Abroad Diary" again, and all fields are blank (proves `closeWriteModal`'s reset from Task 2 is working). Close it.
5. Check DevTools console for errors throughout — expect none.

- [ ] **Step 7: Commit**

```bash
git add study-diary.html css/pages.css js/diary.js
git commit -m "Add Study Diary Edit button with auth-gated visibility and text-field prefill"
```

---

### Task 4: Add the "current media" preview strip

**Files:**
- Modify: `study-diary.html` (preview markup inside the modal form)
- Modify: `css/pages.css` (preview strip styles)
- Modify: `js/diary.js` (`handleOpenEditor`, `closeWriteModal`)

**Interfaces:**
- Consumes: `handleOpenEditor`, `closeWriteModal` (Task 2/3), `isPlaceholder` (already defined at the top of `js/diary.js`).
- Produces: nothing new consumed by later tasks — purely a UI addition that closes the "media can't be prefilled" gap called out in the design.

- [ ] **Step 1: Add the preview container markup**

In `study-diary.html`, find:

```html
        <label class="diary-form__field">
          <span>Diary content</span>
          <textarea name="body" rows="6" placeholder="What happened, what you noticed, how it felt. Leave a blank line between paragraphs." required></textarea>
        </label>

        <div class="diary-form__field">
          <span>Media type</span>
```

Replace with:

```html
        <label class="diary-form__field">
          <span>Diary content</span>
          <textarea name="body" rows="6" placeholder="What happened, what you noticed, how it felt. Leave a blank line between paragraphs." required></textarea>
        </label>

        <div class="diary-form__current-media" hidden>
          <p class="diary-form__current-media-label">Current media — leave the fields below blank to keep it.</p>
          <div class="diary-form__current-media-grid"></div>
        </div>

        <div class="diary-form__field">
          <span>Media type</span>
```

- [ ] **Step 2: Add the CSS**

In `css/pages.css`, find:

```css
.diary-edit-btn:disabled:hover {
  background: none;
  color: var(--color-klein-blue);
}
```

Replace with:

```css
.diary-edit-btn:disabled:hover {
  background: none;
  color: var(--color-klein-blue);
}

.diary-form__current-media {
  margin-bottom: var(--space-2);
}

.diary-form__current-media-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.diary-form__current-media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.diary-form__current-media-grid img,
.diary-form__current-media-grid video {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
}

.diary-form__current-media-empty {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
}
```

- [ ] **Step 3: Populate the preview in `handleOpenEditor`, clear it in `closeWriteModal`**

In `js/diary.js`, find:

```js
// Opens the write/edit modal pre-filled with an existing entry's text
// fields, so submitting updates that entry instead of creating a new one.
// Media (file inputs) can't be pre-filled by the browser — see Task 4 for
// the "current media" preview that covers that gap.
function handleOpenEditor(entry) {
  editingEntryId = entry.id;
  const form = document.querySelector('.diary-form');
  form.category.value = entry.category;
  form.date.value = entry.date;
  form.title.value = entry.title;
  form.quote.value = entry.quote;
  form.body.value = entry.body;
  form.caption.value = entry.media.caption;
  setMediaType(entry.media.type);
  setWriteModalMode('edit');
  document.querySelector('.diary-modal-backdrop').hidden = false;
}
```

Replace with:

```js
// Builds the small thumbnail strip shown in edit mode so the user can see
// what media the entry currently has, since file inputs can't be pre-filled.
function currentMediaPreviewHTML(media) {
  if (media.type === 'video') {
    const url = media.urls[0];
    if (isPlaceholder(url)) return '<p class="diary-form__current-media-empty">No video uploaded yet.</p>';
    return `<video src="${url}" muted></video>`;
  }
  const realUrls = media.urls.filter((url) => !isPlaceholder(url));
  if (realUrls.length === 0) return '<p class="diary-form__current-media-empty">No photos uploaded yet.</p>';
  return realUrls.map((url) => `<img src="${url}" alt="" />`).join('');
}

// Opens the write/edit modal pre-filled with an existing entry's text
// fields and a preview of its current media, so submitting updates that
// entry instead of creating a new one.
function handleOpenEditor(entry) {
  editingEntryId = entry.id;
  const form = document.querySelector('.diary-form');
  form.category.value = entry.category;
  form.date.value = entry.date;
  form.title.value = entry.title;
  form.quote.value = entry.quote;
  form.body.value = entry.body;
  form.caption.value = entry.media.caption;
  setMediaType(entry.media.type);

  const currentMediaEl = document.querySelector('.diary-form__current-media');
  currentMediaEl.hidden = false;
  document.querySelector('.diary-form__current-media-grid').innerHTML = currentMediaPreviewHTML(entry.media);

  setWriteModalMode('edit');
  document.querySelector('.diary-modal-backdrop').hidden = false;
}
```

Then find:

```js
function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
  editingEntryId = null;
  setWriteModalMode('write');
}
```

Replace with:

```js
function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
  editingEntryId = null;
  setWriteModalMode('write');
  document.querySelector('.diary-form__current-media').hidden = true;
  document.querySelector('.diary-form__current-media-grid').innerHTML = '';
}
```

- [ ] **Step 4: Verify in the browser**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
python3 -m http.server 8090
```

Open `http://localhost:8090/study-diary.html`, log in, open the book to a page with real (non-placeholder) photos. Click `Edit`. Confirm a "Current media — leave the fields below blank to keep it." strip appears above the Media type tabs, showing small thumbnails of that page's actual photos. Close the modal, click `Write Diary` instead — confirm the current-media strip is not visible (hidden) in new-entry mode. Check the console for errors.

- [ ] **Step 5: Commit**

```bash
git add study-diary.html css/pages.css js/diary.js
git commit -m "Add current-media preview strip to Study Diary edit modal"
```

---

### Task 5: Branch `handleFormSubmit` to update an existing entry in edit mode

**Files:**
- Modify: `js/diary.js` (import line, `handleFormSubmit`)

**Interfaces:**
- Consumes: `resolveMediaUrls`, `buildEditPatch` (Task 1); `editingEntryId`, `closeWriteModal` (Task 2/4); `updateEntry` (already imported from `js/diary-supabase.js`).
- Produces: no new interface — this is the terminal behavior the whole feature exists for.

- [ ] **Step 1: Import the two new helpers**

In `js/diary.js`, find:

```js
import {
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
} from './diary-validation.mjs';
```

Replace with:

```js
import {
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
  resolveMediaUrls,
  buildEditPatch,
} from './diary-validation.mjs';
```

- [ ] **Step 2: Replace `handleFormSubmit` with a version that branches on `editingEntryId`**

In `js/diary.js`, find the entire function (confirm your file matches before editing — if it doesn't, an earlier task wasn't applied correctly):

```js
async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = data.get('title').trim();
  const body = data.get('body').trim();
  const date = data.get('date').trim();
  if (!title || !body || !date) return;

  const errorEl = document.querySelector('.diary-form .diary-form__error');
  errorEl.hidden = true;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading…';

  try {
    const mediaType = document.querySelector('.diary-form__tab.is-active').dataset.mediaType;
    let files;
    if (mediaType === 'video') {
      const videoFile = data.get('video');
      files = videoFile && videoFile.size > 0 ? [videoFile] : [];
    } else {
      files = ['image1', 'image2', 'image3', 'image4']
        .map((field) => data.get(field))
        .filter((file) => file && file.size > 0);
    }

    let urls = await uploadMediaFiles(files);
    if (urls.length === 0) {
      urls = [mediaType === 'video' ? '[Photo placeholder: new entry video]' : '[Photo placeholder: new entry photo]'];
    }

    const newEntry = {
      number: String(ENTRIES.length + 1).padStart(2, '0'),
      category: data.get('category'),
      date,
      title,
      quote: data.get('quote').trim(),
      body,
      media: { type: mediaType, urls, caption: data.get('caption').trim() },
      mood: '',
      weather: '',
    };
    const row = await insertEntry(entryToSupabaseRow(newEntry));
    ENTRIES.push(supabaseRowToEntry(row));

    state = goToPage(openBook(createDiaryState(ENTRIES.length)), ENTRIES.length - 1);
    document.querySelector('.diary').classList.add('is-open');
    buildDots();
    renderStatic();
    updateChrome();
    closeWriteModal();
  } catch (error) {
    errorEl.textContent = error.message || 'Something went wrong saving this entry. Please try again.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Insert to Abroad Diary';
  }
}
```

Replace with:

```js
async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = data.get('title').trim();
  const body = data.get('body').trim();
  const date = data.get('date').trim();
  if (!title || !body || !date) return;

  const errorEl = document.querySelector('.diary-form .diary-form__error');
  errorEl.hidden = true;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalSubmitLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading…';

  try {
    const mediaType = document.querySelector('.diary-form__tab.is-active').dataset.mediaType;
    let files;
    if (mediaType === 'video') {
      const videoFile = data.get('video');
      files = videoFile && videoFile.size > 0 ? [videoFile] : [];
    } else {
      files = ['image1', 'image2', 'image3', 'image4']
        .map((field) => data.get(field))
        .filter((file) => file && file.size > 0);
    }

    const uploadedUrls = await uploadMediaFiles(files);
    const caption = data.get('caption').trim();

    if (editingEntryId) {
      const existingEntry = ENTRIES.find((entry) => entry.id === editingEntryId);
      const urls = resolveMediaUrls(uploadedUrls, existingEntry.media.urls);
      const patch = buildEditPatch(
        { category: data.get('category'), date, title, quote: data.get('quote').trim(), body },
        { type: mediaType, urls, caption }
      );
      const row = await updateEntry(editingEntryId, patch);
      const index = ENTRIES.findIndex((entry) => entry.id === editingEntryId);
      ENTRIES[index] = supabaseRowToEntry(row);

      renderStatic();
      updateChrome();
      closeWriteModal();
    } else {
      let urls = uploadedUrls;
      if (urls.length === 0) {
        urls = [mediaType === 'video' ? '[Photo placeholder: new entry video]' : '[Photo placeholder: new entry photo]'];
      }

      const newEntry = {
        number: String(ENTRIES.length + 1).padStart(2, '0'),
        category: data.get('category'),
        date,
        title,
        quote: data.get('quote').trim(),
        body,
        media: { type: mediaType, urls, caption },
        mood: '',
        weather: '',
      };
      const row = await insertEntry(entryToSupabaseRow(newEntry));
      ENTRIES.push(supabaseRowToEntry(row));

      state = goToPage(openBook(createDiaryState(ENTRIES.length)), ENTRIES.length - 1);
      document.querySelector('.diary').classList.add('is-open');
      buildDots();
      renderStatic();
      updateChrome();
      closeWriteModal();
    }
  } catch (error) {
    errorEl.textContent = error.message || 'Something went wrong saving this entry. Please try again.';
    errorEl.hidden = false;
    submitBtn.textContent = originalSubmitLabel;
  } finally {
    submitBtn.disabled = false;
  }
}
```

Note the error-path fix: `originalSubmitLabel` is captured before the button text is overwritten to `'Uploading…'`, and restored only in `catch` — not unconditionally in `finally`. This matters because on a *successful* edit save, `closeWriteModal()` already resets the button text to the write-mode default before `finally` runs; if `finally` also restored `originalSubmitLabel` (`'Save Changes'`), it would stomp that reset. Restoring only on the error path keeps both cases correct: on success the modal's own reset wins, on error the pre-submit label reappears so the user sees "Save Changes" (or "Insert to Abroad Diary") again instead of a stuck "Uploading…".

- [ ] **Step 3: Verify in the browser**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
python3 -m http.server 8090
```

Open `http://localhost:8090/study-diary.html`, log in, open the book to a real page:
1. Click `Edit`. Change `Title` to `Edited Study Title`. Leave media fields blank. Click `Save Changes`.
2. Confirm: the modal closes, the currently displayed left page now shows "Edited Study Title", with **no page-turn animation** (updates in place). Confirm the page count (`.diary-pagination__count`) is unchanged.
3. Open DevTools → Application/Storage isn't used here (data is in Supabase) — instead, refresh the whole page. Confirm "Edited Study Title" persisted (proves the Supabase `update` went through, not just a local mutation).
4. Edit the same page again, this time also select a new image file for Image 1, and click `Save Changes`. Confirm the new photo now appears on the right page in place of the old one.
5. Edit any page, change the Title, click `Cancel`. Re-open `Edit` on the same page — confirm the Title shows the *original* value, not the cancelled edit (proves `editingEntryId` reset + no premature local mutation).
6. Immediately after step 5, click `Write Diary` — confirm every field is blank/default (Category back to the form's default, Date empty, Title/Body/Quote/Caption empty, media tab back to Image) — no leakage from the cancelled edit.
7. Trigger a save error deliberately if practical (e.g. temporarily disconnect network in DevTools before clicking Save Changes) — confirm the inline error message appears and the submit button text returns to "Save Changes" (not stuck on "Uploading…"), and the diary page's displayed content is unchanged.

- [ ] **Step 4: Commit**

```bash
git add js/diary.js
git commit -m "Branch Study Diary handleFormSubmit to update an existing entry in edit mode"
```

---

### Task 6: End-to-end regression pass

**Files:** none modified — this task is a full manual click-through of the finished feature plus the pre-existing flows it touches.

**Interfaces:** none.

- [ ] **Step 1: Run the full unit test suite one more time**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
node --test js/diary-validation.test.mjs js/diary-state.test.mjs js/circle-nav-math.test.mjs js/typewriter.test.mjs js/experience-state.test.mjs
```

Expected: all PASS, no failures, no test named "resolveMediaUrls" or "buildEditPatch" missing.

- [ ] **Step 2: Full manual checklist walk-through**

```bash
cd /Users/estrella/Desktop/my-project/.worktrees/personal-website
python3 -m http.server 8090
```

Open `http://localhost:8090/study-diary.html`:

1. **Logged out:** confirm neither `Edit` nor `Write Diary` is visible. Only `Log In`.
2. **Log in.** Confirm both `Edit` and `Write Diary` appear; if the diary currently has entries, `Edit` is enabled.
3. **New entry still works exactly as before:** click `Write Diary`, fill in required fields, submit. Confirm a new page is added, the book jumps to it, and the pagination count increments.
4. **Edit prefill:** click `Edit` on the page you just created. Confirm every field you entered is present, and the media tab matches what you selected.
5. **Cancel leaves data untouched:** change the Title, click Cancel, re-open Edit on the same page — confirm the original Title is still shown.
6. **Save replaces in place:** change Title/Body, click `Save Changes` — confirm the change appears on that same page, no page-jump, page count unchanged, and it survives a full page refresh.
7. **No leakage into new entries:** immediately after saving an edit, click `Write Diary` — confirm every field is blank/default.
8. **Disabled/hidden states:** log out — confirm `Edit` and `Write Diary` both disappear. Log back in.
9. **Console check:** throughout, DevTools console shows no errors.

- [ ] **Step 3: Fix anything the walk-through surfaces**

If any item above fails, identify which task's change is responsible (Task 1-5), fix it there, and re-run the full checklist from Step 2.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

```bash
git add study-diary.html css/pages.css js/diary.js js/diary-validation.mjs js/diary-validation.test.mjs
git commit -m "Fix issues found in end-to-end review of the Study Diary edit feature"
```

If nothing needed fixing, skip this commit — Task 5's commit is the last one for this feature.
