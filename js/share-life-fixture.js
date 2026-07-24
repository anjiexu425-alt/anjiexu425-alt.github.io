import {
  applyShareLifeLikeDelta,
  buildShareLifeCardView,
  canConsumeHorizontalWheel,
  isMouseDragPointer,
  isShareLifeImageAllowed,
  nextLikeIntent,
  normalizePersistedLikeCount,
  resolveFocusTrapTarget,
  resolveScrollBehavior,
  SHARE_LIFE_FOLLOWERS_LABEL,
  SHARE_LIFE_LIKES_LABEL,
  setLikedNoteId,
  validateNoteFields,
} from './share-life-model.mjs';

const PLACEHOLDER_URL = 'assets/images/share-life-placeholder.svg';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SLIDER_CONTROL_SELECTOR = 'button, input, textarea, select, label';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const FIXTURE_NOTES = Object.freeze([
  Object.freeze({
    id: 'fixture-note-1',
    title: 'Small rituals that make a week feel spacious',
    douyinUrl: 'https://www.douyin.com/',
    coverUrl: PLACEHOLDER_URL,
    coverPath: null,
    likesCount: 12,
    createdAt: '2026-07-21T09:00:00.000Z',
    updatedAt: '2026-07-21T09:00:00.000Z',
  }),
  Object.freeze({
    id: 'fixture-note-2',
    title: "<img src=x onerror='alert(1)'> Fixture safety title",
    douyinUrl: 'https://www.douyin.com/',
    coverUrl: PLACEHOLDER_URL,
    coverPath: null,
    likesCount: 3,
    createdAt: '2026-07-22T09:00:00.000Z',
    updatedAt: '2026-07-22T09:00:00.000Z',
  }),
  Object.freeze({
    id: 'fixture-note-3',
    title: 'What I learned by recording ordinary days',
    douyinUrl: 'https://www.douyin.com/',
    coverUrl: PLACEHOLDER_URL,
    coverPath: null,
    likesCount: 7,
    createdAt: '2026-07-23T09:00:00.000Z',
    updatedAt: '2026-07-23T09:00:00.000Z',
  }),
  Object.freeze({
    id: 'fixture-note-4',
    title: 'A gentle field note from the edge of summer',
    douyinUrl: 'https://www.douyin.com/',
    coverUrl: PLACEHOLDER_URL,
    coverPath: null,
    likesCount: 5,
    createdAt: '2026-07-24T09:00:00.000Z',
    updatedAt: '2026-07-24T09:00:00.000Z',
  }),
]);

const track = document.getElementById('shareLifeTrack');
const viewport = document.querySelector('.share-life-slider__viewport');
const status = document.getElementById('shareLifeStatus');
const addButton = document.getElementById('shareLifeAddButton');
const authToggle = document.getElementById('shareLifeFixtureAuthToggle');
const previousButton = document.getElementById('shareLifePrev');
const nextButton = document.getElementById('shareLifeNext');
const followersCount = document.getElementById('shareLifeFollowersCount');
const totalLikesCount = document.getElementById('shareLifeTotalLikesCount');

const noteDialogBackdrop = document.getElementById('shareLifeNoteDialogBackdrop');
const noteDialogTitle = document.getElementById('shareLifeNoteDialogTitle');
const noteDialogClose = document.getElementById('shareLifeNoteDialogClose');
const noteForm = document.getElementById('shareLifeNoteForm');
const noteIdInput = document.getElementById('shareLifeNoteId');
const titleInput = document.getElementById('shareLifeTitle');
const douyinUrlInput = document.getElementById('shareLifeDouyinUrl');
const coverInput = document.getElementById('shareLifeCover');
const likesCountInput = document.getElementById('shareLifeLikesCount');
const coverPreview = document.querySelector('#shareLifeCoverPreview img');
const noteError = document.getElementById('shareLifeNoteError');
const noteCancel = document.getElementById('shareLifeNoteCancel');
const noteSubmit = document.getElementById('shareLifeNoteSubmit');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let notes = FIXTURE_NOTES.map((note) => ({ ...note }));
let likedNoteIds = new Set(['fixture-note-2']);
let isSignedIn = false;
let nextFixtureId = FIXTURE_NOTES.length + 1;
let dialogState = null;
let selectedCoverDataUrl = '';
let coverReadGeneration = 0;
let coverReadPending = false;
let suppressNextCardLinkClick = false;

