import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as diaryMedia from './diary-media.mjs';
const {
  applySingleMediaLayout,
  createMediaLayoutCache,
  hydrateSingleMediaLayouts,
  mediaContainerHTML,
} = diaryMedia;
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
const diaryCSS = readFileSync(new URL('../css/pages.css', import.meta.url), 'utf8');
const diaryHTML = readFileSync(new URL('../study-diary.html', import.meta.url), 'utf8');

test('Write/Edit form exposes an accessible default page-layout choice', () => {
  const layoutFieldset = diaryHTML.match(
    /<fieldset class="diary-form__layout">[\s\S]*?<\/fieldset>/,
  )?.[0];

  assert.ok(layoutFieldset);
  assert.match(layoutFieldset, /<legend>Page layout<\/legend>/);
  assert.match(
    layoutFieldset,
    /name="pageLayout"[^>]*value="text-left"[^>]*checked/,
  );
  assert.match(layoutFieldset, /name="pageLayout"[^>]*value="media-left"/);
  assert.match(layoutFieldset, /Text Left · Media Right/);
  assert.match(layoutFieldset, /Media Left · Text Right/);
});

test('page-layout choice has checked, keyboard-focus, and responsive styles', () => {
  assert.match(diaryCSS, /\.diary-form__layout\s*\{/);
  assert.match(diaryCSS, /\.diary-form__layout-option:has\(input:checked\)/);
  assert.match(diaryCSS, /\.diary-form__layout-option input:focus-visible\s*\{/);
  assert.match(
    diaryCSS,
    /@media \(max-width: 560px\) \{[\s\S]*?\.diary-form__layout\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  );
});

test('Write/Edit layout is filled, saved, and reset through normalized form state', () => {
  const setMediaTypeSource = diarySource.match(
    /function setMediaType[\s\S]*?\n\}/,
  )?.[0];
  const handleOpenEditorSource = diarySource.match(
    /function handleOpenEditor[\s\S]*?\n\}/,
  )?.[0];
  const closeWriteModalSource = diarySource.match(
    /function closeWriteModal[\s\S]*?\n\}/,
  )?.[0];
  const handleFormSubmitSource = diarySource.match(
    /async function handleFormSubmit[\s\S]*?\n\}\n\ndocument/,
  )?.[0];

  assert.ok(setMediaTypeSource);
  assert.doesNotMatch(setMediaTypeSource, /pageLayout|reset\(/);
  assert.ok(handleOpenEditorSource);
  assert.match(
    handleOpenEditorSource,
    /form\.pageLayout\.value\s*=\s*normalizePageLayout\(entry\.media\.layout\)/,
  );
  assert.ok(closeWriteModalSource);
  assert.match(
    closeWriteModalSource,
    /form\.reset\(\);[\s\S]*?form\.pageLayout\.value\s*=\s*'text-left'/,
  );
  assert.ok(handleFormSubmitSource);
  assert.match(
    handleFormSubmitSource,
    /const pageLayout\s*=\s*normalizePageLayout\(data\.get\('pageLayout'\)\)/,
  );
  assert.match(handleFormSubmitSource, /layout:\s*pageLayout/);
  assert.equal(
    handleFormSubmitSource.match(/mediaWithPageLayout\(/g)?.length,
    2,
  );
});

test('Polaroid frames use orientation-specific desktop widths', () => {
  const desktopCSS = diaryCSS.match(
    /\.diary-polaroid \{[\s\S]*?(?=@media \(min-width: 769px\))/,
  )?.[0];

  assert.ok(desktopCSS);
  assert.match(desktopCSS, /\.diary-polaroid--landscape[\s\S]*width:\s*380px/);
  assert.match(desktopCSS, /\.diary-polaroid--square[\s\S]*width:\s*350px/);
  assert.match(desktopCSS, /\.diary-polaroid--portrait[\s\S]*width:\s*330px/);
  assert.match(desktopCSS, /\.diary-polaroid--unknown[\s\S]*width:\s*330px/);
  assert.match(desktopCSS, /\.diary-polaroid--gallery[\s\S]*width:\s*330px/);
  assert.match(
    desktopCSS,
    /\.diary-polaroid \{[\s\S]*transition:\s*transform var\(--transition-slow\),\s*width 220ms ease/,
  );
});

test('Polaroid frames stay fluid at tablet and mobile widths', () => {
  const tabletCSS = diaryCSS.match(
    /@media \(min-width: 769px\) and \(max-width: 1024px\) \{([\s\S]*?)\n\}\n\n\.diary-page__header/,
  )?.[1];
  const mobileCSS = diaryCSS.slice(diaryCSS.lastIndexOf('@media (max-width: 768px)'));

  assert.ok(tabletCSS);
  assert.match(tabletCSS, /\.diary-polaroid--landscape[\s\S]*width:\s*min\(350px,\s*100%\)/);
  assert.match(tabletCSS, /\.diary-polaroid--square[\s\S]*width:\s*min\(330px,\s*100%\)/);
  assert.match(tabletCSS, /\.diary-polaroid--portrait[\s\S]*width:\s*min\(310px,\s*100%\)/);
  assert.match(tabletCSS, /\.diary-polaroid--unknown[\s\S]*width:\s*min\(310px,\s*100%\)/);
  assert.match(tabletCSS, /\.diary-polaroid--gallery[\s\S]*width:\s*min\(310px,\s*100%\)/);

  assert.match(mobileCSS, /^@media \(max-width: 768px\) \{/);
  assert.match(mobileCSS, /\.diary-polaroid--landscape[\s\S]*width:\s*min\(360px,\s*100%\)/);
  assert.match(mobileCSS, /\.diary-polaroid--square[\s\S]*width:\s*min\(320px,\s*100%\)/);
  assert.match(mobileCSS, /\.diary-polaroid--portrait[\s\S]*width:\s*min\(270px,\s*100%\)/);
  assert.match(mobileCSS, /\.diary-polaroid--unknown[\s\S]*width:\s*min\(270px,\s*100%\)/);
  assert.match(mobileCSS, /\.diary-polaroid--gallery[\s\S]*width:\s*min\(270px,\s*100%\)/);
});

test('reduced motion removes the Polaroid frame width transition', () => {
  assert.match(
    diaryCSS,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.diary-polaroid\s*\{\s*transition:\s*none;\s*\}[\s\S]*?\}/,
  );
});

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
  frame = null,
  classes = [
    'diary-page__media',
    'diary-page__media--single',
    'diary-page__media--unknown',
  ],
} = {}) {
  let queryCount = 0;
  return {
    classList: fakeClassList(...classes),
    style: fakeStyle(),
    querySelector() {
      queryCount += 1;
      return media;
    },
    closest(selector) {
      assert.equal(selector, '.diary-polaroid');
      return frame;
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

test('diary rendering preserves media cache lifecycle across static and temporary HTML', () => {
  const renderStaticSource = diarySource.match(/function renderStatic[\s\S]*?\n\}/);
  const buildCurlSource = diarySource.match(/function buildCurlDOM[\s\S]*?\n\}\n\nfunction updateCurl/);
  const initEntriesSource = diarySource.match(/async function initEntries[\s\S]*?\n\}/);
  const handleDiscardSource = diarySource.match(/async function handleDiscard[\s\S]*?\n\}/);
  const handleFormSubmitSource = diarySource.match(/async function handleFormSubmit[\s\S]*?\n\}\n\ndocument/);

  assert.ok(renderStaticSource);
  assert.match(renderStaticSource[0], /hydrateSingleMediaLayouts/);
  assert.match(renderStaticSource[0], /mediaLayoutCache\.begin/);
  assert.match(renderStaticSource[0], /mediaLayoutCache\.set/);
  assert.equal(diarySource.match(/hydrateSingleMediaLayouts\(/g)?.length, 1);
  assert.ok(buildCurlSource);
  assert.match(buildCurlSource[0], /transitionHTMLForEntries\(fromEntry,\s*toEntry,\s*false\)/);
  assert.ok(initEntriesSource);
  assert.match(initEntriesSource[0], /mediaLayoutCache\.invalidate\(\)/);
  assert.match(initEntriesSource[0], /mediaLayoutCache\.prune\(ENTRIES\)/);
  assert.ok(handleDiscardSource);
  assert.match(handleDiscardSource[0], /mediaLayoutCache\.invalidate/);
  assert.match(handleDiscardSource[0], /mediaLayoutCache\.prune\(ENTRIES\)/);
  assert.ok(handleFormSubmitSource);
  assert.match(handleFormSubmitSource[0], /mediaLayoutCache\.invalidate\(existingEntry\)/);
  assert.match(handleFormSubmitSource[0], /mediaLayoutCache\.prune\(ENTRIES\)/);
});

