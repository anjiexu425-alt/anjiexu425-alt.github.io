# Share Life Supabase Design

## Goal

Create the missing `share-life.html` page by adapting the design and content
from `/Users/estrella/.zcode/workspace/default/share-life.html` into the
existing Anjie site. The finished page lets anyone browse notes, open their
Douyin links, and like or unlike them. Only the site owner may add, edit, or
delete notes.

## Visual Direction

Preserve the reference page's defining composition:

- a magazine-style `Share / Life & Insights` heading;
- the Chinese personal statement and contact line;
- right-aligned `Followers` and `Likes` statistics;
- a horizontal row of portrait cover cards;
- circular previous/next controls;
- a pill-shaped Add Note action;
- a compact add/edit modal.

The page will use the site's existing navigation, footer, typography tokens,
Klein blue accent, and responsive conventions. Inline reference-page CSS and
JavaScript will be split into the project's existing `css/` and `js/`
structure. Mobile keeps touch scrolling and hides the redundant arrow
controls.

The reference content remains:

- title: `Share Life & Insights`;
- quote: `梦想是早日实现经济和精神双独立。`;
- subline: `Record growth in my 20s.`;
- identity/contact: `AI Explorer｜anjiexu0630@163.com`;
- followers: fixed at `90`.

The Likes statistic is not the reference's hard-coded `2,500`; it is the sum of
the live note like counts returned by Supabase.

## Page Behavior

### Public browsing

The page fetches notes ordered by `created_at` ascending and renders one card
per row. Each card contains a portrait cover, a two-line title, and a live
heart count. Clicking the card opens its validated Douyin URL in a new tab
with `noopener`.

When no notes exist, the slider displays the reference page's empty-state
message. Loading and backend failure states are distinct; a failed request
must not be presented as a valid empty collection.

### Horizontal navigation

Desktop users can move through cards with the previous/next buttons, a
trackpad, mouse-wheel-to-horizontal translation, or click-and-drag. Touch
devices use native momentum scrolling. Arrow actions move two card widths and
respect reduced-motion preferences.

### Authentication and management

Share Life reuses the same Supabase project and email/password owner account
as Study Diary. The only account permitted to mutate Share Life notes or media
is `anjiexu0630@163.com`; the SQL enforces that email in addition to requiring
the `authenticated` role. Supabase email/password sign-up should remain
disabled so visitors cannot create unnecessary accounts, even though the RLS
owner check remains the authoritative write boundary.

- Signed-out visitors see a Log In button and no Add, Edit, or Delete controls.
- Signed-in owners see Log Out, Add Note, Edit, and Delete controls.
- Add and Edit share one form and change their title and submit label by mode.
- Edit pre-fills the current title and Douyin URL and previews the current
  cover.
- An edit without a newly selected image retains the current cover.
- Delete requires explicit confirmation.

Login state is shared naturally by the Supabase browser session on the same
origin; Share Life does not implement a second credential store.

## Note Form

The form contains:

- title, required, trimmed;
- Douyin URL, required;
- cover image, optional on create and edit;
- current/new cover preview;
- inline error area;
- Cancel and Add/Save actions.

The reference's manually entered Likes field is removed because likes are
public interactions. A create without an image uses a bundled site placeholder
rather than a network-hosted Unsplash URL. Cover images accept standard browser
image MIME types and are limited to 8 MB, matching Study Diary's image limit.

The form remains open and preserves entered values after validation, upload, or
database errors.

## Data Model

Create a `share_life_notes` table:

