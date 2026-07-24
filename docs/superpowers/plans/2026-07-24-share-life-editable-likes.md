# Share Life Editable Likes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner set a non-negative integer like count when creating or editing a Share Life note while preserving public atomic like/unlike behavior.

**Architecture:** Keep validation and Supabase row mapping in `js/share-life-model.mjs`, keep modal state and I/O orchestration in `js/share-life.js`, and expose one native number input in `share-life.html`. The existing `likes_count` column, RLS update policy, and public `adjust_share_life_like` RPC remain unchanged.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules, Supabase JS v2, Node.js built-in test runner.

## Global Constraints

- New-note likes default to `0`.
- Edit mode fills the current persisted count.
- Only finite non-negative integers are accepted; blank, negative, fractional, infinite, and non-numeric values are rejected.
- Owner saves explicitly overwrite `likes_count`.
- Public heart clicks continue using the existing atomic RPC.
- Failed saves keep the modal open and preserve all inputs.
- No Supabase schema migration is required.

---

### Task 1: Like-count validation and row mapping

**Files:**
- Modify: `js/share-life-model.mjs`
- Test: `js/share-life-model.test.mjs`

**Interfaces:**
- Produces: `normalizeEditableLikeCount(value): number | null`
- Extends: `validateNoteFields({ title, douyinUrl, likesCount })`
- Extends: `shareLifeNoteToInsertRow(note)` and `buildShareLifeEditPatch(note)` to return `likes_count`

- [ ] **Step 1: Write failing model tests**

Add focused tests that assert:

```js
assert.equal(model.normalizeEditableLikeCount('0'), 0);
assert.equal(model.normalizeEditableLikeCount('42'), 42);
assert.equal(model.normalizeEditableLikeCount(''), null);
assert.equal(model.normalizeEditableLikeCount('-1'), null);
assert.equal(model.normalizeEditableLikeCount('1.5'), null);
assert.equal(model.normalizeEditableLikeCount('not-a-number'), null);

const invalid = model.validateNoteFields({
  title: 'A note',
  douyinUrl: 'https://www.douyin.com/user/example',
  likesCount: '-1',
});
assert.equal(invalid.isValid, false);
assert.equal(invalid.likesCount, 'Likes must be a whole number of 0 or more.');

assert.equal(model.shareLifeNoteToInsertRow({
  title: 'A note',
  douyinUrl: 'https://www.douyin.com/user/example',
  coverUrl: '/cover.jpg',
  coverPath: null,
  likesCount: 12,
}).likes_count, 12);

assert.equal(model.buildShareLifeEditPatch({
  title: 'A note',
  douyinUrl: 'https://www.douyin.com/user/example',
  coverUrl: '/cover.jpg',
  coverPath: null,
  likesCount: 7,
}).likes_count, 7);
```

Update the three existing `validateNoteFields` test inputs to include
`likesCount: '0'` so each assertion continues to isolate title or URL behavior.

- [ ] **Step 2: Run the model test and verify RED**

Run:

```bash
node --test js/share-life-model.test.mjs
```

Expected: FAIL because `normalizeEditableLikeCount` and the `likesCount` validation result do not exist.

- [ ] **Step 3: Implement minimal pure-model behavior**

Add:

```js
export function normalizeEditableLikeCount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const count = Number(value);
  return Number.isFinite(count) && Number.isInteger(count) && count >= 0
    ? count
    : null;
}
```

Extend `validateNoteFields` with a normalized `likesCount`, a `likesCount` error string, and include it in `isValid`. Add `likes_count: note.likesCount` to `shareLifeNoteToInsertRow`; `buildShareLifeEditPatch` continues delegating to that mapper.

- [ ] **Step 4: Run the model test and verify GREEN**

Run:

```bash
node --test js/share-life-model.test.mjs
```

Expected: all Share Life model tests pass.

- [ ] **Step 5: Commit the model slice**

```bash
git add js/share-life-model.mjs js/share-life-model.test.mjs
git commit -m "feat: validate editable Share Life likes"
```

### Task 2: Modal field and create/edit data flow