test('static and sliced curl DOM consume shared physical spread mappings', () => {
  const renderStaticSource = diarySource.match(/function renderStatic[\s\S]*?\n\}/)?.[0];
  const buildCurlSource = diarySource.match(
    /function buildCurlDOM[\s\S]*?\n\}\n\nfunction updateCurl/,
  )?.[0];

  assert.ok(renderStaticSource);
  assert.match(
    renderStaticSource,
    /const spread = spreadHTMLForEntry\(entry\)/,
  );
  assert.match(renderStaticSource, /\$\{spread\.leftHTML\}/);
  assert.match(renderStaticSource, /\$\{spread\.rightHTML\}/);

  assert.ok(buildCurlSource);
  assert.match(
    buildCurlSource,
    /const transition = transitionHTMLForEntries\(fromEntry,\s*toEntry,\s*false\)/,
  );
  assert.match(buildCurlSource, /leftPage\.innerHTML = transition\.underlayLeftHTML/);
  assert.match(buildCurlSource, /rightPage\.innerHTML = transition\.underlayRightHTML/);
  assert.match(buildCurlSource, /const frontHTML = transition\.frontHTML/);
  assert.match(buildCurlSource, /const backHTML = transition\.backHTML/);
  assert.match(
    buildCurlSource,
    /frontCanvas\.innerHTML = `<div class="diary-page \$\{frontClass\}">\$\{frontHTML\}<\/div>`/,
  );
  assert.match(
    buildCurlSource,
    /backCanvas\.innerHTML = `<div class="diary-page \$\{backClass\}">\$\{backHTML\}<\/div>`/,
  );
});

