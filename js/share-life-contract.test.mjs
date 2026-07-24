import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
