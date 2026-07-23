import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePageLayout, pageRolesForEntry } from './diary-layout.mjs';

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
