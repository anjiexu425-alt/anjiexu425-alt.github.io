import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
} from './diary-state.mjs';

// Placeholder image labels always start with '[' (site-wide convention);
// anything else is treated as a real image URL/path.
function isPlaceholder(value) {
  return value.startsWith('[');
}

const ENTRIES = [
  {
    number: '01',
    category: 'On Arrival',
    date: '2026.02.02',
    title: 'First Week',
    quote: '',
    body: '[Text placeholder: describe your first impressions of the city and program.]',
    media: { type: 'image', urls: ['[Photo placeholder: arrival photo]'], caption: '' },
  },
  {
    number: '02',
    category: 'On Everyday Life',
    date: '2026.03.14',
    title: 'Between Classes',
    quote: '',
    body: '[Text placeholder: describe a typical day, a favorite spot, or a small ritual.]',
    media: { type: 'image', urls: ['[Photo placeholder: campus photo]', '[Photo placeholder: street photo]'], caption: '' },
  },
  {
    number: '03',
    category: 'On Reflection',
    date: '2026.05.28',
    title: 'What Changed',
    quote: '',
    body: '[Text placeholder: describe how the experience shifted your perspective.]',
    media: { type: 'image', urls: ['[Photo placeholder: reflection photo]'], caption: '' },
  },
];

let state = createDiaryState(ENTRIES.length);
let isFlipping = false;

