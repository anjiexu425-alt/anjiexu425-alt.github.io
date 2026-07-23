import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  computeDirectionalDragProgress,
  shouldActivateDirectionalDrag,
  isFlipInteractionLocked,
  ownsDragInteraction,
  createFlipTransition,
  isFlipSnapshotCurrent,
  resolveDragSettle,
  computeSliceThetas,
  computeSliceLayout,
  computeCurlMotion,
  computeUnderlayOpacities,
  easeInOutCubic,
} from './diary-state.mjs';
import {
  createMediaIntrinsicPrewarmer,
  createMediaLayoutCache,
  hydrateSingleMediaLayouts,
} from './diary-media.mjs';
import {
  fetchEntries,
  insertEntry,
  deleteEntry,
  updateEntry,
  uploadFile,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
} from './diary-supabase.js';
import {
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
  resolveMediaUrls,
  buildEditPatch,
} from './diary-validation.mjs';
import {
  isPlaceholder,
  normalizePageLayout,
  mediaWithPageLayout,
  spreadHTMLForEntry as mapSpreadHTMLForEntry,
  transitionHTMLForEntries as mapTransitionHTMLForEntries,
} from './diary-layout.mjs';
import {
  renderSettledSpreadDOM,
  buildCurlSpreadDOM,
} from './diary-dom.mjs';
import {
  normalizeCategory,
  mergeCategoryOptions,
  categoryOptionsHTML,
} from './diary-category.mjs';

// Entries live in Supabase now (see js/diary-supabase.js) — this array is
// populated asynchronously by initEntries() on page load, and mutated in
// place by handleDiscard/setMood/handleFormSubmit after each successful
// write so the UI stays in sync with the database.
let ENTRIES = [];

function refreshCategoryOptions() {
  document.querySelector('#diary-category-options').innerHTML = categoryOptionsHTML(
    mergeCategoryOptions(ENTRIES),
  );
}

let state = createDiaryState(ENTRIES.length);
let isFlipping = false;
const mediaLayoutCache = createMediaLayoutCache();
const mediaIntrinsicPrewarmer = createMediaIntrinsicPrewarmer(mediaLayoutCache);

// Non-null while the write/edit modal is open in edit mode — the id of the
// entry being edited. Reset to null by closeWriteModal() so an in-progress
// or cancelled edit never leaks into the next "Write Diary" draft.
let editingEntryId = null;

// Static, per-book branding — not tied to any one entry, printed on every
// spread like a running header/footer in a real printed book.
const DIARY_TAGLINE = 'Abroad & Reflection Sanctuary';
const DIARY_BRAND = 'Abroad in Serenity';
const DIARY_EDITION = '2026 Edition';

const MOOD_OPTIONS = ['😊 Happy', '😌 Calm', '🥰 Loved', '😔 Sad', '😆 Excited', '😴 Tired'];
const WEATHER_OPTIONS = ['☀️ Sunny', '⛅ Cloudy', '🌧️ Rainy', '❄️ Snowy', '🌬️ Windy', '🌈 Rainbow'];

// Which entry + which of the two fields (mood or weather) the mood modal
// is currently editing — null when the modal is closed.
let moodModalTarget = null;

// Only true once a real Supabase session exists — controls whether the
// Write Diary button, per-entry Discard buttons, and Mood/Weather buttons
// render at all. This is a UX nicety, not the real security boundary —
// that's the database's Row Level Security policies (see Prerequisites).
let isLoggedIn = false;

function pageContentOptions(active) {
  return {
    active,
    entries: ENTRIES,
    isLoggedIn,
    layoutCache: mediaLayoutCache,
    tagline: DIARY_TAGLINE,
    brand: DIARY_BRAND,
    edition: DIARY_EDITION,
  };
}

function spreadHTMLForEntry(entry, active = true) {
  return mapSpreadHTMLForEntry(entry, pageContentOptions(active));
}

function transitionHTMLForEntries(fromEntry, toEntry, active = true) {
  return mapTransitionHTMLForEntries(
    fromEntry,
    toEntry,
    pageContentOptions(active),
  );
}