test('content-role wrappers own text and media alignment independently of physical side', () => {
  assert.match(
    diaryCSS,
    /\.diary-page__content\s*\{[^}]*width:\s*100%[^}]*min-height:\s*100%/s,
  );
  assert.match(
    diaryCSS,
    /\.diary-page__content--media\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
  );

  const physicalRightRule = diaryCSS.match(/\.diary-page--right\s*\{([^}]*)\}/)?.[1];
  assert.ok(physicalRightRule);
  assert.doesNotMatch(physicalRightRule, /align-items|justify-content/);
});

test('single-media layout updates the orientation class and CSS aspect variable', () => {
  const container = fakeMediaContainer();

  const layout = applySingleMediaLayout(container, 1600, 900);

  assert.deepEqual(layout, { orientation: 'landscape', aspectRatio: 16 / 9 });
  assert.equal(container.classList.contains('diary-page__media--unknown'), false);
  assert.equal(container.classList.contains('diary-page__media--landscape'), true);
  assert.equal(container.style.getPropertyValue('--diary-media-aspect'), String(16 / 9));
});

test('right-page media frames serialize cached layouts and safe outer fallbacks', () => {
  const landscapeEntry = {
    id: 'landscape-polaroid',
    media: { type: 'image', urls: ['landscape.jpg'] },
  };
  const uncachedEntry = {
    id: 'uncached-polaroid',
    media: { type: 'image', urls: ['uncached.jpg'] },
  };
  const galleryEntry = {
    id: 'gallery-polaroid',
    media: { type: 'image', urls: ['first.jpg', 'second.jpg'] },
  };
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(landscapeEntry);
  layoutCache.set(generation, { orientation: 'landscape', aspectRatio: 16 / 9 });
  const renderFrame = (entry) => diaryMedia.rightPageMediaFrameHTML(entry, {
    layoutCache,
    renderItem: () => '<img class="diary-page__photo">',
  });

  assert.match(
    renderFrame(landscapeEntry),
    /<div class="diary-polaroid diary-polaroid--landscape">/,
  );
  assert.match(
    renderFrame(uncachedEntry),
    /<div class="diary-polaroid diary-polaroid--unknown">/,
  );
  assert.match(
    renderFrame(galleryEntry),
    /<div class="diary-polaroid diary-polaroid--gallery">/,
  );
});

