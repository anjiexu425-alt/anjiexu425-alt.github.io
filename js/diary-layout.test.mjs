import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as diaryLayout from './diary-layout.mjs';

const {
  normalizePageLayout,
  pageRolesForEntry,
  mediaWithPageLayout,
} = diaryLayout;

test('normalizePageLayout preserves supported layouts and defaults unsupported values', () => {
  assert.equal(normalizePageLayout('text-left'), 'text-left');
  assert.equal(normalizePageLayout('media-left'), 'media-left');
  assert.equal(normalizePageLayout(undefined), 'text-left');
  assert.equal(normalizePageLayout('sideways'), 'text-left');
});

test('pageRolesForEntry returns text on the left for text-left layouts', () => {
  assert.deepEqual(pageRolesForEntry({ media: { layout: 'text-left' } }), {
    left: 'text',
    right: 'media',
  });
});

test('pageRolesForEntry returns media on the left for media-left layouts', () => {
  assert.deepEqual(pageRolesForEntry({ media: { layout: 'media-left' } }), {
    left: 'media',
    right: 'text',
  });
});

test('mediaWithPageLayout returns a new media object with normalized layout', () => {
  const media = {
    type: 'image',
    urls: ['first.jpg', 'second.jpg'],
    caption: 'Library afternoon',
  };

  assert.equal(typeof mediaWithPageLayout, 'function');
  const result = mediaWithPageLayout(media, 'media-left');

  assert.notStrictEqual(result, media);
  assert.deepEqual(result, {
    type: 'image',
    urls: ['first.jpg', 'second.jpg'],
    caption: 'Library afternoon',
    layout: 'media-left',
  });
  assert.deepEqual(media, {
    type: 'image',
    urls: ['first.jpg', 'second.jpg'],
    caption: 'Library afternoon',
  });
});

test('mediaWithPageLayout defaults unsupported layout values without changing media fields', () => {
  assert.equal(typeof mediaWithPageLayout, 'function');
  assert.deepEqual(
    mediaWithPageLayout(
      { type: 'video', urls: ['clip.mp4'], caption: 'Evening walk' },
      'sideways',
    ),
    {
      type: 'video',
      urls: ['clip.mp4'],
      caption: 'Evening walk',
      layout: 'text-left',
    },
  );
});