function createSvgIcon(pathData) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  for (const data of Array.isArray(pathData) ? pathData : [pathData]) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', data);
    svg.append(path);
  }

  return svg;
}

function announce(message) {
  status.textContent = message;
}

function clearFormError() {
  noteError.textContent = '';
  noteError.hidden = true;
}

function showFormError(message) {
  noteError.textContent = message;
  noteError.hidden = false;
}

function setCoverReadPending(isPending) {
  coverReadPending = isPending;
  noteSubmit.disabled = isPending;
}

function updateSliderButtons() {
  const maximumScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  previousButton.disabled = viewport.scrollLeft <= 1;
  nextButton.disabled = viewport.scrollLeft >= maximumScroll - 1;
}

function updateFixtureChrome() {
  authToggle.setAttribute('aria-pressed', String(isSignedIn));
  authToggle.textContent = isSignedIn
    ? 'Signed in — hide owner controls'
    : 'Signed out — enable owner controls';
  addButton.hidden = !isSignedIn;
}

function renderStats() {
  followersCount.textContent = SHARE_LIFE_FOLLOWERS_LABEL;
  totalLikesCount.textContent = SHARE_LIFE_LIKES_LABEL;
}

function createManageButton(className, label, iconPath, action, noteId) {
  const button = document.createElement('button');
  button.className = `share-life-card__manage ${className}`;
  button.type = 'button';
  button.dataset.fixtureAction = action;
  button.dataset.noteId = noteId;
  button.setAttribute('aria-label', label);
  button.append(createSvgIcon(iconPath));
  return button;
}

function createLikeButton(note, view) {
  const button = document.createElement('button');
  button.className = 'share-life-card__likes';
  button.type = 'button';
  button.dataset.fixtureAction = 'like';
  button.dataset.noteId = note.id;
  button.setAttribute('aria-label', `${view.isLiked ? 'Unlike' : 'Like'} ${view.titleText}`);
  button.setAttribute('aria-pressed', String(view.isLiked));
  button.append(createSvgIcon('M12 21s-7-4.6-9.2-8.4C.8 9.2 2.2 5 6.2 4.2c2.1-.4 4.1.5 5.8 2.5 1.7-2 3.7-2.9 5.8-2.5 4 .8 5.4 5 3.4 8.4C19 16.4 12 21 12 21Z'));

  const count = document.createElement('span');
  count.textContent = String(view.likesCount);
  button.append(count);
  return button;
}

function createCard(note) {
  const view = buildShareLifeCardView(note, likedNoteIds, isSignedIn);
  const card = document.createElement('article');
  card.className = 'share-life-card';
  card.dataset.noteId = note.id;

  const imageWrap = document.createElement('div');
  imageWrap.className = 'share-life-card__image-wrap';

  const image = document.createElement('img');
  image.className = 'share-life-card__image';
  image.src = view.coverUrl;
  image.alt = view.titleText;
  image.addEventListener('error', () => {
    image.src = PLACEHOLDER_URL;
  }, { once: true });
  imageWrap.append(image);

  const content = document.createElement('div');
  content.className = 'share-life-card__content';

  const title = document.createElement('h2');
  title.className = 'share-life-card__title';
  title.textContent = view.titleText;

  const footer = document.createElement('div');
  footer.className = 'share-life-card__footer';
  footer.append(createLikeButton(note, view));

  const destination = document.createElement('span');
  destination.textContent = view.douyinUrl ? 'Douyin ↗' : 'Link unavailable';
  footer.append(destination);

  content.append(title, footer);
  card.append(imageWrap, content);

  if (view.douyinUrl) {
    const link = document.createElement('a');
    link.className = 'share-life-card__link';
    link.href = view.douyinUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.draggable = false;
    link.addEventListener('dragstart', (event) => event.preventDefault());
    link.setAttribute('aria-label', `Open ${view.titleText} on Douyin`);
    card.append(link);
  }

  if (view.canManage) {
    card.append(
      createManageButton(
        'share-life-card__manage--edit',
        `Edit ${view.titleText}`,
        'M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4',
        'edit',
        note.id,
      ),
      createManageButton(
        'share-life-card__manage--delete',
        `Delete ${view.titleText}`,
        ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13', 'M10 11v5M14 11v5'],
        'delete',
        note.id,
      ),
    );
  }

  return card;
}

