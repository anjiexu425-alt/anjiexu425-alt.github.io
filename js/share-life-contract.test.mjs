import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