```sql
create table public.share_life_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  douyin_url text not null,
  cover_url text not null,
  cover_path text,
  likes_count bigint not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`cover_path` is nullable because the bundled placeholder is not a Storage
object. `cover_url` is always present so the card renderer has one source.

Row Level Security rules:

- `select`: public (`anon` and `authenticated`);
- `insert`, `update`, `delete`: the authenticated owner email
  `anjiexu0630@163.com` only;
- no public direct update policy.

The email predicate is enforced inside every note and Storage mutation policy,
so other authenticated accounts cannot write. Keeping public sign-up disabled
is still recommended to reduce account abuse and operational noise.

Create a public `share-life-media` bucket:

- public read;
- insert/update/delete restricted to authenticated
  `anjiexu0630@163.com`;
- uploads use an entry-independent timestamp/random path;
- only paths returned by the upload helper are stored in `cover_path`.

The project will include an idempotent SQL setup file containing table,
function, grant, RLS, and Storage policies. The SQL must be applied through the
Supabase SQL Editor before the live page can persist data.

## Likes

Each browser keeps a local set of note IDs under the namespaced key
`shareLifeLikedNoteIds`. This local value records only whether that browser
currently displays the heart as active; it is not the authoritative count.

Clicking an unliked heart requests `+1`; clicking it again requests `-1`.
Supabase exposes a narrowly scoped `security definer` function:

```sql
adjust_share_life_like(note_id uuid, delta integer)
```

The function accepts only `-1` or `1`, updates with
`greatest(0, likes_count + delta)`, and returns the new count in one atomic
statement. Execution is granted to `anon` and `authenticated`; direct public
table updates remain prohibited.

The browser updates its local liked set only after the RPC succeeds. A failed
request restores the previous heart/count and announces an inline error.
Buttons are disabled while their own request is pending, preventing accidental
double clicks in one tab.

This is a lightweight, browser-scoped preference rather than fraud-proof user
identity. Clearing browser storage or using another browser permits another
like. Stronger uniqueness would require visitor accounts or a server-side
fingerprinting system and is outside this version.

## Supabase and Media Flow

All Share Life I/O lives in a dedicated module rather than being added to the
Diary module. It reuses the exported Supabase client/auth session but targets
the Share Life table, RPC, and bucket.

Create:

1. validate and normalize fields;
2. upload a selected cover, if present;
3. insert the note row;
4. if insertion fails after upload, attempt best-effort removal of the newly
   uploaded object and keep the form open.

Edit:

1. validate fields;
2. upload the replacement cover, if present;
3. update the row with new text and cover fields;
4. after a successful update, remove the superseded Storage object;
5. if the update fails, attempt best-effort removal of the newly uploaded
   object and retain the old note.

Delete:

1. delete the database row;
2. remove its Storage object when `cover_path` is present;
3. treat the row deletion as the visible success boundary; report a Storage
   cleanup failure without restoring an already-deleted card.

## Security and Accessibility

- Render titles with DOM `textContent`; never interpolate note fields into
  `innerHTML`.
- Accept only URLs whose parsed protocol is `http:` or `https:`.
- Use a trusted fallback image for broken covers.
- Use button elements for hearts and owner actions, with accessible names and
  `aria-pressed` for like state.
- The modal has a labelled dialog role, traps initial focus, closes on Escape
  and backdrop/Cancel, and returns focus to its opener.
- Cards remain keyboard-accessible links; management buttons do not trigger
  the card link.
- Error and status text use `role="status"` or `role="alert"` as appropriate.
- Reduced-motion users receive instant scrolling and no hover lift animation.

## Files and Boundaries

- `share-life.html`: semantic page, dialogs, static copy, and empty containers.
- `css/share-life.css`: Share Life layout and responsive styles.
- `js/share-life.js`: page state, rendering, events, form/auth orchestration.
- `js/share-life-supabase.js`: table, RPC, Storage, and shared-auth operations.
- `js/share-life-model.mjs`: pure validation, mapping, statistics, and local
  like-state helpers.
- `js/share-life-model.test.mjs`: pure behavior and security regression tests.
- `supabase/share-life.sql`: idempotent schema/RLS/RPC/Storage setup.
- `assets/images/share-life-placeholder.svg`: bundled placeholder cover.

Existing navigation links already target `share-life.html`; other pages do not
need route changes.

## Error Handling

- Initial fetch failure shows a Retry action.
- A broken cover swaps to the bundled placeholder.
- Invalid title, URL, or oversized image is rejected before upload.
- Add/Edit disables its submit button while pending and prevents duplicate
  submissions.
- Like requests lock only the selected heart.
- Delete failure leaves the card visible.
- Login errors appear inside the login dialog.
- Network errors use plain language and never discard form input.

## Testing and Acceptance

Automated Node tests cover:

- row-to-note and note-to-row mapping;
- title trimming and length validation;
- `http/https` URL acceptance and rejection of dangerous protocols;
- 8 MB image limit;
- live Likes sum;
- local liked-ID parsing, deduplication, add, and remove;
- insert/edit media resolution and preservation;
- safe rendering boundary (no note fields interpolated into HTML);
- SQL contract text for table, atomic RPC, grants, RLS, and bucket policies;
- HTML accessibility contract for dialog, buttons, labels, and navigation;
- responsive/reduced-motion CSS contract.

Browser acceptance covers:

- public loading, empty, and failure states;
- authenticated Login/Logout and management visibility;
- Add, Edit, and Delete with image upload;
- card navigation to the correct Douyin URL;
- like, unlike, reload persistence, and total Likes changes;
- arrows, wheel/drag, touch-size layout, keyboard, Escape, and reduced motion;
- desktop and mobile widths.

Live Supabase mutation acceptance happens only after `supabase/share-life.sql`
has been applied. Before that external prerequisite, a deterministic local
fixture will exercise the complete UI with an in-memory adapter without
claiming that production persistence is ready.
