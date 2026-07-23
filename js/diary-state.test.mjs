import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applySingleMediaLayout,
  hydrateSingleMediaLayouts,
  mediaContainerHTML,
  mediaLayoutKey,
} from './diary-media.mjs';
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  computeDragProgress,
  computeDirectionalDragProgress,
  shouldActivateDirectionalDrag,
  isFlipInteractionLocked,
  ownsDragInteraction,
  computeCurlMotion,
  computeUnderlayOpacities,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
  contentOffsetForSlice,
  createFlipTransition,
  shouldCompleteDirectionalFlip,
  resolveDragSettle,
  resolveMediaLayout,
} from './diary-state.mjs';

const diarySource = readFileSync(new URL('./diary.js', import.meta.url), 'utf8');

function fakeClassList(...classNames) {
  const values = new Set(classNames);
  return {
    add(...names) {
      names.forEach((name) => values.add(name));
    },
    remove(...names) {
      names.forEach((name) => values.delete(name));
    },
    contains(name) {
      return values.has(name);
    },
  };
}

function fakeStyle() {
  const values = new Map();
  return {
    setProperty(name, value) {
      values.set(name, value);
    },
    getPropertyValue(name) {
      return values.get(name) ?? '';
    },
  };
}

function fakeMedia(overrides = {}) {
  const listeners = new Map();
  return {
    addEventListener(type, listener, options) {
      listeners.set(type, { listener, options });
    },
    dispatch(type) {
      listeners.get(type)?.listener();
    },
    listener(type) {
      return listeners.get(type);
    },
    ...overrides,
  };
}

function fakeMediaContainer({
  media = null,
  classes = [
    'diary-page__media',
    'diary-page__media--single',
    'diary-page__media--unknown',
  ],
  layoutKey = 'entry-media',
} = {}) {
  let queryCount = 0;
  return {
    classList: fakeClassList(...classes),
    style: fakeStyle(),
    dataset: { mediaLayoutKey: layoutKey },
    querySelector() {
      queryCount += 1;
      return media;
    },
    get queryCount() {
      return queryCount;
    },
  };
}

function fakeMediaRoot(containers) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, '.diary-page__media--single');
      return containers.filter((container) => (
        container.classList.contains('diary-page__media--single')
      ));
    },
  };
}

test('diary rendering shares resolved layouts with temporary flip HTML', () => {
  const rightPageSource = diarySource.match(/function rightPageHTML[\s\S]*?\n\}/);
  const renderStaticSource = diarySource.match(/function renderStatic[\s\S]*?\n\}/);
  const buildCurlSource = diarySource.match(/function buildCurlDOM[\s\S]*?\n\}\n\nfunction updateCurl/);

  assert.ok(rightPageSource);
  assert.match(rightPageSource[0], /mediaContainerHTML/);
  assert.match(rightPageSource[0], /layoutCache:\s*mediaLayoutCache/);
  assert.ok(renderStaticSource);
  assert.match(renderStaticSource[0], /hydrateSingleMediaLayouts/);
  assert.match(renderStaticSource[0], /mediaLayoutCache\.set/);
  assert.equal(diarySource.match(/hydrateSingleMediaLayouts\(/g)?.length, 1);
  assert.ok(buildCurlSource);
  assert.match(buildCurlSource[0], /rightPageHTML\(rightEntry,\s*false\)/);
  assert.match(buildCurlSource[0], /rightPageHTML\(fromEntry,\s*false\)/);
});

test('single-media layout updates the orientation class and CSS aspect variable', () => {
  const container = fakeMediaContainer();

  const layout = applySingleMediaLayout(container, 1600, 900);

  assert.deepEqual(layout, { orientation: 'landscape', aspectRatio: 16 / 9 });
  assert.equal(container.classList.contains('diary-page__media--unknown'), false);
  assert.equal(container.classList.contains('diary-page__media--landscape'), true);
  assert.equal(container.style.getPropertyValue('--diary-media-aspect'), String(16 / 9));
});

test('a complete cached image hydrates immediately without adding a listener', () => {
  const image = fakeMedia({
    complete: true,
    naturalWidth: 900,
    naturalHeight: 1200,
  });
  const container = fakeMediaContainer({ media: image });
  const resolved = [];

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => true,
    onLayout: (key, layout) => resolved.push([key, layout]),
  });

  assert.equal(container.classList.contains('diary-page__media--portrait'), true);
  assert.equal(image.listener('load'), undefined);
  assert.deepEqual(resolved, [[
    'entry-media',
    { orientation: 'portrait', aspectRatio: 3 / 4 },
  ]]);
});

