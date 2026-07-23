# Study Diary Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Study Diary's localStorage-only persistence with Supabase (Postgres + Auth + Storage), so diary entries are publicly readable by anyone who opens the published site, only the site owner can write/edit/delete after logging in, and photos/videos are real uploaded files instead of pasted URLs/paths.

**Architecture:** All Supabase I/O (auth, database reads/writes, file uploads) is isolated in one new module, `js/diary-supabase.js`, imported by `js/diary.js`. A second new module, `js/diary-validation.mjs`, holds every piece of pure logic this feature needs (file-size checks, upload-path building, row↔entry shape mapping) so it can be unit tested the same way the rest of this project's pure logic already is. `js/diary.js` itself keeps its existing rendering/animation/event-wiring responsibilities, but its entry storage moves from a synchronous in-memory array backed by localStorage to entries fetched from Supabase on load, with auth-gated write/delete/edit controls.

**Tech Stack:** Vanilla HTML/CSS/JS (no build tools, no bundler — unchanged project constraint). Supabase JS client v2, loaded directly in the browser via ES module CDN import (`https://esm.sh/@supabase/supabase-js@2`) — no npm install, no build step.

## Global Constraints

- No build tools, no bundler, no npm dependencies added to the repo — the Supabase client loads via a CDN `import`, exactly like any other `<script type="module">` in this project.
- Supabase project uses table `diary_entries` and storage bucket `diary-media` (exact names, used verbatim in code and RLS policies).
- File size limits: images ≤ 8MB (`8 * 1024 * 1024` bytes), videos ≤ 100MB (`100 * 1024 * 1024` bytes) — enforced client-side before an upload is attempted.
- No public sign-up flow. Exactly one Supabase Auth user exists (the site owner), created manually in the Supabase dashboard during Prerequisites — never created by application code.
- Row Level Security enforces: anyone can read (`select`), only an authenticated user can write (`insert`/`update`/`delete`). Since no sign-up flow exists and only one user is ever created, "authenticated" and "the owner" are equivalent — policies do not need to match a specific email.
- Every Supabase call (auth, read, write, upload, delete) must surface a user-facing error message on failure — never fail silently, never leave the UI in an indeterminate state (spec's Error Handling table, `docs/superpowers/specs/2026-07-21-study-diary-backend-design.md`).
- Pure logic (file-size checks, upload-path building, row↔entry mapping) gets `node:test` coverage, matching this project's existing convention (`.mjs` module + matching `.test.mjs`). Live Supabase calls (auth/read/write/upload/delete) are verified manually in a browser — this project has never unit-tested `diary.js`'s DOM/network-wiring code, and real network calls cannot run under `node --test` without a browser or emulator (spec's Testing Strategy explicitly accepts this).

---

## Prerequisites (you do this manually — no subagent can do it for you)

This has to happen before Task 1, because Task 2 needs real values (project URL, anon key) that only exist once your Supabase project does.

- [ ] **Step 1: Create a Supabase project**

Go to [supabase.com](https://supabase.com), sign up/log in, click "New Project". Pick any name/region/password (the database password here is separate from your site-owner login password — you won't need it again unless you connect a SQL client directly). Wait for the project to finish provisioning (~2 minutes).

- [ ] **Step 2: Create the `diary_entries` table and its RLS policies**

In the Supabase dashboard, open **SQL Editor → New Query**, paste and run:

```sql
create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  number text,
  category text,
  entry_date text,
  title text,
  quote text,
  body text,
  media jsonb,
  mood text,
  weather text,
  created_at timestamptz default now()
);

alter table diary_entries enable row level security;

create policy "Public read access"
  on diary_entries for select
  using (true);

create policy "Authenticated insert"
  on diary_entries for insert
  to authenticated
  with check (true);

create policy "Authenticated update"
  on diary_entries for update
  to authenticated
  using (true);

create policy "Authenticated delete"
  on diary_entries for delete
  to authenticated
  using (true);
```

Expected: query runs with no errors. Table Editor (left sidebar) now shows `diary_entries` with the columns above and zero rows.

- [ ] **Step 3: Create the `diary-media` storage bucket and its policies**

Same SQL Editor, new query:

```sql
insert into storage.buckets (id, name, public)
values ('diary-media', 'diary-media', true);

create policy "Public read access to diary media"
  on storage.objects for select
  using (bucket_id = 'diary-media');

create policy "Authenticated upload to diary media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'diary-media');

create policy "Authenticated delete from diary media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'diary-media');
```

Expected: query runs with no errors. **Storage** (left sidebar) now shows a `diary-media` bucket marked Public.

- [ ] **Step 4: Create your own login (the site owner account)**

Go to **Authentication → Users → Add user → Create new user**. Enter your email and a password you'll remember. Toggle **Auto Confirm User** ON (so you don't need to click an email confirmation link). Click Create user.

Expected: your email appears in the Users list with status "Confirmed".

- [ ] **Step 5: Copy your project's URL and anon key**

Go to **Settings → API**. Copy the **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`) and the **anon / public** key (a long string starting with `eyJ...`). You'll paste both into `js/diary-supabase.js` in Task 2, Step 1.

---

## Task 1: Pure validation and data-mapping module

**Files:**
- Create: `js/diary-validation.mjs`
- Test: `js/diary-validation.test.mjs`

**Interfaces:**
- Produces: `MAX_IMAGE_BYTES` (number), `MAX_VIDEO_BYTES` (number), `isFileSizeAllowed(sizeBytes, mediaType)` (boolean), `buildUploadPath(fileName, timestampMs)` (string), `supabaseRowToEntry(row)` (entry object), `entryToSupabaseRow(entry)` (row object) — all consumed by `js/diary-supabase.js` (Task 2) and `js/diary.js` (Tasks 3, 5, 6).

- [ ] **Step 1: Write the failing tests**

Create `js/diary-validation.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
} from './diary-validation.mjs';

test('an image under the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES - 1, 'image'), true);
});