**Files:**
- Modify: `share-life.html`
- Modify: `js/share-life.js`
- Test: `js/share-life-contract.test.mjs`

**Interfaces:**
- Consumes: `normalizeEditableLikeCount(value)` and extended `validateNoteFields`
- Uses DOM element: `#shareLifeLikesCount`

- [ ] **Step 1: Write failing UI contract tests**

Add assertions that the production form contains:

```html
<label for="shareLifeLikesCount">点赞数</label>
<input id="shareLifeLikesCount" name="likesCount" type="number" min="0" step="1" required />
```

Add source-contract assertions that `js/share-life.js`:

- sets `likesCountInput.value = '0'` in create/reset mode;
- sets `likesCountInput.value = String(currentNote.likesCount)` in edit mode;
- passes `likesCountInput.value` to `validateNoteFields`;
- passes `validation.values.likesCount` to both create and edit persistence paths.

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
node --test js/share-life-contract.test.mjs
```

Expected: FAIL because the number input and modal data flow do not exist.

- [ ] **Step 3: Add the semantic number field**

Insert below the cover field:

```html
<div class="share-life-form__field">
  <label for="shareLifeLikesCount">点赞数</label>
  <input
    id="shareLifeLikesCount"
    name="likesCount"
    type="number"
    min="0"
    step="1"
    inputmode="numeric"
    value="0"
    required
  />
</div>
```

- [ ] **Step 4: Wire modal defaults, edit fill, validation, and persistence**

In `js/share-life.js`:

```js
const likesCountInput = document.getElementById('shareLifeLikesCount');
```

Set it to `'0'` whenever the create form is reset, and to `String(Math.max(0, Number(currentNote.likesCount) || 0))` when editing.

Extend validation:

```js
const validation = validateNoteFields({
  title: titleInput.value,
  douyinUrl: douyinUrlInput.value,
  likesCount: likesCountInput.value,
});
```

Display `validation.likesCount` alongside existing field errors. Pass `validation.values.likesCount` into `createNote` and `editNote`, and include it in the objects sent to `shareLifeNoteToInsertRow` and `buildShareLifeEditPatch`.

Remove the existing edit merge that intentionally discards `likesCount`; merge the returned persisted note so the card and total-likes statistic update immediately.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --test js/share-life-model.test.mjs js/share-life-contract.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit the UI/data-flow slice**

```bash
git add share-life.html js/share-life.js js/share-life-contract.test.mjs
git commit -m "feat: edit Share Life like counts"
```

### Task 3: Full regression and browser acceptance

**Files:**
- Verify: `share-life.html`
- Verify: `js/share-life.js`
- Verify: `js/share-life-model.mjs`
- Verify: `js/share-life-model.test.mjs`
- Verify: `js/share-life-contract.test.mjs`

**Interfaces:**
- Verifies: owner form → Supabase `likes_count` → card/summary render
- Preserves: public `adjust_share_life_like` RPC behavior

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
node --test js/*.test.mjs
git diff --check
```

Expected: all tests pass, zero failures, and no whitespace errors.

- [ ] **Step 2: Verify create mode locally**

Open the production page, log in as the owner, click “添加笔记,” and confirm:

- the field is labelled “点赞数”;
- it defaults to `0`;
- negative, fractional, and blank values show the form error and keep the modal open;
- a positive integer can be submitted.

- [ ] **Step 3: Verify Supabase persistence**

Create a note with a positive initial count. Confirm the card and total Likes statistic update immediately, then hard-refresh and confirm the same count remains.

- [ ] **Step 4: Verify edit and public-like compatibility**

Edit the created note, change the count, save, and hard-refresh. Then click its heart once and confirm the count changes by exactly one through the existing RPC.

- [ ] **Step 5: Commit any acceptance-only corrections**

If browser acceptance required no correction, do not create an empty commit. Otherwise:

```bash
git add share-life.html js/share-life.js js/share-life-model.mjs js/share-life-model.test.mjs js/share-life-contract.test.mjs
git commit -m "fix: complete editable likes acceptance"
```
