# Toolkit Page Design

## Purpose

Add a `Toolkit` page to the personal website (`toolkit.html`, already linked from the shared nav in `index.html`/`about.html`/etc. but not yet built) showcasing two collections: **Skills** (a list of tools/skills with GitHub links) and **Vibe Coding Projects** (a card grid of side projects). Adapted from a standalone reference file (`toolkit.html` design mockup) into the site's existing design system, with Supabase-backed persistence matching the Study Diary / Share Life pages.

## Visual style

- Reuses the site's shared header/footer (`.site-nav`), Playfair Display + Noto Serif SC fonts, klein blue (`--color-klein-blue: #002FA7`) accent, and cream background (`--color-bg: #F5F5F3`) — consistent with About/Experience/Study Diary, not the reference file's independent Inter/JetBrains Mono system.
- Title area includes a small breathing klein-blue glow, reusing the existing `.experience-header__glow` treatment (radial gradient + `breathe` keyframes from `pages.css`) instead of the reference's orbiting-circle decoration.
- **Galaxy particle background**: ported from the reference file's canvas animation (floating stars, mouse-repulsion, proximity connecting lines), recolored to klein-blue tones only (dropping the reference's multi-shade blue palette) and at reduced opacity so it reads as a subtle backdrop behind the cream page content rather than competing with it. Rendered on a fixed full-viewport `<canvas>` behind `.page` content (`z-index: 0`), same layering approach as the reference.
- Layout keeps the reference's two-section structure: a **Skills** list (row-based) and a **Vibe Coding Projects** grid (2-column cards on desktop, 1-column on mobile), each with an "add" affordance in the section header.

## Data model (Supabase)

Two new tables, modeled on `share_life_notes` (see `supabase/share-life.sql`):

**`toolkit_skills`**
- `id` uuid primary key default `gen_random_uuid()`
- `name` text not null
- `url` text not null
- `description` text, nullable
- `tags` text[] not null default `'{}'`
- `created_at` timestamptz not null default `now()`

**`toolkit_projects`**
- `id` uuid primary key default `gen_random_uuid()`
- `name` text not null
- `url` text not null
- `description` text, nullable
- `tags` text[] not null default `'{}'`
- `created_at` timestamptz not null default `now()`

No storage bucket needed — both collections are text/link only, no image uploads.

### Row Level Security

Same pattern as `share_life_notes`:
- `select`: public (`using (true)`)
- `insert` / `update` / `delete`: `to authenticated`, `using/with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com')`

This is the RLS enforcement boundary — the only real security gate. Client-side login-state checks are UX only (same caveat as `diary.js`).

## Auth / edit permissions

- Reuses the Study Diary login pattern: email + password via `supabase.auth.signInWithPassword()`, against the *same* Supabase project/anon key already used by `diary-supabase.js` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`).
- Because the Supabase client persists its session in browser localStorage keyed by project ref, a user already logged in on the Study Diary page is automatically recognized as logged in on the Toolkit page too — no separate login required across pages on the same origin.
- A login/logout button (styled/behaved like `.diary-login-btn` + its modal) toggles the UI. Logged out: "添加 Skill"/"添加 Project" buttons and per-item delete buttons are hidden. Logged in: they appear.
- `toolkit-supabase.js` re-exports (or imports and re-uses) the existing `signIn`/`signOut`/`getSession`/`onAuthStateChange` helpers from `diary-supabase.js` rather than duplicating auth logic.

## Interaction / frontend behavior

**Skills list**
- Each row: name (monospace-ish emphasis consistent with site type scale), description, tag chips. Clicking a row opens its GitHub URL in a new tab.
- Logged-in state adds a delete button per row (confirm() before deleting, matching reference behavior).
- "添加 Skill" opens a modal form: name, GitHub URL, description, tags (Enter-to-add tag-chip input, ported from the reference's tag input pattern).

**Vibe Coding Projects grid**
- Each card: project name, description, tag/badge row. Clicking a card opens its GitHub URL in a new tab.
- Logged-in state adds a delete button in the card's top-right corner (visible on hover), confirm() before deleting.
- "添加 Project" opens a modal form: project name, GitHub URL, description, tags/badges.

**Data flow**
- Both sections start empty (no seed data) — populated by the site owner via the add modals after this ships.
- On submit, the form calls the corresponding Supabase insert helper, then re-fetches and re-renders the affected section (no optimistic local-only state, no localStorage — every mutation round-trips through Supabase so all visitors see the same data).
- Empty-state messaging shown when a section has zero items.

**Galaxy background**
- Ported near-verbatim from the reference file's canvas star-field logic (star class with position/velocity/twinkle, mouse-repulsion within a radius, proximity-based connecting lines, scroll parallax), recolored to klein-blue tones and tuned to a lower opacity/star count so it doesn't overpower the cream background or text legibility. Respects `prefers-reduced-motion` by disabling the animation loop (site precedent: `@media (prefers-reduced-motion: reduce)` block in `pages.css` for the diary flip).

## File plan

- **`toolkit.html`** (new) — page shell: `.site-nav` header/footer (copied from `about.html`), galaxy `<canvas>`, Skills section, Projects section, two modal forms.
- **`css/toolkit.css`** (new, sibling to `share-life.css` rather than appended to the already-large `pages.css`) — Skills list, Projects card grid, modal/form styles, galaxy canvas layering, responsive breakpoints.
- **`js/toolkit-supabase.js`** (new, modeled on `share-life-supabase.js`) — imports the shared `supabase` client and auth helpers from `diary-supabase.js`; adds `fetchSkills`/`insertSkill`/`deleteSkill` and `fetchProjects`/`insertProject`/`deleteProject`.
- **`js/toolkit.js`** (new, modeled on `diary.js`'s auth-gating + `share-life.js`'s render logic) — auth state wiring, galaxy canvas animation, render/empty-state logic for both sections, modal open/close, tag-chip input handling, form submit handlers.
- **`supabase/toolkit.sql`** (new, modeled on `share-life.sql`) — creates both tables, enables RLS, adds the four policies per table (select/insert/update/delete).
- Nav links in `index.html` and other pages already point to `toolkit.html` — no changes needed there.

## Out of scope

- No image/media upload for skills or projects (text + link only).
- No editing of existing items after creation (only add + delete) — matches the reference file's scope.
- No public-facing "request access" or multi-user auth — single owner (`anjiexu425@gmail.com`) only, same as Share Life.
