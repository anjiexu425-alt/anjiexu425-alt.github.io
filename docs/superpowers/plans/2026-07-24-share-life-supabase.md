# Share Life Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing Share Life page from the supplied reference HTML, backed by Supabase notes, owner-only management, and public browser-scoped like/unlike behavior.

**Architecture:** Keep pure note validation, mapping, statistics, media resolution, and local-like state in a testable model module. Isolate Supabase table/RPC/Storage calls in a dedicated adapter that reuses the Diary client and auth session. Drive the semantic page with a small vanilla-JavaScript controller and verify the complete UI against an in-memory fixture before requiring the SQL schema to be applied.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node.js built-in test runner, Supabase JS v2 CDN client, PostgreSQL/RLS/RPC, Supabase Storage.

## Global Constraints

- Adapt the design and static copy from `/Users/estrella/.zcode/workspace/default/share-life.html`.
- Use the site's existing navigation, footer, typography, Klein blue accent, and responsive conventions.
- Keep Followers fixed at `90`; Likes is the live sum of note like counts.
- Notes open validated Douyin `http/https` URLs in a new tab with `noopener`.
- Signed-out visitors may read and like; only authenticated owners may add, edit, or delete.
- Each browser toggles one local liked state per note under `shareLifeLikedNoteIds`; Supabase stores the authoritative count.
- A create without a cover uses `assets/images/share-life-placeholder.svg`.
- Cover uploads are images no larger than 8 MB and use bucket `share-life-media`.
- Do not interpolate note-controlled values into `innerHTML`.
- The production table is `public.share_life_notes`; the public atomic RPC is `adjust_share_life_like(note_id uuid, delta integer)`.
- No framework, bundler, npm dependency, visitor accounts, or fraud-proof like identity is introduced.
- Live persistence is not declared ready until `supabase/share-life.sql` has been applied.

---

### Task 1: Pure Share Life model

**Files:**
- Create: `js/share-life-model.mjs`
- Create: `js/share-life-model.test.mjs`

**Interfaces:**
- Consumes: Supabase-shaped rows and raw form/localStorage values.
- Produces: `MAX_SHARE_LIFE_IMAGE_BYTES`, `normalizeTitle`, `normalizeDouyinUrl`, `validateNoteFields`, `isShareLifeImageAllowed`, `buildShareLifeUploadPath`, `supabaseRowToShareLifeNote`, `shareLifeNoteToInsertRow`, `buildShareLifeEditPatch`, `resolveEditedCover`, `sumLikeCounts`, `parseLikedNoteIds`, and `toggleLikedNoteId`.

- [ ] **Step 1: Write failing model tests**

Create tests covering these exact expectations:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from './share-life-model.mjs';

test('normalizes a valid title and http/https Douyin URL', () => {
  assert.equal(model.normalizeTitle('  Iceland light  '), 'Iceland light');
  assert.equal(
    model.normalizeDouyinUrl(' https://www.douyin.com/video/123 '),
    'https://www.douyin.com/video/123',
  );
  assert.equal(model.normalizeDouyinUrl('javascript:alert(1)'), '');
  assert.equal(model.normalizeDouyinUrl('file:///tmp/a'), '');
});

test('validates required title, length, URL, and 8 MB image size', () => {
  assert.equal(model.MAX_SHARE_LIFE_IMAGE_BYTES, 8 * 1024 * 1024);
  assert.equal(model.validateNoteFields({ title: ' ', douyinUrl: 'https://douyin.com' }).title, 'Please enter a title.');
  assert.equal(model.validateNoteFields({ title: 'x'.repeat(161), douyinUrl: 'https://douyin.com' }).title, 'Title must be 160 characters or fewer.');
  assert.equal(model.validateNoteFields({ title: 'Title', douyinUrl: 'javascript:alert(1)' }).douyinUrl, 'Please enter a valid http or https link.');
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024, 'image/jpeg'), true);
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024 + 1, 'image/jpeg'), false);
  assert.equal(model.isShareLifeImageAllowed(100, 'video/mp4'), false);
});

