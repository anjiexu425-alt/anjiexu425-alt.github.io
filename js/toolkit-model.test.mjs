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