function renderNotes() {
  renderStats();
  const fragment = document.createDocumentFragment();

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'share-life-status';
    empty.textContent = 'No fixture notes yet. Sign in and add one.';
    fragment.append(empty);
  } else {
    for (const note of notes) {
      fragment.append(createCard(note));
    }
  }

  track.replaceChildren(fragment);
  requestAnimationFrame(updateSliderButtons);
}

function fallbackFocusTarget(noteId = '') {
  if (noteId) {
    const matchingEdit = [...track.querySelectorAll('[data-fixture-action="edit"]')]
      .find((button) => button.dataset.noteId === noteId);
    if (matchingEdit) return matchingEdit;
  }
  if (!addButton.hidden) return addButton;
  return authToggle;
}

function openNoteDialog(noteId, opener) {
  const note = noteId ? notes.find((candidate) => candidate.id === noteId) : null;
  if (noteId && !note) return;

  noteForm.reset();
  clearFormError();
  selectedCoverDataUrl = '';
  coverReadGeneration += 1;
  setCoverReadPending(false);
  noteIdInput.value = note?.id ?? '';
  titleInput.value = note?.title ?? '';
  douyinUrlInput.value = note?.douyinUrl ?? '';
  if (note) {
    likesCountInput.value = String(normalizePersistedLikeCount(note.likesCount));
  } else {
    likesCountInput.value = '0';
  }
  coverPreview.src = note?.coverUrl || PLACEHOLDER_URL;
  coverPreview.alt = note ? `${note.title} cover preview` : 'Life note cover preview';
  noteDialogTitle.textContent = note ? '编辑笔记' : '添加笔记';
  noteSubmit.textContent = note ? '保存更改' : '添加';
  dialogState = { opener, noteId: note?.id ?? '' };
  noteDialogBackdrop.hidden = false;
  titleInput.focus();
}

function closeNoteDialog(restoreFocus = true) {
  if (noteDialogBackdrop.hidden) return;

  const previousDialog = dialogState;
  dialogState = null;
  coverReadGeneration += 1;
  coverReadPending = false;
  selectedCoverDataUrl = '';
  noteDialogBackdrop.hidden = true;
  noteForm.reset();
  clearFormError();
  coverPreview.src = PLACEHOLDER_URL;

  if (!restoreFocus) return;
  const opener = previousDialog?.opener;
  const focusTarget = opener instanceof HTMLElement && opener.isConnected
    ? opener
    : fallbackFocusTarget(previousDialog?.noteId);
  focusTarget.focus();
}

function trapDialogFocus(event) {
  const focusable = [...noteDialogBackdrop.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element instanceof HTMLElement && !element.hidden);
  const currentIndex = focusable.indexOf(document.activeElement);
  const targetIndex = resolveFocusTrapTarget(currentIndex, focusable.length, event.shiftKey);
  if (targetIndex === -1) return;
  event.preventDefault();
  focusable[targetIndex].focus();
}

function restoreCurrentCoverPreview() {
  selectedCoverDataUrl = '';
  const editingNote = notes.find((note) => note.id === noteIdInput.value);
  coverPreview.src = editingNote?.coverUrl || PLACEHOLDER_URL;
  coverPreview.alt = editingNote
    ? `${editingNote.title} cover preview`
    : 'Life note cover preview';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsDataURL(file);
  });
}