test('maps rows and preserves existing cover during an edit without upload', () => {
  const row = {
    id: 'n1',
    title: 'Title',
    douyin_url: 'https://www.douyin.com/video/1',
    cover_url: '/cover.jpg',
    cover_path: 'covers/cover.jpg',
    likes_count: 4,
    created_at: '2026-07-24T00:00:00Z',
    updated_at: '2026-07-24T00:00:00Z',
  };
  assert.deepEqual(model.supabaseRowToShareLifeNote(row), {
    id: 'n1',
    title: 'Title',
    douyinUrl: 'https://www.douyin.com/video/1',
    coverUrl: '/cover.jpg',
    coverPath: 'covers/cover.jpg',
    likesCount: 4,
    createdAt: '2026-07-24T00:00:00Z',
    updatedAt: '2026-07-24T00:00:00Z',
  });
  assert.deepEqual(
    model.resolveEditedCover(null, row.cover_url, row.cover_path),
    { coverUrl: '/cover.jpg', coverPath: 'covers/cover.jpg' },
  );
});

test('sums safe like counts and toggles deduplicated local liked ids', () => {
  assert.equal(model.sumLikeCounts([{ likesCount: 3 }, { likesCount: 7 }, { likesCount: -2 }]), 10);
  assert.deepEqual([...model.parseLikedNoteIds('["a","a","b",4]')], ['a', 'b']);
  assert.deepEqual([...model.parseLikedNoteIds('bad json')], []);
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'a'), new Set());
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'b'), new Set(['a', 'b']));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-model.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure module**

Implement the named exports with these rules:

```js
export const MAX_SHARE_LIFE_IMAGE_BYTES = 8 * 1024 * 1024;

export function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeDouyinUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function sumLikeCounts(notes) {
  return notes.reduce((sum, note) => (
    sum + Math.max(0, Number.isFinite(Number(note.likesCount)) ? Number(note.likesCount) : 0)
  ), 0);
}
```

`validateNoteFields` returns:

```js
{
  values: { title, douyinUrl },
  title: '',
  douyinUrl: '',
  isValid: true,
}
```

and fills the exact messages from Step 1 when invalid. `parseLikedNoteIds`
accepts only string IDs from a JSON array and returns a `Set`. Upload paths use
`share-life/${timestampMs}-${cryptoPart}-${fileNameWithWhitespaceAsHyphens}`.
Mapping functions convert camelCase page objects to the SQL column names
exactly.

- [ ] **Step 4: Run focused and complete tests**

Run:

```bash
node --test js/share-life-model.test.mjs
node --test --test-reporter=dot js/*.test.mjs
git diff --check
```

Expected: focused model tests and all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/share-life-model.mjs js/share-life-model.test.mjs
git commit -m "Add Share Life data model"
```

### Task 2: Idempotent Supabase schema and contract tests

**Files:**
- Create: `supabase/share-life.sql`
- Create: `js/share-life-contract.test.mjs`

**Interfaces:**
- Consumes: existing Supabase project roles and Storage schema.
- Produces: `public.share_life_notes`, `public.adjust_share_life_like(uuid, integer)`, and public bucket `share-life-media`.

- [ ] **Step 1: Write a failing SQL contract test**

Read the SQL file with `node:fs` and assert it contains:

```js
assert.match(sql, /create table if not exists public\.share_life_notes/i);
assert.match(sql, /likes_count bigint not null default 0/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /create or replace function public\.adjust_share_life_like/i);
assert.match(sql, /delta not in \(-1,\s*1\)/i);
assert.match(sql, /greatest\(0,\s*likes_count \+ delta\)/i);
assert.match(sql, /grant execute .* to anon,\s*authenticated/i);
assert.match(sql, /share-life-media/i);
assert.doesNotMatch(sql, /for update\s+to anon/i);
```

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-contract.test.mjs`

Expected: FAIL because `supabase/share-life.sql` is missing.

- [ ] **Step 3: Create the idempotent SQL**

The SQL must:

1. create the table from the approved design with `if not exists`;
2. enable RLS;
3. drop/recreate named policies so re-running is safe;
4. create public select and authenticated insert/update/delete policies;
5. create the `security definer set search_path = public` RPC;
6. reject a delta outside `-1, 1`;
7. atomically update and return `likes_count`;
8. revoke public function execution, then grant to `anon, authenticated`;
9. insert the public bucket with `on conflict (id) do update set public = true`;
10. add public select and authenticated insert/update/delete Storage policies
    restricted to `bucket_id = 'share-life-media'`.

The RPC body uses:

```sql
if delta not in (-1, 1) then
  raise exception 'delta must be -1 or 1';
end if;

update public.share_life_notes
set likes_count = greatest(0, likes_count + delta),
    updated_at = now()
where id = note_id
returning likes_count into new_count;
```

