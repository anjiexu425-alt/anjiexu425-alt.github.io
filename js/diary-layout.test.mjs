import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as diaryLayout from './diary-layout.mjs';
import { createMediaLayoutCache } from './diary-media.mjs';
import { createFlipTransition } from './diary-state.mjs';

const {
  normalizePageLayout,
  pageContentHTML,
  pageRolesForEntry,
  spreadHTMLForEntry,
  transitionHTMLForEntries,
  mediaWithPageLayout,
} = diaryLayout;

function diaryEntry(id, layout) {
  return {
    id,
    number: id === 'current' ? '01' : '02',
    category: id === 'current' ? 'Study Notes' : 'City Walk',
    date: id === 'current' ? '2026.07.22' : '2026.07.23',
    title: id === 'current' ? 'Current title' : 'Target title',
    quote: id === 'current' ? 'Current quote' : 'Target quote',
    body: id === 'current'
      ? 'Current first paragraph.\n\nCurrent second paragraph.'
      : 'Target first paragraph.\n\nTarget second paragraph.',
    mood: id === 'current' ? '😌 Calm' : '😊 Happy',
    weather: id === 'current' ? '🌧️ Rainy' : '☀️ Sunny',
    media: {
      type: 'image',
      urls: [`${id}.jpg`],
      caption: id === 'current' ? 'Current caption' : 'Target caption',
      ...(layout === undefined ? {} : { layout }),
    },
  };
}

function contentOptions(entries, layoutCache = createMediaLayoutCache()) {
  return {
    active: true,
    entries,
    isLoggedIn: true,
    layoutCache,
  };
}

function assertEntryAndRole(html, entryId, role) {
  assert.match(html, new RegExp(`data-entry-id="${entryId}"`));
  assert.match(html, new RegExp(`diary-page__content--${role}`));
  assert.doesNotMatch(
    html,
    new RegExp(`diary-page__content--${role === 'text' ? 'media' : 'text'}`),
  );
}

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

test('text-left maps complete text HTML left and complete media HTML right', () => {
  const entry = diaryEntry('current', 'text-left');
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(entry);
  layoutCache.set(generation, {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  });

  assert.equal(typeof pageContentHTML, 'function');
  assert.equal(typeof spreadHTMLForEntry, 'function');
  const spread = spreadHTMLForEntry(
    entry,
    contentOptions([entry], layoutCache),
  );

  assertEntryAndRole(spread.leftHTML, 'current', 'text');
  assert.match(spread.leftHTML, /2026\.07\.22/);
  assert.match(spread.leftHTML, /Current title/);
  assert.match(spread.leftHTML, /Current first paragraph/);
  assert.match(spread.leftHTML, /Current second paragraph/);
  assert.match(spread.leftHTML, /class="diary-page__discard"/);
  assert.doesNotMatch(spread.leftHTML, /diary-polaroid/);

  assertEntryAndRole(spread.rightHTML, 'current', 'media');
  assert.match(
    spread.rightHTML,
    /diary-polaroid diary-polaroid--landscape/,
  );
  assert.match(spread.rightHTML, /src="current\.jpg"/);
  assert.match(spread.rightHTML, /Current caption/);
  assert.match(spread.rightHTML, /😌 Calm/);
  assert.match(spread.rightHTML, /🌧️ Rainy/);
  assert.doesNotMatch(spread.rightHTML, /Current first paragraph/);
});

test('media-left maps cached Polaroid media left and complete text HTML right', () => {
  const entry = diaryEntry('current', 'media-left');
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(entry);
  layoutCache.set(generation, {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });

  const spread = spreadHTMLForEntry(
    entry,
    contentOptions([entry], layoutCache),
  );

  assertEntryAndRole(spread.leftHTML, 'current', 'media');
  assert.match(
    spread.leftHTML,
    /diary-polaroid diary-polaroid--portrait/,
  );
  assert.match(spread.leftHTML, /diary-page__media--portrait/);
  assert.match(spread.leftHTML, /--diary-media-aspect:0\.75/);
  assert.match(spread.leftHTML, /Current caption/);
  assert.match(spread.leftHTML, /😌 Calm/);
  assert.match(spread.leftHTML, /🌧️ Rainy/);

  assertEntryAndRole(spread.rightHTML, 'current', 'text');
  assert.match(spread.rightHTML, /2026\.07\.22/);
  assert.match(spread.rightHTML, /Current title/);
  assert.match(spread.rightHTML, /Current first paragraph/);
  assert.match(spread.rightHTML, /class="diary-page__discard"/);
  assert.doesNotMatch(spread.rightHTML, /diary-polaroid/);
});

test('old entries without layout keep the text-left spread mapping', () => {
  const oldEntry = diaryEntry('current');
  const spread = spreadHTMLForEntry(
    oldEntry,
    contentOptions([oldEntry]),
  );

  assertEntryAndRole(spread.leftHTML, 'current', 'text');
  assertEntryAndRole(spread.rightHTML, 'current', 'media');
});

test('inactive media content keeps its caption and controls while deferring video preload', () => {
  const entry = diaryEntry('current', 'media-left');
  entry.media.type = 'video';
  entry.media.urls = ['current.mp4'];
  const html = pageContentHTML(entry, 'media', {
    ...contentOptions([entry]),
    active: false,
  });

  assertEntryAndRole(html, 'current', 'media');
  assert.match(html, /<video[^>]*src="current\.mp4"/);
  assert.match(html, /preload="none"/);
  assert.match(html, /controls/);
  assert.match(html, /Current caption/);
  assert.match(html, /😌 Calm/);
  assert.match(html, /🌧️ Rainy/);
});

test('Next uses physical spreads for underlays and sheet faces across opposite layouts', () => {
  const entries = [
    diaryEntry('current', 'media-left'),
    diaryEntry('target', 'text-left'),
  ];
  const descriptor = createFlipTransition(0, 'next');

  assert.deepEqual(descriptor, {
    fromIndex: 0,
    toIndex: 1,
    startProgress: 0,
    targetProgress: 1,
  });
  assert.equal(typeof transitionHTMLForEntries, 'function');
  const transition = transitionHTMLForEntries(
    entries[descriptor.fromIndex],
    entries[descriptor.toIndex],
    contentOptions(entries),
  );

  assertEntryAndRole(transition.underlayLeftHTML, 'current', 'media');
  assertEntryAndRole(transition.underlayRightHTML, 'target', 'media');
  assertEntryAndRole(transition.frontHTML, 'current', 'text');
  assertEntryAndRole(transition.backHTML, 'target', 'text');
});

test('Previous reverses canonical progress without swapping physical page mappings', () => {
  const entries = [
    diaryEntry('target', 'media-left'),
    diaryEntry('current', 'text-left'),
  ];
  const descriptor = createFlipTransition(1, 'prev');

  assert.deepEqual(descriptor, {
    fromIndex: 0,
    toIndex: 1,
    startProgress: 1,
    targetProgress: 0,
  });
  const transition = transitionHTMLForEntries(
    entries[descriptor.fromIndex],
    entries[descriptor.toIndex],
    contentOptions(entries),
  );

  // At canonical progress 1 the current spread is target/right plus the
  // sheet back (current/left). Reversing to 0 reveals the previous spread.
  assertEntryAndRole(transition.underlayLeftHTML, 'target', 'media');
  assertEntryAndRole(transition.underlayRightHTML, 'current', 'media');
  assertEntryAndRole(transition.frontHTML, 'target', 'text');
  assertEntryAndRole(transition.backHTML, 'current', 'text');
});
