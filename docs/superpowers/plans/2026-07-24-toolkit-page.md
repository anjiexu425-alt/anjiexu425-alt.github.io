# Toolkit Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `toolkit.html` — a Supabase-backed "Skills" list + "Vibe Coding Projects" card grid page, styled in the site's existing klein-blue/Playfair Display design system with a klein-blue-toned galaxy particle background, gated by the same owner login used on Study Diary.

**Architecture:** A pure data-model module (`toolkit-model.mjs`) handles validation, tag normalization, and HTML string building — fully unit tested with `node --test`, no DOM dependency. A thin Supabase CRUD module (`toolkit-supabase.js`) wraps two new tables, reusing the existing `supabase` client and auth helpers from `diary-supabase.js`. A DOM-wiring module (`toolkit.js`) ties model + CRUD + auth together and drives the galaxy canvas animation. `toolkit.html` and `css/toolkit.css` provide the page shell and styling, following the same file-per-page convention as `share-life.html`/`css/share-life.css`.

**Tech Stack:** Vanilla JS (ES modules), Supabase JS client v2 (via esm.sh, already vendored the same way in `diary-supabase.js`), Node's built-in `node:test` + `node:assert/strict` test runner (project convention — no new test framework), plain CSS using the site's existing custom properties from `css/base.css`.

## Global Constraints