function renderStatic({ hydrateMedia = true } = {}) {
  const stage = document.querySelector('.diary-stage');
  if (ENTRIES.length === 0) {
    mediaLayoutCache.prune([]);
    stage.innerHTML = '<p class="diary-empty">No diary pages yet — click "Write Diary" to add one.</p>';
    return;
  }
  const entry = ENTRIES[state.current];
  const layoutGeneration = mediaLayoutCache.begin(entry);
  const spread = spreadHTMLForEntry(entry);
  const hydrateRenderedMedia = hydrateMedia
    ? (root) => hydrateSingleMediaLayouts(root, {
      onLayout: (layout) => mediaLayoutCache.set(layoutGeneration, layout),
    })
    : undefined;
  renderSettledSpreadDOM(stage, spread, {
    hydrateMedia: hydrateRenderedMedia,
  });
}

function preloadEntryGalleryImages(entries) {
  entries.forEach((entry) => {
    if (entry.media.type !== 'image' || entry.media.urls.length <= 1) return;
    entry.media.urls.forEach((url) => {
      if (isPlaceholder(url)) return;
      const image = new Image();
      image.src = url;
    });
  });
}

// Runs once on page load. Shows a loading message inside .diary-stage
// (invisible until the book is opened, since .diary-book is display:none
// until .diary.is-open) so that by the time the user clicks the cover
// open, real content is already in place.
async function initEntries() {
  const stage = document.querySelector('.diary-stage');
  stage.innerHTML = '<p class="diary-empty">Loading diary…</p>';
  try {
    const rows = await fetchEntries();
    mediaLayoutCache.invalidate();
    ENTRIES = rows.map(supabaseRowToEntry);
    mediaLayoutCache.prune(ENTRIES);
    refreshCategoryOptions();
  } catch (error) {
    stage.innerHTML = '<p class="diary-empty">Couldn’t load diary entries. Please check your connection and try again.</p>';
    console.error('Failed to load diary entries', error);
    return;
  }
  // Start entry-scoped image/video metadata loading before rendering the
  // first spread. This stays fire-and-forget so diary startup is never
  // blocked; click/drag paths below gate curl construction on the same
  // bounded, deduplicated work.
  preloadEntryGalleryImages(ENTRIES);
  void mediaIntrinsicPrewarmer.prewarmAll(ENTRIES);
  state = createDiaryState(ENTRIES.length);
  buildDots();
  renderStatic();
  updateChrome();
}

// Only real photos are zoomable — placeholders have nothing to enlarge, and
// video already has its own native fullscreen control via `controls`.
function openLightbox(src, alt) {
  const backdrop = document.querySelector('.diary-lightbox-backdrop');
  const img = document.querySelector('.diary-lightbox__image');
  img.src = src;
  img.alt = alt;
  backdrop.hidden = false;
}

function closeLightbox() {
  const backdrop = document.querySelector('.diary-lightbox-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-lightbox__image').src = '';
}

function openMoodModal(id, kind) {
  moodModalTarget = { id, kind };
  const options = kind === 'mood' ? MOOD_OPTIONS : WEATHER_OPTIONS;
  document.querySelector('.diary-mood-modal__title').textContent = kind === 'mood' ? 'Mood' : 'Weather';
  document.querySelector('.diary-mood-modal__options').innerHTML = options
    .map((option) => `<button type="button" class="diary-mood-modal__option" data-value="${option}">${option}</button>`)
    .join('');
  document.querySelector('.diary-mood-modal-backdrop').hidden = false;
}

function closeMoodModal() {
  document.querySelector('.diary-mood-modal-backdrop').hidden = true;
  moodModalTarget = null;
}

function applyAuthState(session) {
  isLoggedIn = Boolean(session);
  document.querySelector('.diary-write-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-edit-btn').hidden = !isLoggedIn;
  document.querySelector('.diary-login-btn').textContent = isLoggedIn ? 'Log Out' : 'Log In';
  renderStatic();
}

