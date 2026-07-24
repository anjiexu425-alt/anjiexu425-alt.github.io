# Share Life Fixed Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Share Life header statistics fixed at `320 Followers` and `1.1w Likes` while preserving each card’s independent like behavior.

**Architecture:** Export the two display strings from `js/share-life-model.mjs` as the single source of truth. Production and fixture renderers consume those constants, while both HTML files carry matching initial values to prevent loading flicker.

**Tech Stack:** Vanilla HTML/CSS/JavaScript ES modules and Node.js built-in test runner.

## Global Constraints

- Followers always displays `320`.
- Likes always displays `1.1w`.
- Creating, editing, deleting, liking, or unliking a note never changes those header values.
- Card-level likes, Supabase persistence, the public RPC, and editable like counts remain unchanged.
- Production and fixture behavior must match.
- Supabase schema and data are not modified.

---

### Task 1: Fixed header statistics

**Files:**
- Modify: `js/share-life-model.mjs`
- Modify: `js/share-life.js`
- Modify: `js/share-life-fixture.js`
- Modify: `share-life.html`
- Modify: `share-life-fixture.html`
- Test: `js/share-life-model.test.mjs`
- Test: `js/share-life-contract.test.mjs`

**Interfaces:**
- Produces: `SHARE_LIFE_FOLLOWERS_LABEL: '320'`
- Produces: `SHARE_LIFE_LIKES_LABEL: '1.1w'`
- Preserves: `sumLikeCounts(notes)` for existing pure-model coverage, but removes it from header rendering.

- [ ] **Step 1: Write failing model and contract tests**

Add:

```js
test('exports fixed Share Life header statistics', () => {
  assert.equal(model.SHARE_LIFE_FOLLOWERS_LABEL, '320');
  assert.equal(model.SHARE_LIFE_LIKES_LABEL, '1.1w');
});
```

Extend the production/fixture contracts to assert:

```js
assert.match(productionHtml, /id="shareLifeFollowersCount">320</);
assert.match(productionHtml, /id="shareLifeTotalLikesCount">1\.1w</);
assert.match(fixtureHtml, /id="shareLifeFollowersCount">320</);
assert.match(fixtureHtml, /id="shareLifeTotalLikesCount">1\.1w</);
```

Also assert both runtime modules assign the exported labels and do not assign `sumLikeCounts(notes)` to `shareLifeTotalLikesCount`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test js/share-life-model.test.mjs js/share-life-contract.test.mjs
```

Expected: FAIL because the fixed-label exports and matching HTML/runtime assignments do not exist.

- [ ] **Step 3: Add the fixed-label model constants**

At the top of `js/share-life-model.mjs`, add:

```js
export const SHARE_LIFE_FOLLOWERS_LABEL = '320';
export const SHARE_LIFE_LIKES_LABEL = '1.1w';
```

- [ ] **Step 4: Wire production and fixture renderers**

Import both constants in `js/share-life.js` and `js/share-life-fixture.js`.

Production `renderStats()` must set:

```js
followersCount.textContent = SHARE_LIFE_FOLLOWERS_LABEL;
totalLikesCount.textContent = SHARE_LIFE_LIKES_LABEL;
```

Fixture stats rendering must set the same two values. Remove only the now-unused `sumLikeCounts` imports from those runtime modules; keep the pure helper and its tests.

- [ ] **Step 5: Align initial HTML values**

Set the matching initial values in both HTML files:

```html
<dd id="shareLifeFollowersCount">320</dd>
<dd id="shareLifeTotalLikesCount">1.1w</dd>
```

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
node --test js/share-life-model.test.mjs js/share-life-contract.test.mjs
node --test js/*.test.mjs
node --check js/share-life.js
node --check js/share-life-fixture.js
node --check js/share-life-model.mjs
git diff --check
```

Expected: all focused and full tests pass, syntax checks exit `0`, and no whitespace errors are reported.

- [ ] **Step 7: Browser acceptance**

In the fixture and production pages, confirm:

1. Initial stats are `320` and `1.1w`.
2. Creating a note leaves both values unchanged.
3. Editing a note’s like count leaves both values unchanged.
4. Liking and unliking a card leaves both values unchanged while the card count changes.

- [ ] **Step 8: Commit**

```bash
git add share-life.html share-life-fixture.html js/share-life.js js/share-life-fixture.js js/share-life-model.mjs js/share-life-model.test.mjs js/share-life-contract.test.mjs
git commit -m "feat: fix Share Life header stats"
```
