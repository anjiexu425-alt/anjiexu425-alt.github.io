import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as diaryMedia from './diary-media.mjs';
import * as diaryState from './diary-state.mjs';
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
const pageLayoutFixture = readFileSync(
  new URL('../page-layout-fixture.html', import.meta.url),
  'utf8',
);
const pageLayoutPlan = readFileSync(
  new URL('../docs/superpowers/plans/2026-07-23-study-diary-page-layout-choice.md', import.meta.url),
  'utf8',
);

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

test('production rendering delegates mapped spreads to the executable DOM builders', () => {
  const renderStaticSource = diarySource.match(/function renderStatic[\s\S]*?\n\}/)?.[0];
  const buildCurlSource = diarySource.match(
    /function buildCurlDOM[\s\S]*?\n\}\n\nfunction updateCurl/,
  )?.[0];

  assert.ok(renderStaticSource);
  assert.match(
    renderStaticSource,
    /const spread = spreadHTMLForEntry\(entry\)/,
  );
  assert.match(
    renderStaticSource,
    /renderSettledSpreadDOM\(stage,\s*spread,\s*\{[\s\S]*?hydrateMedia:/,
  );

  assert.ok(buildCurlSource);
  assert.match(
    buildCurlSource,
    /const transition = transitionHTMLForEntries\(fromEntry,\s*toEntry,\s*false\)/,
  );
  assert.match(
    buildCurlSource,
    /const elements = buildCurlSpreadDOM\(stage,\s*transition\)/,
  );
});

test('production prewarms early and gates click and drag curl construction on ready intrinsic layouts', () => {
  const initEntriesSource = diarySource.match(
    /async function initEntries[\s\S]*?\n\}/,
  )?.[0];
  const prepareCurlSource = diarySource.match(
    /function prepareCurlEntries[\s\S]*?\n\}/,
  )?.[0];
  const playFlipSource = diarySource.match(
    /async function playFlip[\s\S]*?\n\}\n\nconst DRAG_THRESHOLD/,
  )?.[0];
  const pointerDownSource = diarySource.match(
    /function handleStagePointerDown[\s\S]*?\n\}\n\nfunction handleStagePointerMove/,
  )?.[0];

  assert.match(
    diarySource,
    /createMediaIntrinsicPrewarmer\(mediaLayoutCache\)/,
  );
  assert.ok(initEntriesSource);
  assert.match(
    initEntriesSource,
    /mediaIntrinsicPrewarmer\.prewarmAll\(ENTRIES\)[\s\S]*?renderStatic\(\)/,
  );
  assert.ok(prepareCurlSource);
  assert.match(
    prepareCurlSource,
    /mediaIntrinsicPrewarmer\.ensure\(\[fromEntry,\s*toEntry\]\)/,
  );
  assert.ok(playFlipSource);
  assert.match(
    playFlipSource,
    /await prepareCurlEntries\(fromEntry,\s*toEntry\)[\s\S]*?if \(!mediaReady\)[\s\S]*?return;[\s\S]*?buildCurlDOM\(fromEntry,\s*toEntry\)/,
  );
  assert.ok(pointerDownSource);
  assert.match(
    pointerDownSource,
    /if \(!mediaIntrinsicPrewarmer\.isReady\(flipEntries\)\)[\s\S]*?prewarmAll\(flipEntries\)[\s\S]*?return;[\s\S]*?setPointerCapture/,
  );
});