test('a video with metadata hydrates immediately', () => {
  const video = fakeMedia({
    readyState: 1,
    videoWidth: 1000,
    videoHeight: 1000,
  });
  const container = fakeMediaContainer({ media: video });

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => false,
    haveMetadata: 1,
  });

  assert.equal(container.classList.contains('diary-page__media--square'), true);
  assert.equal(video.listener('loadedmetadata'), undefined);
});

test('pending image and video media hydrate from one-shot async events', () => {
  const image = fakeMedia({
    complete: false,
    naturalWidth: 1200,
    naturalHeight: 800,
  });
  const video = fakeMedia({
    readyState: 0,
    videoWidth: 900,
    videoHeight: 1200,
  });
  const imageContainer = fakeMediaContainer({ media: image, layoutKey: 'image-key' });
  const videoContainer = fakeMediaContainer({ media: video, layoutKey: 'video-key' });
  const resolved = [];

  hydrateSingleMediaLayouts(fakeMediaRoot([imageContainer, videoContainer]), {
    isImage: (media) => media === image,
    haveMetadata: 1,
    onLayout: (key, layout) => resolved.push([key, layout]),
  });

  assert.deepEqual(image.listener('load')?.options, { once: true });
  assert.deepEqual(video.listener('loadedmetadata')?.options, { once: true });
  image.dispatch('load');
  video.dispatch('loadedmetadata');
  assert.equal(imageContainer.classList.contains('diary-page__media--landscape'), true);
  assert.equal(videoContainer.classList.contains('diary-page__media--portrait'), true);
  assert.deepEqual(resolved.map(([key]) => key), ['image-key', 'video-key']);
});

test('placeholder and multi-image containers are not hydrated', () => {
  const placeholder = fakeMediaContainer();
  const gallery = fakeMediaContainer({
    media: fakeMedia({ complete: true, naturalWidth: 1000, naturalHeight: 1000 }),
    classes: ['diary-page__media'],
  });
  let resolvedCount = 0;

  hydrateSingleMediaLayouts(fakeMediaRoot([placeholder, gallery]), {
    isImage: () => true,
    onLayout: () => {
      resolvedCount += 1;
    },
  });

  assert.equal(placeholder.classList.contains('diary-page__media--unknown'), true);
  assert.equal(gallery.queryCount, 0);
  assert.equal(resolvedCount, 0);
});

test('temporary flip HTML uses each source or target entry cached layout without hydration', () => {
  const entry = {
    title: 'Wide view',
    media: { type: 'image', urls: ['wide.jpg'] },
  };
  const targetEntry = {
    title: 'Square view',
    media: { type: 'image', urls: ['square.jpg'] },
  };
  const image = fakeMedia({
    complete: true,
    naturalWidth: 1600,
    naturalHeight: 900,
  });
  const key = mediaLayoutKey(entry.media.urls[0]);
  const container = fakeMediaContainer({ media: image, layoutKey: key });
  const layoutCache = new Map();

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => true,
    onLayout: (layoutKey, layout) => layoutCache.set(layoutKey, layout),
  });
  layoutCache.set(mediaLayoutKey(targetEntry.media.urls[0]), {
    orientation: 'square',
    aspectRatio: 1,
  });
  const html = mediaContainerHTML(entry, {
    active: false,
    layoutCache,
    renderItem: (_entry, _url, _index, _total, active) => {
      assert.equal(active, false);
      return '<img class="diary-page__photo">';
    },
  });
  const targetHTML = mediaContainerHTML(targetEntry, {
    active: false,
    layoutCache,
    renderItem: () => '<img class="diary-page__photo">',
  });

  assert.match(html, /diary-page__media--landscape/);
  assert.match(html, /--diary-media-aspect:1\.777/);
  assert.doesNotMatch(html, /diary-page__media--unknown/);
  assert.match(targetHTML, /diary-page__media--square/);
  assert.match(targetHTML, /--diary-media-aspect:1;/);
});

test('uncached temporary HTML and placeholders use the safe unknown fallback', () => {
  const layoutCache = new Map();
  const renderItem = () => '<div class="diary-placeholder"></div>';
  const placeholderEntry = {
    media: { type: 'image', urls: ['[Photo placeholder: campus]'] },
  };

  const html = mediaContainerHTML(placeholderEntry, {
    active: false,
    layoutCache,
    renderItem,
  });

  assert.match(html, /diary-page__media--single/);
  assert.match(html, /diary-page__media--unknown/);
  assert.doesNotMatch(html, /--diary-media-aspect:/);
});