test('single-media hydration replaces the closest Polaroid orientation class', () => {
  const frame = { classList: fakeClassList('diary-polaroid--portrait') };
  const image = fakeMedia({
    complete: true,
    naturalWidth: 1000,
    naturalHeight: 1000,
  });
  const container = fakeMediaContainer({ media: image, frame });

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), { isImage: () => true });

  assert.equal(frame.classList.contains('diary-polaroid--portrait'), false);
  assert.equal(frame.classList.contains('diary-polaroid--square'), true);
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
    onLayout: (layout) => resolved.push(layout),
  });

  assert.equal(container.classList.contains('diary-page__media--portrait'), true);
  assert.equal(image.listener('load'), undefined);
  assert.deepEqual(resolved, [
    { orientation: 'portrait', aspectRatio: 3 / 4 },
  ]);
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
  const imageContainer = fakeMediaContainer({ media: image });
  const videoContainer = fakeMediaContainer({ media: video });
  const resolved = [];

  hydrateSingleMediaLayouts(fakeMediaRoot([imageContainer, videoContainer]), {
    isImage: (media) => media === image,
    haveMetadata: 1,
    onLayout: (layout) => resolved.push(layout),
  });

  assert.deepEqual(image.listener('load')?.options, { once: true });
  assert.deepEqual(video.listener('loadedmetadata')?.options, { once: true });
  image.dispatch('load');
  video.dispatch('loadedmetadata');
  assert.equal(imageContainer.classList.contains('diary-page__media--landscape'), true);
  assert.equal(videoContainer.classList.contains('diary-page__media--portrait'), true);
  assert.deepEqual(resolved.map(({ orientation }) => orientation), ['landscape', 'portrait']);
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

test('temporary right-page and slice HTML serialize each cached outer Polaroid orientation', () => {
  const entry = {
    id: 'wide-entry',
    title: 'Wide view',
    media: { type: 'image', urls: ['wide.jpg'] },
  };
  const targetEntry = {
    id: 'square-entry',
    title: 'Square view',
    media: { type: 'image', urls: ['square.jpg'] },
  };
  const image = fakeMedia({
    complete: true,
    naturalWidth: 1600,
    naturalHeight: 900,
  });
  const container = fakeMediaContainer({ media: image });
  const layoutCache = createMediaLayoutCache();
  const entryGeneration = layoutCache.begin(entry);

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => true,
    onLayout: (layout) => layoutCache.set(entryGeneration, layout),
  });
  const targetGeneration = layoutCache.begin(targetEntry);
  layoutCache.set(targetGeneration, {
    orientation: 'square',
    aspectRatio: 1,
  });
  assert.equal(typeof diaryMedia.rightPageMediaFrameHTML, 'function');
  const sliceFrontHTML = diaryMedia.rightPageMediaFrameHTML(entry, {
    active: false,
    layoutCache,
    renderItem: (_entry, _url, _index, _total, active) => {
      assert.equal(active, false);
      return '<img class="diary-page__photo">';
    },
  });
  const targetPageHTML = diaryMedia.rightPageMediaFrameHTML(targetEntry, {
    active: false,
    layoutCache,
    renderItem: () => '<img class="diary-page__photo">',
  });

  assert.match(
    sliceFrontHTML,
    /<div class="diary-polaroid diary-polaroid--landscape">/,
  );
  assert.match(sliceFrontHTML, /diary-page__media--landscape/);
  assert.match(sliceFrontHTML, /--diary-media-aspect:1\.777/);
  assert.doesNotMatch(sliceFrontHTML, /diary-polaroid--unknown/);
  assert.match(
    targetPageHTML,
    /<div class="diary-polaroid diary-polaroid--square">/,
  );
  assert.match(targetPageHTML, /diary-page__media--square/);
  assert.match(targetPageHTML, /--diary-media-aspect:1;/);
});