- [ ] **Step 4: Run contract and full tests**

Run:

```bash
node --test js/share-life-contract.test.mjs
node --test --test-reporter=dot js/*.test.mjs
git diff --check
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/share-life.sql js/share-life-contract.test.mjs
git commit -m "Add Share Life Supabase schema"
```

### Task 3: Semantic page, reference styling, and placeholder

**Files:**
- Create: `share-life.html`
- Create: `css/share-life.css`
- Create: `assets/images/share-life-placeholder.svg`
- Extend: `js/share-life-contract.test.mjs`

**Interfaces:**
- Consumes: `css/base.css`, `css/nav.css`, `js/nav.js`, and the reference page.
- Produces: semantic containers and stable selectors consumed by Task 5.

- [ ] **Step 1: Add failing HTML/CSS contract tests**

Assert the page:

- has `aria-current="page"` on Share Life;
- links `css/base.css`, `css/nav.css`, `css/share-life.css`;
- loads `js/nav.js` and module `js/share-life.js`;
- contains `#shareLifeTrack`, `#shareLifeStatus`, `#shareLifeAddButton`,
  `#shareLifePrev`, `#shareLifeNext`;
- contains labelled note and login dialogs with `role="dialog"` and
  `aria-modal="true"`;
- has explicit labels for title, Douyin URL, cover, email, and password;
- contains no inline `<style>`, inline `<script>`, or `onclick=`;
- contains the approved static copy.

Assert CSS contains mobile and reduced-motion media queries, native horizontal
overflow, hidden scrollbars, and focus-visible styles.

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-contract.test.mjs`

Expected: FAIL because the page and stylesheet do not exist.

- [ ] **Step 3: Build the semantic page**

Adapt the reference markup into the existing site shell. Keep management
elements present but hidden until auth state is known. Use:

```html
<main class="share-life-page container">
  <section class="share-life-hero">...</section>
  <section class="share-life-actions">...</section>
  <section class="share-life-slider" aria-label="Life notes">
    <button id="shareLifePrev" type="button" aria-label="Previous notes">...</button>
    <div class="share-life-slider__viewport">
      <div id="shareLifeTrack" class="share-life-slider__track"></div>
    </div>
    <button id="shareLifeNext" type="button" aria-label="Next notes">...</button>
  </section>
  <p id="shareLifeStatus" role="status" aria-live="polite"></p>