test('prepared flips revalidate captured state and transition before fallback or curl construction', () => {
  const playFlipSource = diarySource.match(
    /async function playFlip[\s\S]*?\n\}\n\nconst DRAG_THRESHOLD/,
  )?.[0];

  assert.ok(playFlipSource);
  assert.match(
    playFlipSource,
    /const flipSnapshot = \{\s*current:\s*state\.current,\s*totalPages:\s*state\.totalPages,\s*descriptor,\s*fromEntry,\s*toEntry,\s*\}/,
  );
  assert.match(
    playFlipSource,
    /await prepareCurlEntries\(fromEntry,\s*toEntry\)[\s\S]*?const currentDescriptor = createFlipTransition\(state\.current,\s*direction\)/,
  );
  assert.match(
    playFlipSource,
    /isFlipSnapshotCurrent\(\s*flipSnapshot,\s*state,\s*currentDescriptor,\s*ENTRIES,\s*\)/,
  );
  assert.match(
    playFlipSource,
    /if \(!transitionIsCurrent\)[\s\S]*?return;[\s\S]*?if \(!mediaReady\)[\s\S]*?finishInstantFlip[\s\S]*?buildCurlDOM/,
  );
});

test('flip snapshot validation rejects page-count, current-page, transition, and entry mutations', () => {
  assert.equal(
    typeof diaryState.isFlipSnapshotCurrent,
    'function',
    'production must expose executable flip snapshot validation',
  );
  const fromEntry = { id: 'from' };
  const toEntry = { id: 'to' };
  const descriptor = createFlipTransition(0, 'next');
  const snapshot = {
    current: 0,
    totalPages: 2,
    descriptor,
    fromEntry,
    toEntry,
  };
  const currentState = { current: 0, totalPages: 2, isOpen: true };
  const entries = [fromEntry, toEntry];

  assert.equal(
    diaryState.isFlipSnapshotCurrent(
      snapshot,
      currentState,
      createFlipTransition(0, 'next'),
      entries,
    ),
    true,
  );
  assert.equal(
    diaryState.isFlipSnapshotCurrent(
      snapshot,
      { ...currentState, totalPages: 3 },
      createFlipTransition(0, 'next'),
      [...entries, { id: 'new' }],
    ),
    false,
  );
  assert.equal(
    diaryState.isFlipSnapshotCurrent(
      snapshot,
      { ...currentState, current: 1 },
      createFlipTransition(1, 'prev'),
      entries,
    ),
    false,
  );
  assert.equal(
    diaryState.isFlipSnapshotCurrent(
      snapshot,
      currentState,
      createFlipTransition(0, 'prev'),
      entries,
    ),
    false,
  );
  assert.equal(
    diaryState.isFlipSnapshotCurrent(
      snapshot,
      currentState,
      createFlipTransition(0, 'next'),
      [fromEntry, { id: 'replacement' }],
    ),
    false,
  );
});