test('uncached temporary HTML and placeholders use the safe unknown fallback', () => {
  const layoutCache = createMediaLayoutCache();
  const renderItem = () => '<div class="diary-placeholder"></div>';
  const placeholderEntry = {
    id: 'placeholder-entry',
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
    id: 'gallery-entry',
    media: { type: 'image', urls: ['first.jpg', 'second.jpg'] },
  };
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(entry);
  layoutCache.set(generation, { orientation: 'landscape', aspectRatio: 16 / 9 });

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

test('media layout cache isolates entries that reuse the same URL', () => {
  const firstEntry = {
    id: 'first-entry',
    media: { type: 'image', urls: ['shared.jpg'] },
  };
  const reusedUrlEntry = {
    id: 'second-entry',
    media: { type: 'image', urls: ['shared.jpg'] },
  };
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(firstEntry);

  assert.equal(layoutCache.set(generation, {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  }), true);

  assert.deepEqual(layoutCache.get(firstEntry), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
  assert.equal(layoutCache.get(reusedUrlEntry), undefined);
  assert.match(mediaContainerHTML(reusedUrlEntry, {
    active: false,
    layoutCache,
    renderItem: () => '<img>',
  }), /diary-page__media--unknown/);
});

test('media replacement invalidates a same-entry same-URL layout and its old generation', () => {
  const oldEntry = {
    id: 'edited-entry',
    media: { type: 'image', urls: ['stable-storage-url.jpg'] },
  };
  const replacedEntry = {
    id: 'edited-entry',
    media: { type: 'image', urls: ['stable-storage-url.jpg'] },
  };
  const layoutCache = createMediaLayoutCache();
  const oldGeneration = layoutCache.begin(oldEntry);
  layoutCache.set(oldGeneration, {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });

  layoutCache.invalidate(oldEntry);

  assert.equal(layoutCache.get(replacedEntry), undefined);
  assert.equal(layoutCache.set(oldGeneration, {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  }), false);

  const replacementGeneration = layoutCache.begin(replacedEntry);
  assert.equal(layoutCache.set(replacementGeneration, {
    orientation: 'square',
    aspectRatio: 1,
  }), true);
  assert.deepEqual(layoutCache.get(replacedEntry), {
    orientation: 'square',
    aspectRatio: 1,
  });
});

test('switching an entry to different media never serializes its previous layout', () => {
  const oldEntry = {
    id: 'switching-entry',
    media: { type: 'image', urls: ['portrait.jpg'] },
  };
  const switchedEntry = {
    id: 'switching-entry',
    media: { type: 'video', urls: ['landscape.mp4'] },
  };
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(oldEntry);
  layoutCache.set(generation, {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });

  const html = mediaContainerHTML(switchedEntry, {
    active: false,
    layoutCache,
    renderItem: () => '<video controls></video>',
  });

  assert.equal(layoutCache.get(switchedEntry), undefined);
  assert.match(html, /diary-page__media--unknown/);
  assert.doesNotMatch(html, /diary-page__media--portrait/);
  assert.doesNotMatch(html, /--diary-media-aspect:/);
});

test('prune removes unreferenced layouts and rejects their late generations', () => {
  const deletedEntry = {
    id: 'deleted-entry',
    media: { type: 'image', urls: ['deleted.jpg'] },
  };
  const changedEntry = {
    id: 'changed-entry',
    media: { type: 'image', urls: ['before.jpg'] },
  };
  const changedEntryAfterInit = {
    id: 'changed-entry',
    media: { type: 'image', urls: ['after.jpg'] },
  };
  const layoutCache = createMediaLayoutCache();
  const deletedGeneration = layoutCache.begin(deletedEntry);
  layoutCache.set(deletedGeneration, { orientation: 'square', aspectRatio: 1 });
  const changedGeneration = layoutCache.begin(changedEntry);
  layoutCache.set(changedGeneration, { orientation: 'portrait', aspectRatio: 3 / 4 });

  layoutCache.prune([changedEntryAfterInit]);

  assert.equal(layoutCache.size, 0);
  assert.equal(layoutCache.get(deletedEntry), undefined);
  assert.equal(layoutCache.get(changedEntryAfterInit), undefined);
  assert.equal(layoutCache.set(deletedGeneration, {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  }), false);
  assert.equal(layoutCache.set(changedGeneration, {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  }), false);
});

test('a late image load after deletion cannot update its old container or cache generation', () => {
  const entry = {
    id: 'late-entry',
    media: { type: 'image', urls: ['slow.jpg'] },
  };
  const image = fakeMedia({
    complete: false,
    naturalWidth: 1600,
    naturalHeight: 900,
  });
  const container = fakeMediaContainer({ media: image });
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(entry);

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => true,
    onLayout: (layout) => layoutCache.set(generation, layout),
  });
  layoutCache.invalidate(entry);
  layoutCache.prune([]);
  image.dispatch('load');

  assert.equal(layoutCache.size, 0);
  assert.equal(layoutCache.get(entry), undefined);
  assert.equal(container.classList.contains('diary-page__media--unknown'), true);
  assert.equal(container.classList.contains('diary-page__media--landscape'), false);
});

test('rendering another entry expires a pending load from the previous settled page', () => {
  const previousEntry = {
    id: 'previous-entry',
    media: { type: 'image', urls: ['previous-slow.jpg'] },
  };
  const currentEntry = {
    id: 'current-entry',
    media: { type: 'image', urls: ['current.jpg'] },
  };
  const image = fakeMedia({
    complete: false,
    naturalWidth: 1600,
    naturalHeight: 900,
  });
  const container = fakeMediaContainer({ media: image });
  const layoutCache = createMediaLayoutCache();
  const previousGeneration = layoutCache.begin(previousEntry);

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => true,
    onLayout: (layout) => layoutCache.set(previousGeneration, layout),
  });
  layoutCache.begin(currentEntry);
  image.dispatch('load');

  assert.equal(layoutCache.get(previousEntry), undefined);
  assert.equal(container.classList.contains('diary-page__media--unknown'), true);
  assert.equal(container.classList.contains('diary-page__media--landscape'), false);
});

