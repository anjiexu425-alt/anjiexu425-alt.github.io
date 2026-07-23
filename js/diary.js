import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
} from './diary-state.mjs';
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
} from './diary-validation.mjs';

// Placeholder image labels always start with '[' (site-wide convention);
// anything else is treated as a real image URL/path.
function isPlaceholder(value) {
  return value.startsWith('[');
}

// Entries live in Supabase now (see js/diary-supabase.js) — this array is
// populated asynchronously by initEntries() on page load, and mutated in
// place by handleDiscard/setMood/handleFormSubmit after each successful
// write so the UI stays in sync with the database.
let ENTRIES = [];

let state = createDiaryState(ENTRIES.length);
let isFlipping = false;

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

// Body text with a blank line between lines is rendered as separate
// paragraphs, matching the "title + quote + two body paragraphs" layout.
function bodyParagraphsHTML(body) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p class="diary-page__body">${paragraph}</p>`)
    .join('');
}

function leftPageHTML(entry) {
  const index = ENTRIES.indexOf(entry);
  const discardHTML = isLoggedIn
    ? `<button type="button" class="diary-page__discard" data-entry-id="${entry.id}">Discard</button>`
    : '';
  return `
    <div class="diary-page__header">
      <span class="diary-page__label">${entry.number} / ${entry.category.toUpperCase()}</span>
      <span class="diary-page__date">${entry.date}</span>
    </div>
    <h2 class="diary-page__title">${entry.title}</h2>
    ${entry.quote ? `<blockquote class="diary-page__quote">${entry.quote}</blockquote>` : ''}
    <div class="diary-page__ruled">${bodyParagraphsHTML(entry.body)}</div>
    <div class="diary-page__footer">
      <span class="diary-page__tagline">${DIARY_TAGLINE}</span>
      ${discardHTML}
    </div>
  `;
}

// Placeholder strings look like "[Photo placeholder: campus photo]" — pull
// the human-readable part out for the placeholder card's label, falling
// back to a generic prompt if the text doesn't match that shape.
function placeholderLabel(value) {
  const match = value.match(/:\s*([^\]]+)\]/);
  const text = match ? match[1].trim() : 'a photo';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function placeholderHTML(value) {
  return `
    <span class="diary-placeholder__icon" aria-hidden="true">&#10022;</span>
    <span class="diary-placeholder__label">${placeholderLabel(value)}</span>
    <span class="diary-placeholder__hint">[ Tap to Upload ]</span>
  `;
}

// A single photo/video fills the whole media area; multiple photos assemble
// into a grid that adapts to the count rather than always forcing 2x2 — 3
// photos get a magazine-collage layout (first spans both rows). Each
// URL/path is used directly as the src — works equally for a full network
// URL or a local relative path like assets/images/photo.jpg, since the
// browser resolves both the same way.
//
// `active` distinguishes the real, settled page (rendered by renderStatic)
// from the throwaway duplicates rendered mid-flip (the static half still
// under the moving sheet, and the sheet's own front/back faces) — those
// duplicates are visible for under a second and then discarded, so their
// videos get preload="none" rather than letting the browser start
// buffering data no one will watch.
function mediaItemHTML(entry, url, index, total, active) {
  const spanAttr = total === 3 && index === 0 ? ' style="grid-row: span 2;"' : '';
  if (isPlaceholder(url)) return `<div class="diary-placeholder"${spanAttr}>${placeholderHTML(url)}</div>`;
  if (entry.media.type === 'video') {
    const preloadAttr = active ? '' : ' preload="none"';
    return `<video class="diary-page__video" src="${url}" muted loop playsinline controls${preloadAttr}${spanAttr}></video>`;
  }
  return `<img class="diary-page__photo" src="${url}" alt="${entry.title}"${spanAttr} />`;
}

function mediaGridStyle(count) {
  // A single photo gets a taller, portrait-friendly box (3:4) instead of a
  // square one — object-fit:contain already shows the whole photo without
  // cropping, but a square box leaves wide empty margins on either side of
  // a portrait photo; 3:4 fits that common shape much more closely so the
  // photo reads larger with far less empty mat around it.
  if (count <= 1) return 'display:grid; grid-template-columns:1fr; grid-template-rows:1fr; aspect-ratio:3/4;';
  if (count === 2) return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:1fr; gap:2px;';
  return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); gap:2px;';
}

function rightPageHTML(entry, active = true) {
  const index = ENTRIES.indexOf(entry);
  const urls = entry.media.urls;
  const isGrid = urls.length > 1;
  const gridStyle = mediaGridStyle(urls.length);
  const itemsHTML = urls.map((url, i) => mediaItemHTML(entry, url, i, urls.length, active)).join('');
  const badgeHTML = isGrid ? '<span class="diary-polaroid__badge">Gallery</span>' : '';
  const captionHTML = entry.media.caption ? `<p class="diary-polaroid__caption">${entry.media.caption}</p>` : '';
  const countLabel = entry.media.type === 'video' ? '1 Video' : `${urls.length} Snapshot${urls.length === 1 ? '' : 's'}`;
  const moodRowHTML = isLoggedIn
    ? `<div class="diary-mood-row">
        <button type="button" class="diary-mood-btn" data-mood-kind="mood" data-entry-id="${entry.id}">${entry.mood || '+ Mood'}</button>
        <button type="button" class="diary-mood-btn" data-mood-kind="weather" data-entry-id="${entry.id}">${entry.weather || '+ Weather'}</button>
      </div>`
    : '';

  return `
    <div class="diary-page__header">
      <span class="diary-page__label">Page Spread ${index + 1} of ${ENTRIES.length}</span>
      <span class="diary-page__count">${countLabel}</span>
    </div>
    <div class="diary-polaroid">
      <span class="diary-polaroid__tape" aria-hidden="true"></span>
      ${badgeHTML}
      <div class="diary-page__media" style="${gridStyle}">${itemsHTML}</div>
      ${captionHTML}
      ${moodRowHTML}
    </div>
    <div class="diary-page__footer diary-page__footer--right">
      <span>${DIARY_BRAND}</span>
      <span>${DIARY_EDITION}</span>
    </div>
  `;
}

function renderStatic() {
  const stage = document.querySelector('.diary-stage');
  if (ENTRIES.length === 0) {
    stage.innerHTML = '<p class="diary-empty">No diary pages yet — click "Write Diary" to add one.</p>';
    return;
  }
  const entry = ENTRIES[state.current];
  stage.innerHTML = `
    <div class="diary-page diary-page--left">${leftPageHTML(entry)}</div>
    <div class="diary-page diary-page--right">${rightPageHTML(entry)}</div>
  `;
}

// Runs once on page load. Shows a loading message inside .diary-stage
// (invisible until the book is opened, since .diary-book is display:none
// until .diary.is-open) so that by the time the user clicks the cover
// open, real content is already in place.
// Photos now live on Supabase Storage instead of local files, so a page
// flipped to for the first time can show a still-loading image mid-flip —
// fetching every real photo into the browser's cache as soon as entries
// are known (fire-and-forget, not awaited) means by the time a user
// actually flips to any given page, its photos are already cached and
// paint instantly instead of popping in a moment after the flip.
function preloadEntryImages(entries) {
  entries.forEach((entry) => {
    if (entry.media.type !== 'image') return;
    entry.media.urls.forEach((url) => {
      if (isPlaceholder(url)) return;
      const img = new Image();
      img.src = url;
    });
  });
}

async function initEntries() {
  const stage = document.querySelector('.diary-stage');
  stage.innerHTML = '<p class="diary-empty">Loading diary…</p>';
  try {
    const rows = await fetchEntries();
    ENTRIES = rows.map(supabaseRowToEntry);
  } catch (error) {
    stage.innerHTML = '<p class="diary-empty">Couldn’t load diary entries. Please check your connection and try again.</p>';
    console.error('Failed to load diary entries', error);
    return;
  }
  preloadEntryImages(ENTRIES);
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
  ENTRIES.splice(removedIndex, 1);
  const nextIndex = Math.max(0, Math.min(state.current, ENTRIES.length - 1));
  state = goToPage(openBook(createDiaryState(ENTRIES.length)), nextIndex);
  buildDots();
  renderStatic();
  updateChrome();
}

function updateChrome() {
  const countLabel = state.totalPages === 0 ? '0 / 0' : `${state.current + 1} / ${state.totalPages}`;
  document.querySelector('.diary-pagination__count').textContent = countLabel;
  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });
  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state) || isFlipping;
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state) || isFlipping;
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
      if (isFlipping || i === state.current) return;
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

// Builds the static halves (with underlay shadows) and the flip sheet
// (with front/back faces and curl shadows) for a flip in progress, and
// appends everything to .diary-stage. Shared by the click/keyboard-
// triggered animated flip (playFlip) and the pointer-driven drag flip —
// both need the identical visual structure, they just drive the sheet's
// transform/opacity differently afterward (a CSS animation vs. live
// pointer tracking). Returns the sheet element.
function buildFlipDOM(direction, oldEntry, newEntry) {
  const stage = document.querySelector('.diary-stage');
  // Stop decode immediately rather than waiting on GC of the removed
  // elements — cheap insurance against multiple videos competing for the
  // hardware decoder mid-flip.
  stage.querySelectorAll('video').forEach((video) => video.pause());
  stage.innerHTML = '';

  const leftEntry = direction === 'next' ? oldEntry : newEntry;
  const rightEntry = direction === 'next' ? newEntry : oldEntry;

  // Every page rendered during the flip is transitional — none of it is the
  // settled foreground page, so media loads inactive (see mediaItemHTML).
  const leftPage = document.createElement('div');
  leftPage.className = 'diary-page diary-page--left';
  leftPage.innerHTML = leftPageHTML(leftEntry);

  const rightPage = document.createElement('div');
  rightPage.className = 'diary-page diary-page--right';
  rightPage.innerHTML = rightPageHTML(rightEntry, false);

  // The static half NOT under the moving sheet fades a shadow in (the
  // turning page casting a shadow as it lifts); the half already revealed
  // underneath fades its shadow out (was dark under the page, now landing
  // in the light). Which side is which flips with direction.
  const underlayIn = document.createElement('div');
  underlayIn.className = 'diary-underlay-shadow diary-underlay-shadow--in';
  const underlayOut = document.createElement('div');
  underlayOut.className = 'diary-underlay-shadow diary-underlay-shadow--out';
  if (direction === 'next') {
    leftPage.appendChild(underlayIn);
    rightPage.appendChild(underlayOut);
  } else {
    rightPage.appendChild(underlayIn);
    leftPage.appendChild(underlayOut);
  }

  stage.appendChild(leftPage);
  stage.appendChild(rightPage);

  const sheet = document.createElement('div');
  sheet.className = `diary-flip-sheet diary-flip-sheet--${direction}`;

  const front = document.createElement('div');
  front.className = 'diary-flip-sheet__face diary-flip-sheet__face--front';
  const back = document.createElement('div');
  back.className = 'diary-flip-sheet__face diary-flip-sheet__face--back';

  if (direction === 'next') {
    front.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(oldEntry, false)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(newEntry)}</div>`;
  } else {
    front.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(oldEntry)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(newEntry, false)}</div>`;
  }

  // Curl shadow riding the turning sheet itself: strongest near the spine
  // it's pivoting on, easing off across the transition (deepens, then
  // settles — not a flat fade) on the front face; the back face starts
  // partly shadowed and clears as it comes fully face-up. The gradient
  // direction is fixed per face in local (pre-rotation) space — the back
  // face's own static rotateY(180deg) mirrors it back to the correct side
  // once flipped, so front/back keep the same two directions regardless of
  // next/prev... except next/prev mount the sheet at opposite spines, so
  // the directions swap between the two directions too.
  const frontShadow = document.createElement('div');
  frontShadow.className = 'diary-flip-shadow diary-flip-shadow--front';
  frontShadow.style.background = direction === 'next'
    ? 'linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)'
    : 'linear-gradient(to left, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)';
  front.appendChild(frontShadow);

  const backShadow = document.createElement('div');
  backShadow.className = 'diary-flip-shadow diary-flip-shadow--back';
  backShadow.style.background = direction === 'next'
    ? 'linear-gradient(to left, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)'
    : 'linear-gradient(to right, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 40%, transparent)';
  back.appendChild(backShadow);

  sheet.appendChild(front);
  sheet.appendChild(back);
  stage.appendChild(sheet);

  return sheet;
}

// A real 3D page-turn: a half-width "sheet" with two faces (front = the page
// currently showing, back = the page it reveals) sits over the static pages
// beneath it and rotates -180deg/180deg around the book's spine, with an
// arc lift and mid-rotation opacity dip layered on via the diary-flip-next/
// diary-flip-prev @keyframes. Both faces use backface-visibility:hidden so
// only one is ever shown at a time as it turns through profile. Driven by
// requestAnimationFrame + animationend (not framer-motion, which needs a
// bundler) — the initial state is committed to layout before the
// is-flipped class (which starts the @keyframes animation) is added, kept
// from the transition-based version out of caution even though a CSS
// animation doesn't strictly require it the way a transition did.
function playFlip(direction) {
  if (isFlipping) return;
  const oldIndex = state.current;
  const newIndex = direction === 'next' ? oldIndex + 1 : oldIndex - 1;
  if (newIndex < 0 || newIndex >= state.totalPages) return;

  if (prefersInstantTransition()) {
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    renderStatic();
    updateChrome();
    return;
  }

  isFlipping = true;
  updateChrome();

  const oldEntry = ENTRIES[oldIndex];
  const newEntry = ENTRIES[newIndex];
  const sheet = buildFlipDOM(direction, oldEntry, newEntry);

  // Force layout so the un-flipped starting transform is committed before
  // the target class gets added on the next frame.
  void sheet.offsetHeight;

  requestAnimationFrame(() => {
    sheet.classList.add('is-flipped');
  });

  // Completing the flip must happen exactly once, triggered by whichever
  // comes first: the sheet's own flip animation finishing, or (if that
  // event never arrives — observed in some WebKit/embedded-WebView builds)
  // a fallback timeout. isSheetEventTarget rejects animationend events
  // bubbled up from a descendant (animationend bubbles like any other DOM
  // event), so a child's unrelated animation can't end the flip early.
  let flipFinished = false;
  function finishFlip() {
    if (flipFinished) return;
    flipFinished = true;
    sheet.removeEventListener('animationend', onSheetAnimationEnd);
    clearTimeout(fallbackTimer);
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    isFlipping = false;
    renderStatic();
    updateChrome();
  }

  function onSheetAnimationEnd(event) {
    if (isSheetEventTarget(event, sheet)) finishFlip();
  }

  sheet.addEventListener('animationend', onSheetAnimationEnd);

  // Read the duration straight off the sheet's own computed style rather
  // than hardcoding a second copy of it — this can never drift out of
  // sync with --diary-flip-duration (the CSS custom property that also
  // drives the shadow animations' duration) however that value changes.
  const flipDurationMs = parseFloat(getComputedStyle(sheet).animationDuration) * 1000 || 700;
  const fallbackTimer = setTimeout(finishFlip, flipDurationMs + 150);
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

function applyDragFlipVisualState() {
  const rawDeltaX = dragFlip.currentX - dragFlip.startX;
  const signedDeltaX = dragFlip.direction === 'next' ? -rawDeltaX : rawDeltaX;
  const progress = computeDragProgress(signedDeltaX, dragFlip.pageWidth);
  const { rotateDeg, liftPx, opacity } = computeFlipVisualState(progress, dragFlip.direction);
  dragFlip.sheet.style.transform = `translate3d(0, ${liftPx}px, 0) rotateY(${rotateDeg}deg)`;
  dragFlip.sheet.style.opacity = String(opacity);
  dragFlip.progress = progress;
}

function scheduleDragFlipUpdate() {
  if (dragFlip.rafScheduled) return;
  dragFlip.rafScheduled = true;
  requestAnimationFrame(() => {
    if (!dragFlip) return;
    dragFlip.rafScheduled = false;
    applyDragFlipVisualState();
  });
}

function handleStagePointerDown(event) {
  if (isFlipping || !state.isOpen || prefersInstantTransition()) return;
  if (event.target.closest('.diary-page__discard, .diary-mood-btn, .diary-page__photo')) return;
  const direction = findDragDirection(event.target);
  if (!direction) return;
  const newIndex = direction === 'next' ? state.current + 1 : state.current - 1;
  if (newIndex < 0 || newIndex >= state.totalPages) return;

  event.currentTarget.setPointerCapture(event.pointerId);
  dragFlip = {
    direction,
    pointerId: event.pointerId,
    startX: event.clientX,
    currentX: event.clientX,
    moved: false,
    rafScheduled: false,
    sheet: null,
    pageWidth: 0,
    progress: 0,
    oldIndex: state.current,
    newIndex,
  };
}

function handleStagePointerMove(event) {
  if (!dragFlip || event.pointerId !== dragFlip.pointerId) return;
  dragFlip.currentX = event.clientX;

  if (!dragFlip.moved) {
    if (Math.abs(event.clientX - dragFlip.startX) < DRAG_THRESHOLD_PX) return;
    dragFlip.moved = true;
    isFlipping = true;
    updateChrome();
    document.querySelector('.diary-stage').classList.add('diary-stage--dragging');
    const oldEntry = ENTRIES[dragFlip.oldIndex];
    const newEntry = ENTRIES[dragFlip.newIndex];
    dragFlip.sheet = buildFlipDOM(dragFlip.direction, oldEntry, newEntry);
    dragFlip.pageWidth = dragFlip.sheet.getBoundingClientRect().width;
  }

  scheduleDragFlipUpdate();
}

function settleDragFlip() {
  const { direction, sheet, progress } = dragFlip;
  const completing = shouldCompleteFlip(progress);
  const finalRotateDeg = completing ? (direction === 'next' ? -180 : 180) : 0;

  document.querySelector('.diary-stage').classList.remove('diary-stage--dragging');
  sheet.classList.add('diary-flip-sheet--settling');

  let settled = false;
  function finishDragFlip() {
    if (settled) return;
    settled = true;
    sheet.removeEventListener('transitionend', onSettleTransitionEnd);
    clearTimeout(settleFallbackTimer);
    if (completing) {
      state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    }
    isFlipping = false;
    renderStatic();
    updateChrome();
  }

  function onSettleTransitionEnd(event) {
    if (isSheetEventTarget(event, sheet)) finishDragFlip();
  }

  sheet.addEventListener('transitionend', onSettleTransitionEnd);

  requestAnimationFrame(() => {
    sheet.style.transform = `translate3d(0, 0, 0) rotateY(${finalRotateDeg}deg)`;
    sheet.style.opacity = '1';
  });

  const settleDurationMs = parseFloat(getComputedStyle(sheet).transitionDuration) * 1000 || 700;
  const settleFallbackTimer = setTimeout(finishDragFlip, settleDurationMs + 150);
}

function handleStagePointerUp(event) {
  if (!dragFlip || event.pointerId !== dragFlip.pointerId) return;
  event.currentTarget.releasePointerCapture(event.pointerId);

  if (!dragFlip.moved) {
    dragFlip = null;
    return;
  }

  settleDragFlip();
  dragFlip = null;
}

function handleStagePointerCancel(event) {
  handleStagePointerUp(event);
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
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

// Opens the write/edit modal pre-filled with an existing entry's text
// fields, so submitting updates that entry instead of creating a new one.
// Media (file inputs) can't be pre-filled by the browser — see Task 4 for
// the "current media" preview that covers that gap.
function handleOpenEditor(entry) {
  editingEntryId = entry.id;
  const form = document.querySelector('.diary-form');
  form.category.value = entry.category;
  form.date.value = entry.date;
  form.title.value = entry.title;
  form.quote.value = entry.quote;
  form.body.value = entry.body;
  form.caption.value = entry.media.caption;
  setMediaType(entry.media.type);
  setWriteModalMode('edit');
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
  editingEntryId = null;
  setWriteModalMode('write');
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
  if (!title || !body || !date) return;

  const errorEl = document.querySelector('.diary-form .diary-form__error');
  errorEl.hidden = true;
  const submitBtn = form.querySelector('button[type="submit"]');
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

    let urls = await uploadMediaFiles(files);
    if (urls.length === 0) {
      urls = [mediaType === 'video' ? '[Photo placeholder: new entry video]' : '[Photo placeholder: new entry photo]'];
    }

    const newEntry = {
      number: String(ENTRIES.length + 1).padStart(2, '0'),
      category: data.get('category'),
      date,
      title,
      quote: data.get('quote').trim(),
      body,
      media: { type: mediaType, urls, caption: data.get('caption').trim() },
      mood: '',
      weather: '',
    };
    const row = await insertEntry(entryToSupabaseRow(newEntry));
    ENTRIES.push(supabaseRowToEntry(row));

    state = goToPage(openBook(createDiaryState(ENTRIES.length)), ENTRIES.length - 1);
    document.querySelector('.diary').classList.add('is-open');
    buildDots();
    renderStatic();
    updateChrome();
    closeWriteModal();
  } catch (error) {
    errorEl.textContent = error.message || 'Something went wrong saving this entry. Please try again.';
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Insert to Abroad Diary';
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
