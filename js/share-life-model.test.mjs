import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from './share-life-model.mjs';

test('normalizes a valid title and http/https Douyin URL', () => {
  assert.equal(model.normalizeTitle('  Iceland light  '), 'Iceland light');
  assert.equal(
    model.normalizeDouyinUrl(' https://www.douyin.com/video/123 '),
    'https://www.douyin.com/video/123',
  );
  assert.equal(model.normalizeDouyinUrl('javascript:alert(1)'), '');
  assert.equal(model.normalizeDouyinUrl('file:///tmp/a'), '');
});

test('validates required title, length, URL, and 8 MB image size', () => {
  assert.equal(model.MAX_SHARE_LIFE_IMAGE_BYTES, 8 * 1024 * 1024);
  assert.equal(model.validateNoteFields({ title: ' ', douyinUrl: 'https://douyin.com' }).title, 'Please enter a title.');
  assert.equal(model.validateNoteFields({ title: 'x'.repeat(161), douyinUrl: 'https://douyin.com' }).title, 'Title must be 160 characters or fewer.');
  assert.equal(model.validateNoteFields({ title: 'Title', douyinUrl: 'javascript:alert(1)' }).douyinUrl, 'Please enter a valid http or https link.');
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024, 'image/jpeg'), true);
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024 + 1, 'image/jpeg'), false);
  assert.equal(model.isShareLifeImageAllowed(100, 'video/mp4'), false);
});

test('maps rows and preserves existing cover during an edit without upload', () => {
  const row = {
    id: 'n1',
    title: 'Title',
    douyin_url: 'https://www.douyin.com/video/1',
    cover_url: '/cover.jpg',
    cover_path: 'covers/cover.jpg',
    likes_count: 4,
    created_at: '2026-07-24T00:00:00Z',
    updated_at: '2026-07-24T00:00:00Z',
  };
  assert.deepEqual(model.supabaseRowToShareLifeNote(row), {
    id: 'n1',
    title: 'Title',
    douyinUrl: 'https://www.douyin.com/video/1',
    coverUrl: '/cover.jpg',
    coverPath: 'covers/cover.jpg',
    likesCount: 4,
    createdAt: '2026-07-24T00:00:00Z',
    updatedAt: '2026-07-24T00:00:00Z',
  });
  assert.deepEqual(
    model.resolveEditedCover(null, row.cover_url, row.cover_path),
    { coverUrl: '/cover.jpg', coverPath: 'covers/cover.jpg' },
  );
});

test('sums safe like counts and toggles deduplicated local liked ids', () => {
  assert.equal(model.sumLikeCounts([{ likesCount: 3 }, { likesCount: 7 }, { likesCount: -2 }]), 10);
  assert.deepEqual([...model.parseLikedNoteIds('["a","a","b",4]')], ['a', 'b']);
  assert.deepEqual([...model.parseLikedNoteIds('bad json')], []);
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'a'), new Set());
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'b'), new Set(['a', 'b']));
});
