import {
  buildShareLifeCardView,
  buildShareLifeEditPatch,
  buildShareLifeUploadPath,
  isShareLifeImageAllowed,
  nextLikeIntent,
  parseLikedNoteIds,
  resolveEditedCover,
  resolveScrollBehavior,
  shareLifeNoteToInsertRow,
  sumLikeCounts,
  supabaseRowToShareLifeNote,
  toggleLikedNoteId,
  validateNoteFields,
} from './share-life-model.mjs';
import {
  adjustShareLifeLike,
  deleteShareLifeNote,
  fetchShareLifeNotes,
  insertShareLifeNote,
  removeShareLifeCover,
  updateShareLifeNote,
  uploadShareLifeCover,
} from './share-life-supabase.js';
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
} from './diary-supabase.js';

const PLACEHOLDER_URL = '/assets/images/share-life-placeholder.svg';
const LIKED_NOTE_IDS_KEY = 'shareLifeLikedNoteIds';
const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const track = document.getElementById('shareLifeTrack');
const viewport = document.querySelector('.share-life-slider__viewport');
const status = document.getElementById('shareLifeStatus');
const addButton = document.getElementById('shareLifeAddButton');
const loginButton = document.getElementById('shareLifeLoginButton');
const logoutButton = document.getElementById('shareLifeLogoutButton');
const previousButton = document.getElementById('shareLifePrev');
const nextButton = document.getElementById('shareLifeNext');
const followersCount = document.getElementById('shareLifeFollowersCount');
const likesCount = document.getElementById('shareLifeLikesCount');

const noteDialogBackdrop = document.getElementById('shareLifeNoteDialogBackdrop');
const noteDialogTitle = document.getElementById('shareLifeNoteDialogTitle');
const noteDialogClose = document.getElementById('shareLifeNoteDialogClose');
const noteForm = document.getElementById('shareLifeNoteForm');
const noteIdInput = document.getElementById('shareLifeNoteId');
const titleInput = document.getElementById('shareLifeTitle');
const douyinUrlInput = document.getElementById('shareLifeDouyinUrl');
const coverInput = document.getElementById('shareLifeCover');
const coverPreview = document.querySelector('#shareLifeCoverPreview img');
const noteError = document.getElementById('shareLifeNoteError');
const noteCancel = document.getElementById('shareLifeNoteCancel');

const loginDialogBackdrop = document.getElementById('shareLifeLoginDialogBackdrop');
const loginDialogClose = document.getElementById('shareLifeLoginDialogClose');
const loginForm = document.getElementById('shareLifeLoginForm');
const emailInput = document.getElementById('shareLifeEmail');
const passwordInput = document.getElementById('shareLifePassword');
const loginError = document.getElementById('shareLifeLoginError');
const loginCancel = document.getElementById('shareLifeLoginCancel');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let notes = [];
let likedNoteIds = new Set();
let isLoggedIn = false;
let authSubscribed = false;
let openDialog = null;
let previewObjectUrl = '';
const pendingLikeIds = new Set();

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

function clearAlert(element) {
  element.textContent = '';
  element.hidden = true;
}

function showAlert(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function announceError(error, fallback) {
  status.textContent = errorMessage(error, fallback);
}

function setPreview(source, altText = 'Life note cover preview') {
  coverPreview.src = source || PLACEHOLDER_URL;
  coverPreview.alt = altText;
}

function revokePreviewObjectUrl() {
  if (!previewObjectUrl) return;
  URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = '';
}

function openModal(backdrop, firstField, opener) {
  if (openDialog && openDialog.backdrop !== backdrop) {
    closeModal(openDialog.backdrop, false);
  }

  openDialog = { backdrop, opener };
  backdrop.hidden = false;
  firstField.focus();
}

function closeModal(backdrop, restoreFocus = true) {
  if (backdrop.hidden) return;

  const opener = openDialog?.backdrop === backdrop ? openDialog.opener : null;
  backdrop.hidden = true;
  if (openDialog?.backdrop === backdrop) openDialog = null;

  if (backdrop === noteDialogBackdrop) {
    revokePreviewObjectUrl();
  }

  if (restoreFocus && opener instanceof HTMLElement && opener.isConnected) {
    opener.focus();
  }
}

function updateSliderButtons() {
  const maximumScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  previousButton.disabled = viewport.scrollLeft <= 1;
  nextButton.disabled = viewport.scrollLeft >= maximumScroll - 1;
}

function renderStats() {
  followersCount.textContent = '90';
  likesCount.textContent = String(sumLikeCounts(notes));
}

function renderChrome() {
  addButton.hidden = !isLoggedIn;
  loginButton.hidden = isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
}

function renderTrackMessage(message, retryHandler = null) {
  const messageElement = document.createElement('p');
  messageElement.className = 'share-life-status';
  messageElement.textContent = message;
  track.replaceChildren(messageElement);

  if (retryHandler) {
    const retryButton = document.createElement('button');
    retryButton.className = 'share-life-button';
    retryButton.type = 'button';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', retryHandler);
    track.append(retryButton);
  }

  status.textContent = message;
  updateSliderButtons();
}

function renderLoading() {
  renderTrackMessage('Loading life notes…');
}

function createManageButton(className, label, iconPath, handler) {
  const button = document.createElement('button');
  button.className = `share-life-card__manage ${className}`;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(createSvgIcon(iconPath));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler(button);
  });
  return button;
}