test('multi-image HTML keeps the gallery grid and ignores cached single-media layout', () => {
  const entry = {
    media: { type: 'image', urls: ['first.jpg', 'second.jpg'] },
  };
  const layoutCache = new Map([[
    mediaLayoutKey(entry.media.urls[0]),
    { orientation: 'landscape', aspectRatio: 16 / 9 },
  ]]);

  const html = mediaContainerHTML(entry, {
    active: false,
    layoutCache,
    renderItem: () => '<img>',
  });

  assert.doesNotMatch(html, /diary-page__media--single/);
  assert.doesNotMatch(html, /diary-page__media--landscape/);
  assert.doesNotMatch(html, /--diary-media-aspect:/);
  assert.match(html, /grid-template-columns:repeat\(2,1fr\)/);
});

test('starts closed on the first page', () => {
  const state = createDiaryState(3);
  assert.equal(state.isOpen, false);
  assert.equal(state.current, 0);
});

test('opening the book does not change the current page', () => {
  const state = openBook(createDiaryState(3));
  assert.equal(state.isOpen, true);
  assert.equal(state.current, 0);
});

test('previous is clamped at the first page', () => {
  const state = createDiaryState(3);
  assert.equal(canGoPrevious(state), false);
  const stillFirst = goToPrevious(state);
  assert.equal(stillFirst.current, 0);
});

test('next moves forward and is clamped at the last page', () => {
  let state = createDiaryState(3);
  state = goToNext(state);
  state = goToNext(state);
  assert.equal(state.current, 2);
  assert.equal(canGoNext(state), false);

  const stillLast = goToNext(state);
  assert.equal(stillLast.current, 2);
});

test('goToPage jumps directly to a given page', () => {
  const state = createDiaryState(5);
  const jumped = goToPage(state, 3);
  assert.equal(jumped.current, 3);
});

test('goToPage clamps to the valid range', () => {
  const state = createDiaryState(5);
  assert.equal(goToPage(state, -2).current, 0);
  assert.equal(goToPage(state, 99).current, 4);
});

test('computeDragProgress returns 0 when there is no movement', () => {
  assert.equal(computeDragProgress(0, 300), 0);
});

test('computeDragProgress returns a fraction of pageWidth dragged', () => {
  assert.equal(computeDragProgress(150, 300), 0.5);
});

test('computeDragProgress clamps below 0 to 0', () => {
  assert.equal(computeDragProgress(-50, 300), 0);
});

test('computeDragProgress clamps above 1 to 1', () => {
  assert.equal(computeDragProgress(400, 300), 1);
});

test('computeDragProgress returns 0 for a non-positive pageWidth', () => {
  assert.equal(computeDragProgress(150, 0), 0);
});

test('next drag progress advances only for leftward movement', () => {
  assert.equal(computeDirectionalDragProgress(500, 350, 300, 'next'), 0.5);
  assert.equal(computeDirectionalDragProgress(500, 650, 300, 'next'), 0);
});

test('previous drag progress advances only for rightward movement', () => {
  assert.equal(computeDirectionalDragProgress(500, 650, 300, 'prev'), 0.5);
  assert.ok(Math.abs(computeDirectionalDragProgress(500, 740, 300, 'prev') - 0.2) < 1e-9);
  assert.equal(computeDirectionalDragProgress(500, 350, 300, 'prev'), 1);
});

test('drag activation accepts only movement in the page turn direction', () => {
  assert.equal(shouldActivateDirectionalDrag(500, 492, 'next', 8), true);
  assert.equal(shouldActivateDirectionalDrag(500, 650, 'next', 8), false);
  assert.equal(shouldActivateDirectionalDrag(500, 508, 'prev', 8), true);
  assert.equal(shouldActivateDirectionalDrag(500, 350, 'prev', 8), false);
});

test('a pending drag locks navigation and a second drag start', () => {
  const pendingDrag = { pointerId: 7, moved: false };
  assert.equal(isFlipInteractionLocked(false, pendingDrag), true);
  assert.equal(isFlipInteractionLocked(true, null), true);
  assert.equal(isFlipInteractionLocked(false, null), false);
});

test('only the current drag owner can update the interaction', () => {
  const activeDrag = { pointerId: 7 };
  const replacementDrag = { pointerId: 7 };
  assert.equal(ownsDragInteraction(activeDrag, activeDrag, 7), true);
  assert.equal(ownsDragInteraction(activeDrag, activeDrag, 8), false);
  assert.equal(ownsDragInteraction(replacementDrag, activeDrag, 7), false);
  assert.equal(ownsDragInteraction(null, activeDrag, 7), false);
});