test('an image over the size limit is rejected', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES + 1, 'image'), false);
});

test('an image exactly at the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES, 'image'), true);
});

test('a video under the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_VIDEO_BYTES - 1, 'video'), true);
});

test('a video over the size limit is rejected', () => {
  assert.equal(isFileSizeAllowed(MAX_VIDEO_BYTES + 1, 'video'), false);
});

test('buildUploadPath combines a timestamp and the file name', () => {
  assert.equal(buildUploadPath('beach.jpg', 1700000000000), '1700000000000-beach.jpg');
});

test('buildUploadPath replaces spaces in the file name with hyphens', () => {
  assert.equal(buildUploadPath('my beach photo.jpg', 1700000000000), '1700000000000-my-beach-photo.jpg');
});

test('supabaseRowToEntry maps a database row to the entry shape used by rendering', () => {
  const row = {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  };
  assert.deepEqual(supabaseRowToEntry(row), {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  });
});

test('supabaseRowToEntry defaults missing quote/mood/weather to empty strings', () => {
  const row = {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: null,
    body: 'It was a good day.',
    media: { type: 'image', urls: [], caption: '' },
    mood: null,
    weather: null,
  };
  const entry = supabaseRowToEntry(row);
  assert.equal(entry.quote, '');
  assert.equal(entry.mood, '');
  assert.equal(entry.weather, '');
});

test('entryToSupabaseRow maps the entry shape back to a database row', () => {
  const entry = {
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  };
  assert.deepEqual(entryToSupabaseRow(entry), {
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  });
});