function createLikeButton(note, view) {
  const button = document.createElement('button');
  button.className = 'share-life-card__likes';
  button.type = 'button';
  button.setAttribute('aria-label', `${view.isLiked ? 'Unlike' : 'Like'} ${view.titleText}`);
  button.setAttribute('aria-pressed', String(view.isLiked));
  button.disabled = pendingLikeIds.has(note.id);
  button.append(createSvgIcon('M12 21s-7-4.6-9.2-8.4C.8 9.2 2.2 5 6.2 4.2c2.1-.4 4.1.5 5.8 2.5 1.7-2 3.7-2.9 5.8-2.5 4 .8 5.4 5 3.4 8.4C19 16.4 12 21 12 21Z'));

  const count = document.createElement('span');
  count.textContent = String(view.likesCount);
  button.append(count);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleLike(note, button);
  });

  return button;
}

function createCard(note) {
  const view = buildShareLifeCardView(note, likedNoteIds, isLoggedIn);
  const card = document.createElement('article');
  card.className = 'share-life-card';

  const link = document.createElement('a');
  link.className = 'share-life-card__link';
  link.href = view.douyinUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', `Open ${view.titleText} on Douyin`);

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
  destination.textContent = 'Douyin ↗';
  footer.append(destination);

  content.append(title, footer);
  link.append(imageWrap);
  card.append(link, content);

  if (view.canManage) {
    const editButton = createManageButton(
      'share-life-card__manage--edit',
      `Edit ${view.titleText}`,
      'M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4',
      () => openEditDialog(note, editButton),
    );
    const deleteButton = createManageButton(
      'share-life-card__manage--delete',
      `Delete ${view.titleText}`,
      ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13', 'M10 11v5M14 11v5'],
      (selectedButton) => void handleDelete(note, selectedButton),
    );
    card.append(editButton, deleteButton);
  }

  return card;
}

function renderNotes() {
  renderStats();

  if (notes.length === 0) {
    renderTrackMessage('No life notes yet.');
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    fragment.append(createCard(note));
  }
  track.replaceChildren(fragment);
  status.textContent = `${notes.length} life ${notes.length === 1 ? 'note' : 'notes'}.`;
  requestAnimationFrame(updateSliderButtons);
}

function renderPage() {
  renderChrome();
  renderNotes();
}

function readLikedNoteIds() {
  try {
    return parseLikedNoteIds(localStorage.getItem(LIKED_NOTE_IDS_KEY));
  } catch {
    return new Set();
  }
}

function persistLikedNoteIds() {
  try {
    localStorage.setItem(LIKED_NOTE_IDS_KEY, JSON.stringify([...likedNoteIds]));
  } catch (error) {
    console.warn('Could not persist Share Life likes.', error);
  }
}

async function bestEffortRemoveCover(path) {
  if (!path) return;
  try {
    await removeShareLifeCover(path);
  } catch (error) {
    console.warn('Could not remove a Share Life cover.', error);
  }
}

function openCreateDialog() {
  noteForm.reset();
  clearAlert(noteError);
  noteIdInput.value = '';
  noteDialogTitle.textContent = '添加笔记';
  setPreview(PLACEHOLDER_URL);
  openModal(noteDialogBackdrop, titleInput, addButton);
}

function openEditDialog(note, opener) {
  noteForm.reset();
  clearAlert(noteError);
  noteIdInput.value = note.id;
  titleInput.value = note.title;
  douyinUrlInput.value = note.douyinUrl;
  noteDialogTitle.textContent = '编辑笔记';
  setPreview(note.coverUrl || PLACEHOLDER_URL, note.title);
  openModal(noteDialogBackdrop, titleInput, opener);
}

function validateSelectedCover(file, isCreate) {
  if (!file && isCreate) {
    return 'Please choose a cover image.';
  }
  if (file && !isShareLifeImageAllowed(file.size, file.type)) {
    return 'Please choose an image file up to 8 MB.';
  }
  return '';
}

