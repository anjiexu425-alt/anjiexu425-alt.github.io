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
  assert.match(css, /\.share-life-card__likes\s*\{[^}]*border\s*:\s*0[^}]*background\s*:\s*transparent[^}]*font\s*:\s*inherit/i);
  assert.match(css, /\.share-life-card__manage svg\s*\{[^}]*width\s*:[^;}]+;[^}]*height\s*:/i);
  assert.doesNotMatch(css, /backdrop-filter\s*:/i);
});

test('Share Life Supabase schema has its required security contract', async () => {
  const sql = await readFile(new URL('../supabase/share-life.sql', import.meta.url), 'utf8');

  assert.match(sql, /create table if not exists public\.share_life_notes/i);
  assert.match(sql, /likes_count bigint not null default 0/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /create or replace function public\.adjust_share_life_like/i);
  assert.match(sql, /delta is null/i);
  assert.match(sql, /delta not in \(-1,\s*1\)/i);
  assert.match(sql, /greatest\(0,\s*likes_count \+ delta\)/i);
  assert.match(sql, /grant execute .* to anon,\s*authenticated/i);
  assert.match(sql, /share-life-media/i);
  assert.match(sql, /cover_path\s+text(?:\s*,|\s*\n)/i);
  assert.doesNotMatch(sql, /cover_path\s+text\s+not\s+null/i);
  assert.match(
    sql,
    /alter table\s+public\.share_life_notes\s+alter column\s+cover_path\s+drop not null/i,
  );
  assert.doesNotMatch(sql, /for update\s+to anon/i);
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