</main>
```

The note dialog has one form reused by create/edit. The login dialog follows
Study Diary's email/password structure.

- [ ] **Step 4: Adapt the visual design**

Move reference styles under a `share-life-` namespace. Reuse existing CSS
tokens where available. Cards remain `280px` wide on desktop and `240px` on
mobile with a `3 / 4` cover. Add:

```css
@media (prefers-reduced-motion: reduce) {
  .share-life-card,
  .share-life-card__image,
  .share-life-modal {
    transition: none;
  }
}
```

Do not use `backdrop-filter`; use a flat modal scrim consistent with Study
Diary's Safari-safe modal treatment.

- [ ] **Step 5: Create the bundled SVG placeholder**

Create an original warm-paper/Klein-blue abstract cover at a `3:4` viewBox,
with no text dependency and an accessible fallback provided by the consuming
`img` alt text.

- [ ] **Step 6: Run contract and full tests**

Run:

```bash
node --test js/share-life-contract.test.mjs
node --test --test-reporter=dot js/*.test.mjs
git diff --check
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add share-life.html css/share-life.css assets/images/share-life-placeholder.svg js/share-life-contract.test.mjs
git commit -m "Build Share Life page shell"
```

### Task 4: Supabase adapter

**Files:**
- Create: `js/share-life-supabase.js`
- Extend: `js/share-life-contract.test.mjs`

**Interfaces:**
- Consumes: `supabase` and auth functions exported by `js/diary-supabase.js`.
- Produces: `fetchShareLifeNotes`, `insertShareLifeNote`, `updateShareLifeNote`, `deleteShareLifeNote`, `adjustShareLifeLike`, `uploadShareLifeCover`, and `removeShareLifeCover`.

- [ ] **Step 1: Add a failing static adapter contract**

Assert the module:

- imports the shared `supabase`;
- targets `share_life_notes`;
- orders by `created_at` ascending;
- calls RPC `adjust_share_life_like`;
- targets bucket `share-life-media`;
- exports every interface listed above;
- never contains the Supabase URL or anon key.

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-contract.test.mjs`

Expected: FAIL because `js/share-life-supabase.js` is missing.

- [ ] **Step 3: Implement the adapter**

Use the same error pattern as `diary-supabase.js`:

```js
import { supabase } from './diary-supabase.js';

const TABLE = 'share_life_notes';
const BUCKET = 'share-life-media';

export async function adjustShareLifeLike(noteId, delta) {
  const { data, error } = await supabase.rpc('adjust_share_life_like', {
    note_id: noteId,
    delta,
  });
  if (error) throw error;
  return Number(data);
}
```

Storage upload returns both `{ coverUrl, coverPath }`. Removal accepts a path
and no-ops when it is falsy. Fetch/insert/update return rows; delete and remove
return after throwing any error.

- [ ] **Step 4: Run syntax and contract tests**

Run:

```bash
node --check js/share-life-supabase.js
node --test js/share-life-contract.test.mjs
node --test --test-reporter=dot js/*.test.mjs
git diff --check
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add js/share-life-supabase.js js/share-life-contract.test.mjs
git commit -m "Add Share Life Supabase adapter"
```

### Task 5: Rendering, auth, CRUD, likes, and slider interactions

**Files:**
- Create: `js/share-life.js`
- Extend: `js/share-life-model.mjs`
- Extend: `js/share-life-model.test.mjs`
- Extend: `js/share-life-contract.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4 and shared `signIn`, `signOut`, `getSession`, `onAuthStateChange`.
- Produces: complete Share Life production behavior.

- [ ] **Step 1: Add failing pure rendering-boundary and interaction-state tests**

Add small pure helpers rather than testing DOM with mocks:

```js
test('card view models preserve text as data and never return HTML', () => {
  const view = model.buildShareLifeCardView({
    id: 'n1',
    title: '<img src=x onerror=alert(1)>',
    douyinUrl: 'https://douyin.com/video/1',
    coverUrl: '/cover.jpg',
    likesCount: 2,
  }, new Set(['n1']), true);
  assert.equal(view.titleText, '<img src=x onerror=alert(1)>');
  assert.equal(view.isLiked, true);
  assert.equal(view.canManage, true);
  assert.equal('html' in view, false);
});
```

Also test:

- `buildShareLifeCardView` clamps negative like counts to `0`;
- `buildShareLifeCardView` selects the bundled placeholder for an empty cover;
- `nextLikeIntent(note, likedSet)` returns `{ delta: 1, nextLiked: true }`
  or `{ delta: -1, nextLiked: false }`;
- `resolveScrollBehavior(true)` returns `'auto'` and false returns `'smooth'`.

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-model.test.mjs`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Keep all note fields as values. Do not return HTML strings. Use the exact
placeholder path `/assets/images/share-life-placeholder.svg`.

- [ ] **Step 4: Implement safe DOM rendering**

`share-life.js` creates every card with `document.createElement`. Assign:

```js
titleEl.textContent = view.titleText;
link.href = view.douyinUrl;
link.target = '_blank';
link.rel = 'noopener';
image.src = view.coverUrl;
image.alt = view.titleText;
likeButton.type = 'button';
likeButton.setAttribute('aria-pressed', String(view.isLiked));
```

Edit/Delete are sibling buttons outside the card link. Their click handlers
stop propagation. Rendering loading, empty, error, and retry states also uses
DOM creation/textContent, not note-derived `innerHTML`.

- [ ] **Step 5: Wire auth and modal accessibility**

On startup:

1. render loading;
2. fetch notes and map rows;
3. read the shared Supabase session;
4. parse `shareLifeLikedNoteIds`;
5. subscribe to auth changes;
6. render notes/chrome/stats.

Owner buttons follow `isLoggedIn`. Dialog open stores the opener, sets
`hidden = false`, and focuses the first field. Escape/Cancel/backdrop close;
close returns focus. Failed submissions do not call `form.reset()`.

- [ ] **Step 6: Wire create/edit media transactions**

Use `validateNoteFields` and the image-size helper before any network call.
Follow the design's cleanup ordering exactly:

- create upload → insert; failed insert removes the new cover best effort;
- edit optional upload → update; successful update removes the old cover;
  failed update removes the new cover best effort;
- edit without upload retains old cover;
- delete row → remove cover best effort → remove local card.

Display errors in the existing alert element and restore enabled button labels
in `finally`.

- [ ] **Step 7: Wire atomic likes and totals**

Lock only the selected like button. Compute intent from the current liked set,
call the RPC, then update the note count and local set only on success:

```js
localStorage.setItem('shareLifeLikedNoteIds', JSON.stringify([...likedNoteIds]));
```

On error, keep the previous UI and announce the error. Re-render Followers as
`90` and Likes via `sumLikeCounts(notes)`.

- [ ] **Step 8: Wire slider interactions**

Previous/next move two measured card widths plus gaps. Translate vertical
wheel movement only when vertical delta dominates. Drag starts only with the
primary mouse button and does not hijack links/buttons. Respect reduced motion
through `matchMedia('(prefers-reduced-motion: reduce)')`.

- [ ] **Step 9: Run syntax, focused, and full tests**

Run:

```bash
node --check js/share-life.js
node --check js/share-life-supabase.js
node --check js/share-life-model.mjs
node --test js/share-life-model.test.mjs js/share-life-contract.test.mjs
node --test js/*.test.mjs
git diff --check
```

Expected: all checks and tests pass.

- [ ] **Step 10: Commit**

```bash
git add js/share-life.js js/share-life-model.mjs js/share-life-model.test.mjs js/share-life-contract.test.mjs
git commit -m "Implement Share Life interactions"
```

### Task 6: Deterministic browser fixture and live readiness handoff

**Files:**
- Create: `share-life-fixture.html`
- Create: `js/share-life-fixture.js`
- Extend: `js/share-life-contract.test.mjs`
- Update: `docs/superpowers/specs/2026-07-24-share-life-supabase-design.md`

**Interfaces:**
- Consumes: production CSS, model helpers, and the same semantic UI states.
- Produces: a local in-memory acceptance surface and explicit Supabase setup handoff.

- [ ] **Step 1: Add a failing fixture contract**

Assert the fixture:

- links production `css/share-life.css`;
- loads `js/share-life-fixture.js`;
- identifies itself visibly as `Local acceptance fixture`;
- does not import the Supabase CDN or write to the production table;
- starts with at least three safe in-memory notes, including a malicious-looking
  title string that must render as text.

- [ ] **Step 2: Run RED**

Run: `node --test js/share-life-contract.test.mjs`

Expected: FAIL because the fixture is missing.

- [ ] **Step 3: Implement the in-memory acceptance fixture**

Reuse the production semantic structure and model helpers, but implement
create/edit/delete/like against an array. Provide a visible signed-in toggle
for testing owner controls without credentials. Keep fixture data within the
fixture and never use production localStorage key `shareLifeLikedNoteIds`.

- [ ] **Step 4: Run complete automated verification**

Run:

```bash
for file in js/*.js js/*.mjs; do node --check "$file" || exit 1; done
node --test js/*.test.mjs
git diff --check
```

Expected: every syntax check and test passes with zero failures.

- [ ] **Step 5: Run browser acceptance on the fixture**

Verify:

1. reference design at desktop and mobile widths;
2. horizontal arrows, wheel, and drag;
3. safe title rendering;
4. like/unlike and total Likes;
5. owner visibility toggle;
6. Add/Edit/Delete with cover preview;
7. keyboard focus, Escape, Cancel, and reduced-motion behavior.

- [ ] **Step 6: Check production readiness without mutating Supabase**

Open `share-life.html`. If the SQL is not yet applied, confirm it shows the
designed fetch-error/Retry state. Do not claim live persistence is operational.
Provide `supabase/share-life.sql` to the user for SQL Editor execution.

After the user confirms SQL application, run the live acceptance:

1. public fetch/empty state;
2. owner login and management visibility;
3. create a temporary note with cover;
4. edit title/link without replacing cover;
5. signed-out like/unlike and reload;
6. delete the temporary note and confirm its Storage object is removed.

- [ ] **Step 7: Record the acceptance boundary**

Update the design document's final paragraph only if the live SQL has actually
been applied and tested. Otherwise retain the explicit external prerequisite.

- [ ] **Step 8: Commit fixture and documentation**

```bash
git add share-life-fixture.html js/share-life-fixture.js js/share-life-contract.test.mjs docs/superpowers/specs/2026-07-24-share-life-supabase-design.md
git commit -m "Add Share Life acceptance fixture"
```