test('a late video metadata event after media replacement cannot write the old generation', () => {
  const entry = {
    id: 'video-entry',
    media: { type: 'video', urls: ['stable-video-url.mp4'] },
  };
  const video = fakeMedia({
    readyState: 0,
    videoWidth: 1600,
    videoHeight: 900,
  });
  const container = fakeMediaContainer({ media: video });
  const layoutCache = createMediaLayoutCache();
  const generation = layoutCache.begin(entry);

  hydrateSingleMediaLayouts(fakeMediaRoot([container]), {
    isImage: () => false,
    haveMetadata: 1,
    onLayout: (layout) => layoutCache.set(generation, layout),
  });
  layoutCache.invalidate(entry);
  video.dispatch('loadedmetadata');

  assert.equal(layoutCache.get(entry), undefined);
  assert.equal(container.classList.contains('diary-page__media--unknown'), true);
  assert.equal(container.classList.contains('diary-page__media--landscape'), false);
});

test('an entry with no media URLs uses the unknown 3:4 single-media fallback', () => {
  const entry = {
    id: 'empty-media-entry',
    media: { type: 'image', urls: [] },
  };
  const html = mediaContainerHTML(entry, {
    layoutCache: createMediaLayoutCache(),
    renderItem: () => '<img>',
  });

  assert.match(html, /diary-page__media--single/);
  assert.match(html, /diary-page__media--unknown/);
  assert.doesNotMatch(html, /--diary-media-aspect:/);
  assert.match(
    diaryCSS,
    /\.diary-page__media--single\s*\{[^}]*aspect-ratio:\s*var\(--diary-media-aspect,\s*3\s*\/\s*4\)/s,
  );
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

test('resolveMediaLayout clamps a 4000 by 1000 panorama to 16:9', () => {
  assert.deepEqual(resolveMediaLayout(4000, 1000), {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  });
});

test('resolveMediaLayout falls back for non-finite, negative, and missing dimensions', () => {
  const invalidDimensions = [
    [NaN, 1000],
    [1000, NaN],
    [Infinity, 1000],
    [1000, Infinity],
    [-1000, 1000],
    [1000, -1000],
    [undefined, undefined],
    [1000, undefined],
  ];

  invalidDimensions.forEach(([width, height]) => {
    assert.deepEqual(resolveMediaLayout(width, height), {
      orientation: 'unknown',
      aspectRatio: 3 / 4,
    });
  });
});
