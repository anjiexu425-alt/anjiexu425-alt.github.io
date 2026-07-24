import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Share Life local acceptance fixture is deterministic and isolated from Supabase', async () => {
  const html = await readFile(new URL('../share-life-fixture.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('./share-life-fixture.js', import.meta.url), 'utf8');

  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/share-life\.css"/i);
  assert.match(
    html,
    /<script\b[^>]*type="module"[^>]*src="js\/share-life-fixture\.js"[^>]*><\/script>/i,
  );
  assert.match(html, />\s*Local acceptance fixture\s*</i);
  assert.match(html, /\bid="shareLifeFixtureAuthToggle"/i);

  assert.match(script, /from\s+['"]\.\/share-life-model\.mjs['"]/);
  assert.match(script, /const\s+FIXTURE_NOTES\s*=\s*Object\.freeze\(\s*\[/);
  assert.ok(
    (script.match(/\bid:\s*['"]fixture-note-\d+['"]/g) ?? []).length >= 3,
    'fixture should seed at least three in-memory notes',
  );
  assert.match(script, /<img src=x onerror='alert\(1\)'> Fixture safety title/);
  assert.match(script, /title\.textContent\s*=\s*view\.titleText/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.doesNotMatch(script, /\blocalStorage\b/);
  assert.doesNotMatch(script, /shareLifeLikedNoteIds/);

  const fixtureSource = `${html}\n${script}`;
  assert.doesNotMatch(fixtureSource, /supabase(?:\.co|-js|\/supabase)|diary-supabase|share-life-supabase/i);
  assert.doesNotMatch(fixtureSource, /\.from\(\s*['"]share_life_notes['"]\s*\)/i);
});

test('Share Life fixture only captures real card drags and suppresses their immediate link click', async () => {
  const script = await readFile(new URL('./share-life-fixture.js', import.meta.url), 'utf8');
  const pointerDownStart = script.indexOf("viewport.addEventListener('pointerdown'");
  const pointerMoveStart = script.indexOf("viewport.addEventListener('pointermove'");
  const finishDragStart = script.indexOf('const finishDrag');
  const pointerUpStart = script.indexOf("viewport.addEventListener('pointerup'");
  const pointerDownHandler = script.slice(pointerDownStart, pointerMoveStart);
  const pointerMoveHandler = script.slice(pointerMoveStart, finishDragStart);
  const finishDragHandler = script.slice(finishDragStart, pointerUpStart);

  assert.ok(pointerDownStart >= 0 && pointerMoveStart > pointerDownStart);
  assert.doesNotMatch(pointerDownHandler, /setPointerCapture/);
  assert.match(pointerDownHandler, /pointerStartedOnCardLink\s*=/);
  assert.match(pointerMoveHandler, /Math\.abs\(distance\)\s*>\s*4\s*&&\s*!isDragging/);
  assert.match(pointerMoveHandler, /viewport\.setPointerCapture\(event\.pointerId\)/);
  assert.match(pointerMoveHandler, /if\s*\(\s*!isDragging\s*\)\s*return/);
  assert.match(
    finishDragHandler,
    /shouldSuppressLink\s*=\s*isDragging\s*&&\s*pointerStartedOnCardLink/,
  );
  assert.match(finishDragHandler, /window\.setTimeout\(\(\)\s*=>\s*\{/);
  assert.match(
    script,
    /viewport\.addEventListener\(\s*['"]click['"][\s\S]*?suppressNextCardLinkClick[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)[\s\S]*?\},\s*true\s*\)/,
  );
});

test('Share Life fixture restores the current cover after invalid or unreadable selections', async () => {
  const script = await readFile(new URL('./share-life-fixture.js', import.meta.url), 'utf8');
  const restoreStart = script.indexOf('function restoreCurrentCoverPreview');
  const readStart = script.indexOf('function readFileAsDataUrl');
  const changeStart = script.indexOf('async function handleCoverChange');
  const submitStart = script.indexOf('function handleNoteSubmit');
  const restoreHelper = script.slice(restoreStart, readStart);
  const changeHandler = script.slice(changeStart, submitStart);

  assert.ok(restoreStart >= 0 && readStart > restoreStart);
  assert.match(restoreHelper, /selectedCoverDataUrl\s*=\s*['"]/);
  assert.match(restoreHelper, /notes\.find\(\(note\)\s*=>\s*note\.id\s*===\s*noteIdInput\.value\)/);
  assert.match(restoreHelper, /coverPreview\.src\s*=\s*editingNote\?\.coverUrl\s*\|\|\s*PLACEHOLDER_URL/);

  const invalidStart = changeHandler.indexOf('if (!isShareLifeImageAllowed');
  const readTryStart = changeHandler.indexOf('try {', invalidStart);
  const invalidBranch = changeHandler.slice(invalidStart, readTryStart);
  assert.match(invalidBranch, /restoreCurrentCoverPreview\(\)/);

  const catchStart = changeHandler.indexOf('catch', readTryStart);
  const catchBranch = changeHandler.slice(catchStart);
  assert.match(catchBranch, /coverInput\.value\s*=\s*['"]/);
  assert.match(catchBranch, /restoreCurrentCoverPreview\(\)/);
  assert.match(catchBranch, /showFormError\(/);
  assert.match(script, /let\s+coverReadPending\s*=\s*false/);
  assert.match(script, /function\s+setCoverReadPending\s*\(/);
  assert.match(changeHandler, /setCoverReadPending\(true\)/);
  assert.match(changeHandler, /readGeneration\s*!==\s*coverReadGeneration/);
  assert.match(changeHandler, /setCoverReadPending\(false\)/);

  const submitHandler = script.slice(submitStart, script.indexOf('function handleDelete'));
  assert.match(submitHandler, /if\s*\(\s*coverReadPending\s*\)/);
  assert.match(submitHandler, /showFormError\(/);
});

test('Share Life production cover preview is generation-safe and restores the edited cover', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');
  const restoreStart = script.indexOf('function restoreCurrentCoverPreview');
  const readStart = script.indexOf('function readFileAsDataUrl');
  const changeStart = script.indexOf('async function handleCoverChange');
  const configureStart = script.indexOf('function configureModalInteractions');
  const restoreHelper = script.slice(restoreStart, readStart);
  const changeHandler = script.slice(changeStart, configureStart);

  assert.ok(restoreStart >= 0 && readStart > restoreStart);
  assert.match(restoreHelper, /notes\.find\(\(note\)\s*=>\s*note\.id\s*===\s*noteIdInput\.value\)/);
  assert.match(restoreHelper, /existingNote\?\.coverUrl\s*\|\|\s*PLACEHOLDER_URL/);
  assert.match(script, /let\s+coverReadGeneration\s*=\s*0/);
  assert.match(script, /let\s+coverReadPending\s*=\s*false/);
  assert.match(script, /function\s+setCoverReadPending\s*\(/);
  assert.match(script, /new\s+FileReader\(\)/);
  assert.doesNotMatch(script, /URL\.createObjectURL/);

  const invalidStart = changeHandler.indexOf('if (!isShareLifeImageAllowed');
  const tryStart = changeHandler.indexOf('try {', invalidStart);
  const invalidBranch = changeHandler.slice(invalidStart, tryStart);
  assert.match(invalidBranch, /coverInput\.value\s*=\s*['"]/);
  assert.match(invalidBranch, /restoreCurrentCoverPreview\(\)/);

  const catchStart = changeHandler.indexOf('catch', tryStart);
  const catchBranch = changeHandler.slice(catchStart);
  assert.match(catchBranch, /readGeneration\s*!==\s*coverReadGeneration/);
  assert.match(catchBranch, /coverInput\.value\s*=\s*['"]/);
  assert.match(catchBranch, /restoreCurrentCoverPreview\(\)/);
  assert.match(changeHandler, /setCoverReadPending\(true\)/);
  assert.match(changeHandler, /setCoverReadPending\(false\)/);

  const submitStart = script.indexOf('async function handleNoteSubmit');
  const deleteStart = script.indexOf('async function handleDelete');
  const submitHandler = script.slice(submitStart, deleteStart);
  assert.match(submitHandler, /if\s*\(\s*coverReadPending\s*\)/);

  const closeStart = script.indexOf('function closeModal');
  const currentOperationStart = script.indexOf('function isCurrentModalOperation');
  const closeHelper = script.slice(closeStart, currentOperationStart);
  assert.match(closeHelper, /coverReadGeneration\s*\+=\s*1/);
  assert.match(closeHelper, /coverReadPending\s*=\s*false/);
});

test('Share Life page exposes its semantic and accessibility contract', async () => {
  const html = await readFile(new URL('../share-life.html', import.meta.url), 'utf8');

  assert.match(html, /<a\b[^>]*href="share-life\.html"[^>]*aria-current="page"[^>]*>\s*Share Life\s*<\/a>/i);
  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/base\.css"/i);
  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/nav\.css"/i);
  assert.match(html, /<link\b[^>]*rel="stylesheet"[^>]*href="css\/share-life\.css"/i);
  assert.match(html, /<script\b[^>]*src="js\/nav\.js"[^>]*><\/script>/i);
  assert.match(html, /<script\b[^>]*type="module"[^>]*src="js\/share-life\.js"[^>]*><\/script>/i);

  for (const id of [
    'shareLifeTrack',
    'shareLifeStatus',
    'shareLifeAddButton',
    'shareLifePrev',
    'shareLifeNext',
  ]) {
    assert.match(html, new RegExp(`\\bid="${id}"`));
  }

  assert.match(html, /<[^>]+\brole="dialog"[^>]+\baria-modal="true"[^>]+\baria-labelledby="shareLifeNoteDialogTitle"/i);
  assert.match(html, /<[^>]+\brole="dialog"[^>]+\baria-modal="true"[^>]+\baria-labelledby="shareLifeLoginDialogTitle"/i);
  assert.match(html, /<dt>\s*Followers\s*<\/dt>\s*<dd\b[^>]*id="shareLifeFollowersCount"/i);
  assert.match(html, /<dt>\s*Likes\s*<\/dt>\s*<dd\b[^>]*id="shareLifeLikesCount"/i);
  assert.match(html, /<dd\b[^>]*id="shareLifeLikesCount"[^>]*>\s*0\s*<\/dd>/i);
  assert.doesNotMatch(html, /\bid="shareLifeLikes"/i);
  assert.match(html, /<button\b[^>]*id="shareLifeAddButton"[^>]*\blang="zh-CN"/i);
  assert.match(html, /<div\b[^>]*id="shareLifeNoteDialog"[^>]*\blang="zh-CN"[\s\S]*?\brole="dialog"/i);

  for (const id of [
    'shareLifeTitle',
    'shareLifeDouyinUrl',
    'shareLifeCover',
    'shareLifeEmail',
    'shareLifePassword',
  ]) {
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"`, 'i'));
    assert.match(html, new RegExp(`<(?:input|textarea)\\b[^>]*id="${id}"`, 'i'));
  }

  const visibleText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const copy of [
    'Share Life &amp; Insights',
    '梦想是早日实现经济和精神双独立。',
    'Record growth in my 20s.',
    'AI Explorer｜anjiexu0630@163.com',
    'Followers',
    'Likes',
    '添加笔记',
  ]) {
    assert.ok(visibleText.includes(copy), `expected approved static copy: ${copy}`);
  }

  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\bonclick\s*=/i);
});

test('Share Life stylesheet preserves native scrolling and accessible motion', async () => {
  const css = await readFile(new URL('../css/share-life.css', import.meta.url), 'utf8');

  assert.match(css, /@media\s*\(\s*max-width\s*:\s*768px\s*\)/i);
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i);
  assert.match(css, /overflow-x\s*:\s*auto/i);
  assert.match(css, /scrollbar-width\s*:\s*none/i);
  assert.match(css, /::-webkit-scrollbar[\s\S]*?display\s*:\s*none/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /\.share-life-button\[hidden\]\s*\{[^}]*display\s*:\s*none/i);
  assert.match(css, /:root\s*\{[^}]*--share-life-border\s*:/i);
  assert.match(css, /--share-life-muted\s*:\s*var\(--color-text-muted\)/i);
  assert.doesNotMatch(css, /#85858a/i);
  assert.match(css, /\.share-life-card__likes\s*\{[^}]*min-width\s*:\s*2\.75rem[^}]*min-height\s*:\s*2\.75rem[^}]*border\s*:\s*0[^}]*background\s*:\s*transparent[^}]*font\s*:\s*inherit/i);
  assert.match(css, /\.share-life-card__likes:focus-visible\s*(?:,|\{)/i);
  assert.match(css, /\.share-life-card__likes svg\s*\{[^}]*width\s*:\s*0\.9rem[^}]*height\s*:\s*0\.9rem/i);
  assert.match(css, /\.share-life-card__manage svg\s*\{[^}]*width\s*:[^;}]+;[^}]*height\s*:/i);
  assert.doesNotMatch(css, /backdrop-filter\s*:/i);
});

test('Share Life Supabase schema has its required security contract', async () => {
  const sql = await readFile(new URL('../supabase/share-life.sql', import.meta.url), 'utf8');
  const policyBlock = (name) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = sql.match(new RegExp(`create policy\\s+"${escapedName}"[\\s\\S]*?;`, 'i'));
    assert.ok(match, `expected policy ${name}`);
    return match[0];
  };
  const assertOwnerPredicate = (block, minimumCount = 1) => {
    const matches = block.match(
      /auth\.jwt\(\)\s*->>\s*'email'\s*=\s*'anjiexu0630@163\.com'/gi,
    ) ?? [];
    assert.ok(
      matches.length >= minimumCount,
      `expected owner email predicate ${minimumCount} time(s) in:\n${block}`,
    );
  };

  assert.match(sql, /create table if not exists public\.share_life_notes/i);
  assert.match(sql, /likes_count bigint not null default 0/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /create or replace function public\.adjust_share_life_like/i);
  assert.match(
    sql,
    /create or replace function public\.adjust_share_life_like[\s\S]*?security definer[\s\S]*?set search_path\s*=\s*public/i,
  );
  assert.match(sql, /delta is null/i);
  assert.match(sql, /delta not in \(-1,\s*1\)/i);
  assert.match(sql, /greatest\(0,\s*likes_count \+ delta\)/i);
  assert.match(
    sql,
    /revoke execute on function public\.adjust_share_life_like\(uuid,\s*integer\) from public/i,
  );
  assert.match(sql, /grant execute .* to anon,\s*authenticated/i);
  assert.match(sql, /share-life-media/i);
  assert.match(sql, /cover_path\s+text(?:\s*,|\s*\n)/i);
  assert.doesNotMatch(sql, /cover_path\s+text\s+not\s+null/i);
  assert.match(
    sql,
    /alter table\s+public\.share_life_notes\s+alter column\s+cover_path\s+drop not null/i,
  );
  assert.doesNotMatch(sql, /for update\s+to anon/i);

  assert.match(
    sql,
    /alter table\s+public\.share_life_notes\s+drop constraint if exists\s+share_life_notes_title_length_check/i,
  );
  assert.match(
    sql,
    /add constraint\s+share_life_notes_title_length_check\s+check\s*\(\s*char_length\(\s*btrim\(title\)\s*\)\s+between\s+1\s+and\s+160\s*\)/i,
  );
  assert.doesNotMatch(sql, /char_length\(\s*title\s*\)\s+between/i);
  assert.match(sql, /create or replace function public\.set_share_life_updated_at\(\)/i);
  assert.match(sql, /new\.updated_at\s*:=\s*now\(\)/i);
  assert.match(sql, /drop trigger if exists\s+set_share_life_updated_at\s+on\s+public\.share_life_notes/i);
  assert.match(
    sql,
    /create trigger\s+set_share_life_updated_at\s+before update on\s+public\.share_life_notes[\s\S]*?for each row[\s\S]*?execute function\s+public\.set_share_life_updated_at\(\)/i,
  );

  for (const name of [
    'Authenticated users can create Share Life notes',
    'Authenticated users can edit Share Life notes',
    'Authenticated users can delete Share Life notes',
  ]) {
    const block = policyBlock(name);
    assert.match(block, /to authenticated/i);
    assertOwnerPredicate(block, name.includes('edit') ? 2 : 1);
  }

  for (const name of [
    'Authenticated users can upload Share Life media',
    'Authenticated users can update Share Life media',
    'Authenticated users can delete Share Life media',
  ]) {
    const block = policyBlock(name);
    assert.match(block, /to authenticated/i);
    const minimumCount = name.includes('update') ? 2 : 1;
    assertOwnerPredicate(block, minimumCount);
    assert.ok(
      (block.match(/bucket_id\s*=\s*'share-life-media'/gi) ?? []).length >= minimumCount,
      `expected bucket scope ${minimumCount} time(s) in:\n${block}`,
    );
  }

  assert.match(
    policyBlock('Public can view Share Life notes'),
    /for select[\s\S]*?to public[\s\S]*?using\s*\(\s*true\s*\)/i,
  );
  assert.match(
    policyBlock('Public can view Share Life media'),
    /for select[\s\S]*?to public[\s\S]*?bucket_id\s*=\s*'share-life-media'/i,
  );
});

test('Share Life Supabase adapter reuses the shared client and required resources', async () => {
  const adapter = await readFile(new URL('./share-life-supabase.js', import.meta.url), 'utf8');

  assert.match(adapter, /import\s*\{\s*supabase\s*\}\s*from\s*['"]\.\/diary-supabase\.js['"]/i);
  assert.match(adapter, /const\s+TABLE\s*=\s*['"]share_life_notes['"]/i);
  assert.match(adapter, /\.from\(\s*TABLE\s*\)/i);
  assert.match(adapter, /\.order\(\s*['"]created_at['"]\s*,\s*\{\s*ascending\s*:\s*true\s*\}\s*\)/i);
  assert.match(adapter, /\.rpc\(\s*['"]adjust_share_life_like['"]/i);
  assert.match(adapter, /const\s+BUCKET\s*=\s*['"]share-life-media['"]/i);
  assert.match(adapter, /storage\.from\(\s*BUCKET\s*\)/i);
  assert.match(
    adapter,
    /\.delete\(\)\s*\.eq\(\s*['"]id['"]\s*,\s*id\s*\)\s*\.select\(\s*['"]id['"]\s*\)\s*\.single\(\)/i,
  );
  assert.match(adapter, /if\s*\(\s*data\?\.id\s*!==\s*id\s*\)\s*throw new Error\(/i);

  for (const name of [
    'fetchShareLifeNotes',
    'insertShareLifeNote',
    'updateShareLifeNote',
    'deleteShareLifeNote',
    'adjustShareLifeLike',
    'uploadShareLifeCover',
    'removeShareLifeCover',
  ]) {
    assert.match(adapter, new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
  }

  assert.doesNotMatch(adapter, /https:\/\/[^\s'"]+\.supabase\.co/i);
  assert.doesNotMatch(adapter, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
});

test('Share Life note modal submit copy changes between create and edit modes', async () => {
  for (const page of ['../share-life.html', '../share-life-fixture.html']) {
    const html = await readFile(new URL(page, import.meta.url), 'utf8');
    assert.match(
      html,
      /<button\b[^>]*id="shareLifeNoteSubmit"[^>]*type="submit"[^>]*>\s*添加\s*<\/button>/i,
    );
  }

  for (const modulePath of ['./share-life.js', './share-life-fixture.js']) {
    const script = await readFile(new URL(modulePath, import.meta.url), 'utf8');
    assert.match(script, /const\s+noteSubmit\s*=\s*document\.getElementById\(\s*['"]shareLifeNoteSubmit['"]\s*\)/);

    const createStart = modulePath.includes('fixture')
      ? script.indexOf('function openNoteDialog')
      : script.indexOf('function openCreateDialog');
    const createEnd = modulePath.includes('fixture')
      ? script.indexOf('function closeNoteDialog')
      : script.indexOf('function openEditDialog');
    const createBlock = script.slice(createStart, createEnd);
    assert.match(createBlock, /noteSubmit\.textContent\s*=\s*(?:note\s*\?\s*['"]保存更改['"]\s*:\s*)?['"]添加['"]/);

    if (!modulePath.includes('fixture')) {
      const editStart = script.indexOf('function openEditDialog');
      const editEnd = script.indexOf('function validateSelectedCover');
      assert.match(
        script.slice(editStart, editEnd),
        /noteSubmit\.textContent\s*=\s*['"]保存更改['"]/,
      );
    } else {
      assert.match(createBlock, /note\s*\?\s*['"]保存更改['"]\s*:\s*['"]添加['"]/);
    }
  }
});

test('Share Life production module uses safe DOM and shared data boundaries', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  for (const name of [
    'buildShareLifeCardView',
    'nextLikeIntent',
    'resolveScrollBehavior',
    'sumLikeCounts',
    'validateNoteFields',
    'isShareLifeImageAllowed',
    'buildShareLifeUploadPath',
    'canConsumeHorizontalWheel',
    'createDialogOperationToken',
    'isDialogOperationCurrent',
    'isMouseDragPointer',
    'mergeShareLifeNoteById',
    'resolveCreatedCover',
    'resolveEditedCover',
    'resolveFocusReturnTarget',
    'resolveFocusTrapTarget',
    'setLikedNoteId',
  ]) {
    assert.match(script, new RegExp(`\\b${name}\\b`));
  }

  for (const name of [
    'fetchShareLifeNotes',
    'insertShareLifeNote',
    'updateShareLifeNote',
    'deleteShareLifeNote',
    'adjustShareLifeLike',
    'uploadShareLifeCover',
    'removeShareLifeCover',
  ]) {
    assert.match(script, new RegExp(`\\b${name}\\b`));
  }

  for (const name of ['signIn', 'signOut', 'getSession', 'onAuthStateChange']) {
    assert.match(script, new RegExp(`\\b${name}\\b`));
  }

  assert.match(script, /document\.createElement\(/);
  assert.match(script, /\.textContent\s*=/);
  assert.match(script, /setAttribute\(\s*['"]aria-pressed['"]/);
  assert.match(script, /['"]noopener['"]/);
  assert.match(script, /shareLifeLikedNoteIds/);
  assert.match(script, /prefers-reduced-motion:\s*reduce/);
  assert.match(script, /addEventListener\(\s*['"]wheel['"]/);
  assert.match(script, /addEventListener\(\s*['"]pointerdown['"]/);
  assert.match(script, /event\.key\s*===\s*['"]Tab['"]/);
  assert.match(script, /event\.pointerType\s*!==\s*['"]mouse['"]/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.doesNotMatch(script, /\.outerHTML\s*=/);
  assert.doesNotMatch(script, /insertAdjacentHTML/);
});

test('Share Life create, modal, auth, and navigation contracts cover review races', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/share-life.css', import.meta.url), 'utf8');

  assert.match(script, /function\s+initializeAuth\s*\(/);
  assert.match(script, /function\s+loadShareLifeNotes\s*\(/);
  assert.match(script, /void\s+initializeAuth\s*\(\s*\)/);
  assert.match(script, /void\s+loadShareLifeNotes\s*\(\s*\)/);

  assert.match(script, /if\s*\(\s*view\.douyinUrl\s*\)/);
  assert.match(script, /share-life-card__link/);
  assert.match(css, /\.share-life-card__link\s*\{[^}]*position\s*:\s*absolute[^}]*inset\s*:\s*0/is);
  assert.match(css, /\.share-life-card__likes\s*\{[^}]*position\s*:\s*relative[^}]*z-index\s*:\s*2/is);

  assert.match(script, /const\s+editingId\s*=\s*noteIdInput\.value\s*\|\|\s*null/);
  assert.match(script, /createDialogOperationToken\(/);
  assert.match(script, /isDialogOperationCurrent\(/);
  assert.match(script, /resolveFocusReturnTarget\(/);
  assert.match(script, /resolveFocusTrapTarget\(/);
});

test('Share Life delete and like handlers preserve their required operation order', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');
  const deleteStart = script.indexOf('async function handleDelete');
  const likeStart = script.indexOf('async function handleLike');
  const deleteHandler = script.slice(deleteStart, likeStart);
  const likeEnd = script.indexOf('async function handleLoginSubmit');
  const likeHandler = script.slice(likeStart, likeEnd);

  assert.ok(deleteStart >= 0 && likeStart > deleteStart);
  const rowDelete = deleteHandler.indexOf('await deleteShareLifeNote');
  const localDelete = deleteHandler.indexOf('notes = notes.filter');
  const render = deleteHandler.indexOf('renderNotes()', localDelete);
  const cleanup = deleteHandler.indexOf('await removeShareLifeCover');
  assert.ok(rowDelete >= 0 && rowDelete < localDelete);
  assert.ok(localDelete < render);
  assert.ok(render < cleanup);
  assert.match(deleteHandler, /buildShareLifeCoverCleanupFailureMessage/);

  assert.match(likeHandler, /notes\.find\(\(candidate\)\s*=>\s*candidate\.id\s*===\s*noteId\)/);
  assert.match(likeHandler, /mergeShareLifeNoteById\(/);
  assert.match(likeHandler, /setLikedNoteId\([^;]+intent\.nextLiked/);
  assert.doesNotMatch(likeHandler, /\bnote\.likesCount\s*=/);
  assert.doesNotMatch(likeHandler, /toggleLikedNoteId\(/);
});

test('Share Life card surface keeps wheel and threshold drag available', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  assert.match(script, /function\s+isSliderControlTarget\s*\(/);
  assert.match(script, /closest\(\s*['"]\.share-life-card__link['"]\s*\)/);
  assert.match(script, /suppressNextCardLinkClick/);
  assert.match(script, /addEventListener\(\s*['"]click['"][\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)/);
  assert.match(script, /Math\.abs\(distance\)\s*>\s*4/);

  const wheelStart = script.indexOf("viewport.addEventListener('wheel'");
  const pointerStart = script.indexOf("viewport.addEventListener('pointerdown'");
  const wheelHandler = script.slice(wheelStart, pointerStart);
  assert.match(wheelHandler, /isSliderControlTarget\(event\.target\)/);
  assert.doesNotMatch(wheelHandler, /isInteractiveTarget\(event\.target\)/);
});

test('Share Life load epochs, readiness, and note mutation locks guard owner writes', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  for (const name of [
    'authKnown',
    'notesLoadEpoch',
    'notesLoadPending',
    'notesMutationRevision',
    'pendingNoteMutationIds',
    'canManageShareLifeNotes',
    'isFreshShareLifeNotesLoad',
    'canStartShareLifeNoteMutation',
  ]) {
    assert.match(script, new RegExp(`\\b${name}\\b`));
  }

  assert.match(script, /if\s*\(\s*notesLoadPending\s*\)\s*return/);
  assert.match(script, /const\s+mutationRevisionAtStart\s*=\s*notesMutationRevision/);
  assert.match(script, /loadEpoch\s*:\s*loadEpoch/);
  assert.match(script, /currentLoadEpoch\s*:\s*notesLoadEpoch/);
  assert.match(script, /mutationRevisionAtStart\s*:\s*mutationRevisionAtStart/);
  assert.match(script, /currentMutationRevision\s*:\s*notesMutationRevision/);
  assert.match(script, /retryButton\.disabled\s*=\s*true/);

  const renderChromeStart = script.indexOf('function renderChrome');
  const renderMessageStart = script.indexOf('function renderTrackMessage');
  const renderChrome = script.slice(renderChromeStart, renderMessageStart);
  assert.match(renderChrome, /authKnown/);
  assert.match(renderChrome, /canManageNotes/);

  const editStart = script.indexOf('async function editNote');
  const submitStart = script.indexOf('async function handleNoteSubmit');
  const submitEnd = script.indexOf('async function handleDelete');
  const submitHandler = script.slice(submitStart, submitEnd);
  const editFunction = script.slice(editStart, submitStart);
  assert.match(submitHandler, /pendingNoteMutationIds\.add\(editingId\)/);
  assert.match(submitHandler, /pendingNoteMutationIds\.delete\(editingId\)/);
  assert.match(editFunction, /mergeShareLifeNoteById/);

  const deleteEnd = script.indexOf('async function handleLike');
  const deleteHandler = script.slice(submitEnd, deleteEnd);
  assert.match(deleteHandler, /canStartShareLifeNoteMutation/);
  assert.match(deleteHandler, /pendingNoteMutationIds\.add\(/);
  assert.match(deleteHandler, /pendingNoteMutationIds\.delete\(/);
});

test('Share Life cleanup status combines fixed meaning with technical detail', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  assert.match(script, /buildShareLifeCoverCleanupFailureMessage/);
  assert.match(script, /status\.textContent\s*=\s*buildShareLifeCoverCleanupFailureMessage\(/);
  assert.match(script, /errorMessage\(error,\s*['"]{2}\)/);
});

test('Share Life card links disable native ghost dragging without losing navigation', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  assert.match(script, /link\.draggable\s*=\s*false/);
  assert.match(
    script,
    /link\.addEventListener\(\s*['"]dragstart['"]\s*,\s*\(event\)\s*=>\s*event\.preventDefault\(\)\s*\)/,
  );
  assert.match(script, /link\.href\s*=\s*view\.douyinUrl/);
  assert.match(script, /link\.target\s*=\s*['"]_blank['"]/);
  assert.match(script, /link\.setAttribute\(\s*['"]aria-label['"]/);
});

test('Share Life create lock outlives modal UI generations and always releases', async () => {
  const script = await readFile(new URL('./share-life.js', import.meta.url), 'utf8');

  assert.match(script, /let\s+createPending\s*=\s*false/);
  assert.match(script, /canStartShareLifeCreate/);
  assert.match(script, /addButton\.disabled\s*=\s*createPending/);

  const createOpenStart = script.indexOf('function openCreateDialog');
  const editOpenStart = script.indexOf('function openEditDialog');
  const openCreate = script.slice(createOpenStart, editOpenStart);
  assert.match(openCreate, /canStartShareLifeCreate\(\s*canManageNotes\(\)\s*,\s*createPending\s*\)/);

  const submitStart = script.indexOf('async function handleNoteSubmit');
  const deleteStart = script.indexOf('async function handleDelete');
  const submitHandler = script.slice(submitStart, deleteStart);
  assert.match(submitHandler, /if\s*\(\s*!editingId\s*&&\s*!canStartShareLifeCreate/);
  assert.match(submitHandler, /createPending\s*=\s*true/);
  assert.match(submitHandler, /ownsCreateLock\s*=\s*true/);
  assert.match(submitHandler, /finally\s*\{[\s\S]*?createPending\s*=\s*false/);

  const finallyStart = submitHandler.indexOf('finally');
  const tokenCheckAfterFinally = submitHandler.indexOf('isCurrentModalOperation', finallyStart);
  const releaseAfterFinally = submitHandler.indexOf('createPending = false', finallyStart);
  assert.ok(releaseAfterFinally >= 0 && releaseAfterFinally < tokenCheckAfterFinally);
});