test('computeCurlMotion is 0 at both ends and peaks at the midpoint', () => {
  assert.ok(Math.abs(computeCurlMotion(0)) < 1e-9);
  assert.equal(computeCurlMotion(0.5), 1);
  assert.ok(Math.abs(computeCurlMotion(1)) < 1e-9);
});

test('underlay shadows follow canonical progress at both physical endpoints', () => {
  assert.deepEqual(computeUnderlayOpacities(0), { leftIn: 0, rightOut: 0.7 });
  assert.deepEqual(computeUnderlayOpacities(0.5), { leftIn: 0.3, rightOut: 0.35 });
  assert.deepEqual(computeUnderlayOpacities(1), { leftIn: 0.6, rightOut: 0 });
});

test('easeInOutCubic passes through the endpoints and midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});

test('canonical slice geometry is flat right at 0 and flat left at 1', () => {
  assert.deepEqual(computeSliceThetas(0, 16), Array(16).fill(0));
  computeSliceThetas(1, 16).forEach((deg) => {
    assert.ok(Math.abs(deg + 180) < 1e-6);
  });
});

test('canonical layout starts at the spine and needs no direction mirror', () => {
  const flatThetas = Array(4).fill(0);
  const result = computeSliceLayout(flatThetas, 10);
  assert.deepEqual(result.positions, [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 20, z: 0 },
    { x: 30, z: 0 },
  ]);
  assert.deepEqual(result.tip, { x: 40, z: 0, rotateDeg: 0 });
});

test('computeSliceLayout carries curl depth into the tip', () => {
  const { tip } = computeSliceLayout([-30], 10);
  const radians = (-30 * Math.PI) / 180;
  assert.ok(Math.abs(tip.x - 10 * Math.cos(radians)) < 1e-9);
  assert.ok(Math.abs(tip.z + 10 * Math.sin(radians)) < 1e-9);
});

test('content strips depend on paper face, not navigation direction', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'front'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'front'), 15);
  assert.equal(contentOffsetForSlice(0, 16, 'back'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'back'), 0);
});

test('next transition plays canonical curl forward', () => {
  assert.deepEqual(createFlipTransition(2, 'next'), {
    fromIndex: 2,
    toIndex: 3,
    startProgress: 0,
    targetProgress: 1,
  });
});

test('previous transition plays the same canonical curl backward', () => {
  assert.deepEqual(createFlipTransition(2, 'prev'), {
    fromIndex: 1,
    toIndex: 2,
    startProgress: 1,
    targetProgress: 0,
  });
});

test('directional completion uses opposite sides of the midpoint', () => {
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'next'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'next'), false);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'prev'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'prev'), false);
});

test('cancelled next drag returns to its start even beyond halfway', () => {
  assert.deepEqual(resolveDragSettle({
    progress: 0.9,
    direction: 'next',
    startProgress: 0,
    targetProgress: 1,
    cancelled: true,
  }), {
    completes: false,
    settleProgress: 0,
  });
});

test('cancelled previous drag returns to its start even beyond halfway', () => {
  assert.deepEqual(resolveDragSettle({
    progress: 0.1,
    direction: 'prev',
    startProgress: 1,
    targetProgress: 0,
    cancelled: true,
  }), {
    completes: false,
    settleProgress: 1,
  });
});

test('resolveMediaLayout classifies media orientation and clamps extreme ratios', () => {
  assert.deepEqual(resolveMediaLayout(1600, 900), {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  });
  assert.deepEqual(resolveMediaLayout(1200, 1000), {
    orientation: 'landscape',
    aspectRatio: 1.2,
  });
  assert.deepEqual(resolveMediaLayout(1000, 1000), {
    orientation: 'square',
    aspectRatio: 1,
  });
  assert.deepEqual(resolveMediaLayout(900, 1200), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
  assert.deepEqual(resolveMediaLayout(800, 1000), {
    orientation: 'portrait',
    aspectRatio: 0.8,
  });
  assert.deepEqual(resolveMediaLayout(900, 1600), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
  assert.deepEqual(resolveMediaLayout(0, 900), {
    orientation: 'unknown',
    aspectRatio: 3 / 4,
  });
});

test('resolveMediaLayout treats the 0.9 and 1.1 boundaries as square', () => {
  assert.deepEqual(resolveMediaLayout(9, 10), {
    orientation: 'square',
    aspectRatio: 1,
  });
  assert.deepEqual(resolveMediaLayout(11, 10), {
    orientation: 'square',
    aspectRatio: 1,
  });
});