function executableInstantFlipHarness() {
  const finishInstantFlipSource = diarySource.match(
    /function finishInstantFlip[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(finishInstantFlipSource);
  return new Function(
    'goToNext',
    'goToPrevious',
    `
      return (initialState, direction, hydrateMedia) => {
        let state = initialState;
        let isFlipping = true;
        const renders = [];
        let chromeUpdates = 0;
        const renderStatic = (options) => renders.push(options);
        const updateChrome = () => { chromeUpdates += 1; };
        ${finishInstantFlipSource}
        finishInstantFlip(direction, { hydrateMedia });
        return { state, isFlipping, renders, chromeUpdates };
      };
    `,
  )(goToNext, goToPrevious);
}

test('bad image, bad video, and timeout use no-snap instant fallback for Next and Previous', async () => {
  const runInstantFlip = executableInstantFlipHarness();
  const failureCases = [
    {
      label: 'bad image',
      entry: { id: 'bad-image', media: { type: 'image', urls: ['bad.jpg'] } },
      options: {
        loadImageMetadata: async () => {
          throw new Error('bad image');
        },
        timeoutMs: 50,
      },
    },
    {
      label: 'bad video',
      entry: { id: 'bad-video', media: { type: 'video', urls: ['bad.mp4'] } },
      options: {
        loadVideoMetadata: async () => {
          throw new Error('bad video');
        },
        timeoutMs: 50,
      },
    },
    {
      label: 'metadata timeout',
      entry: { id: 'slow-image', media: { type: 'image', urls: ['slow.jpg'] } },
      options: {
        loadImageMetadata: () => new Promise(() => {}),
        timeoutMs: 5,
      },
    },
  ];

  for (const failureCase of failureCases) {
    const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(
      createMediaLayoutCache(),
      failureCase.options,
    );
    assert.equal(
      await prewarmer.ensure([failureCase.entry]),
      false,
      failureCase.label,
    );

    for (const direction of ['next', 'prev']) {
      const initialState = {
        isOpen: true,
        current: direction === 'next' ? 0 : 1,
        totalPages: 2,
      };
      const result = runInstantFlip(initialState, direction, false);
      assert.equal(
        result.state.current,
        direction === 'next' ? 1 : 0,
        `${failureCase.label} ${direction}`,
      );
      assert.equal(result.isFlipping, false);
      assert.deepEqual(result.renders, [{ hydrateMedia: false }]);
      assert.equal(result.chromeUpdates, 1);
    }
  }

  const playFlipSource = diarySource.match(
    /async function playFlip[\s\S]*?\n\}\n\nconst DRAG_THRESHOLD/,
  )?.[0];
  assert.match(
    playFlipSource,
    /if \(!mediaReady\)[\s\S]*?finishInstantFlip\(direction,\s*\{\s*hydrateMedia:\s*false\s*\}\)/,
  );
  assert.match(
    diarySource,
    /function renderStatic\(\{\s*hydrateMedia = true\s*\} = \{\}\)[\s\S]*?hydrateMedia\s*\?[\s\S]*?hydrateSingleMediaLayouts/,
  );
});

test('startup keeps eager gallery image warming without duplicating single-media intrinsic loads', () => {
  const galleryWarmSource = diarySource.match(
    /function preloadEntryGalleryImages[\s\S]*?\n\}/,
  )?.[0];
  const initEntriesSource = diarySource.match(
    /async function initEntries[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(galleryWarmSource);
  assert.match(
    galleryWarmSource,
    /entry\.media\.type !== 'image'[\s\S]*?entry\.media\.urls\.length <= 1/,
  );
  assert.match(galleryWarmSource, /const image = new Image\(\)/);
  assert.ok(initEntriesSource);
  assert.match(
    initEntriesSource,
    /preloadEntryGalleryImages\(ENTRIES\)[\s\S]*?mediaIntrinsicPrewarmer\.prewarmAll\(ENTRIES\)[\s\S]*?renderStatic\(\)/,
  );
});

test('acceptance fixture prewarms real media and delegates settled and curl DOM to production builders', () => {
  assert.match(
    pageLayoutFixture,
    /createMediaIntrinsicPrewarmer/,
  );
  assert.match(
    pageLayoutFixture,
    /renderSettledSpreadDOM/,
  );
  assert.match(
    pageLayoutFixture,
    /buildCurlSpreadDOM/,
  );
  assert.match(
    pageLayoutFixture,
    /await mediaIntrinsicPrewarmer\.ensure\(entries\)/,
  );
  assert.match(
    pageLayoutFixture,
    /renderSettledSpreadDOM\(root,\s*spread\)/,
  );
  assert.match(
    pageLayoutFixture,
    /buildCurlSpreadDOM\(builderStage,\s*transition\)/,
  );
  assert.doesNotMatch(pageLayoutFixture, /layoutCache\.set\(/);
  assert.match(pageLayoutFixture, /Fixture-only form harness/);
});

test('implementation plan identifies the tracked acceptance fixture as an automated test dependency', () => {
  assert.match(
    pageLayoutPlan,
    /tracked `page-layout-fixture\.html` test fixture/,
  );
  assert.match(
    pageLayoutPlan,
    /automated contract test reads this file/,
  );
  assert.doesNotMatch(pageLayoutPlan, /Use an untracked fixture/);
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

test('intrinsic prewarming fills entry-scoped image and video layouts concurrently', async () => {
  assert.equal(
    typeof diaryMedia.createMediaIntrinsicPrewarmer,
    'function',
    'production must expose an intrinsic media prewarmer',
  );
  const imageEntry = {
    id: 'prewarm-image',
    media: { type: 'image', urls: ['photo.jpg'] },
  };
  const videoEntry = {
    id: 'prewarm-video',
    media: { type: 'video', urls: ['clip.mp4'] },
  };
  const calls = [];
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: async (url) => {
      calls.push(['image', url]);
      return { width: 1600, height: 900 };
    },
    loadVideoMetadata: async (url) => {
      calls.push(['video', url]);
      return { width: 900, height: 1200 };
    },
    timeoutMs: 50,
  });

  assert.deepEqual(await prewarmer.prewarmAll([imageEntry, videoEntry]), [
    {
      status: 'ready',
      layout: { orientation: 'landscape', aspectRatio: 16 / 9 },
    },
    {
      status: 'ready',
      layout: { orientation: 'portrait', aspectRatio: 3 / 4 },
    },
  ]);
  assert.deepEqual(calls, [
    ['image', 'photo.jpg'],
    ['video', 'clip.mp4'],
  ]);
  assert.deepEqual(layoutCache.get(imageEntry), {
    orientation: 'landscape',
    aspectRatio: 16 / 9,
  });
  assert.deepEqual(layoutCache.get(videoEntry), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
  assert.equal(prewarmer.isReady([imageEntry, videoEntry]), true);
});

test('bulk intrinsic prewarming never exceeds its configured concurrency and still deduplicates', async () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({
    id: `capped-${index}`,
    media: { type: 'image', urls: [`${index}.jpg`] },
  }));
  let active = 0;
  let maxActive = 0;
  let loadCalls = 0;
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: async () => {
      loadCalls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return { width: 1600, height: 900 };
    },
    maxConcurrency: 2,
    timeoutMs: 50,
  });

  const duplicate = prewarmer.prewarm(entries[0]);
  const results = await prewarmer.prewarmAll(entries);
  assert.deepEqual(await duplicate, {
    status: 'ready',
    layout: { orientation: 'landscape', aspectRatio: 16 / 9 },
  });
  assert.equal(results.length, entries.length);
  assert.equal(maxActive, 2);
  assert.equal(loadCalls, entries.length);
  assert.equal(prewarmer.isReady(entries), true);
});

