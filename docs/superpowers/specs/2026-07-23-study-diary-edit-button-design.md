# Study Diary Edit Button — Design

## Goal

Add an `Edit` button to the Study Diary page (`study-diary.html`) that lets a logged-in user edit the text, images, and video of the currently displayed diary page in place — mirroring the existing "Write Diary" flow but updating instead of inserting.

## Context

`study-diary.html` + `js/diary.js` implement a page-flip diary book backed by Supabase (`js/diary-supabase.js`): entries are fetched into an in-memory `ENTRIES` array on load, and every write (insert, delete, mood/weather update) goes through a Supabase call and then patches `ENTRIES` in place before re-rendering. There is no client-side router or framework — `js/diary.js` is a single module driving the DOM directly via `document.querySelector`.

The write flow today: `.diary-write-btn` (visible only when `isLoggedIn`) opens `.diary-modal-backdrop`, a form with Category/Date/Title/Quote/Body fields, a media-type tab (Image/Video) with file inputs, and a Caption field. `handleFormSubmit` uploads any selected files via `uploadFile`, builds a new entry object, calls `insertEntry`, pushes the returned row (mapped via `supabaseRowToEntry`) onto `ENTRIES`, and jumps the book to the new last page.

This design reuses that same modal and form in a new "edit mode" rather than building a second modal.

## Architecture

A new module-level variable, `editingEntryId` (string `id` or `null`), tracks whether the modal is in edit mode. `null` (the default) means "new entry" — today's behavior, unchanged. Non-null means "editing that entry's id" — set by the new `handleOpenEditor()` and cleared by `closeWriteModal()`.

`handleFormSubmit` branches once, near the top, on whether `editingEntryId` is set:
- **Edit branch:** build a patch from the form fields (reusing existing media unless new files were uploaded — see Media below), call `updateEntry(editingEntryId, patch)`, replace the matching object in `ENTRIES` with the mapped result (`supabaseRowToEntry`), `renderStatic()` in place (no page jump, no `buildDots()` re-render since the page count didn't change), close the modal.
- **New-entry branch:** unchanged from today.

## UI Changes

**Files touched:** `study-diary.html`, `js/diary.js`, `css/pages.css`.

- **Button:** `.diary-edit-btn` added to `.diary-toolbar`, positioned immediately to the left of `.diary-write-btn`. Label: `✎ Edit` (a pencil glyph, matching this site's existing convention of Unicode/emoji icons rather than an SVG icon library — see `.diary-placeholder__icon`, the category emoji in the write form, etc.). Styled identically to `.diary-write-btn` (same pill/outline/klein-blue treatment) via a shared CSS rule or an added class — a visual sibling, not a visually distinct button.
- **Visibility:** gated by `isLoggedIn`, exactly like `.diary-write-btn`, `.diary-page__discard`, and the mood/weather buttons — `applyAuthState()` sets `.diary-edit-btn`'s `hidden` alongside `.diary-write-btn`'s. Additionally disabled (not just hidden) when there are zero entries, since there's nothing to edit — reuse the `ENTRIES.length === 0` check already made in `renderStatic()`.
- **Modal copy:** title/submit-button text swap based on `editingEntryId`: `"Write a Diary Entry"` / `"Insert to Abroad Diary"` when null, `"Edit Diary Entry"` / `"Save Changes"` when set.
- **Media area in edit mode:** above the file inputs, show the entry's current media (reusing `mediaItemHTML` at small size, or a simpler thumbnail strip) with a caption like "Current media — leave blank below to keep it." The existing media-type tabs (Image/Video) default to the entry's current `media.type`. File inputs start empty (browsers cannot pre-populate a file input), and the caption/other text fields are pre-filled normally via `.value`.

## Data Flow

**`handleOpenEditor(entry)`** (bound to `.diary-edit-btn`'s click, called with `ENTRIES[state.current]`):
1. `editingEntryId = entry.id`
2. Populate form fields: `category`, `date`, `title`, `quote`, `body`, `caption` via `.value = entry.<field>`
3. `setMediaType(entry.media.type)` to select the matching tab
4. Render the "current media" preview strip from `entry.media.urls`
5. Update modal title/button text for edit mode
6. `document.querySelector('.diary-modal-backdrop').hidden = false`

**`handleFormSubmit` edit branch:**
1. Read form fields exactly as the new-entry path does.
2. If the active media tab has any files selected, upload them via the existing `uploadMediaFiles()` and use the resulting `urls`; otherwise reuse `entry.media.urls` from the entry being edited (looked up via `editingEntryId` in `ENTRIES`).
3. Build a patch object shaped like `entryToSupabaseRow` (`category`, `entry_date`/`date`, `title`, `quote`, `body`, `media`, and — per plan constraint — preserve `number`, `mood`, `weather` untouched) — call `updateEntry(editingEntryId, patch)`.
4. On success: find the entry in `ENTRIES` by id, replace it with `supabaseRowToEntry(returnedRow)` (preserving array position/index so `state.current` still points at the same page), `renderStatic()`, `updateChrome()` (label doesn't change, but keeps things consistent), close the modal.
5. `editingEntryId = null` is reset by `closeWriteModal()`, called on success and on cancel/close, so a cancelled or completed edit never leaks into the next "Write Diary" draft — same guarantee the sibling `ai-studio-diary-book` implementation established via `resetWriterForm()`.

**`closeWriteModal()`** gains: `editingEntryId = null`, and resets the modal title/button text and media-type tab back to new-entry defaults, in addition to its existing `form.reset()`.

## Error Handling

Reuses the existing `.diary-form .diary-form__error` element and try/catch/finally structure in `handleFormSubmit` — no new error UI. On an `updateEntry` failure, show `"Could not save changes. Please try again."` in that element and leave `ENTRIES` untouched (no optimistic mutation before the Supabase call resolves), matching how `setMood`/`handleDiscard` already handle failures elsewhere in this file.

## Out of Scope

- No offline/local-only fallback if Supabase is unreachable — same as the rest of this file.
- No multi-select "replace only image 3" granularity — uploading any new file(s) replaces the entire media set for that entry, matching how new-entry creation already works.
- No undo for a saved edit (same as today: there's no undo for a new entry either, only Discard).