test('entryToSupabaseRow defaults missing quote/mood/weather to null', () => {
  const entry = {
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: '',
    body: 'It was a good day.',
    media: { type: 'image', urls: [], caption: '' },
    mood: '',
    weather: '',
  };
  const row = entryToSupabaseRow(entry);
  assert.equal(row.quote, null);
  assert.equal(row.mood, null);
  assert.equal(row.weather, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test js/diary-validation.test.mjs`
Expected: FAIL — `Cannot find module './diary-validation.mjs'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `js/diary-validation.mjs`:

```js
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function maxBytesForMediaType(mediaType) {
  return mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function isFileSizeAllowed(sizeBytes, mediaType) {
  return sizeBytes <= maxBytesForMediaType(mediaType);
}

// Storage object keys can't safely contain arbitrary whitespace, and a
// timestamp prefix keeps two uploads of the same filename from colliding.
export function buildUploadPath(fileName, timestampMs) {
  return `${timestampMs}-${fileName.replace(/\s+/g, '-')}`;
}

// Maps a diary_entries database row to the entry object shape every
// rendering function in js/diary.js already expects (leftPageHTML,
// rightPageHTML, mediaItemHTML, etc. are unchanged by the Supabase
// migration as long as this mapping is correct).
export function supabaseRowToEntry(row) {
  return {
    id: row.id,
    number: row.number,
    category: row.category,
    date: row.entry_date,
    title: row.title,
    quote: row.quote || '',
    body: row.body,
    media: row.media,
    mood: row.mood || '',
    weather: row.weather || '',
  };
}

export function entryToSupabaseRow(entry) {
  return {
    number: entry.number,
    category: entry.category,
    entry_date: entry.date,
    title: entry.title,
    quote: entry.quote || null,
    body: entry.body,
    media: entry.media,
    mood: entry.mood || null,
    weather: entry.weather || null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test js/diary-validation.test.mjs`
Expected: `pass 11`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add js/diary-validation.mjs js/diary-validation.test.mjs
git commit -m "Add pure validation and Supabase row-mapping helpers for Study Diary"
```

---

## Task 2: Supabase client module

**Files:**
- Create: `js/diary-supabase.js`

**Interfaces:**
- Produces: `fetchEntries()`, `insertEntry(row)`, `deleteEntry(id)`, `updateEntry(id, patch)`, `uploadFile(file, path)`, `signIn(email, password)`, `signOut()`, `getSession()`, `onAuthStateChange(callback)` — all `async` (except `onAuthStateChange`) — consumed by `js/diary.js` in Tasks 3, 4, 5, 6. `uploadFile` takes an already-built storage path — the caller (Task 5) computes it via `buildUploadPath` from `js/diary-validation.mjs` before calling this.

This module is pure I/O wiring around the Supabase SDK — there is no pure logic here to unit test (every function is a thin `async` wrapper that either returns Supabase's data or throws Supabase's error). Verification for this task is manual, in a browser, per the spec's Testing Strategy.

- [ ] **Step 1: Create the module**

Create `js/diary-supabase.js`:

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// From your Supabase project's Settings -> API (see Prerequisites, Step 5).
// The anon/public key is safe to ship in client code — Supabase's access
// control is enforced by the diary_entries/storage.objects Row Level
// Security policies (see Prerequisites, Steps 2-3), not by keeping this
// key secret.
const SUPABASE_URL = 'REPLACE_WITH_YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';

const MEDIA_BUCKET = 'diary-media';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function fetchEntries() {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertEntry(row) {
  const { data, error } = await supabase
    .from('diary_entries')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('diary_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase
    .from('diary_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadFile(file, path) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
```

- [ ] **Step 2: Fill in your real project values**

Open `js/diary-supabase.js` and replace `SUPABASE_URL`/`SUPABASE_ANON_KEY`'s placeholder strings with the exact values you copied in Prerequisites Step 5.

- [ ] **Step 3: Verify manually in a browser**

`js/diary-supabase.js` isn't imported anywhere yet (Task 3 wires that up), so verify it loads and connects correctly on its own first:

1. Start a local server from the project root: `python3 -m http.server 8000`
2. Open `http://localhost:8000/study-diary.html` in a browser.
3. Open the browser's DevTools console.
4. Run:
   ```js
   const mod = await import('./js/diary-supabase.js');
   await mod.fetchEntries();
   ```
5. Expected: resolves to `[]` (an empty array — the table exists but has no rows yet), no error thrown. If you see a network/auth error, double check Step 2's values against Settings → API, and confirm Prerequisites Steps 2-3 ran without error.

- [ ] **Step 4: Commit**

```bash
git add js/diary-supabase.js
git commit -m "Add Supabase client module for Study Diary (auth, database, storage)"
```

---

## Task 3: Load entries from Supabase on page load

**Files:**
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `fetchEntries()` from `js/diary-supabase.js` (Task 2), `supabaseRowToEntry(row)` from `js/diary-validation.mjs` (Task 1).
- Produces: `ENTRIES` becomes a `let`-bound array populated asynchronously (was previously synchronously populated from localStorage) — Tasks 4, 5, 6 build on this.

This task only replaces the **read** path (loading entries when the page opens). `handleDiscard`, `setMood`, and `handleFormSubmit` still mutate `ENTRIES` in memory only after this task — their calls to the now-deleted `saveEntries()` are removed so nothing throws, but real Supabase writes for those three are wired up in Tasks 5 and 6. This is intentional, incremental scope — don't get ahead and wire the write paths here.

- [ ] **Step 1: Remove the localStorage code and switch `ENTRIES` to a mutable, initially-empty array**

In `js/diary.js`, replace:

```js
// Entries persist across reloads via localStorage (this static site has no
// backend/database) — anything written through the "Write Diary" form, or
// discarded, is saved right after the change so a refresh doesn't lose it.
const DIARY_STORAGE_KEY = 'anjie-study-diary-entries';

function loadStoredEntries() {
  try {
    const raw = localStorage.getItem(DIARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(ENTRIES));
  } catch {
    // Storage can fail (quota exceeded, private browsing) — the diary
    // still works for the current session, it just won't persist.
  }
}

const ENTRIES = loadStoredEntries();
```

with:

```js
// Entries live in Supabase now (see js/diary-supabase.js) — this array is
// populated asynchronously by initEntries() on page load, and mutated in
// place by handleDiscard/setMood/handleFormSubmit after each successful
// write so the UI stays in sync with the database.
let ENTRIES = [];
```

- [ ] **Step 2: Add the import**

At the top of `js/diary.js`, add this import alongside the existing `diary-state.mjs` import:

```js
import { fetchEntries } from './diary-supabase.js';
import { supabaseRowToEntry } from './diary-validation.mjs';
```

- [ ] **Step 3: Add `initEntries()`**

Add this function right after `renderStatic()`'s definition in `js/diary.js`:

```js
// Runs once on page load. Shows a loading message inside .diary-stage
// (invisible until the book is opened, since .diary-book is display:none
// until .diary.is-open) so that by the time the user clicks the cover
// open, real content is already in place.
async function initEntries() {
  const stage = document.querySelector('.diary-stage');
  stage.innerHTML = '<p class="diary-empty">Loading diary…</p>';
  try {
    const rows = await fetchEntries();
    ENTRIES = rows.map(supabaseRowToEntry);
  } catch (error) {
    stage.innerHTML = '<p class="diary-empty">Couldn’t load diary entries. Please check your connection and try again.</p>';
    console.error('Failed to load diary entries', error);
    return;
  }
  state = createDiaryState(ENTRIES.length);
  buildDots();
  renderStatic();
  updateChrome();
}
```

- [ ] **Step 4: Call it from `DOMContentLoaded` instead of `buildDots()`**

In `js/diary.js`'s `document.addEventListener('DOMContentLoaded', () => { ... })`, replace the first line:

```js
  buildDots();
```

with:

```js
  initEntries();
```

- [ ] **Step 5: Remove the now-dead `saveEntries()` calls**

In `js/diary.js`, remove the line `saveEntries();` from inside `setMood`, from inside `handleDiscard`, and from inside `handleFormSubmit` (three separate lines, one per function — leave everything else in those three functions exactly as-is for now).

- [ ] **Step 6: Verify manually in a browser**

1. In Supabase's Table Editor, manually insert one test row into `diary_entries` (any values are fine, e.g. `number: '01'`, `category: 'Chill Beach'`, `entry_date: '2026.07.20'`, `title: 'Test Entry'`, `body: 'Hello from Supabase.'`, `media: {"type":"image","urls":["[Photo placeholder: test]"],"caption":""}`).
2. Start a local server: `python3 -m http.server 8000`, open `http://localhost:8000/study-diary.html`.
3. Open the diary cover.
4. Expected: the test entry you inserted renders — title "Test Entry", body text, and a placeholder photo card (since the URL is a placeholder string).
5. In DevTools console, confirm no errors were logged.

- [ ] **Step 7: Run the full test suite**

Run: `node --test js/*.test.mjs`
Expected: all tests still pass (this task didn't touch any `.mjs` pure-logic module, so the count is unchanged from before this task).

- [ ] **Step 8: Commit**

```bash
git add js/diary.js
git commit -m "Load Study Diary entries from Supabase instead of localStorage"
```

---

## Task 4: Login/logout and auth-gated edit controls

**Files:**
- Modify: `study-diary.html`
- Modify: `css/pages.css`
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `signIn(email, password)`, `signOut()`, `getSession()`, `onAuthStateChange(callback)` from `js/diary-supabase.js` (Task 2).
- Produces: module-level `isLoggedIn` boolean in `js/diary.js`, read by `leftPageHTML`/`rightPageHTML` (this task) and by Tasks 5/6's write-form/discard/mood gating.

- [ ] **Step 1: Add the Log In button and login modal markup**

In `study-diary.html`, replace:

```html
      <div class="diary-toolbar">
        <button type="button" class="diary-write-btn">Write Diary</button>
      </div>
```

with:

```html
      <div class="diary-toolbar">
        <button type="button" class="diary-write-btn" hidden>Write Diary</button>
        <button type="button" class="diary-login-btn">Log In</button>
      </div>
```

Then, right after the existing `.diary-mood-modal-backdrop` block (before `<footer class="site-footer">`), add:

```html
  <div class="diary-login-modal-backdrop" hidden>
    <div class="diary-login-modal">
      <div class="diary-modal__header">
        <h3>Log In</h3>
        <button type="button" class="diary-login-modal__close" aria-label="Close">×</button>
      </div>
      <form class="diary-login-form">
        <label class="diary-form__field">
          <span>Email</span>
          <input type="email" name="email" required />
        </label>
        <label class="diary-form__field">
          <span>Password</span>
          <input type="password" name="password" required />
        </label>
        <p class="diary-form__error" hidden></p>
        <div class="diary-form__actions">
          <button type="button" class="button diary-login-form__cancel">Cancel</button>
          <button type="submit" class="button button--primary">Log In</button>
        </div>
      </form>
    </div>
  </div>
```

- [ ] **Step 2: Add the CSS**

In `css/pages.css`, right after the `.diary-mood-modal__clear` rule, add:

```css
.diary-login-btn {
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.diary-login-btn:hover {
  color: var(--color-klein-blue);
}

.diary-login-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  z-index: 100;
}

.diary-login-modal-backdrop[hidden] {
  display: none;
}

.diary-login-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 340px;
  width: 100%;
  padding: var(--space-4);
}

.diary-login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.diary-form__error {
  color: #b3261e;
  font-size: 0.8rem;
  margin: 0;
}

.diary-form__error[hidden] {
  display: none;
}
```

Also update the `.diary-toolbar` rule (currently `display: flex; justify-content: center; margin-top: var(--space-3);`) so the two buttons sit side by side with a gap — replace it with:

```css
.diary-toolbar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
```

- [ ] **Step 3: Gate the Discard button and Mood/Weather row behind `isLoggedIn`**

In `js/diary.js`, add this module-level variable near the top, right after `let moodModalTarget = null;`:

```js
// Only true once a real Supabase session exists — controls whether the
// Write Diary button, per-entry Discard buttons, and Mood/Weather buttons
// render at all. This is a UX nicety, not the real security boundary —
// that's the database's Row Level Security policies (see Prerequisites).
let isLoggedIn = false;
```

Replace the whole `leftPageHTML` function with:

```js
function leftPageHTML(entry) {
  const index = ENTRIES.indexOf(entry);
  const discardHTML = isLoggedIn
    ? `<button type="button" class="diary-page__discard" data-discard-index="${index}">Discard</button>`
    : '';
  return `
    <div class="diary-page__header">
      <span class="diary-page__label">${entry.number} / ${entry.category.toUpperCase()}</span>
      <span class="diary-page__date">${entry.date}</span>
    </div>
    <h2 class="diary-page__title">${entry.title}</h2>
    ${entry.quote ? `<blockquote class="diary-page__quote">${entry.quote}</blockquote>` : ''}
    <div class="diary-page__ruled">${bodyParagraphsHTML(entry.body)}</div>
    <div class="diary-page__footer">
      <span class="diary-page__tagline">${DIARY_TAGLINE}</span>
      ${discardHTML}
    </div>
  `;
}
```

Replace the whole `rightPageHTML` function with:

```js
function rightPageHTML(entry, active = true) {
  const index = ENTRIES.indexOf(entry);
  const urls = entry.media.urls;
  const isGrid = urls.length > 1;
  const gridStyle = mediaGridStyle(urls.length);
  const itemsHTML = urls.map((url, i) => mediaItemHTML(entry, url, i, urls.length, active)).join('');
  const badgeHTML = isGrid ? '<span class="diary-polaroid__badge">Gallery</span>' : '';
  const captionHTML = entry.media.caption ? `<p class="diary-polaroid__caption">${entry.media.caption}</p>` : '';
  const countLabel = entry.media.type === 'video' ? '1 Video' : `${urls.length} Snapshot${urls.length === 1 ? '' : 's'}`;
  const moodRowHTML = isLoggedIn
    ? `<div class="diary-mood-row">
        <button type="button" class="diary-mood-btn" data-mood-kind="mood" data-mood-index="${index}">${entry.mood || '+ Mood'}</button>
        <button type="button" class="diary-mood-btn" data-mood-kind="weather" data-mood-index="${index}">${entry.weather || '+ Weather'}</button>
      </div>`
    : '';

  return `
    <div class="diary-page__header">
      <span class="diary-page__label">Page Spread ${index + 1} of ${ENTRIES.length}</span>
      <span class="diary-page__count">${countLabel}</span>
    </div>
    <div class="diary-polaroid">
      <span class="diary-polaroid__tape" aria-hidden="true"></span>
      ${badgeHTML}
      <div class="diary-page__media" style="${gridStyle}">${itemsHTML}</div>
      ${captionHTML}
      ${moodRowHTML}
    </div>
    <div class="diary-page__footer diary-page__footer--right">
      <span>${DIARY_BRAND}</span>
      <span>${DIARY_EDITION}</span>
    </div>
  `;
}
```

- [ ] **Step 4: Add login/logout functions**

At the top of `js/diary.js`, replace the `diary-supabase.js` import line added in Task 3:

```js
import { fetchEntries } from './diary-supabase.js';
```

with:

```js
import { fetchEntries, signIn, signOut, getSession, onAuthStateChange } from './diary-supabase.js';
```

(The `diary-validation.mjs` import line added in Task 3 is unchanged — leave it as-is.)

Add these functions right after `closeMoodModal()`:

```js
function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  document.querySelector('.diary-write-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-login-btn').textContent = isLoggedIn ? 'Log Out' : 'Log In';
  renderStatic();
}

function openLoginModal() {
  document.querySelector('.diary-login-form .diary-form__error').hidden = true;
  document.querySelector('.diary-login-modal-backdrop').hidden = false;
}

function closeLoginModal() {
  document.querySelector('.diary-login-modal-backdrop').hidden = true;
  document.querySelector('.diary-login-form').reset();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorEl = document.querySelector('.diary-login-form .diary-form__error');
  errorEl.hidden = true;
  try {
    await signIn(data.get('email').trim(), data.get('password'));
    closeLoginModal();
  } catch (error) {
    errorEl.textContent = 'Incorrect email or password.';
    errorEl.hidden = false;
  }
}

async function handleLoginBtnClick() {
  if (isLoggedIn) {
    await signOut();
  } else {
    openLoginModal();
  }
}
```

`renderStatic()` inside `applyAuthState` re-renders the currently-displayed page so Discard/Mood buttons appear or disappear immediately on login/logout, without needing to flip away and back. `onAuthStateChange` (wired in Step 5) calls `applyAuthState` automatically after both `signIn` and `signOut` resolve, so neither handler above needs to call it directly.

- [ ] **Step 5: Wire the new elements and auth listener**

In `js/diary.js`'s `DOMContentLoaded` handler, add these lines right after the existing `.diary-mood-modal-backdrop` listener block:

```js
  document.querySelector('.diary-login-btn').addEventListener('click', handleLoginBtnClick);
  document.querySelector('.diary-login-modal__close').addEventListener('click', closeLoginModal);
  document.querySelector('.diary-login-form__cancel').addEventListener('click', closeLoginModal);
  document.querySelector('.diary-login-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeLoginModal();
  });
  document.querySelector('.diary-login-form').addEventListener('submit', handleLoginSubmit);

  onAuthStateChange((session) => applyAuthState(session));
  getSession().then((session) => applyAuthState(session));
```

Also update the existing `keydown` handler so Escape closes the login modal too — replace:

```js
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
      closeMoodModal();
    }
    if (!state.isOpen) return;
    if (event.key === 'ArrowRight') playFlip('next');
    if (event.key === 'ArrowLeft') playFlip('prev');
  });
```

with:

```js
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
      closeMoodModal();
      closeLoginModal();
    }
    if (!state.isOpen) return;
    if (event.key === 'ArrowRight') playFlip('next');
    if (event.key === 'ArrowLeft') playFlip('prev');
  });
```

- [ ] **Step 6: Verify manually in a browser**

1. Start a local server, open `study-diary.html`.
2. Expected: "Write Diary" button is not visible; a small "Log In" text link is visible in the toolbar; open the diary book to the test entry from Task 3 — no Discard button, no Mood/Weather buttons.
3. Click "Log In", enter the email/password from Prerequisites Step 4.
4. Expected: modal closes, "Log In" becomes "Log Out", "Write Diary" button appears, and the currently-open page now shows a Discard button and Mood/Weather buttons without needing to navigate away and back.
5. Click "Log Out".
6. Expected: all three controls disappear again immediately.
7. Click "Log In" again, enter a wrong password.
8. Expected: inline error "Incorrect email or password." appears, modal stays open.

- [ ] **Step 7: Commit**

```bash
git add study-diary.html css/pages.css js/diary.js
git commit -m "Add Study Diary login/logout and gate edit controls behind auth"
```

---

## Task 5: Real file upload and Supabase insert in the Write Diary form

**Files:**
- Modify: `study-diary.html`
- Modify: `css/pages.css`
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `insertEntry(row)`, `uploadFile(file, path)` from `js/diary-supabase.js` (Task 2); `isFileSizeAllowed(sizeBytes, mediaType)`, `buildUploadPath(fileName, timestampMs)`, `entryToSupabaseRow(entry)`, `supabaseRowToEntry(row)` from `js/diary-validation.mjs` (Task 1); `isLoggedIn` from Task 4.
- Produces: newly-inserted entries now carry a real `id` (from Supabase) in `ENTRIES`, which Task 6 depends on.

- [ ] **Step 1: Switch the image/video fields to real file inputs**

In `study-diary.html`, replace:

```html
        <div class="diary-form__media-group" data-media-group="image">
          <label class="diary-form__field">
            <span>Image 1 (URL or local path, e.g. assets/images/photo.jpg)</span>
            <input type="text" name="image1" placeholder="Leave blank to use a placeholder" />
          </label>
          <label class="diary-form__field">
            <span>Image 2 (optional)</span>
            <input type="text" name="image2" />
          </label>
          <label class="diary-form__field">
            <span>Image 3 (optional)</span>
            <input type="text" name="image3" />
          </label>
          <label class="diary-form__field">
            <span>Image 4 (optional)</span>
            <input type="text" name="image4" />
          </label>
        </div>

        <div class="diary-form__media-group" data-media-group="video" hidden>
          <label class="diary-form__field">
            <span>Video (URL or local path, e.g. assets/videos/clip.mp4)</span>
            <input type="text" name="video" placeholder="Leave blank to use a placeholder" />
          </label>
        </div>
```

with:

```html
        <div class="diary-form__media-group" data-media-group="image">
          <label class="diary-form__field">
            <span>Image 1 (max 8MB, leave blank to use a placeholder)</span>
            <input type="file" name="image1" accept="image/*" />
          </label>
          <label class="diary-form__field">
            <span>Image 2 (optional)</span>
            <input type="file" name="image2" accept="image/*" />
          </label>
          <label class="diary-form__field">
            <span>Image 3 (optional)</span>
            <input type="file" name="image3" accept="image/*" />
          </label>
          <label class="diary-form__field">
            <span>Image 4 (optional)</span>
            <input type="file" name="image4" accept="image/*" />
          </label>
        </div>

        <div class="diary-form__media-group" data-media-group="video" hidden>
          <label class="diary-form__field">
            <span>Video (max 100MB, leave blank to use a placeholder)</span>
            <input type="file" name="video" accept="video/*" />
          </label>
        </div>
```

- [ ] **Step 2: Add an error message element to the write form**

In `study-diary.html`, replace:

```html
        <div class="diary-form__actions">
          <button type="button" class="button diary-form__cancel">Cancel</button>
          <button type="submit" class="button button--primary">Insert to Abroad Diary</button>
        </div>
```

with:

```html
        <p class="diary-form__error" hidden></p>
        <div class="diary-form__actions">
          <button type="button" class="button diary-form__cancel">Cancel</button>
          <button type="submit" class="button button--primary">Insert to Abroad Diary</button>
        </div>
```

(`.diary-form__error`'s styling already exists from Task 4, Step 2 — no new CSS needed.)

- [ ] **Step 3: Update the imports in `js/diary.js`**

Replace the two import lines added in Tasks 3 and 4:

```js
import { fetchEntries, signIn, signOut, getSession, onAuthStateChange } from './diary-supabase.js';
import { supabaseRowToEntry } from './diary-validation.mjs';
```

with:

```js
import {
  fetchEntries,
  insertEntry,
  uploadFile,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
} from './diary-supabase.js';
import {
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
} from './diary-validation.mjs';
```

- [ ] **Step 4: Replace `handleFormSubmit`**

Replace the whole `handleFormSubmit` function in `js/diary.js` with:

```js
async function uploadMediaFiles(files) {
  const urls = [];
  for (const file of files) {
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    if (!isFileSizeAllowed(file.size, mediaType)) {
      const limit = mediaType === 'video' ? '100MB' : '8MB';
      throw new Error(`${file.name} is too large (max ${limit}).`);
    }
    const path = buildUploadPath(file.name, Date.now());
    const url = await uploadFile(file, path);
    urls.push(url);
  }
  return urls;
}

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

- [ ] **Step 5: Verify manually in a browser**

1. Log in (Task 4's flow).
2. Click "Write Diary", fill in title/date/body, pick a small real image file (under 8MB) for Image 1, leave 2-4 blank, submit.
3. Expected: submit button briefly reads "Uploading…" then the modal closes and the book jumps to the new entry showing your real uploaded photo (not a placeholder).
4. Refresh the page, log in again if needed, open the book.
5. Expected: the entry you just added is still there (now served from Supabase, not localStorage).
6. In the Supabase dashboard, check **Storage → diary-media** — your uploaded file should be listed there.
7. Try submitting again with an image file you know is over 8MB.
8. Expected: an inline error naming the file and the size limit appears in the form; the modal stays open; no partial entry is created (confirm in Table Editor that no new row was added).

- [ ] **Step 6: Commit**

```bash
git add study-diary.html js/diary.js
git commit -m "Upload real files to Supabase Storage from the Write Diary form"
```

---

## Task 6: Migrate Discard and Mood/Weather to Supabase writes, keyed by entry id

**Files:**
- Modify: `js/diary.js`

**Interfaces:**
- Consumes: `deleteEntry(id)`, `updateEntry(id, patch)` from `js/diary-supabase.js` (Task 2); `entry.id` values populated since Task 3 (initial load) and Task 5 (new entries).

Before this task, `data-discard-index`/`data-mood-index` identify an entry by its position in the `ENTRIES` array — fragile once entries can be deleted out of order by a real database. This task switches both to `entry.id` (the database's stable UUID), and makes both actions real Supabase writes with error handling, per the spec's Error Handling table.

- [ ] **Step 1: Update the imports**

Replace the `diary-supabase.js` import (last updated in Task 5) with:

```js
import {
  fetchEntries,
  insertEntry,
  deleteEntry,
  updateEntry,
  uploadFile,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
} from './diary-supabase.js';
```

- [ ] **Step 2: Switch the Discard button and Mood/Weather buttons to `data-entry-id`**

In `js/diary.js`'s `leftPageHTML`, replace:

```js
  const discardHTML = isLoggedIn
    ? `<button type="button" class="diary-page__discard" data-discard-index="${index}">Discard</button>`
    : '';
```

with:

```js
  const discardHTML = isLoggedIn
    ? `<button type="button" class="diary-page__discard" data-entry-id="${entry.id}">Discard</button>`
    : '';
```

In `rightPageHTML`, replace:

```js
  const moodRowHTML = isLoggedIn
    ? `<div class="diary-mood-row">
        <button type="button" class="diary-mood-btn" data-mood-kind="mood" data-mood-index="${index}">${entry.mood || '+ Mood'}</button>
        <button type="button" class="diary-mood-btn" data-mood-kind="weather" data-mood-index="${index}">${entry.weather || '+ Weather'}</button>
      </div>`
    : '';
```

with:

```js
  const moodRowHTML = isLoggedIn
    ? `<div class="diary-mood-row">
        <button type="button" class="diary-mood-btn" data-mood-kind="mood" data-entry-id="${entry.id}">${entry.mood || '+ Mood'}</button>
        <button type="button" class="diary-mood-btn" data-mood-kind="weather" data-entry-id="${entry.id}">${entry.weather || '+ Weather'}</button>
      </div>`
    : '';
```

(`index` is still used elsewhere in both functions — for the "Page Spread N of Total" label and the category header — so it stays declared; only the two data attributes above change.)

- [ ] **Step 3: Replace `openMoodModal`, `setMood`, and `handleDiscard`**

Replace all three functions in `js/diary.js` with:

```js
function openMoodModal(id, kind) {
  moodModalTarget = { id, kind };
  const options = kind === 'mood' ? MOOD_OPTIONS : WEATHER_OPTIONS;
  document.querySelector('.diary-mood-modal__title').textContent = kind === 'mood' ? 'Mood' : 'Weather';
  document.querySelector('.diary-mood-modal__options').innerHTML = options
    .map((option) => `<button type="button" class="diary-mood-modal__option" data-value="${option}">${option}</button>`)
    .join('');
  document.querySelector('.diary-mood-modal-backdrop').hidden = false;
}

async function setMood(value) {
  if (!moodModalTarget) return;
  const { id, kind } = moodModalTarget;
  try {
    await updateEntry(id, { [kind]: value || null });
  } catch (error) {
    window.alert('Could not save that. Please try again.');
    return;
  }
  const entry = ENTRIES.find((e) => e.id === id);
  if (entry) entry[kind] = value;
  closeMoodModal();
  renderStatic();
}

async function handleDiscard(id) {
  if (!window.confirm("Discard this diary page? This can't be undone.")) return;
  try {
    await deleteEntry(id);
  } catch (error) {
    window.alert('Could not discard this entry. Please try again.');
    return;
  }
  const removedIndex = ENTRIES.findIndex((entry) => entry.id === id);
  if (removedIndex === -1) return;
  ENTRIES.splice(removedIndex, 1);
  const nextIndex = Math.max(0, Math.min(state.current, ENTRIES.length - 1));
  state = goToPage(openBook(createDiaryState(ENTRIES.length)), nextIndex);
  buildDots();
  renderStatic();
  updateChrome();
}
```

(`closeMoodModal` itself is unchanged — leave it exactly as it is.)

- [ ] **Step 4: Update the delegated click handler**

In `js/diary.js`'s `DOMContentLoaded` handler, replace:

```js
  document.querySelector('.diary-stage').addEventListener('click', (event) => {
    const discardBtn = event.target.closest('.diary-page__discard');
    if (discardBtn) {
      handleDiscard(Number(discardBtn.dataset.discardIndex));
      return;
    }
    const moodBtn = event.target.closest('.diary-mood-btn');
    if (moodBtn) {
      openMoodModal(Number(moodBtn.dataset.moodIndex), moodBtn.dataset.moodKind);
      return;
    }
    const photo = event.target.closest('.diary-page__photo');
    if (photo) openLightbox(photo.src, photo.alt);
  });
```

with:

```js
  document.querySelector('.diary-stage').addEventListener('click', (event) => {
    const discardBtn = event.target.closest('.diary-page__discard');
    if (discardBtn) {
      handleDiscard(discardBtn.dataset.entryId);
      return;
    }
    const moodBtn = event.target.closest('.diary-mood-btn');
    if (moodBtn) {
      openMoodModal(moodBtn.dataset.entryId, moodBtn.dataset.moodKind);
      return;
    }
    const photo = event.target.closest('.diary-page__photo');
    if (photo) openLightbox(photo.src, photo.alt);
  });
```

- [ ] **Step 5: Verify manually in a browser**

1. Log in, open the book to an entry with real content.
2. Click "+ Mood", pick an option.
3. Expected: the button now shows the picked emoji+label; refresh the page — it's still there (confirms it was written to Supabase, not just local state). Check the row in Supabase's Table Editor — the `mood` column has the value.
4. Repeat for "+ Weather".
5. Click "Clear" on one of them via the mood modal.
6. Expected: button reverts to "+ Mood"/"+ Weather"; refreshing confirms the database column is now `null`.
7. Click "Discard" on an entry, confirm the dialog.
8. Expected: entry disappears, book moves to a neighboring page; refresh — it's still gone. Confirm in Table Editor that the row no longer exists.
9. Log out, open the book — confirm no Discard/Mood/Weather buttons are visible anywhere (this also re-confirms Task 4's gating still works after this task's changes).

- [ ] **Step 6: Run the full test suite one more time**

Run: `node --test js/*.test.mjs`
Expected: all tests pass, including the 11 from Task 1 — nothing in this task touched a `.mjs` module, so the count is unchanged.

- [ ] **Step 7: Commit**

```bash
git add js/diary.js
git commit -m "Migrate Study Diary Discard and Mood/Weather to Supabase, keyed by entry id"
```

---

## Not covered by this plan (deferred, per the spec's "范围之外" section)

- Multi-user/multi-account support, sign-up flow, password reset.
- Real-time sync across open tabs/devices (this plan fetches once on page load).
- Supabase CLI local emulator / automated integration tests for the live Supabase calls.
- Mirroring these changes into `scratchpad/preview.html` — the live-preview Artifact has no network access to a real Supabase project and no way to authenticate, so Study Diary's preview tab will need a callout (or to keep showing the old localStorage-backed mock behavior) rather than actually integrating Supabase. Decide this with the user before touching the preview file once this plan is implemented.