async function handleCoverChange() {
  clearFormError();
  const [file] = coverInput.files;
  const readGeneration = ++coverReadGeneration;

  if (!file) {
    setCoverReadPending(false);
    restoreCurrentCoverPreview();
    return;
  }

  if (!isShareLifeImageAllowed(file.size, file.type)) {
    coverInput.value = '';
    setCoverReadPending(false);
    restoreCurrentCoverPreview();
    showFormError('Choose an image no larger than 8 MB.');
    return;
  }

  setCoverReadPending(true);
  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (readGeneration !== coverReadGeneration || noteDialogBackdrop.hidden) return;
    if (!dataUrl) throw new Error('The selected image was empty.');
    selectedCoverDataUrl = dataUrl;
    coverPreview.src = dataUrl;
    coverPreview.alt = `${file.name} cover preview`;
  } catch {
    if (readGeneration !== coverReadGeneration || noteDialogBackdrop.hidden) return;
    coverInput.value = '';
    restoreCurrentCoverPreview();
    showFormError('The selected image could not be previewed.');
  } finally {
    if (readGeneration === coverReadGeneration && !noteDialogBackdrop.hidden) {
      setCoverReadPending(false);
    }
  }
}

function handleNoteSubmit(event) {
  event.preventDefault();
  if (coverReadPending) {
    showFormError('Wait for the cover preview to finish.');
    return;
  }
  if (!isSignedIn) {
    showFormError('Enable owner controls before changing fixture notes.');
    return;
  }

  const validation = validateNoteFields({
    title: titleInput.value,
    douyinUrl: douyinUrlInput.value,
    likesCount: likesCountInput.value,
  });
  if (!validation.isValid) {
    showFormError(validation.title || validation.douyinUrl || validation.likesCount);
    return;
  }

  const editingId = noteIdInput.value;
  const existingNote = notes.find((note) => note.id === editingId);
  if (editingId && !existingNote) {
    showFormError('That fixture note is no longer available.');
    return;
  }

  const timestamp = new Date().toISOString();
  if (existingNote) {
    notes = notes.map((note) => note.id === editingId
      ? {
          ...note,
          title: validation.values.title,
          douyinUrl: validation.values.douyinUrl,
          likesCount: validation.values.likesCount,
          coverUrl: selectedCoverDataUrl || note.coverUrl,
          updatedAt: timestamp,
        }
      : note);
    renderNotes();
    closeNoteDialog();
    announce('Fixture note updated in memory.');
    return;
  }

  const note = {
    id: `fixture-note-${nextFixtureId}`,
    title: validation.values.title,
    douyinUrl: validation.values.douyinUrl,
    coverUrl: selectedCoverDataUrl || PLACEHOLDER_URL,
    coverPath: null,
    likesCount: validation.values.likesCount,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  nextFixtureId += 1;
  notes = [...notes, note];
  renderNotes();
  closeNoteDialog();
  announce('Fixture note added in memory.');
}

function handleDelete(noteId, trigger) {
  if (!isSignedIn) return;
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note || !window.confirm(`Delete "${note.title}" from this fixture?`)) return;

  notes = notes.filter((candidate) => candidate.id !== noteId);
  likedNoteIds = setLikedNoteId(likedNoteIds, noteId, false);
  renderNotes();
  announce('Fixture note deleted from memory.');
  fallbackFocusTarget().focus();
  trigger.blur();
}

function handleLike(noteId) {
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) return;

  const intent = nextLikeIntent(note, likedNoteIds);
  likedNoteIds = setLikedNoteId(likedNoteIds, noteId, intent.nextLiked);
  notes = notes.map((candidate) => candidate.id === noteId
    ? {
        ...candidate,
        likesCount: applyShareLifeLikeDelta(candidate.likesCount, intent.delta),
      }
    : candidate);
  renderNotes();
  announce(intent.nextLiked ? 'Fixture note liked.' : 'Fixture note unliked.');

  requestAnimationFrame(() => {
    track.querySelector(`[data-fixture-action="like"][data-note-id="${CSS.escape(noteId)}"]`)?.focus();
  });
}