test('settled render generations do not cancel a target entry prewarm generation', async () => {
  const currentEntry = {
    id: 'settled-current',
    media: { type: 'image', urls: ['current.jpg'] },
  };
  const targetEntry = {
    id: 'pending-target',
    media: { type: 'image', urls: ['target.jpg'] },
  };
  let resolveTarget;
  const targetMetadata = new Promise((resolve) => {
    resolveTarget = resolve;
  });
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: () => targetMetadata,
    timeoutMs: 50,
  });
  const targetPrewarm = prewarmer.prewarm(targetEntry);
  await Promise.resolve();

  const settledGeneration = layoutCache.begin(currentEntry);
  assert.equal(layoutCache.set(settledGeneration, {
    orientation: 'square',
    aspectRatio: 1,
  }), true);
  resolveTarget({ width: 900, height: 1200 });

  assert.deepEqual(await targetPrewarm, {
    status: 'ready',
    layout: { orientation: 'portrait', aspectRatio: 3 / 4 },
  });
  assert.deepEqual(layoutCache.get(targetEntry), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
});

test('intrinsic prewarming is deduplicated and fails within a bounded timeout', async () => {
  const failedEntry = {
    id: 'failed-prewarm',
    media: { type: 'image', urls: ['never.jpg'] },
  };
  let loadCalls = 0;
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: () => {
      loadCalls += 1;
      return new Promise(() => {});
    },
    timeoutMs: 5,
  });

  const first = prewarmer.prewarm(failedEntry);
  const second = prewarmer.prewarm(failedEntry);
  assert.strictEqual(first, second);
  assert.deepEqual(await first, { status: 'timed-out' });
  assert.equal(loadCalls, 1);
  assert.equal(layoutCache.get(failedEntry), undefined);
  assert.equal(await prewarmer.ensure([failedEntry]), false);
});

