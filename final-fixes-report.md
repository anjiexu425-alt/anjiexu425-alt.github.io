# Final fixes report — diary page-layout intrinsic media readiness

## RED

The first regression test starts from an empty production
`createMediaLayoutCache`, maps a `text-left -> media-left` transition, and
passes the result through the production `buildCurlSpreadDOM` boundary.

```text
node --test --test-name-pattern='uncached text-left to media-left' js/diary-layout.test.mjs
tests 1, pass 0, fail 1
actual: 'undefined'
expected: 'function'
production must expose an entry-aware intrinsic media prewarmer
```

This was the expected failure: the old `preloadEntryImages` downloaded image
bytes but exposed no intrinsic prewarm API and never populated the
entry-scoped layout cache. The target physical-left back face therefore
serialized the `unknown` 3:4 fallback.

Additional RED cycles proved:

- the new API was initially absent for concurrent image/video metadata;
- a settled render generation would otherwise conflict with target-entry
  prewarm work;
- timeout, deduplication, edit/delete stale completion, and in-place media
  replacement needed explicit generation behavior;
- the acceptance fixture still manually seeded cache values and manually
  assembled settled pages/slice previews instead of using production DOM
  builders.

## GREEN

- The uncached `text-left -> media-left` regression now prewarms both entries
  and asserts all 16 production curl slices serialize a landscape front and
  portrait target back with no `diary-polaroid--unknown`.
- `createMediaLayoutCache` now keeps the existing exclusive settled-render
  generation lane and adds concurrent entry-scoped generations. `set`,
  `cancel`, `invalidate`, signature rejection, and `prune` reject old edit or
  delete completions in both lanes.
- `createMediaIntrinsicPrewarmer` is reusable and entry-aware. It:
  - reads image `naturalWidth`/`naturalHeight`;
  - reads video `videoWidth`/`videoHeight` from `loadedmetadata` with
    `preload="metadata"`;
  - deduplicates in-flight work by entry plus media signature;
  - resolves to explicit `cached`, `ready`, `not-needed`, `failed`,
    `timed-out`, or `stale` states;
  - aborts browser metadata work after a bounded 2500 ms default timeout;
  - never lets an old generation write after edit, delete, prune, or an
    in-place media signature change.
- Initial entry loading starts image/video intrinsic prewarming before the
  first render without awaiting it, so startup remains non-blocking. Gallery
  image network warming remains intact and single-image duplication is
  avoided.
- Click flips await the same bounded, deduplicated readiness work before
  constructing curl DOM. On failure/timeout they leave the settled spread
  untouched, which explicitly avoids a fallback-to-intrinsic visual snap.
- Drag flips construct no curl DOM until both physical-face entries are
  ready. An early gesture starts/joins prewarming and remains on the settled
  spread; a later gesture can proceed without a ratio race.
- Successful edits/new entries start fresh prewarming. Existing
  invalidate/prune behavior protects late edit/delete completions.

## Fixture

- File: `page-layout-fixture.html`
- URL when served from this worktree:
  `http://127.0.0.1:4173/page-layout-fixture.html`
- Example server command: `python3 -m http.server 4173`
- The fixture now uses real local image intrinsic metadata rather than manual
  cache seeds.
- Settled spreads call production `renderSettledSpreadDOM`.
- Transition underlays and all slice canvases originate from production
  `buildCurlSpreadDOM`; the visible previews clone those built nodes rather
  than reconstructing their HTML or offsets.
- The radio section remains a fixture-only form harness and is labeled as
  such. Production form behavior remains covered by executable source
  contract tests.

The current environment exposed no controllable browser instance, and its
sandbox rejected binding the local HTTP port, so a new interactive
screenshot/console pass could not be run here. Module syntax and the
production-builder fixture contract are automated instead.

## Verification

```text
node --check js/diary.js
node --check js/diary-media.mjs
node --check js/diary-layout.mjs
node --check js/diary-dom.mjs
fixture inline module: node --input-type=module --check
all passed

node --test js/*.test.mjs
tests 134, pass 134, fail 0

git diff --check
passed
```

Focused cache, transition, stale-generation, timeout, click/drag gate, and
fixture tests also passed before the full run.

## Commit

- `d3eb285 Prewarm diary media layouts before page curls`

## Self-review and concerns

- No Supabase schema, persistence contract, curl geometry, slice ordering,
  upload flow, or page-layout mapping changed.
- Static DOM hydration retains its exclusive generation behavior: navigating
  away still prevents a detached settled page from applying a late layout.
  Concurrent entry prewarm work is isolated from that lane.
- Gallery eager image warming is preserved; videos gain metadata-only warming.
- Metadata failure is intentionally safe rather than invisible: a click flip
  stops after the bounded timeout, and a drag does not start, so no unknown
  back face can land and snap. A broken/very slow resource may require a later
  retry; no infinite wait or unbounded listener remains.
- No unresolved automated-test or diff concern remains.
