import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as diaryLayout from './diary-layout.mjs';
import * as diaryMedia from './diary-media.mjs';
import { createFlipTransition } from './diary-state.mjs';
import * as diaryDOM from './diary-dom.mjs';

const { createMediaLayoutCache } = diaryMedia;
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

test('text page escapes a malicious custom category before innerHTML rendering', () => {
  const entry = diaryEntry('current', 'text-left');
  entry.category = 'Film </span><img src=x onerror="globalThis.pwned=true"><span>';

  const html = pageContentHTML(entry, 'text');

  assert.doesNotMatch(html, /<img\b/i);
  assert.doesNotMatch(html, /<[^>]+\sonerror\s*=/i);
  assert.match(
    html,
    /FILM &lt;\/SPAN&gt;&lt;IMG SRC=X ONERROR=&quot;GLOBALTHIS\.PWNED=TRUE&quot;&gt;&lt;SPAN&gt;/,
  );
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
    diaryEntry('current', 'text-left'),
    diaryEntry('target', 'media-left'),
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

  assertEntryAndRole(transition.underlayLeftHTML, 'current', 'text');
  assertEntryAndRole(transition.underlayRightHTML, 'target', 'text');
  assertEntryAndRole(transition.frontHTML, 'current', 'media');
  assertEntryAndRole(transition.backHTML, 'target', 'media');
});

test('uncached text-left to media-left prewarms intrinsic layouts before building every curl face', async () => {
  assert.equal(
    typeof diaryMedia.createMediaIntrinsicPrewarmer,
    'function',
    'production must expose an entry-aware intrinsic media prewarmer',
  );
  const entries = [
    diaryEntry('current', 'text-left'),
    diaryEntry('target', 'media-left'),
  ];
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: async (url) => (
      url === 'current.jpg'
        ? { width: 1600, height: 900 }
        : { width: 900, height: 1200 }
    ),
    timeoutMs: 50,
  });

  assert.equal(layoutCache.get(entries[0]), undefined);
  assert.equal(layoutCache.get(entries[1]), undefined);
  assert.equal(await prewarmer.ensure(entries), true);

  const transition = transitionHTMLForEntries(entries[0], entries[1], {
    ...contentOptions(entries, layoutCache),
    active: false,
  });
  const built = diaryDOM.buildCurlSpreadDOM(fakeStage(), transition);

  built.slices.forEach(({ el }) => {
    const frontHTML = el.children[0].children[0].innerHTML;
    const backHTML = el.children[1].children[0].innerHTML;
    assert.match(frontHTML, /diary-polaroid--landscape/);
    assert.match(backHTML, /diary-polaroid--portrait/);
    assert.match(backHTML, /diary-page__media--portrait/);
    assert.doesNotMatch(frontHTML, /diary-polaroid--unknown/);
    assert.doesNotMatch(backHTML, /diary-polaroid--unknown/);
  });
});

