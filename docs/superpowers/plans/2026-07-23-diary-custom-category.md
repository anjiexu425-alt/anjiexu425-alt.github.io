# Study Diary Custom Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Write Diary and Edit Diary accept a new category while continuing to suggest built-in and previously saved categories.

**Architecture:** Add a focused category utility module that owns normalization and case-insensitive suggestion merging. Replace the fixed select with a native input/datalist combobox, then let `diary.js` rebuild the datalist from built-ins plus the current entries and send the normalized value through the existing insert/update paths.

**Tech Stack:** HTML5 input/datalist, browser JavaScript ES modules, Node.js built-in test runner, existing CSS and Supabase persistence.

## Global Constraints

- Write Diary and Edit Diary must use the same category behavior.
- The category field is required and values are trimmed before persistence.
- Built-in categories remain available.
- Entry-derived custom categories are deduplicated case-insensitively.
- The built-in spelling wins over an entry spelling that differs only by case.
- Do not add a category database table, browser storage, or a new dependency.
- Old diary entries require no migration.

---

### Task 1: Category normalization and suggestion merging

**Files:**
- Create: `js/diary-category.mjs`
- Create: `js/diary-category.test.mjs`

**Interfaces:**
- Consumes: diary entry objects shaped as `{ category: unknown }`.
- Produces: `BUILT_IN_CATEGORIES: readonly string[]`, `normalizeCategory(value: unknown): string`, and `mergeCategoryOptions(entries: Array<{category?: unknown}>): string[]`.

- [ ] **Step 1: Write the failing category utility tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_CATEGORIES,
  normalizeCategory,
  mergeCategoryOptions,
} from './diary-category.mjs';

test('normalizeCategory trims a category value', () => {
  assert.equal(normalizeCategory('  Film Notes  '), 'Film Notes');
});

test('normalizeCategory converts non-string and whitespace-only values to empty', () => {
  assert.equal(normalizeCategory('   '), '');
  assert.equal(normalizeCategory(null), '');
  assert.equal(normalizeCategory(42), '');
});

test('mergeCategoryOptions keeps built-ins first and appends custom entry categories', () => {
  const result = mergeCategoryOptions([
    { category: 'Film Notes' },
    { category: 'Weekend Cooking' },
  ]);
  assert.deepEqual(result.slice(0, BUILT_IN_CATEGORIES.length), BUILT_IN_CATEGORIES);
  assert.deepEqual(result.slice(-2), ['Film Notes', 'Weekend Cooking']);
});