function handleTrackClick(event) {
  const action = event.target.closest('[data-fixture-action]');
  if (!action) return;

  event.preventDefault();
  event.stopPropagation();
  const { fixtureAction, noteId } = action.dataset;
  if (fixtureAction === 'like') {
    handleLike(noteId);
  } else if (fixtureAction === 'edit') {
    openNoteDialog(noteId, action);
  } else if (fixtureAction === 'delete') {
    handleDelete(noteId, action);
  }
}

function scrollByCard(direction) {
  const card = track.querySelector('.share-life-card');
  const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
  const distance = card ? card.getBoundingClientRect().width + gap : viewport.clientWidth * 0.8;
  viewport.scrollBy({
    left: direction * distance,
    behavior: resolveScrollBehavior(reducedMotionQuery.matches),
  });
}

function isSliderControlTarget(target) {
  const control = target instanceof Element ? target.closest(SLIDER_CONTROL_SELECTOR) : null;
  return Boolean(control && !control.matches('.share-life-card__link'));
}

function initializeSliderDrag() {
  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let isDragging = false;
  let pointerStartedOnCardLink = false;

  viewport.addEventListener('pointerdown', (event) => {
    if (!isMouseDragPointer(event) || isSliderControlTarget(event.target)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = viewport.scrollLeft;
    isDragging = false;
    pointerStartedOnCardLink = event.target instanceof Element
      && Boolean(event.target.closest('.share-life-card__link'));
  });

  viewport.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 4 && !isDragging) {
      isDragging = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (!isDragging) return;

    event.preventDefault();
    viewport.scrollLeft = startScrollLeft - distance;
  });

  const finishDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    const shouldSuppressLink = isDragging && pointerStartedOnCardLink;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    pointerId = null;
    isDragging = false;
    pointerStartedOnCardLink = false;
    if (shouldSuppressLink) {
      suppressNextCardLinkClick = true;
      window.setTimeout(() => {
        suppressNextCardLinkClick = false;
      }, 0);
    }
    updateSliderButtons();
  };

  viewport.addEventListener('click', (event) => {
    if (
      !suppressNextCardLinkClick
      || !(event.target instanceof Element)
      || !event.target.closest('.share-life-card__link')
    ) {
      return;
    }
    suppressNextCardLinkClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
}

authToggle.addEventListener('click', () => {
  isSignedIn = !isSignedIn;
  if (!isSignedIn) closeNoteDialog(false);
  updateFixtureChrome();
  renderNotes();
  announce(isSignedIn
    ? 'Fixture signed-in mode enabled. Owner controls are visible.'
    : 'Fixture signed-out mode enabled. Owner controls are hidden.');
  authToggle.focus();
});

addButton.addEventListener('click', () => openNoteDialog('', addButton));
noteDialogClose.addEventListener('click', () => closeNoteDialog());
noteCancel.addEventListener('click', () => closeNoteDialog());
noteForm.addEventListener('submit', handleNoteSubmit);
coverInput.addEventListener('change', () => void handleCoverChange());
track.addEventListener('click', handleTrackClick);
previousButton.addEventListener('click', () => scrollByCard(-1));
nextButton.addEventListener('click', () => scrollByCard(1));
viewport.addEventListener('scroll', updateSliderButtons, { passive: true });
viewport.addEventListener('wheel', (event) => {
  if (isSliderControlTarget(event.target)) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!canConsumeHorizontalWheel({
    scrollLeft: viewport.scrollLeft,
    scrollWidth: viewport.scrollWidth,
    clientWidth: viewport.clientWidth,
    delta,
  })) return;
  event.preventDefault();
  viewport.scrollLeft += delta;
}, { passive: false });

noteDialogBackdrop.addEventListener('click', (event) => {
  if (event.target === noteDialogBackdrop) closeNoteDialog();
});
document.addEventListener('keydown', (event) => {
  if (noteDialogBackdrop.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNoteDialog();
  } else if (event.key === 'Tab') {
    trapDialogFocus(event);
  }
});
window.addEventListener('resize', updateSliderButtons);

initializeSliderDrag();
updateFixtureChrome();
renderNotes();