function openLoginModal() {
  document.querySelector('.diary-login-form .diary-form__error').hidden = true;
  document.querySelector('.diary-login-modal-backdrop').hidden = false;
}

function closeLoginModal() {
  document.querySelector('.diary-login-modal-backdrop').hidden = true;
  document.querySelector('.diary-login-form').reset();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorEl = document.querySelector('.diary-login-form .diary-form__error');
  errorEl.hidden = true;
  try {
    await signIn(data.get('email').trim(), data.get('password'));
    closeLoginModal();
  } catch (error) {
    errorEl.textContent = 'Incorrect email or password.';
    errorEl.hidden = false;
  }
}

async function handleLoginBtnClick() {
  if (isLoggedIn) {
    await signOut();
  } else {
    openLoginModal();
  }
}

async function setMood(value) {
  if (!moodModalTarget) return;
  const { id, kind } = moodModalTarget;
  try {
    await updateEntry(id, { [kind]: value || null });
  } catch (error) {
    window.alert('Could not save that. Please try again.');
    return;
  }
  const entry = ENTRIES.find((e) => e.id === id);
  if (entry) entry[kind] = value;
  mediaLayoutCache.prune(ENTRIES);
  closeMoodModal();
  renderStatic();
}

async function handleDiscard(id) {
  if (!window.confirm("Discard this diary page? This can't be undone.")) return;
  try {
    await deleteEntry(id);
  } catch (error) {
    window.alert('Could not discard this entry. Please try again.');
    return;
  }
  const removedIndex = ENTRIES.findIndex((entry) => entry.id === id);
  if (removedIndex === -1) return;
  mediaLayoutCache.invalidate(ENTRIES[removedIndex]);
  ENTRIES.splice(removedIndex, 1);
  mediaLayoutCache.prune(ENTRIES);
  refreshCategoryOptions();
  const nextIndex = Math.max(0, Math.min(state.current, ENTRIES.length - 1));
  state = goToPage(openBook(createDiaryState(ENTRIES.length)), nextIndex);
  buildDots();
  renderStatic();
  updateChrome();
}

function updateChrome() {
  const countLabel = state.totalPages === 0 ? '0 / 0' : `${state.current + 1} / ${state.totalPages}`;
  const interactionLocked = isFlipInteractionLocked(isFlipping, dragFlip);
  document.querySelector('.diary-pagination__count').textContent = countLabel;
  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });
  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state) || interactionLocked;
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state) || interactionLocked;
  document.querySelector('.diary-edit-btn').disabled = ENTRIES.length === 0;
}

function buildDots() {
  const dotsEl = document.querySelector('.diary-pagination__dots');
  dotsEl.innerHTML = '';
  ENTRIES.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'diary-pagination__dot';
    dot.setAttribute('role', 'button');
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('aria-label', `Jump to page ${i + 1}`);
    dot.addEventListener('click', () => {
      if (isFlipInteractionLocked(isFlipping, dragFlip) || i === state.current) return;
      state = goToPage(state, i);
      renderStatic();
      updateChrome();
    });
    dotsEl.appendChild(dot);
  });
}

function flashClicked(button) {
  button.classList.add('is-clicked');
  setTimeout(() => button.classList.remove('is-clicked'), 500);
}