test('mergeCategoryOptions ignores empty categories and deduplicates without case sensitivity', () => {
  const result = mergeCategoryOptions([
    { category: ' study ' },
    { category: 'Film Notes' },
    { category: 'film notes' },
    { category: '   ' },
  ]);
  assert.equal(result.filter((category) => category.toLowerCase() === 'study').length, 1);
  assert.equal(result.find((category) => category.toLowerCase() === 'study'), 'Study');
  assert.equal(result.filter((category) => category.toLowerCase() === 'film notes').length, 1);
  assert.equal(result.find((category) => category.toLowerCase() === 'film notes'), 'Film Notes');
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test js/diary-category.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `js/diary-category.mjs`.

- [ ] **Step 3: Implement the minimal category utility**

```js
export const BUILT_IN_CATEGORIES = Object.freeze([
  'Study',
  'Abroad / Travel',
  'Chill Beach',
  'Cozy Coffee Shop',
  'Quiet Nature',
  'City Sunset',
  'Rainy Reflection',
  'Midnight Wanderer',
]);

export function normalizeCategory(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function mergeCategoryOptions(entries = []) {
  const categories = [];
  const seen = new Set();

  for (const value of [
    ...BUILT_IN_CATEGORIES,
    ...entries.map((entry) => entry?.category),
  ]) {
    const category = normalizeCategory(value);
    const key = category.toLocaleLowerCase();
    if (!category || seen.has(key)) continue;
    seen.add(key);
    categories.push(category);
  }

  return categories;
}
```

- [ ] **Step 4: Run the focused and full tests**

Run: `node --test js/diary-category.test.mjs`

Expected: 4 tests pass.

Run: `node --test --test-reporter=dot js/*.test.mjs`

Expected: all existing tests plus the 4 new tests pass.

- [ ] **Step 5: Commit the tested utility**

```bash
git add js/diary-category.mjs js/diary-category.test.mjs
git commit -m "Add diary category option helpers"
```

### Task 2: Editable category combobox in Write and Edit

**Files:**
- Modify: `study-diary.html:65-80`
- Modify: `js/diary.js:1-45, 150-175, 670-835`
- Modify: `css/pages.css:1342-1352`
- Test: `js/diary-category.test.mjs`

**Interfaces:**
- Consumes: `normalizeCategory` and `mergeCategoryOptions` from Task 1.
- Produces: `<input name="category" list="diary-category-options" required>` and `refreshCategoryOptions()` in `diary.js`.

- [ ] **Step 1: Extend the test with escaped datalist option rendering**

Add an exported helper whose output is safe to assign to `datalist.innerHTML`:

```js
import {
  BUILT_IN_CATEGORIES,
  normalizeCategory,
  mergeCategoryOptions,
  categoryOptionsHTML,
} from './diary-category.mjs';

test('categoryOptionsHTML escapes custom labels before rendering options', () => {
  assert.equal(
    categoryOptionsHTML(['Film & TV', 'A "Quoted" <Category>']),
    '<option value="Film &amp; TV"></option>'
      + '<option value="A &quot;Quoted&quot; &lt;Category&gt;"></option>',
  );
});
```

- [ ] **Step 2: Run the focused test and verify the missing export failure**

Run: `node --test js/diary-category.test.mjs`

Expected: FAIL because `categoryOptionsHTML` is not exported.

- [ ] **Step 3: Implement safe option rendering**

Add to `js/diary-category.mjs`:

```js
function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function categoryOptionsHTML(categories) {
  return categories
    .map((category) => `<option value="${escapeAttribute(category)}"></option>`)
    .join('');
}
```

- [ ] **Step 4: Replace the fixed select with an editable native combobox**

Replace the Category field in `study-diary.html` with:

```html
<label class="diary-form__field">
  <span>Category</span>
  <input
    type="text"
    name="category"
    list="diary-category-options"
    placeholder="Choose or type a category"
    autocomplete="off"
    required
  />
  <datalist id="diary-category-options"></datalist>
</label>
```

- [ ] **Step 5: Rebuild suggestions and normalize submitted categories**

Import the category helpers in `js/diary.js`:

```js
import {
  normalizeCategory,
  mergeCategoryOptions,
  categoryOptionsHTML,
} from './diary-category.mjs';
```

Add:

```js
function refreshCategoryOptions() {
  document.querySelector('#diary-category-options').innerHTML = categoryOptionsHTML(
    mergeCategoryOptions(ENTRIES),
  );
}
```

Call `refreshCategoryOptions()` after entries load, before Write opens, before
Edit is pre-filled, and after successful insert/update/delete mutations. In
`handleFormSubmit`, normalize once and reject an empty value:

```js
const category = normalizeCategory(data.get('category'));
if (!category || !title || !body || !date) return;
```

Use `category` instead of `data.get('category')` in both the edit patch and new
entry object.

- [ ] **Step 6: Keep styling consistent with the existing field controls**

The existing `.diary-form__field input` rule already styles the replacement.
Remove `.diary-form__field select` from the selector only if no other form
select remains; otherwise leave the selector intact. Do not add a custom popup
or category-specific visual layer.

- [ ] **Step 7: Run automated verification**

Run:

```bash
node --check js/diary.js
node --check js/diary-category.mjs
node --test --test-reporter=dot js/*.test.mjs
git diff --check
```

Expected: syntax checks exit 0, all tests pass, and `git diff --check` reports
no whitespace errors.

- [ ] **Step 8: Verify the browser behavior**

Open `http://127.0.0.1:8013/study-diary.html` and verify:

1. Write Diary shows an editable Category field with built-in suggestions.
2. Typing `Film Notes` and completing a valid entry sends `Film Notes` as the
   category.
3. Reopening Write Diary suggests `Film Notes`.
4. Edit pre-fills the saved custom category and permits changing it.
5. Entering only spaces is rejected by the required submission logic.

- [ ] **Step 9: Commit the integration**

```bash
git add study-diary.html js/diary.js js/diary-category.mjs js/diary-category.test.mjs css/pages.css
git commit -m "Allow custom diary categories"
```