async function createNote(values, file) {
  const uploadPath = buildShareLifeUploadPath(file.name);
  const uploadedCover = await uploadShareLifeCover(file, uploadPath);
  let row;

  try {
    row = await insertShareLifeNote(shareLifeNoteToInsertRow({
      title: values.title,
      douyinUrl: values.douyinUrl,
      ...uploadedCover,
    }));
  } catch (error) {
    await bestEffortRemoveCover(uploadedCover.coverPath);
    throw error;
  }

  notes.push(supabaseRowToShareLifeNote(row));
}

async function editNote(existingNote, values, file) {
  let uploadedCover = null;
  if (file) {
    const uploadPath = buildShareLifeUploadPath(file.name);
    uploadedCover = await uploadShareLifeCover(file, uploadPath);
  }

  const resolvedCover = resolveEditedCover(
    uploadedCover,
    existingNote.coverUrl,
    existingNote.coverPath,
  );

  let row;
  try {
    row = await updateShareLifeNote(existingNote.id, buildShareLifeEditPatch({
      title: values.title,
      douyinUrl: values.douyinUrl,
      ...resolvedCover,
    }));
  } catch (error) {
    if (uploadedCover) {
      await bestEffortRemoveCover(uploadedCover.coverPath);
    }
    throw error;
  }

  if (uploadedCover && existingNote.coverPath !== uploadedCover.coverPath) {
    await bestEffortRemoveCover(existingNote.coverPath);
  }

  const index = notes.findIndex((note) => note.id === existingNote.id);
  if (index !== -1) notes[index] = supabaseRowToShareLifeNote(row);
}

async function handleNoteSubmit(event) {
  event.preventDefault();
  clearAlert(noteError);

  if (!isLoggedIn) {
    showAlert(noteError, 'Please log in to manage life notes.');
    return;
  }

  const validation = validateNoteFields({
    title: titleInput.value,
    douyinUrl: douyinUrlInput.value,
  });
  if (!validation.isValid) {
    showAlert(noteError, validation.title || validation.douyinUrl);
    return;
  }

  const existingNote = notes.find((note) => note.id === noteIdInput.value) ?? null;
  const file = coverInput.files?.[0] ?? null;
  const coverError = validateSelectedCover(file, !existingNote);
  if (coverError) {
    showAlert(noteError, coverError);
    return;
  }

  const submitButton = noteForm.querySelector('button[type="submit"]');
  const idleLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = '保存中…';

  try {
    if (existingNote) {
      await editNote(existingNote, validation.values, file);
    } else {
      await createNote(validation.values, file);
    }

    renderNotes();
    closeModal(noteDialogBackdrop);
    noteForm.reset();
  } catch (error) {
    showAlert(noteError, errorMessage(error, 'Could not save this life note.'));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = idleLabel;
  }
}

async function handleDelete(note, button) {
  if (!isLoggedIn || !window.confirm(`Delete “${note.title}”?`)) return;

  button.disabled = true;
  try {
    await deleteShareLifeNote(note.id);
    await bestEffortRemoveCover(note.coverPath);
    notes = notes.filter((candidate) => candidate.id !== note.id);
    likedNoteIds.delete(note.id);
    persistLikedNoteIds();
    renderNotes();
  } catch (error) {
    announceError(error, 'Could not delete this life note.');
  } finally {
    button.disabled = false;
  }
}

async function handleLike(note, button) {
  if (pendingLikeIds.has(note.id)) return;

  const intent = nextLikeIntent(note, likedNoteIds);
  pendingLikeIds.add(note.id);
  button.disabled = true;

  try {
    const nextCount = await adjustShareLifeLike(note.id, intent.delta);
    note.likesCount = Math.max(0, Number.isFinite(nextCount) ? nextCount : 0);
    likedNoteIds = toggleLikedNoteId(likedNoteIds, note.id);
    persistLikedNoteIds();
  } catch (error) {
    announceError(error, 'Could not update this like.');
    return;
  } finally {
    pendingLikeIds.delete(note.id);
    button.disabled = false;
  }

  renderNotes();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearAlert(loginError);

  const submitButton = loginForm.querySelector('button[type="submit"]');
  const idleLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Logging In…';

  try {
    const session = await signIn(emailInput.value, passwordInput.value);
    isLoggedIn = Boolean(session);
    renderPage();
    closeModal(loginDialogBackdrop);
    loginForm.reset();
  } catch (error) {
    showAlert(loginError, errorMessage(error, 'Could not log in.'));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = idleLabel;
  }
}