- Reuse the existing Supabase project (`SUPABASE_URL`/`SUPABASE_ANON_KEY` already defined in `js/diary-supabase.js`) — do not create a new project or duplicate the client.
- All write access (insert/update/delete) on the new tables is restricted via RLS to `auth.jwt() ->> 'email' = 'anjiexu425@gmail.com'` — the same owner-only pattern as `supabase/share-life.sql`.
- No image/media upload for skills or projects — text and links only, no storage bucket.
- No "edit existing item" feature — only add + delete (matches the reference mockup's scope).
- Use the site's existing design tokens from `css/base.css` (`--color-klein-blue`, `--color-bg`, `--color-surface`, `--font-display`, `--font-body`, `--space-*`, `--radius-*`, `--transition-fast`/`--transition-slow`) — do not introduce a second, competing token system.
- Test convention: plain `.test.mjs` files run via `node --test js/<file>.test.mjs`, no Jest/Vitest/jsdom (confirmed: no DOM-testing library exists in this repo; DOM-wiring files like `diary.js`/`share-life.js` are not unit tested directly — only their extracted pure-logic modules are).

---

### Task 1: Supabase migration for `toolkit_skills` and `toolkit_projects`

**Files:**
- Create: `supabase/toolkit.sql`

**Interfaces:**
- Produces: two tables (`public.toolkit_skills`, `public.toolkit_projects`) with columns `id, name, url, description, tags, created_at`, each with RLS enabled and four policies (select/insert/update/delete). Task 3's `toolkit-supabase.js` depends on these exact table names and column names.

This file cannot be executed or unit-tested from this repo (it's applied manually in the Supabase SQL editor, same as `supabase/share-life.sql` — there is no committed test for that file either). Verification happens in Task 6, against the live project.

- [ ] **Step 1: Write the migration file**

```sql
-- Toolkit skills and vibe-coding projects, shown on toolkit.html.
-- This migration is safe to run again against the same Supabase project.

create table if not exists public.toolkit_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.toolkit_skills
drop constraint if exists toolkit_skills_name_length_check;

alter table public.toolkit_skills
add constraint toolkit_skills_name_length_check
check (char_length(btrim(name)) between 1 and 160);

alter table public.toolkit_skills enable row level security;

drop policy if exists "Public can view toolkit skills" on public.toolkit_skills;
create policy "Public can view toolkit skills"
on public.toolkit_skills
for select
to public
using (true);

drop policy if exists "Owner can create toolkit skills" on public.toolkit_skills;
create policy "Owner can create toolkit skills"
on public.toolkit_skills
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can edit toolkit skills" on public.toolkit_skills;
create policy "Owner can edit toolkit skills"
on public.toolkit_skills
for update
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com')
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can delete toolkit skills" on public.toolkit_skills;
create policy "Owner can delete toolkit skills"
on public.toolkit_skills
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

create table if not exists public.toolkit_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.toolkit_projects
drop constraint if exists toolkit_projects_name_length_check;

alter table public.toolkit_projects
add constraint toolkit_projects_name_length_check
check (char_length(btrim(name)) between 1 and 160);

alter table public.toolkit_projects enable row level security;

drop policy if exists "Public can view toolkit projects" on public.toolkit_projects;
create policy "Public can view toolkit projects"
on public.toolkit_projects
for select
to public
using (true);

drop policy if exists "Owner can create toolkit projects" on public.toolkit_projects;
create policy "Owner can create toolkit projects"
on public.toolkit_projects
for insert
to authenticated
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can edit toolkit projects" on public.toolkit_projects;
create policy "Owner can edit toolkit projects"
on public.toolkit_projects
for update
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com')
with check (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');

drop policy if exists "Owner can delete toolkit projects" on public.toolkit_projects;
create policy "Owner can delete toolkit projects"
on public.toolkit_projects
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'anjiexu425@gmail.com');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/toolkit.sql
git commit -m "feat: add Supabase migration for toolkit skills and projects"
```

---

### Task 2: `toolkit-model.mjs` — validation, normalization, and HTML builders

**Files:**
- Create: `js/toolkit-model.mjs`
- Test: `js/toolkit-model.test.mjs`

**Interfaces:**
- Consumes: nothing (pure module, no imports beyond built-ins).
- Produces (named exports consumed by Task 5's `toolkit.js`): `normalizeTags(tags: string[]): string[]`, `isValidHttpUrl(value: string): boolean`, `buildItemSubmission({ name, url, description, tags }): { valid: boolean, errors: string[], row: { name: string, url: string, description: string|null, tags: string[] } | null }`, `supabaseRowToItem(row): { id, name, url, description: string, tags: string[] }`, `skillRowHTML(item, isLoggedIn: boolean): string`, `projectCardHTML(item, isLoggedIn: boolean): string`, `emptyStateHTML(message: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `js/toolkit-model.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTags,
  isValidHttpUrl,
  buildItemSubmission,
  supabaseRowToItem,
  skillRowHTML,
  projectCardHTML,
  emptyStateHTML,
} from './toolkit-model.mjs';

test('normalizeTags trims, drops empties, and dedupes case-insensitively', () => {
  assert.deepEqual(
    normalizeTags([' Context ', 'context', '', '  ', 'Migration']),
    ['Context', 'Migration'],
  );
});

test('isValidHttpUrl accepts http and https URLs', () => {
  assert.equal(isValidHttpUrl('https://github.com/anjie/tool'), true);
  assert.equal(isValidHttpUrl('http://example.com'), true);
});

test('isValidHttpUrl rejects non-URL strings and other protocols', () => {
  assert.equal(isValidHttpUrl('not a url'), false);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl(undefined), false);
});

test('buildItemSubmission rejects a missing name', () => {
  const result = buildItemSubmission({
    name: '  ',
    url: 'https://github.com/x',
    description: '',
    tags: [],
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['Name is required.']);
  assert.equal(result.row, null);
});

test('buildItemSubmission rejects an invalid URL', () => {
  const result = buildItemSubmission({
    name: 'context-snapshot',
    url: 'not a url',
    description: '',
    tags: [],
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['A valid http(s) URL is required.']);
});

test('buildItemSubmission normalizes a valid submission into an insert-ready row', () => {
  const result = buildItemSubmission({
    name: '  context-snapshot  ',
    url: '  https://github.com/anjie/context-snapshot  ',
    description: '  Snapshot conversation context.  ',
    tags: [' Context ', 'context', 'Migration'],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.row, {
    name: 'context-snapshot',
    url: 'https://github.com/anjie/context-snapshot',
    description: 'Snapshot conversation context.',
    tags: ['Context', 'Migration'],
  });
});

test('buildItemSubmission stores a blank description as null', () => {
  const result = buildItemSubmission({
    name: 'x',
    url: 'https://example.com',
    description: '   ',
    tags: [],
  });
  assert.equal(result.valid, true);
  assert.equal(result.row.description, null);
});

test('supabaseRowToItem maps a database row to the item shape used by rendering', () => {
  const row = {
    id: 'abc-123',
    name: 'context-snapshot',
    url: 'https://github.com/x',
    description: null,
    tags: null,
  };
  assert.deepEqual(supabaseRowToItem(row), {
    id: 'abc-123',
    name: 'context-snapshot',
    url: 'https://github.com/x',
    description: '',
    tags: [],
  });
});

test('skillRowHTML escapes HTML in name, description, and tags', () => {
  const html = skillRowHTML(
    {
      id: '1',
      name: '<b>x</b>',
      url: 'https://example.com',
      description: '<i>desc</i>',
      tags: ['<script>'],
    },
    false,
  );
  assert.doesNotMatch(html, /<b>x<\/b>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('skillRowHTML omits the delete button when logged out', () => {
  const html = skillRowHTML(
    { id: '1', name: 'x', url: 'https://example.com', description: '', tags: [] },
    false,
  );
  assert.doesNotMatch(html, /skill-delete/);
});

test('skillRowHTML includes a delete button with the item id when logged in', () => {
  const html = skillRowHTML(
    { id: 'abc', name: 'x', url: 'https://example.com', description: '', tags: [] },
    true,
  );
  assert.match(html, /class="skill-delete" data-id="abc"/);
});

test('projectCardHTML falls back to a placeholder when description is empty', () => {
  const html = projectCardHTML(
    { id: '1', name: 'x', url: 'https://example.com', description: '', tags: [] },
    false,
  );
  assert.match(html, /暂无描述/);
});

test('projectCardHTML omits the delete button when logged out', () => {
  const html = projectCardHTML(
    { id: '1', name: 'x', url: 'https://example.com', description: 'd', tags: [] },
    false,
  );
  assert.doesNotMatch(html, /project-delete/);
});

test('projectCardHTML includes a delete button with the item id when logged in', () => {
  const html = projectCardHTML(
    { id: 'xyz', name: 'x', url: 'https://example.com', description: 'd', tags: [] },
    true,
  );
  assert.match(html, /class="project-delete" data-id="xyz"/);
});

test('emptyStateHTML escapes its message', () => {
  assert.match(emptyStateHTML('<script>alert(1)</script>'), /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/toolkit-model.test.mjs`
Expected: FAIL — `Cannot find module './toolkit-model.mjs'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `js/toolkit-model.mjs`:

```javascript
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeTags(tags = []) {
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = normalizeText(raw);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function buildItemSubmission({ name, url, description, tags }) {
  const normalizedName = normalizeText(name);
  const normalizedUrl = normalizeText(url);
  const normalizedDescription = normalizeText(description);
  const normalizedTags = normalizeTags(tags);

  const errors = [];
  if (!normalizedName) errors.push('Name is required.');
  if (!isValidHttpUrl(normalizedUrl)) errors.push('A valid http(s) URL is required.');

  if (errors.length > 0) {
    return { valid: false, errors, row: null };
  }

  return {
    valid: true,
    errors: [],
    row: {
      name: normalizedName,
      url: normalizedUrl,
      description: normalizedDescription || null,
      tags: normalizedTags,
    },
  };
}

export function supabaseRowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function tagChipsHTML(tags, className) {
  return tags.map((tag) => `<span class="${className}">${escapeHTML(tag)}</span>`).join('');
}

export function skillRowHTML(item, isLoggedIn) {
  const tagsHtml = tagChipsHTML(item.tags, 'skill-tag');
  const deleteButton = isLoggedIn
    ? `<button class="skill-delete" data-id="${escapeHTML(item.id)}" title="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`
    : '';
  return `
    <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" class="skill-row" data-id="${escapeHTML(item.id)}">
      <div class="skill-main">
        <span class="skill-name">${escapeHTML(item.name)}</span>
        <span class="skill-desc">${escapeHTML(item.description)}</span>
      </div>
      <div class="skill-row__end">
        <div class="skill-tags">${tagsHtml}</div>
        ${deleteButton}
      </div>
    </a>
  `;
}

export function projectCardHTML(item, isLoggedIn) {
  const badgesHtml = tagChipsHTML(item.tags, 'project-badge');
  const deleteButton = isLoggedIn
    ? `<button class="project-delete" data-id="${escapeHTML(item.id)}" title="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`
    : '';
  return `
    <div class="project-card" data-id="${escapeHTML(item.id)}">
      ${deleteButton}
      <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" class="project-card__link">
        <div class="project-content">
          <h3 class="project-name">${escapeHTML(item.name)}</h3>
          <p class="project-desc">${item.description ? escapeHTML(item.description) : '暂无描述'}</p>
          <div class="project-badges">${badgesHtml}</div>
        </div>
      </a>
    </div>
  `;
}

export function emptyStateHTML(message) {
  return `<div class="toolkit-empty"><p>${escapeHTML(message)}</p></div>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/toolkit-model.test.mjs`
Expected: PASS — all 14 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/toolkit-model.mjs js/toolkit-model.test.mjs
git commit -m "feat: add toolkit data model with validation and HTML builders"
```

---

### Task 3: `toolkit-supabase.js` — CRUD wrapper for the two new tables

**Files:**
- Create: `js/toolkit-supabase.js`

**Interfaces:**
- Consumes: `supabase` client from `./diary-supabase.js` (existing export).
- Produces (consumed by Task 5's `toolkit.js`): `fetchToolkitSkills(): Promise<row[]>`, `insertToolkitSkill(row): Promise<row>`, `deleteToolkitSkill(id): Promise<void>`, `fetchToolkitProjects(): Promise<row[]>`, `insertToolkitProject(row): Promise<row>`, `deleteToolkitProject(id): Promise<void>`.

This is a thin I/O wrapper with no branching logic (same as `share-life-supabase.js`, which also has no dedicated test file) — no unit test needed; it's exercised end-to-end in Task 6.

- [ ] **Step 1: Write the implementation**

Create `js/toolkit-supabase.js`:

```javascript
import { supabase } from './diary-supabase.js';

const SKILLS_TABLE = 'toolkit_skills';
const PROJECTS_TABLE = 'toolkit_projects';

export async function fetchToolkitSkills() {
  const { data, error } = await supabase
    .from(SKILLS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertToolkitSkill(row) {
  const { data, error } = await supabase
    .from(SKILLS_TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteToolkitSkill(id) {
  const { error } = await supabase.from(SKILLS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchToolkitProjects() {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertToolkitProject(row) {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteToolkitProject(id) {
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Sanity-check the module loads**

Run: `node --input-type=module -e "import('./js/toolkit-supabase.js').then(() => console.log('loaded ok'))"`
Expected: PASS — prints `loaded ok` (confirms the import chain from `diary-supabase.js`, including the `esm.sh` Supabase client import, resolves without syntax errors; it does not hit the network).

- [ ] **Step 3: Commit**

```bash
git add js/toolkit-supabase.js
git commit -m "feat: add Supabase CRUD wrapper for toolkit skills and projects"
```

---

### Task 4: `toolkit.html` page shell + `css/toolkit.css`

**Files:**
- Create: `toolkit.html`
- Create: `css/toolkit.css`

**Interfaces:**
- Produces: the exact DOM ids and classes that Task 5's `toolkit.js` queries via `getElementById`/class selectors (listed in full in Task 5's contract test). Any id renamed here must be renamed identically in Task 5.
- Consumes: `css/base.css`, `css/nav.css` (existing, shared across all pages), and reuses the existing `.button`/`.button--primary` classes from `css/base.css` for modal submit/cancel buttons, and the existing `@keyframes breathe` from `css/base.css` for the header glow.

- [ ] **Step 1: Create `toolkit.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Toolkit</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/toolkit.css" />
</head>
<body>
  <canvas id="toolkitGalaxyCanvas" class="toolkit-canvas" aria-hidden="true"></canvas>

  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html" aria-current="page">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="toolkit-page container">
    <div class="toolkit-header">
      <span class="toolkit-header__glow" aria-hidden="true"></span>
      <h1 class="toolkit-header__title">Toolkit</h1>
    </div>

    <div class="toolkit-auth">
      <button id="toolkitLoginButton" class="toolkit-login-btn" type="button" hidden>Log In</button>
      <button id="toolkitLogoutButton" class="toolkit-logout-btn" type="button" hidden>Log Out</button>
    </div>

    <div class="toolkit-divider"></div>

    <section aria-labelledby="toolkitSkillsHeading">
      <div class="toolkit-section-header">
        <h2 id="toolkitSkillsHeading" class="toolkit-section-title">Skills</h2>
        <button id="toolkitAddSkillButton" class="toolkit-add-btn" type="button" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          添加 Skill
        </button>
      </div>
      <div id="toolkitSkillsList" class="toolkit-skills"></div>
    </section>

    <div class="toolkit-divider"></div>

    <section aria-labelledby="toolkitProjectsHeading">
      <div class="toolkit-section-header">
        <h2 id="toolkitProjectsHeading" class="toolkit-section-title">Vibe Coding Projects</h2>
        <button id="toolkitAddProjectButton" class="toolkit-add-btn" type="button" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          添加 Project
        </button>
      </div>
      <div id="toolkitProjectsGrid" class="toolkit-projects"></div>
    </section>

    <p id="toolkitStatus" class="toolkit-empty" role="status" aria-live="polite">Loading toolkit…</p>
  </main>

  <div id="toolkitSkillDialogBackdrop" class="toolkit-modal-backdrop" hidden>
    <div id="toolkitSkillDialog" class="toolkit-modal" role="dialog" aria-modal="true" aria-labelledby="toolkitSkillDialogTitle">
      <div class="toolkit-modal__header">
        <h2 id="toolkitSkillDialogTitle">添加 Skill</h2>
        <button id="toolkitSkillDialogClose" class="toolkit-modal__close" type="button" aria-label="关闭">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <form id="toolkitSkillForm" class="toolkit-form" novalidate>
        <div class="toolkit-form__field">
          <label for="toolkitSkillName">Skill 名称</label>
          <input id="toolkitSkillName" name="name" type="text" placeholder="例如：context-snapshot" required />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitSkillUrl">GitHub 链接</label>
          <input id="toolkitSkillUrl" name="url" type="url" placeholder="https://github.com/..." required />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitSkillDesc">描述</label>
          <input id="toolkitSkillDesc" name="description" type="text" placeholder="简短描述这个 Skill 的作用..." />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitSkillTagField">标签（按回车添加）</label>
          <div id="toolkitSkillTagsInput" class="toolkit-tags-input">
            <input id="toolkitSkillTagField" class="toolkit-tag-field" type="text" placeholder="Context, Migration..." />
          </div>
        </div>
        <p id="toolkitSkillError" class="toolkit-form__error" role="alert" hidden></p>
        <div class="toolkit-form__actions">
          <button id="toolkitSkillCancel" class="button" type="button">取消</button>
          <button class="button button--primary" type="submit">添加</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toolkitProjectDialogBackdrop" class="toolkit-modal-backdrop" hidden>
    <div id="toolkitProjectDialog" class="toolkit-modal" role="dialog" aria-modal="true" aria-labelledby="toolkitProjectDialogTitle">
      <div class="toolkit-modal__header">
        <h2 id="toolkitProjectDialogTitle">添加 Project</h2>
        <button id="toolkitProjectDialogClose" class="toolkit-modal__close" type="button" aria-label="关闭">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <form id="toolkitProjectForm" class="toolkit-form" novalidate>
        <div class="toolkit-form__field">
          <label for="toolkitProjectName">项目名称</label>
          <input id="toolkitProjectName" name="name" type="text" placeholder="例如：AI 数据工作流" required />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitProjectUrl">GitHub 链接</label>
          <input id="toolkitProjectUrl" name="url" type="url" placeholder="https://github.com/..." required />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitProjectDesc">项目描述</label>
          <textarea id="toolkitProjectDesc" name="description" placeholder="描述这个项目的功能和亮点..."></textarea>
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitProjectTagField">标签 / 徽章（按回车添加）</label>
          <div id="toolkitProjectTagsInput" class="toolkit-tags-input">
            <input id="toolkitProjectTagField" class="toolkit-tag-field" type="text" placeholder="人工干预减少 80%..." />
          </div>
        </div>
        <p id="toolkitProjectError" class="toolkit-form__error" role="alert" hidden></p>
        <div class="toolkit-form__actions">
          <button id="toolkitProjectCancel" class="button" type="button">取消</button>
          <button class="button button--primary" type="submit">添加</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toolkitLoginDialogBackdrop" class="toolkit-modal-backdrop" hidden>
    <div id="toolkitLoginDialog" class="toolkit-modal" role="dialog" aria-modal="true" aria-labelledby="toolkitLoginDialogTitle">
      <div class="toolkit-modal__header">
        <h2 id="toolkitLoginDialogTitle">Log In</h2>
        <button id="toolkitLoginDialogClose" class="toolkit-modal__close" type="button" aria-label="Close login">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <form id="toolkitLoginForm" class="toolkit-form">
        <div class="toolkit-form__field">
          <label for="toolkitEmail">Email</label>
          <input id="toolkitEmail" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="toolkit-form__field">
          <label for="toolkitPassword">Password</label>
          <input id="toolkitPassword" name="password" type="password" autocomplete="current-password" required />
        </div>
        <p id="toolkitLoginError" class="toolkit-form__error" role="alert" hidden></p>
        <div class="toolkit-form__actions">
          <button id="toolkitLoginCancel" class="button" type="button">Cancel</button>
          <button class="button button--primary" type="submit">Log In</button>
        </div>
      </form>
    </div>
  </div>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
  <script type="module" src="js/toolkit.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/toolkit.css`**

```css
/* Toolkit page: header glow, galaxy background canvas, skills list,
   projects grid, and shared modal/form styles. */

.toolkit-canvas {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.toolkit-page {
  padding: var(--space-5) 0 var(--space-6);
}

.toolkit-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.toolkit-header__glow {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 47, 167, 0.9), transparent 70%);
  animation: breathe 4s ease-in-out infinite alternate;
}

.toolkit-header__title {
  font-size: 2.4rem;
}

.toolkit-auth {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.toolkit-login-btn,
.toolkit-logout-btn {
  background: none;
  border: none;
  padding: var(--space-1) var(--space-2);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.toolkit-login-btn:hover,
.toolkit-logout-btn:hover {
  color: var(--color-klein-blue);
}

.toolkit-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
  margin: var(--space-4) 0;
}

.toolkit-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.toolkit-section-title {
  font-size: 1.6rem;
}

.toolkit-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.toolkit-add-btn:hover {
  color: var(--color-klein-blue);
}

.toolkit-add-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.toolkit-skills {
  display: flex;
  flex-direction: column;
}

.skill-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-fast), padding var(--transition-fast);
}

.skill-row:last-child {
  border-bottom: none;
}

.skill-row:hover {
  background: rgba(0, 47, 167, 0.03);
  padding-left: 12px;
  padding-right: 12px;
  margin: 0 -12px;
  border-radius: var(--radius-md);
}

.skill-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.skill-desc {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.skill-row__end {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.skill-tags {
  display: flex;
  gap: 10px;
}

.skill-tag {
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.skill-delete,
.project-delete {
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.skill-delete:hover,
.project-delete:hover {
  color: #b3261e;
}

.skill-delete svg,
.project-delete svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.toolkit-projects {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.project-card {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.1);
}

.project-card__link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.project-content {
  padding: var(--space-3);
}

.project-name {
  font-size: 1.1rem;
  margin-bottom: var(--space-1);
}

.project-desc {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.project-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.project-badge {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--color-klein-blue-soft);
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  color: var(--color-klein-blue);
}

.project-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  opacity: 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  transition: opacity var(--transition-fast);
}

.project-card:hover .project-delete {
  opacity: 1;
}

.toolkit-empty {
  text-align: center;
  padding: var(--space-4) 0;
  color: var(--color-text-muted);
}

.toolkit-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 10, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  z-index: 100;
}

.toolkit-modal-backdrop[hidden] {
  display: none;
}

.toolkit-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--space-4);
}

.toolkit-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.toolkit-modal__header h2 {
  margin: 0;
  font-size: 1.3rem;
}

.toolkit-modal__close {
  background: none;
  border: none;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
}

.toolkit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.toolkit-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.toolkit-form__field input,
.toolkit-form__field textarea {
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: var(--color-bg);
  color: var(--color-text);
}

.toolkit-form__field textarea {
  resize: vertical;
  min-height: 70px;
}

.toolkit-tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: var(--color-bg);
  min-height: 44px;
  align-items: center;
}

.toolkit-tags-input:focus-within {
  border-color: var(--color-klein-blue);
}

.toolkit-tag-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-klein-blue-soft);
  font-size: 0.7rem;
  color: var(--color-klein-blue);
}

.toolkit-tag-chip__remove {
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.toolkit-tag-field {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.85rem;
  color: var(--color-text);
  flex: 1;
  min-width: 80px;
  padding: 4px;
}

.toolkit-form__error {
  color: #b3261e;
  font-size: 0.8rem;
  margin: 0;
}

.toolkit-form__error[hidden] {
  display: none;
}

.toolkit-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 768px) {
  .toolkit-projects {
    grid-template-columns: 1fr;
  }

  .skill-main {
    flex-direction: column;
    gap: 2px;
  }

  .skill-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .skill-row__end {
    align-self: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toolkit-header__glow {
    animation: none;
  }
}
```

- [ ] **Step 3: Verify the page loads without errors (no JS wired up yet)**

Run: `python3 -m http.server 8000` from the project root (skip if already running), then open `http://localhost:8000/toolkit.html`.
Expected: page renders with nav, title, empty sections showing "Loading toolkit…", no console errors about missing CSS. (The `toolkit.js` 404 in the console at this point is expected — it's created in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add toolkit.html css/toolkit.css
git commit -m "feat: add Toolkit page shell and styles"
```

---

### Task 5: `toolkit.js` — auth, rendering, galaxy canvas, and a contract test

**Files:**
- Create: `js/toolkit.js`
- Test: `js/toolkit-contract.test.mjs`

**Interfaces:**
- Consumes: `buildItemSubmission`, `emptyStateHTML`, `projectCardHTML`, `skillRowHTML`, `supabaseRowToItem` from `./toolkit-model.mjs` (Task 2); `deleteToolkitProject`, `deleteToolkitSkill`, `fetchToolkitProjects`, `fetchToolkitSkills`, `insertToolkitProject`, `insertToolkitSkill` from `./toolkit-supabase.js` (Task 3); `getSession`, `onAuthStateChange`, `signIn`, `signOut` from `./diary-supabase.js` (existing); the exact DOM ids created in `toolkit.html` (Task 4).
- Produces: nothing consumed by later tasks — this is the final wiring layer.

- [ ] **Step 1: Write `js/toolkit.js`**

```javascript
import {
  buildItemSubmission,
  emptyStateHTML,
  projectCardHTML,
  skillRowHTML,
  supabaseRowToItem,
} from './toolkit-model.mjs';
import {
  deleteToolkitProject,
  deleteToolkitSkill,
  fetchToolkitProjects,
  fetchToolkitSkills,
  insertToolkitProject,
  insertToolkitSkill,
} from './toolkit-supabase.js';
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
} from './diary-supabase.js';

let isLoggedIn = false;
let skills = [];
let projects = [];
let skillTags = [];
let projectTags = [];

const skillsList = document.getElementById('toolkitSkillsList');
const projectsGrid = document.getElementById('toolkitProjectsGrid');
const statusEl = document.getElementById('toolkitStatus');

const loginButton = document.getElementById('toolkitLoginButton');
const logoutButton = document.getElementById('toolkitLogoutButton');
const addSkillButton = document.getElementById('toolkitAddSkillButton');
const addProjectButton = document.getElementById('toolkitAddProjectButton');

const skillDialogBackdrop = document.getElementById('toolkitSkillDialogBackdrop');
const skillForm = document.getElementById('toolkitSkillForm');
const skillNameInput = document.getElementById('toolkitSkillName');
const skillUrlInput = document.getElementById('toolkitSkillUrl');
const skillDescInput = document.getElementById('toolkitSkillDesc');
const skillTagsInput = document.getElementById('toolkitSkillTagsInput');
const skillTagField = document.getElementById('toolkitSkillTagField');
const skillErrorEl = document.getElementById('toolkitSkillError');
const skillCancelButton = document.getElementById('toolkitSkillCancel');
const skillDialogCloseButton = document.getElementById('toolkitSkillDialogClose');

const projectDialogBackdrop = document.getElementById('toolkitProjectDialogBackdrop');
const projectForm = document.getElementById('toolkitProjectForm');
const projectNameInput = document.getElementById('toolkitProjectName');
const projectUrlInput = document.getElementById('toolkitProjectUrl');
const projectDescInput = document.getElementById('toolkitProjectDesc');
const projectTagsInput = document.getElementById('toolkitProjectTagsInput');
const projectTagField = document.getElementById('toolkitProjectTagField');
const projectErrorEl = document.getElementById('toolkitProjectError');
const projectCancelButton = document.getElementById('toolkitProjectCancel');
const projectDialogCloseButton = document.getElementById('toolkitProjectDialogClose');

const loginDialogBackdrop = document.getElementById('toolkitLoginDialogBackdrop');
const loginForm = document.getElementById('toolkitLoginForm');
const emailInput = document.getElementById('toolkitEmail');
const passwordInput = document.getElementById('toolkitPassword');
const loginErrorEl = document.getElementById('toolkitLoginError');
const loginCancelButton = document.getElementById('toolkitLoginCancel');
const loginDialogCloseButton = document.getElementById('toolkitLoginDialogClose');

function renderSkills() {
  skillsList.innerHTML = skills.length
    ? skills.map((skill) => skillRowHTML(skill, isLoggedIn)).join('')
    : emptyStateHTML('还没有 Skill，点击右上角「添加 Skill」开始收藏吧');
}

function renderProjects() {
  projectsGrid.innerHTML = projects.length
    ? projects.map((project) => projectCardHTML(project, isLoggedIn)).join('')
    : emptyStateHTML('还没有 Project，点击右上角「添加 Project」开始收藏吧');
}

function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  loginButton.hidden = isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  addSkillButton.hidden = !isLoggedIn;
  addProjectButton.hidden = !isLoggedIn;
  renderSkills();
  renderProjects();
}

async function loadToolkitData() {
  statusEl.hidden = false;
  statusEl.textContent = 'Loading toolkit…';
  try {
    const [skillRows, projectRows] = await Promise.all([
      fetchToolkitSkills(),
      fetchToolkitProjects(),
    ]);
    skills = skillRows.map(supabaseRowToItem);
    projects = projectRows.map(supabaseRowToItem);
    renderSkills();
    renderProjects();
    statusEl.hidden = true;
  } catch (error) {
    statusEl.textContent = `Failed to load toolkit: ${error.message}`;
  }
}

function updateTagsDisplay(container, field, tags) {
  container.querySelectorAll('.toolkit-tag-chip').forEach((chip) => chip.remove());
  tags.forEach((tag, index) => {
    const chip = document.createElement('span');
    chip.className = 'toolkit-tag-chip';
    chip.innerHTML = `${tag}<span class="toolkit-tag-chip__remove" data-index="${index}">×</span>`;
    container.insertBefore(chip, field);
  });
}

function handleTagFieldKeydown(field, tags, container) {
  return (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = field.value.trim();
    if (value && !tags.includes(value)) {
      tags.push(value);
      field.value = '';
      updateTagsDisplay(container, field, tags);
    }
  };
}

function handleTagsContainerClick(tags, container, field) {
  return (event) => {
    if (!event.target.classList.contains('toolkit-tag-chip__remove')) return;
    const index = Number(event.target.dataset.index);
    tags.splice(index, 1);
    updateTagsDisplay(container, field, tags);
  };
}

skillTagField.addEventListener('keydown', handleTagFieldKeydown(skillTagField, skillTags, skillTagsInput));
skillTagsInput.addEventListener('click', handleTagsContainerClick(skillTags, skillTagsInput, skillTagField));

projectTagField.addEventListener('keydown', handleTagFieldKeydown(projectTagField, projectTags, projectTagsInput));
projectTagsInput.addEventListener('click', handleTagsContainerClick(projectTags, projectTagsInput, projectTagField));

function openSkillDialog() {
  skillDialogBackdrop.hidden = false;
  skillNameInput.focus();
}

function closeSkillDialog() {
  skillDialogBackdrop.hidden = true;
  skillForm.reset();
  skillTags = [];
  updateTagsDisplay(skillTagsInput, skillTagField, skillTags);
  skillErrorEl.hidden = true;
}

function openProjectDialog() {
  projectDialogBackdrop.hidden = false;
  projectNameInput.focus();
}

function closeProjectDialog() {
  projectDialogBackdrop.hidden = true;
  projectForm.reset();
  projectTags = [];
  updateTagsDisplay(projectTagsInput, projectTagField, projectTags);
  projectErrorEl.hidden = true;
}

function openLoginDialog() {
  loginDialogBackdrop.hidden = false;
  emailInput.focus();
}

function closeLoginDialog() {
  loginDialogBackdrop.hidden = true;
  loginForm.reset();
  loginErrorEl.hidden = true;
}

addSkillButton.addEventListener('click', openSkillDialog);
skillCancelButton.addEventListener('click', closeSkillDialog);
skillDialogCloseButton.addEventListener('click', closeSkillDialog);
skillDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === skillDialogBackdrop) closeSkillDialog();
});

addProjectButton.addEventListener('click', openProjectDialog);
projectCancelButton.addEventListener('click', closeProjectDialog);
projectDialogCloseButton.addEventListener('click', closeProjectDialog);
projectDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === projectDialogBackdrop) closeProjectDialog();
});

loginButton.addEventListener('click', openLoginDialog);
loginCancelButton.addEventListener('click', closeLoginDialog);
loginDialogCloseButton.addEventListener('click', closeLoginDialog);
loginDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === loginDialogBackdrop) closeLoginDialog();
});

logoutButton.addEventListener('click', async () => {
  await signOut();
});

skillForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submission = buildItemSubmission({
    name: skillNameInput.value,
    url: skillUrlInput.value,
    description: skillDescInput.value,
    tags: skillTags,
  });
  if (!submission.valid) {
    skillErrorEl.textContent = submission.errors.join(' ');
    skillErrorEl.hidden = false;
    return;
  }
  try {
    await insertToolkitSkill(submission.row);
    closeSkillDialog();
    await loadToolkitData();
  } catch (error) {
    skillErrorEl.textContent = error.message;
    skillErrorEl.hidden = false;
  }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submission = buildItemSubmission({
    name: projectNameInput.value,
    url: projectUrlInput.value,
    description: projectDescInput.value,
    tags: projectTags,
  });
  if (!submission.valid) {
    projectErrorEl.textContent = submission.errors.join(' ');
    projectErrorEl.hidden = false;
    return;
  }
  try {
    await insertToolkitProject(submission.row);
    closeProjectDialog();
    await loadToolkitData();
  } catch (error) {
    projectErrorEl.textContent = error.message;
    projectErrorEl.hidden = false;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await signIn(emailInput.value, passwordInput.value);
    closeLoginDialog();
  } catch {
    loginErrorEl.textContent = 'Incorrect email or password.';
    loginErrorEl.hidden = false;
  }
});

skillsList.addEventListener('click', async (event) => {
  const button = event.target.closest('.skill-delete');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (!window.confirm('确定要删除这个 Skill 吗？')) return;
  await deleteToolkitSkill(button.dataset.id);
  await loadToolkitData();
});

projectsGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('.project-delete');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (!window.confirm('确定要删除这个 Project 吗？')) return;
  await deleteToolkitProject(button.dataset.id);
  await loadToolkitData();
});

// ===== Galaxy background =====
(function setupGalaxyCanvas() {
  const canvas = document.getElementById('toolkitGalaxyCanvas');
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let width;
  let height;
  let stars = [];
  const mouse = { x: -1000, y: -1000 };

  const STAR_COUNT = 110;
  const COLORS = ['#002FA7', '#1a4fc7', '#335fc2'];
  const MOUSE_INFLUENCE = 130;

  class Star {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.baseX = this.x;
      this.baseY = this.y;
      this.size = Math.random() * 1.8 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.02;
      this.vy = (Math.random() - 0.5) * 0.02;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.alpha = Math.random() * 0.3 + 0.12;
      this.twinkle = Math.random() * Math.PI * 2;
      this.twinkleSpeed = Math.random() * 0.02 + 0.01;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;

      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_INFLUENCE) {
        const force = (MOUSE_INFLUENCE - dist) / MOUSE_INFLUENCE;
        this.x += (dx / dist) * force * 2;
        this.y += (dy / dist) * force * 2;
      }

      this.x += (this.baseX - this.x) * 0.01;
      this.y += (this.baseY - this.y) * 0.01;
      this.twinkle += this.twinkleSpeed;
    }

    draw() {
      const twinkleAlpha = this.alpha * (0.6 + 0.4 * Math.sin(this.twinkle));
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `${this.color}${Math.floor(twinkleAlpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    stars.forEach((star) => {
      star.update();
      star.draw();
    });
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.strokeStyle = `rgba(0, 47, 167, ${0.06 * (1 - dist / 90)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }

  resize();
  stars = Array.from({ length: STAR_COUNT }, () => new Star());
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  animate();
})();

onAuthStateChange((session) => applyAuthState(session));
getSession().then(applyAuthState);
loadToolkitData();
```

- [ ] **Step 2: Write the failing contract test**

Create `js/toolkit-contract.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Toolkit page wires the ids and script that toolkit.js depends on', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../toolkit.html', import.meta.url), 'utf8'),
    readFile(new URL('./toolkit.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<link rel="stylesheet" href="css\/toolkit\.css" \/>/);
  assert.match(html, /<canvas id="toolkitGalaxyCanvas"/);
  assert.match(html, /<script type="module" src="js\/toolkit\.js">/);
  assert.match(html, /href="toolkit\.html" aria-current="page"/);

  const requiredIds = [
    'toolkitGalaxyCanvas',
    'toolkitSkillsList',
    'toolkitProjectsGrid',
    'toolkitStatus',
    'toolkitLoginButton',
    'toolkitLogoutButton',
    'toolkitAddSkillButton',
    'toolkitAddProjectButton',
    'toolkitSkillDialogBackdrop',
    'toolkitSkillForm',
    'toolkitSkillName',
    'toolkitSkillUrl',
    'toolkitSkillDesc',
    'toolkitSkillTagsInput',
    'toolkitSkillTagField',
    'toolkitSkillError',
    'toolkitSkillCancel',
    'toolkitSkillDialogClose',
    'toolkitProjectDialogBackdrop',
    'toolkitProjectForm',
    'toolkitProjectName',
    'toolkitProjectUrl',
    'toolkitProjectDesc',
    'toolkitProjectTagsInput',
    'toolkitProjectTagField',
    'toolkitProjectError',
    'toolkitProjectCancel',
    'toolkitProjectDialogClose',
    'toolkitLoginDialogBackdrop',
    'toolkitLoginForm',
    'toolkitEmail',
    'toolkitPassword',
    'toolkitLoginError',
    'toolkitLoginCancel',
    'toolkitLoginDialogClose',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `expected toolkit.html to contain id="${id}"`);
  }

  const idsScriptShouldReference = requiredIds.filter((id) => id !== 'toolkitGalaxyCanvas');
  for (const id of idsScriptShouldReference) {
    assert.match(
      script,
      new RegExp(`getElementById\\('${id}'\\)`),
      `expected toolkit.js to reference getElementById('${id}')`,
    );
  }
  assert.match(script, /getElementById\('toolkitGalaxyCanvas'\)/);
});
```

- [ ] **Step 3: Run the test**

Run: `node --test js/toolkit-contract.test.mjs`
Expected: PASS — the test was written after `toolkit.js` and `toolkit.html`, so it should pass immediately. If it fails, it means an id in one file doesn't match the other — fix the mismatch (do not weaken the test).

- [ ] **Step 4: Run the full existing test suite to confirm no regressions**

Run: `node --test js/*.test.mjs`
Expected: PASS — all pre-existing tests plus the new `toolkit-model.test.mjs` and `toolkit-contract.test.mjs` are green.

- [ ] **Step 5: Commit**

```bash
git add js/toolkit.js js/toolkit-contract.test.mjs
git commit -m "feat: wire up Toolkit page auth, rendering, and galaxy background"
```

---

### Task 6: Apply the migration and verify end-to-end in the browser

**Files:** none (manual verification against the live Supabase project and a local static server).

**Interfaces:** none — this task only verifies Tasks 1–5 work together.

- [ ] **Step 1: Apply the migration**

Open the Supabase project's SQL editor (same project as `SUPABASE_URL` in `js/diary-supabase.js`) and run the full contents of `supabase/toolkit.sql`.
Expected: two new tables (`toolkit_skills`, `toolkit_projects`) appear in the Table Editor, each with RLS enabled and 4 policies.

- [ ] **Step 2: Serve the site locally**

Run: `python3 -m http.server 8000` from the project root (skip if a server is already running there).

- [ ] **Step 3: Verify the logged-out view**

Open `http://localhost:8000/toolkit.html`.
Expected: page loads with the galaxy background visible behind the cream page content, "Log In" button visible, "添加 Skill"/"添加 Project" buttons hidden, both sections show their empty-state message (since the tables are empty), no console errors.

- [ ] **Step 4: Verify login and adding a Skill**

Click "Log In", enter the owner email/password (same credentials used for Study Diary), submit.
Expected: modal closes, "Log In" becomes "Log Out", "添加 Skill"/"添加 Project" buttons appear. Click "添加 Skill", fill in name/URL, add two tags via Enter, submit.
Expected: modal closes, the Skills list now shows one row with the name, tags, and (since logged in) a delete button; reloading the page still shows it (confirms it persisted to Supabase, not just local state).

- [ ] **Step 5: Verify adding a Project and deleting both**

Click "添加 Project", fill in name/URL/description, add a tag, submit.
Expected: the Projects grid shows one card with a delete button visible on hover.
Delete the skill row and the project card (confirming each `confirm()` dialog).
Expected: both sections return to their empty-state message; reloading the page still shows both empty (confirms deletion persisted).

- [ ] **Step 6: Verify logged-out visitors can view but not edit**

Click "Log Out". Add a skill and a project again while logged in, then open the same URL in a private/incognito window (logged out).
Expected: the incognito view shows the Skill and Project you just added (public `select` works) but no "添加"/delete buttons (RLS + UX gating both confirmed).