test('Previous reverses canonical progress without swapping physical page mappings', () => {
  const entries = [
    diaryEntry('target', 'text-left'),
    diaryEntry('current', 'media-left'),
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
  assertEntryAndRole(transition.underlayLeftHTML, 'target', 'text');
  assertEntryAndRole(transition.underlayRightHTML, 'current', 'text');
  assertEntryAndRole(transition.frontHTML, 'target', 'media');
  assertEntryAndRole(transition.backHTML, 'current', 'media');
});

function classNames(element) {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.className = '';
    this.innerHTML = '';
    this.style = {};
    this.pauseCalls = 0;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  replaceChildren(...children) {
    this.children = [...children];
    this.innerHTML = '';
  }

  querySelectorAll(selector) {
    const matches = [];
    const isMatch = selector.startsWith('.')
      ? (element) => classNames(element).has(selector.slice(1))
      : (element) => element.tagName === selector.toUpperCase();
    const visit = (element) => {
      element.children.forEach((child) => {
        if (isMatch(child)) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  getBoundingClientRect() {
    return classNames(this).has('diary-flip-sheet')
      ? { width: 640, height: 480 }
      : { width: 0, height: 0 };
  }

  pause() {
    this.pauseCalls += 1;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

function fakeStage() {
  const document = new FakeDocument();
  return document.createElement('section');
}

function assertBuiltPage(element, physicalSide, entryId, role) {
  assert.equal(
    element.className,
    `diary-page diary-page--${physicalSide}`,
  );
  assertEntryAndRole(element.innerHTML, entryId, role);
}

function assertBuiltSliceFace(slice, faceIndex, physicalSide, entryId, role) {
  const face = slice.children[faceIndex];
  const canvas = face.children[0];
  assert.match(
    face.className,
    new RegExp(`diary-flip-slice__face--${faceIndex === 0 ? 'front' : 'back'}`),
  );
  assert.match(
    canvas.innerHTML,
    new RegExp(`<div class="diary-page diary-page--${physicalSide}">`),
  );
  assertEntryAndRole(canvas.innerHTML, entryId, role);
}

test('settled DOM hydrates media through the stage root on either physical side', () => {
  assert.equal(
    typeof diaryDOM.renderSettledSpreadDOM,
    'function',
    'renderSettledSpreadDOM must provide an executable production boundary',
  );

  for (const layout of ['text-left', 'media-left']) {
    const entry = diaryEntry('current', layout);
    const spread = spreadHTMLForEntry(entry, contentOptions([entry]));
    const stage = fakeStage();
    const hydrationRoots = [];

    const built = diaryDOM.renderSettledSpreadDOM(stage, spread, {
      hydrateMedia: (root) => hydrationRoots.push(root),
    });

    const mediaSide = layout === 'media-left' ? 'left' : 'right';
    const textSide = mediaSide === 'left' ? 'right' : 'left';
    assertBuiltPage(built[`${mediaSide}Page`], mediaSide, 'current', 'media');
    assertBuiltPage(built[`${textSide}Page`], textSide, 'current', 'text');
    assert.deepEqual(stage.children, [built.leftPage, built.rightPage]);
    assert.deepEqual(hydrationRoots, [stage]);
  }
});

test('Next builds opposite-layout underlays and media front/back into all 16 slices', () => {
  assert.equal(
    typeof diaryDOM.buildCurlSpreadDOM,
    'function',
    'buildCurlSpreadDOM must provide an executable production boundary',
  );
  const entries = [
    diaryEntry('current', 'text-left'),
    diaryEntry('target', 'media-left'),
  ];
  const descriptor = createFlipTransition(0, 'next');
  const transition = transitionHTMLForEntries(
    entries[descriptor.fromIndex],
    entries[descriptor.toIndex],
    contentOptions(entries),
  );
  const stage = fakeStage();

  const built = diaryDOM.buildCurlSpreadDOM(stage, transition);

  assertBuiltPage(built.leftPage, 'left', 'current', 'text');
  assertBuiltPage(built.rightPage, 'right', 'target', 'text');
  assert.equal(built.slices.length, 16);
  assert.equal(stage.querySelectorAll('.diary-flip-slice').length, 16);
  built.slices.forEach(({ el }) => {
    assertBuiltSliceFace(el, 0, 'right', 'current', 'media');
    assertBuiltSliceFace(el, 1, 'left', 'target', 'media');
  });
});

test('Previous builds the same physical underlays and slice faces while progress reverses', () => {
  assert.equal(
    typeof diaryDOM.buildCurlSpreadDOM,
    'function',
    'buildCurlSpreadDOM must provide an executable production boundary',
  );
  const entries = [
    diaryEntry('target', 'text-left'),
    diaryEntry('current', 'media-left'),
  ];
  const descriptor = createFlipTransition(1, 'prev');
  const transition = transitionHTMLForEntries(
    entries[descriptor.fromIndex],
    entries[descriptor.toIndex],
    contentOptions(entries),
  );
  const stage = fakeStage();

  const built = diaryDOM.buildCurlSpreadDOM(stage, transition);

  assert.equal(descriptor.startProgress, 1);
  assert.equal(descriptor.targetProgress, 0);
  assertBuiltPage(built.leftPage, 'left', 'target', 'text');
  assertBuiltPage(built.rightPage, 'right', 'current', 'text');
  assert.equal(built.slices.length, 16);
  built.slices.forEach(({ el }) => {
    assertBuiltSliceFace(el, 0, 'right', 'target', 'media');
    assertBuiltSliceFace(el, 1, 'left', 'current', 'media');
  });
});