async function handleLogout() {
  const idleLabel = logoutButton.textContent;
  logoutButton.disabled = true;
  logoutButton.textContent = 'Logging Out…';

  try {
    await signOut();
    isLoggedIn = false;
    renderPage();
  } catch (error) {
    announceError(error, 'Could not log out.');
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = idleLabel;
  }
}

function cardScrollDistance() {
  const firstCard = track.querySelector('.share-life-card');
  if (!firstCard) return viewport.clientWidth;

  const trackStyles = getComputedStyle(track);
  const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap) || 0;
  return (firstCard.getBoundingClientRect().width + gap) * 2;
}

function scrollCards(direction) {
  viewport.scrollBy({
    left: direction * cardScrollDistance(),
    behavior: resolveScrollBehavior(reducedMotionQuery.matches),
  });
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function configureSliderInteractions() {
  previousButton.addEventListener('click', () => scrollCards(-1));
  nextButton.addEventListener('click', () => scrollCards(1));
  viewport.addEventListener('scroll', updateSliderButtons, { passive: true });

  viewport.addEventListener('wheel', (event) => {
    if (
      Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      || isInteractiveTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    viewport.scrollBy({
      left: event.deltaY,
      behavior: resolveScrollBehavior(reducedMotionQuery.matches),
    });
  }, { passive: false });

  let activePointerId = null;
  let pointerStartX = 0;
  let scrollStart = 0;
  let isDragging = false;

  viewport.addEventListener('pointerdown', (event) => {
    if (
      event.button !== 0
      || !event.isPrimary
      || isInteractiveTarget(event.target)
    ) {
      return;
    }

    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    scrollStart = viewport.scrollLeft;
    isDragging = false;
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) > 4) isDragging = true;
    if (!isDragging) return;

    event.preventDefault();
    viewport.scrollLeft = scrollStart - distance;
  });

  const endDrag = (event) => {
    if (event.pointerId !== activePointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    isDragging = false;
  };

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
}

function configureModalInteractions() {
  addButton.addEventListener('click', openCreateDialog);
  loginButton.addEventListener('click', () => {
    loginForm.reset();
    clearAlert(loginError);
    openModal(loginDialogBackdrop, emailInput, loginButton);
  });
  logoutButton.addEventListener('click', () => void handleLogout());

  noteDialogClose.addEventListener('click', () => closeModal(noteDialogBackdrop));
  noteCancel.addEventListener('click', () => closeModal(noteDialogBackdrop));
  loginDialogClose.addEventListener('click', () => closeModal(loginDialogBackdrop));
  loginCancel.addEventListener('click', () => closeModal(loginDialogBackdrop));

  noteDialogBackdrop.addEventListener('click', (event) => {
    if (event.target === noteDialogBackdrop) closeModal(noteDialogBackdrop);
  });
  loginDialogBackdrop.addEventListener('click', (event) => {
    if (event.target === loginDialogBackdrop) closeModal(loginDialogBackdrop);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openDialog) {
      closeModal(openDialog.backdrop);
    }
  });

  coverInput.addEventListener('change', () => {
    clearAlert(noteError);
    revokePreviewObjectUrl();
    const file = coverInput.files?.[0] ?? null;
    if (!file) {
      const existingNote = notes.find((note) => note.id === noteIdInput.value);
      setPreview(existingNote?.coverUrl || PLACEHOLDER_URL, existingNote?.title);
      return;
    }
    if (!isShareLifeImageAllowed(file.size, file.type)) {
      showAlert(noteError, 'Please choose an image file up to 8 MB.');
      coverInput.value = '';
      setPreview(PLACEHOLDER_URL);
      return;
    }

    previewObjectUrl = URL.createObjectURL(file);
    setPreview(previewObjectUrl, file.name);
  });

  noteForm.addEventListener('submit', (event) => void handleNoteSubmit(event));
  loginForm.addEventListener('submit', (event) => void handleLoginSubmit(event));
}

async function initialize() {
  renderLoading();

  try {
    const rows = await fetchShareLifeNotes();
    notes = rows.map(supabaseRowToShareLifeNote);

    const session = await getSession();
    isLoggedIn = Boolean(session);

    likedNoteIds = readLikedNoteIds();

    if (!authSubscribed) {
      onAuthStateChange((nextSession) => {
        isLoggedIn = Boolean(nextSession);
        renderPage();
      });
      authSubscribed = true;
    }

    renderPage();
  } catch (error) {
    renderChrome();
    renderStats();
    renderTrackMessage(
      errorMessage(error, 'Could not load life notes.'),
      () => void initialize(),
    );
  }
}

configureSliderInteractions();
configureModalInteractions();
void initialize();