function prefersInstantTransition() {
  return (
    window.matchMedia('(max-width: 768px)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function readFlipDurationMs() {
  const raw = getComputedStyle(document.querySelector('.diary'))
    .getPropertyValue('--diary-flip-duration')
    .trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 700;
  return raw.endsWith('ms') ? value : value * 1000;
}

function prepareCurlEntries(fromEntry, toEntry) {
  return mediaIntrinsicPrewarmer.ensure([fromEntry, toEntry]);
}

function buildCurlDOM(fromEntry, toEntry) {
  const stage = document.querySelector('.diary-stage');
  const transition = transitionHTMLForEntries(fromEntry, toEntry, false);
  const elements = buildCurlSpreadDOM(stage, transition);
  updateCurl(0, elements);
  return elements;
}

function updateCurl(progress, elements) {
  const {
    slices,
    tipEl,
    castShadowEl,
    underlayIn,
    underlayOut,
    segWidth,
    sheetWidthPx,
    sliceCount,
  } = elements;
  const thetas = computeSliceThetas(progress, sliceCount);
  const { positions, tip } = computeSliceLayout(thetas, segWidth);
  const motion = computeCurlMotion(progress);
  const underlayOpacities = computeUnderlayOpacities(progress);
  slices.forEach(({ el, frontShade, backShade }, k) => {
    const { x, z } = positions[k];
    el.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${thetas[k]}deg)`;
    el.style.zIndex = progress < 0.5 ? String(k + 1) : String(sliceCount - k);
    frontShade.style.opacity = String(motion * 0.35);
    backShade.style.opacity = String(motion * 0.3);
  });
  tipEl.style.opacity = String(motion * 0.85);
  tipEl.style.transform = `translate3d(${tip.x}px, 0, ${tip.z}px) rotateY(${tip.rotateDeg}deg)`;
  const shadowWidth = sheetWidthPx * 0.4;
  castShadowEl.style.width = `${shadowWidth}px`;
  castShadowEl.style.opacity = String(motion * 0.48);
  castShadowEl.style.transform = `translate3d(${tip.x - shadowWidth / 2}px, 0, 0) scaleX(${0.72 + motion * 0.55})`;
  underlayIn.style.opacity = String(underlayOpacities.leftIn);
  underlayOut.style.opacity = String(underlayOpacities.rightOut);
}

function runFlipAnimation(elements, fromProgress, toProgress) {
  return new Promise((resolve) => {
    const durationMs = readFlipDurationMs();
    const start = performance.now();
    function tick(now) {
      const linear = durationMs > 0 ? Math.min(1, (now - start) / durationMs) : 1;
      const eased = easeInOutCubic(linear);
      updateCurl(fromProgress + (toProgress - fromProgress) * eased, elements);
      if (linear < 1) requestAnimationFrame(tick);
      else {
        updateCurl(toProgress, elements);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

function finishInstantFlip(direction, { hydrateMedia = true } = {}) {
  state = direction === 'next' ? goToNext(state) : goToPrevious(state);
  isFlipping = false;
  renderStatic({ hydrateMedia });
  updateChrome();
}

async function playFlip(direction) {
  if (isFlipInteractionLocked(isFlipping, dragFlip)) return;
  const descriptor = createFlipTransition(state.current, direction);
  if (descriptor.fromIndex < 0 || descriptor.toIndex >= state.totalPages) return;

  if (prefersInstantTransition()) {
    finishInstantFlip(direction);
    return;
  }

  const fromEntry = ENTRIES[descriptor.fromIndex];
  const toEntry = ENTRIES[descriptor.toIndex];
  const flipSnapshot = {
    current: state.current,
    totalPages: state.totalPages,
    descriptor,
    fromEntry,
    toEntry,
  };
  isFlipping = true;
  updateChrome();

  const mediaReady = await prepareCurlEntries(fromEntry, toEntry);
  const currentDescriptor = createFlipTransition(state.current, direction);
  const transitionIsCurrent = isFlipSnapshotCurrent(
    flipSnapshot,
    state,
    currentDescriptor,
    ENTRIES,
  );
  if (!transitionIsCurrent) {
    isFlipping = false;
    updateChrome();
    return;
  }
  if (!mediaReady) {
    // A failed or timed-out intrinsic lookup cannot safely build a curl face.
    // Complete navigation without a curl and keep the settled fallback ratio
    // stable by skipping this render's late intrinsic DOM hydration.
    finishInstantFlip(direction, { hydrateMedia: false });
    return;
  }

  const elements = buildCurlDOM(fromEntry, toEntry);
  await runFlipAnimation(
    elements,
    descriptor.startProgress,
    descriptor.targetProgress,
  );
  if (!isFlipSnapshotCurrent(
    flipSnapshot,
    state,
    createFlipTransition(state.current, direction),
    ENTRIES,
  )) {
    isFlipping = false;
    renderStatic();
    updateChrome();
    return;
  }
  state = direction === 'next' ? goToNext(state) : goToPrevious(state);
  isFlipping = false;
  renderStatic();
  updateChrome();
}

const DRAG_THRESHOLD_PX = 8;

// Tracks an in-progress drag-to-flip gesture; null when no drag is active.
// `moved` distinguishes "pointer is down but hasn't crossed the drag
// threshold yet" (still could be a click on something inside the page)
// from "definitely dragging, the flip sheet exists and is being driven by
// pointer position." `rafScheduled` coalesces rapid pointermove events
// into at most one DOM write per animation frame.
let dragFlip = null;

function findDragDirection(target) {
  if (target.closest('.diary-page--right')) return 'next';
  if (target.closest('.diary-page--left')) return 'prev';
  return null;
}

function applyDragFlipVisualState(activeDrag) {
  const progress = computeDirectionalDragProgress(
    activeDrag.startX,
    activeDrag.currentX,
    activeDrag.elements.sheetWidthPx,
    activeDrag.direction,
  );
  updateCurl(progress, activeDrag.elements);
  activeDrag.progress = progress;
}

function scheduleDragFlipUpdate(activeDrag) {
  if (activeDrag.rafScheduled) return;
  activeDrag.rafScheduled = true;
  requestAnimationFrame(() => {
    if (!ownsDragInteraction(dragFlip, activeDrag, activeDrag.pointerId)) return;
    activeDrag.rafScheduled = false;
    applyDragFlipVisualState(activeDrag);
  });
}

function handleStagePointerDown(event) {
  if (
    isFlipInteractionLocked(isFlipping, dragFlip)
    || !state.isOpen
    || prefersInstantTransition()
  ) return;
  if (event.target.closest('.diary-page__discard, .diary-mood-btn, .diary-page__photo')) return;
  const direction = findDragDirection(event.target);
  if (!direction) return;
  const descriptor = createFlipTransition(state.current, direction);
  if (descriptor.fromIndex < 0 || descriptor.toIndex >= state.totalPages) return;
  const flipEntries = [
    ENTRIES[descriptor.fromIndex],
    ENTRIES[descriptor.toIndex],
  ];
  if (!mediaIntrinsicPrewarmer.isReady(flipEntries)) {
    // A drag cannot pause midway while metadata arrives. Warm it now and
    // leave this gesture on the settled spread; a later gesture can build
    // the curl only after both physical faces have stable intrinsic ratios.
    void mediaIntrinsicPrewarmer.prewarmAll(flipEntries);
    return;
  }

  event.currentTarget.setPointerCapture(event.pointerId);
  dragFlip = {
    direction,
    pointerId: event.pointerId,
    startX: event.clientX,
    currentX: event.clientX,
    moved: false,
    rafScheduled: false,
    elements: null,
    progress: descriptor.startProgress,
    fromIndex: descriptor.fromIndex,
    toIndex: descriptor.toIndex,
    startProgress: descriptor.startProgress,
    targetProgress: descriptor.targetProgress,
  };
  updateChrome();
}

function handleStagePointerMove(event) {
  const activeDrag = dragFlip;
  if (!ownsDragInteraction(dragFlip, activeDrag, event.pointerId)) return;
  activeDrag.currentX = event.clientX;

  if (!activeDrag.moved) {
    if (!shouldActivateDirectionalDrag(
      activeDrag.startX,
      event.clientX,
      activeDrag.direction,
      DRAG_THRESHOLD_PX,
    )) return;
    activeDrag.moved = true;
    isFlipping = true;
    updateChrome();
    document.querySelector('.diary-stage').classList.add('diary-stage--dragging');
    activeDrag.elements = buildCurlDOM(
      ENTRIES[activeDrag.fromIndex],
      ENTRIES[activeDrag.toIndex],
    );
  }

  scheduleDragFlipUpdate(activeDrag);
}

async function settleDragFlip(activeDrag, cancelled) {
  const {
    direction,
    elements,
    progress,
    startProgress,
    targetProgress,
  } = activeDrag;
  const { completes, settleProgress } = resolveDragSettle({
    progress,
    direction,
    startProgress,
    targetProgress,
    cancelled,
  });

  document.querySelector('.diary-stage').classList.remove('diary-stage--dragging');
  try {
    await runFlipAnimation(elements, progress, settleProgress);
    if (completes) {
      state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    }
  } finally {
    isFlipping = false;
    renderStatic();
    updateChrome();
  }
}

function releasePointerCaptureSafely(target, pointerId) {
  if (typeof target.releasePointerCapture !== 'function') return;
  if (
    typeof target.hasPointerCapture === 'function'
    && !target.hasPointerCapture(pointerId)
  ) return;
  try {
    target.releasePointerCapture(pointerId);
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error;
  }
}

function handleStagePointerUp(event) {
  const activeDrag = dragFlip;
  if (!ownsDragInteraction(dragFlip, activeDrag, event.pointerId)) return;
  releasePointerCaptureSafely(event.currentTarget, event.pointerId);

  if (!activeDrag.moved) {
    dragFlip = null;
    updateChrome();
    return;
  }

  // Pointer-up can beat the queued RAF; apply its final coordinate now.
  // Clearing dragFlip below makes that queued callback fail its ownership check.
  activeDrag.currentX = event.clientX;
  applyDragFlipVisualState(activeDrag);
  dragFlip = null;
  settleDragFlip(activeDrag, false);
}

function handleStagePointerCancel(event) {
  const activeDrag = dragFlip;
  if (!ownsDragInteraction(dragFlip, activeDrag, event.pointerId)) return;
  releasePointerCaptureSafely(event.currentTarget, event.pointerId);
  dragFlip = null;

  if (!activeDrag.moved) {
    updateChrome();
    return;
  }

  settleDragFlip(activeDrag, true);
}

function openCover(button) {
  flashClicked(button);
  state = openBook(state);
  document.querySelector('.diary').classList.add('is-open');
  renderStatic();
  updateChrome();
}

function setMediaType(type) {
  document.querySelectorAll('.diary-form__tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.mediaType === type);
  });
  document.querySelectorAll('.diary-form__media-group').forEach((group) => {
    group.hidden = group.dataset.mediaGroup !== type;
  });
}

// Swaps the write/edit modal's title and submit-button copy. 'edit' is used
// while editingEntryId is set; 'write' is the default, new-entry copy.
function setWriteModalMode(mode) {
  const isEdit = mode === 'edit';
  document.querySelector('.diary-modal-backdrop .diary-modal__header h3').textContent = isEdit
    ? 'Edit Diary Entry'
    : 'Write a Diary Entry';
  document.querySelector('.diary-form button[type="submit"]').textContent = isEdit
    ? 'Save Changes'
    : 'Insert to Abroad Diary';
}

function openWriteModal() {
  refreshCategoryOptions();
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

// Builds the small thumbnail strip shown in edit mode so the user can see
// what media the entry currently has, since file inputs can't be pre-filled.
function currentMediaPreviewHTML(media) {
  if (media.type === 'video') {
    const url = media.urls[0];
    if (media.urls.length === 0 || isPlaceholder(url)) {
      return '<p class="diary-form__current-media-empty">No video uploaded yet.</p>';
    }
    return `<video src="${url}" muted></video>`;
  }
  const realUrls = media.urls.filter((url) => !isPlaceholder(url));
  if (realUrls.length === 0) return '<p class="diary-form__current-media-empty">No photos uploaded yet.</p>';
  return realUrls.map((url) => `<img src="${url}" alt="" />`).join('');
}

// Opens the write/edit modal pre-filled with an existing entry's text
// fields and a preview of its current media, so submitting updates that
// entry instead of creating a new one.
function handleOpenEditor(entry) {
  editingEntryId = entry.id;
  refreshCategoryOptions();
  const form = document.querySelector('.diary-form');
  form.category.value = entry.category;
  form.date.value = entry.date;
  form.title.value = entry.title;
  form.quote.value = entry.quote;
  form.body.value = entry.body;
  form.caption.value = entry.media.caption;
  form.pageLayout.value = normalizePageLayout(entry.media.layout);
  setMediaType(entry.media.type);

  const currentMediaEl = document.querySelector('.diary-form__current-media');
  currentMediaEl.hidden = false;
  document.querySelector('.diary-form__current-media-grid').innerHTML = currentMediaPreviewHTML(entry.media);

  setWriteModalMode('edit');
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  const form = document.querySelector('.diary-form');
  backdrop.hidden = true;
  form.reset();
  form.pageLayout.value = 'text-left';
  setMediaType('image');
  editingEntryId = null;
  setWriteModalMode('write');
  document.querySelector('.diary-form__current-media').hidden = true;
  document.querySelector('.diary-form__current-media-grid').innerHTML = '';
}

async function uploadMediaFiles(files) {
  const urls = [];
  for (const file of files) {
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    if (!isFileSizeAllowed(file.size, mediaType)) {
      const limit = mediaType === 'video' ? '100MB' : '8MB';
      throw new Error(`${file.name} is too large (max ${limit}).`);
    }
    const path = buildUploadPath(file.name, Date.now());
    const url = await uploadFile(file, path);
    urls.push(url);
  }
  return urls;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = data.get('title').trim();
  const body = data.get('body').trim();
  const date = data.get('date').trim();
  const category = normalizeCategory(data.get('category'));
  const pageLayout = normalizePageLayout(data.get('pageLayout'));
  if (!category || !title || !body || !date) return;

  const errorEl = document.querySelector('.diary-form .diary-form__error');
  errorEl.hidden = true;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalSubmitLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading…';

  try {
    const mediaType = document.querySelector('.diary-form__tab.is-active').dataset.mediaType;
    let files;
    if (mediaType === 'video') {
      const videoFile = data.get('video');
      files = videoFile && videoFile.size > 0 ? [videoFile] : [];
    } else {
      files = ['image1', 'image2', 'image3', 'image4']
        .map((field) => data.get(field))
        .filter((file) => file && file.size > 0);
    }

    const uploadedUrls = await uploadMediaFiles(files);
    const caption = data.get('caption').trim();

    if (editingEntryId) {
      const existingEntry = ENTRIES.find((entry) => entry.id === editingEntryId);
      const urls = resolveMediaUrls(uploadedUrls, existingEntry.media, mediaType);
      const patch = buildEditPatch(
        { category, date, title, quote: data.get('quote').trim(), body },
        mediaWithPageLayout(
          { type: mediaType, urls, caption, layout: pageLayout },
          pageLayout
        )
      );
      const row = await updateEntry(editingEntryId, patch);
      const index = ENTRIES.findIndex((entry) => entry.id === editingEntryId);
      mediaLayoutCache.invalidate(existingEntry);
      ENTRIES[index] = supabaseRowToEntry(row);
      mediaLayoutCache.prune(ENTRIES);
      refreshCategoryOptions();
      void mediaIntrinsicPrewarmer.prewarm(ENTRIES[index]);

      renderStatic();
      updateChrome();
      closeWriteModal();
    } else {
      let urls = uploadedUrls;
      if (urls.length === 0) {
        urls = [mediaType === 'video' ? '[Photo placeholder: new entry video]' : '[Photo placeholder: new entry photo]'];
      }

      const newEntry = {
        number: String(ENTRIES.length + 1).padStart(2, '0'),
        category,
        date,
        title,
        quote: data.get('quote').trim(),
        body,
        media: mediaWithPageLayout(
          { type: mediaType, urls, caption, layout: pageLayout },
          pageLayout
        ),
        mood: '',
        weather: '',
      };
      const row = await insertEntry(entryToSupabaseRow(newEntry));
      ENTRIES.push(supabaseRowToEntry(row));
      mediaLayoutCache.prune(ENTRIES);
      refreshCategoryOptions();
      void mediaIntrinsicPrewarmer.prewarm(ENTRIES.at(-1));

      state = goToPage(openBook(createDiaryState(ENTRIES.length)), ENTRIES.length - 1);
      document.querySelector('.diary').classList.add('is-open');
      buildDots();
      renderStatic();
      updateChrome();
      closeWriteModal();
    }
  } catch (error) {
    errorEl.textContent = error.message || 'Something went wrong saving this entry. Please try again.';
    errorEl.hidden = false;
    submitBtn.textContent = originalSubmitLabel;
  } finally {
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initEntries();

  document.querySelector('.diary-cover__open').addEventListener('click', (event) => {
    openCover(event.currentTarget);
  });

  // Delegated: discard buttons and photos are re-created on every render,
  // so a single listener on the stage catches all of them without
  // re-binding each time.
  document.querySelector('.diary-stage').addEventListener('click', (event) => {
    const discardBtn = event.target.closest('.diary-page__discard');
    if (discardBtn) {
      handleDiscard(discardBtn.dataset.entryId);
      return;
    }
    const moodBtn = event.target.closest('.diary-mood-btn');
    if (moodBtn) {
      openMoodModal(moodBtn.dataset.entryId, moodBtn.dataset.moodKind);
      return;
    }
    const photo = event.target.closest('.diary-page__photo');
    if (photo) openLightbox(photo.src, photo.alt);
  });

  document.querySelector('.diary-lightbox__close').addEventListener('click', closeLightbox);
  document.querySelector('.diary-lightbox-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeLightbox();
  });

  document.querySelector('.diary-mood-modal__close').addEventListener('click', closeMoodModal);
  document.querySelector('.diary-mood-modal__clear').addEventListener('click', () => setMood(''));
  document.querySelector('.diary-mood-modal__options').addEventListener('click', (event) => {
    const option = event.target.closest('.diary-mood-modal__option');
    if (option) setMood(option.dataset.value);
  });
  document.querySelector('.diary-mood-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeMoodModal();
  });

  document.querySelector('.diary-login-btn').addEventListener('click', handleLoginBtnClick);
  document.querySelector('.diary-login-modal__close').addEventListener('click', closeLoginModal);
  document.querySelector('.diary-login-form__cancel').addEventListener('click', closeLoginModal);
  document.querySelector('.diary-login-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeLoginModal();
  });
  document.querySelector('.diary-login-form').addEventListener('submit', handleLoginSubmit);

  onAuthStateChange((session) => applyAuthState(session));
  getSession().then((session) => applyAuthState(session));

  document.querySelector('.diary-nav--next').addEventListener('click', (event) => {
    flashClicked(event.currentTarget);
    playFlip('next');
  });

  document.querySelector('.diary-nav--prev').addEventListener('click', (event) => {
    flashClicked(event.currentTarget);
    playFlip('prev');
  });

  const dragStageEl = document.querySelector('.diary-stage');
  dragStageEl.addEventListener('pointerdown', handleStagePointerDown);
  dragStageEl.addEventListener('pointermove', handleStagePointerMove);
  dragStageEl.addEventListener('pointerup', handleStagePointerUp);
  dragStageEl.addEventListener('pointercancel', handleStagePointerCancel);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
      closeMoodModal();
      closeLoginModal();
    }
    if (!state.isOpen) return;
    if (event.key === 'ArrowRight') playFlip('next');
    if (event.key === 'ArrowLeft') playFlip('prev');
  });

  document.querySelector('.diary-edit-btn').addEventListener('click', () => {
    if (ENTRIES.length === 0) return;
    handleOpenEditor(ENTRIES[state.current]);
  });
  document.querySelector('.diary-write-btn').addEventListener('click', openWriteModal);
  document.querySelector('.diary-modal__close').addEventListener('click', closeWriteModal);
  document.querySelector('.diary-form__cancel').addEventListener('click', closeWriteModal);
  document.querySelector('.diary-modal-backdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeWriteModal();
  });
  document.querySelectorAll('.diary-form__tab').forEach((tab) => {
    tab.addEventListener('click', () => setMediaType(tab.dataset.mediaType));
  });
  document.querySelector('.diary-form').addEventListener('submit', handleFormSubmit);
});