// Static, per-book branding — not tied to any one entry, printed on every
// spread like a running header/footer in a real printed book.
const DIARY_TAGLINE = 'Abroad & Reflection Sanctuary';
const DIARY_BRAND = 'Abroad in Serenity';
const DIARY_EDITION = '2026 Edition';

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
      <button type="button" class="diary-page__discard" data-discard-index="${index}">Discard</button>
    </div>
  `;
}

// A single photo/video fills the whole media area; 2-4 photos assemble
// into a grid (up to 2x2). Each URL/path is used directly as the src —
// works equally for a full network URL or a local relative path like
// assets/images/photo.jpg, since the browser resolves both the same way.
function mediaItemHTML(entry, url) {
  if (isPlaceholder(url)) return `<div class="placeholder-img">${url}</div>`;
  return entry.media.type === 'video'
    ? `<video class="diary-page__video" src="${url}" muted loop playsinline controls></video>`
    : `<img class="diary-page__photo" src="${url}" alt="${entry.title}" />`;
}

function rightPageHTML(entry) {
  const urls = entry.media.urls;
  const isGrid = urls.length > 1;
  const gridStyle = isGrid
    ? `display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(${urls.length <= 2 ? 1 : 2},1fr); gap:2px; background:#000; padding:2px;`
    : 'display:block;';
  const itemsHTML = urls.map((url) => mediaItemHTML(entry, url)).join('');
  const badgeHTML = isGrid ? '<span class="diary-polaroid__badge">Gallery</span>' : '';
  const captionHTML = entry.media.caption ? `<p class="diary-polaroid__caption">${entry.media.caption}</p>` : '';
  const countLabel = entry.media.type === 'video' ? '1 Video' : `${urls.length} Snapshot${urls.length === 1 ? '' : 's'}`;

  return `
    <div class="diary-page__header">
      <span class="diary-page__label">Page Spread ${ENTRIES.indexOf(entry) + 1} of ${ENTRIES.length}</span>
      <span class="diary-page__count">${countLabel}</span>
    </div>
    <div class="diary-polaroid">
      <span class="diary-polaroid__tape" aria-hidden="true"></span>
      ${badgeHTML}
      <div class="diary-page__media" style="${gridStyle}">${itemsHTML}</div>
      ${captionHTML}
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

function handleDiscard(index) {
  if (!window.confirm("Discard this diary page? This can't be undone.")) return;
  ENTRIES.splice(index, 1);
  const nextIndex = Math.max(0, Math.min(state.current, ENTRIES.length - 1));
  state = goToPage(openBook(createDiaryState(ENTRIES.length)), nextIndex);
  buildDots();
  renderStatic();
  updateChrome();
}

function updateChrome() {
  document.querySelector('.diary-pagination__count').textContent = `${state.current + 1} / ${state.totalPages}`;
  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });
  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state) || isFlipping;
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state) || isFlipping;
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

// A real 3D page-turn: a half-width "sheet" with two faces (front = the page
// currently showing, back = the page it reveals) sits over the static pages
// beneath it and rotates -180deg/180deg around the book's spine. Both faces
// use backface-visibility:hidden so only one is ever shown at a time as it
// turns through profile. Built via requestAnimationFrame + transitionend
// (not framer-motion, which needs a bundler) — the sheet's initial transform
// must be committed to layout before the target transform is set, or the
// change happens in the same tick and the transition never plays.
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
  const stage = document.querySelector('.diary-stage');
  stage.innerHTML = '';

  const leftEntry = direction === 'next' ? oldEntry : newEntry;
  const rightEntry = direction === 'next' ? newEntry : oldEntry;

  const leftPage = document.createElement('div');
  leftPage.className = 'diary-page diary-page--left';
  leftPage.innerHTML = leftPageHTML(leftEntry);

  const rightPage = document.createElement('div');
  rightPage.className = 'diary-page diary-page--right';
  rightPage.innerHTML = rightPageHTML(rightEntry);

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
    front.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(oldEntry)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(newEntry)}</div>`;
  } else {
    front.innerHTML = `<div class="diary-page diary-page--left">${leftPageHTML(oldEntry)}</div>`;
    back.innerHTML = `<div class="diary-page diary-page--right">${rightPageHTML(newEntry)}</div>`;
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

  // Force layout so the un-flipped starting transform is committed before
  // the target class gets added on the next frame.
  void sheet.offsetHeight;

  requestAnimationFrame(() => {
    sheet.classList.add('is-flipped');
  });

  sheet.addEventListener('transitionend', function onDone(event) {
    if (event.propertyName !== 'transform') return;
    sheet.removeEventListener('transitionend', onDone);
    state = direction === 'next' ? goToNext(state) : goToPrevious(state);
    isFlipping = false;
    renderStatic();
    updateChrome();
  });
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

function openWriteModal() {
  document.querySelector('.diary-modal-backdrop').hidden = false;
}

function closeWriteModal() {
  const backdrop = document.querySelector('.diary-modal-backdrop');
  backdrop.hidden = true;
  document.querySelector('.diary-form').reset();
  setMediaType('image');
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const title = data.get('title').trim();
  const body = data.get('body').trim();
  const date = data.get('date').trim();
  if (!title || !body || !date) return;

  const mediaType = document.querySelector('.diary-form__tab.is-active').dataset.mediaType;
  let urls;
  if (mediaType === 'video') {
    const videoUrl = data.get('video').trim();
    urls = [videoUrl || '[Photo placeholder: new entry video]'];
  } else {
    urls = ['image1', 'image2', 'image3', 'image4']
      .map((field) => data.get(field).trim())
      .filter(Boolean);
    if (urls.length === 0) urls = ['[Photo placeholder: new entry photo]'];
  }

  ENTRIES.push({
    number: String(ENTRIES.length + 1).padStart(2, '0'),
    category: data.get('category'),
    date,
    title,
    quote: data.get('quote').trim(),
    body,
    media: { type: mediaType, urls, caption: data.get('caption').trim() },
  });

  state = goToPage(openBook(createDiaryState(ENTRIES.length)), ENTRIES.length - 1);
  document.querySelector('.diary').classList.add('is-open');
  buildDots();
  renderStatic();
  updateChrome();
  closeWriteModal();
}

document.addEventListener('DOMContentLoaded', () => {
  buildDots();

  document.querySelector('.diary-cover__open').addEventListener('click', (event) => {
    openCover(event.currentTarget);
  });

  // Delegated: discard buttons are re-created on every render, so a single
  // listener on the stage catches all of them without re-binding each time.
  document.querySelector('.diary-stage').addEventListener('click', (event) => {
    const discardBtn = event.target.closest('.diary-page__discard');
    if (discardBtn) handleDiscard(Number(discardBtn.dataset.discardIndex));
  });

  document.querySelector('.diary-nav--next').addEventListener('click', (event) => {
    flashClicked(event.currentTarget);
    playFlip('next');
  });

  document.querySelector('.diary-nav--prev').addEventListener('click', (event) => {
    flashClicked(event.currentTarget);
    playFlip('prev');
  });

  document.addEventListener('keydown', (event) => {
    if (!state.isOpen) return;
    if (event.key === 'ArrowRight') playFlip('next');
    if (event.key === 'ArrowLeft') playFlip('prev');
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