test('failed metadata and entries without intrinsic media settle without poisoning cache', async () => {
  const failedVideo = {
    id: 'failed-video',
    media: { type: 'video', urls: ['broken.mp4'] },
  };
  const gallery = {
    id: 'gallery',
    media: { type: 'image', urls: ['first.jpg', 'second.jpg'] },
  };
  const placeholder = {
    id: 'placeholder',
    media: { type: 'image', urls: ['[Photo placeholder: campus]'] },
  };
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadVideoMetadata: async () => {
      throw new Error('metadata unavailable');
    },
    timeoutMs: 50,
  });

  assert.deepEqual(await prewarmer.prewarm(failedVideo), { status: 'failed' });
  assert.deepEqual(await prewarmer.prewarm(gallery), { status: 'not-needed' });
  assert.deepEqual(await prewarmer.prewarm(placeholder), { status: 'not-needed' });
  assert.equal(layoutCache.size, 0);
  assert.equal(prewarmer.isReady([gallery, placeholder]), true);
  assert.equal(prewarmer.isReady([failedVideo]), false);
});

test('late prewarm metadata cannot survive an edit or deletion generation', async () => {
  const editedEntry = {
    id: 'prewarm-edited',
    media: { type: 'image', urls: ['before.jpg'] },
  };
  const editedReplacement = {
    id: 'prewarm-edited',
    media: { type: 'image', urls: ['after.jpg'] },
  };
  const deletedEntry = {
    id: 'prewarm-deleted',
    media: { type: 'video', urls: ['deleted.mp4'] },
  };
  let resolveEdited;
  let resolveDeleted;
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: () => new Promise((resolve) => {
      resolveEdited = resolve;
    }),
    loadVideoMetadata: () => new Promise((resolve) => {
      resolveDeleted = resolve;
    }),
    timeoutMs: 50,
  });
  const editedPrewarm = prewarmer.prewarm(editedEntry);
  const deletedPrewarm = prewarmer.prewarm(deletedEntry);
  await Promise.resolve();

  layoutCache.invalidate(editedEntry);
  layoutCache.invalidate(deletedEntry);
  layoutCache.prune([editedReplacement]);
  resolveEdited({ width: 1600, height: 900 });
  resolveDeleted({ width: 900, height: 1200 });

  assert.deepEqual(await editedPrewarm, { status: 'stale' });
  assert.deepEqual(await deletedPrewarm, { status: 'stale' });
  assert.equal(layoutCache.get(editedReplacement), undefined);
  assert.equal(layoutCache.get(deletedEntry), undefined);
});

test('an in-place media edit starts a new prewarm instead of deduplicating stale work', async () => {
  const entry = {
    id: 'in-place-edit',
    media: { type: 'image', urls: ['before.jpg'] },
  };
  const resolvers = new Map();
  const layoutCache = createMediaLayoutCache();
  const prewarmer = diaryMedia.createMediaIntrinsicPrewarmer(layoutCache, {
    loadImageMetadata: (url) => new Promise((resolve) => {
      resolvers.set(url, resolve);
    }),
    timeoutMs: 50,
  });

  const beforePrewarm = prewarmer.prewarm(entry);
  await Promise.resolve();
  entry.media.urls = ['after.jpg'];
  const afterPrewarm = prewarmer.prewarm(entry);
  await Promise.resolve();

  assert.notStrictEqual(beforePrewarm, afterPrewarm);
  resolvers.get('before.jpg')({ width: 1600, height: 900 });
  resolvers.get('after.jpg')({ width: 900, height: 1200 });
  assert.deepEqual(await beforePrewarm, { status: 'stale' });
  assert.deepEqual(await afterPrewarm, {
    status: 'ready',
    layout: { orientation: 'portrait', aspectRatio: 3 / 4 },
  });
  assert.deepEqual(layoutCache.get(entry), {
    orientation: 'portrait',
    aspectRatio: 3 / 4,
  });
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
