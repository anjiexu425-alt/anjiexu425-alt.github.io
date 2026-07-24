import {
  buildShareLifeCardView,
  buildShareLifeCoverCleanupFailureMessage,
  buildShareLifeEditPatch,
  buildShareLifeUploadPath,
  canManageShareLifeNotes,
  canConsumeHorizontalWheel,
  canStartShareLifeCreate,
  canStartShareLifeNoteMutation,
  createDialogOperationToken,
  isShareLifeImageAllowed,
  isDialogOperationCurrent,
  isFreshShareLifeNotesLoad,
  isMouseDragPointer,
  mergeShareLifeNoteById,
  nextLikeIntent,
  parseLikedNoteIds,
  resolveCreatedCover,
  resolveEditedCover,
  resolveFocusReturnTarget,
  resolveFocusTrapTarget,
  resolveScrollBehavior,
  setLikedNoteId,
  shareLifeNoteToInsertRow,
  sumLikeCounts,
  supabaseRowToShareLifeNote,
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
const SLIDER_CONTROL_SELECTOR = 'button, input, textarea, select, label';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');
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
let authKnown = false;
let authSubscribed = false;
let notesLoaded = false;
let notesLoadEpoch = 0;
let notesLoadPending = false;
let notesMutationRevision = 0;
let createPending = false;
let openDialog = null;
let previewObjectUrl = '';
let dialogGeneration = 0;
const pendingLikeIds = new Set();
const pendingNoteMutationIds = new Set();

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
  return typeof error?.message === 'string' && error.message
    ? error.message
    : fallback;
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

function resetFormSubmitButton(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = false;
  if (submitButton.dataset.idleLabel) {
    submitButton.textContent = submitButton.dataset.idleLabel;
    delete submitButton.dataset.idleLabel;
  }
}

function setFormPending(form, pendingLabel) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.dataset.idleLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = pendingLabel;
  return submitButton;
}

function findReplacementEditButton(noteId) {
  if (!noteId) return null;
  return [...track.querySelectorAll('[data-share-life-action="edit"]')]
    .find((button) => button.dataset.noteId === noteId) ?? null;
}

function restoreModalFocus(opener, focusReturn = null) {
  const replacementEdit = findReplacementEditButton(focusReturn?.noteId);
  const targetType = resolveFocusReturnTarget({
    openerConnected: opener instanceof HTMLElement
      && opener.isConnected
      && !opener.hidden
      && !opener.disabled,
    matchingEditExists: replacementEdit instanceof HTMLElement
      && !replacementEdit.disabled,
    addAvailable: !addButton.hidden && !addButton.disabled,
    loginAvailable: !loginButton.hidden && !loginButton.disabled,
  });
  const target = {
    opener,
    edit: replacementEdit,
    add: addButton,
    login: loginButton,
  }[targetType];
  if (target instanceof HTMLElement) target.focus();
}

function openModal(backdrop, firstField, opener, focusReturn = null) {
  if (openDialog && openDialog.backdrop !== backdrop) {
    closeModal(openDialog.backdrop, false);
  }

  dialogGeneration += 1;
  openDialog = {
    backdrop,
    opener,
    focusReturn,
    generation: dialogGeneration,
  };
  backdrop.hidden = false;
  firstField.focus();
}

function closeModal(backdrop, restoreFocus = true, focusReturnOverride = null) {
  if (backdrop.hidden) return;

  const dialog = openDialog?.backdrop === backdrop ? openDialog : null;
  backdrop.hidden = true;
  if (dialog) {
    openDialog = null;
    dialogGeneration += 1;
  }

  if (backdrop === noteDialogBackdrop) {
    revokePreviewObjectUrl();
    resetFormSubmitButton(noteForm);
  } else if (backdrop === loginDialogBackdrop) {
    resetFormSubmitButton(loginForm);
  }

  if (restoreFocus) {
    restoreModalFocus(dialog?.opener, focusReturnOverride ?? dialog?.focusReturn);
  }
}

function isCurrentModalOperation(backdrop, token, editingId = null) {
  return Boolean(
    openDialog?.backdrop === backdrop
    && isDialogOperationCurrent(
      token,
      openDialog.generation,
      editingId,
    ),
  );
}

function trapModalFocus(event) {
  const focusable = [...openDialog.backdrop.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element instanceof HTMLElement && !element.hidden);
  const currentIndex = focusable.indexOf(document.activeElement);
  const targetIndex = resolveFocusTrapTarget(
    currentIndex,
    focusable.length,
    event.shiftKey,
  );
  if (targetIndex === -1) return;
  event.preventDefault();
  focusable[targetIndex].focus();
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

function canManageNotes() {
  return canManageShareLifeNotes({
    authKnown,
    isLoggedIn,
    notesKnown: notesLoaded,
    notesLoadPending,
  });
}

function markNotesMutation() {
  notesMutationRevision += 1;
  if (notesLoadPending) {
    notesLoadEpoch += 1;
    notesLoadPending = false;
  }
}

function renderChrome() {
  const canManage = canManageNotes();
  addButton.hidden = !canManage;
  addButton.disabled = createPending;
  loginButton.hidden = !authKnown || isLoggedIn;
  logoutButton.hidden = !authKnown || !isLoggedIn;
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
    retryButton.addEventListener('click', () => {
      retryButton.disabled = true;
      retryHandler();
    });
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

function createLikeButton(noteId, view) {
  const button = document.createElement('button');
  button.className = 'share-life-card__likes';
  button.type = 'button';
  button.setAttribute('aria-label', `${view.isLiked ? 'Unlike' : 'Like'} ${view.titleText}`);
  button.setAttribute('aria-pressed', String(view.isLiked));
  button.disabled = pendingLikeIds.has(noteId);
  button.append(createSvgIcon('M12 21s-7-4.6-9.2-8.4C.8 9.2 2.2 5 6.2 4.2c2.1-.4 4.1.5 5.8 2.5 1.7-2 3.7-2.9 5.8-2.5 4 .8 5.4 5 3.4 8.4C19 16.4 12 21 12 21Z'));

  const count = document.createElement('span');
  count.textContent = String(view.likesCount);
  button.append(count);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handleLike(noteId, button);
  });

  return button;
}

function createCard(note) {
  const view = buildShareLifeCardView(note, likedNoteIds, canManageNotes());
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
  footer.append(createLikeButton(note.id, view));

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
    const editButton = createManageButton(
      'share-life-card__manage--edit',
      `Edit ${view.titleText}`,
      'M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4',
      () => openEditDialog(note, editButton),
    );
    editButton.dataset.shareLifeAction = 'edit';
    editButton.dataset.noteId = note.id;
    editButton.disabled = pendingNoteMutationIds.has(note.id);
    const deleteButton = createManageButton(
      'share-life-card__manage--delete',
      `Delete ${view.titleText}`,
      ['M4 7h16', 'M9 7V4h6v3', 'M7 7l1 13h8l1-13', 'M10 11v5M14 11v5'],
      (selectedButton) => void handleDelete(note, selectedButton),
    );
    deleteButton.dataset.shareLifeAction = 'delete';
    deleteButton.dataset.noteId = note.id;
    deleteButton.disabled = pendingNoteMutationIds.has(note.id);
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

function renderAuthState() {
  renderChrome();
  if (notesLoaded) renderNotes();
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
  if (!canStartShareLifeCreate(canManageNotes(), createPending)) return;
  noteForm.reset();
  resetFormSubmitButton(noteForm);
  clearAlert(noteError);
  noteIdInput.value = '';
  noteDialogTitle.textContent = '添加笔记';
  setPreview(PLACEHOLDER_URL);
  openModal(noteDialogBackdrop, titleInput, addButton, { type: 'add' });
}

function openEditDialog(note, opener) {
  if (!canStartShareLifeNoteMutation(
    note.id,
    pendingNoteMutationIds,
    canManageNotes(),
  )) {
    return;
  }
  const currentNote = notes.find((candidate) => candidate.id === note.id);
  if (!currentNote) return;
  noteForm.reset();
  resetFormSubmitButton(noteForm);
  clearAlert(noteError);
  noteIdInput.value = currentNote.id;
  titleInput.value = currentNote.title;
  douyinUrlInput.value = currentNote.douyinUrl;
  noteDialogTitle.textContent = '编辑笔记';
  setPreview(currentNote.coverUrl || PLACEHOLDER_URL, currentNote.title);
  openModal(noteDialogBackdrop, titleInput, opener, {
    type: 'edit',
    noteId: currentNote.id,
  });
}

function validateSelectedCover(file) {
  if (file && !isShareLifeImageAllowed(file.size, file.type)) {
    return 'Please choose an image file up to 8 MB.';
  }
  return '';
}

async function createNote(values, file) {
  let uploadedCover = null;
  if (file) {
    const uploadPath = buildShareLifeUploadPath(file.name);
    uploadedCover = await uploadShareLifeCover(file, uploadPath);
  }
  const createdCover = resolveCreatedCover(uploadedCover);
  let row;

  try {
    row = await insertShareLifeNote(shareLifeNoteToInsertRow({
      title: values.title,
      douyinUrl: values.douyinUrl,
      ...createdCover,
    }));
  } catch (error) {
    if (uploadedCover) {
      await bestEffortRemoveCover(uploadedCover.coverPath);
    }
    throw error;
  }

  markNotesMutation();
  notes.push(supabaseRowToShareLifeNote(row));
}

async function editNote(existingNoteId, values, file) {
  const existingNote = notes.find((note) => note.id === existingNoteId);
  if (!existingNote) throw new Error('This life note no longer exists.');

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

  const updatedNote = supabaseRowToShareLifeNote(row);
  const {
    likesCount: _staleLikesCount,
    ...editPatch
  } = updatedNote;
  markNotesMutation();
  notes = mergeShareLifeNoteById(notes, existingNoteId, editPatch);
}

async function handleNoteSubmit(event) {
  event.preventDefault();
  clearAlert(noteError);

  if (!canManageNotes()) {
    showAlert(noteError, 'Life notes are not ready for changes.');
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

  const editingId = noteIdInput.value || null;
  const existingNote = editingId
    ? notes.find((note) => note.id === editingId) ?? null
    : null;
  if (editingId && !existingNote) {
    showAlert(noteError, 'This life note no longer exists.');
    return;
  }
  if (editingId && !canStartShareLifeNoteMutation(
    editingId,
    pendingNoteMutationIds,
    canManageNotes(),
  )) {
    showAlert(noteError, 'This life note already has a pending change.');
    return;
  }
  if (!editingId && !canStartShareLifeCreate(
    canManageNotes(),
    createPending,
  )) {
    showAlert(noteError, 'A life note is already being created.');
    return;
  }
  const file = coverInput.files?.[0] ?? null;
  const coverError = validateSelectedCover(file);
  if (coverError) {
    showAlert(noteError, coverError);
    return;
  }

  const operationToken = createDialogOperationToken(
    openDialog?.generation,
    editingId,
  );
  const focusReturn = openDialog?.focusReturn
    ? { ...openDialog.focusReturn }
    : null;
  let ownsMutationLock = false;
  let ownsCreateLock = false;
  let saveSucceeded = false;
  if (editingId) {
    pendingNoteMutationIds.add(editingId);
    ownsMutationLock = true;
    renderNotes();
  } else {
    createPending = true;
    ownsCreateLock = true;
    renderChrome();
  }
  markNotesMutation();
  setFormPending(noteForm, '保存中…');

  try {
    if (existingNote) {
      await editNote(editingId, validation.values, file);
    } else {
      await createNote(validation.values, file);
    }
    saveSucceeded = true;
  } catch (error) {
    if (isCurrentModalOperation(noteDialogBackdrop, operationToken, editingId)) {
      showAlert(noteError, errorMessage(error, 'Could not save this life note.'));
    }
  } finally {
    if (ownsMutationLock) {
      pendingNoteMutationIds.delete(editingId);
      if (!saveSucceeded) renderNotes();
    }
    if (ownsCreateLock) {
      createPending = false;
      renderChrome();
    }
    if (isCurrentModalOperation(noteDialogBackdrop, operationToken, editingId)) {
      resetFormSubmitButton(noteForm);
    }
  }

  if (!saveSucceeded) return;
  renderNotes();
  if (!isCurrentModalOperation(noteDialogBackdrop, operationToken, editingId)) {
    return;
  }
  noteForm.reset();
  closeModal(noteDialogBackdrop, true, focusReturn);
}

async function handleDelete(note, button) {
  if (!canStartShareLifeNoteMutation(
    note.id,
    pendingNoteMutationIds,
    canManageNotes(),
  )) {
    return;
  }
  const currentNote = notes.find((candidate) => candidate.id === note.id);
  if (!currentNote || !window.confirm(`Delete “${currentNote.title}”?`)) return;

  pendingNoteMutationIds.add(currentNote.id);
  markNotesMutation();
  button.disabled = true;
  renderNotes();
  let ownsMutationLock = true;
  try {
    await deleteShareLifeNote(currentNote.id);
    markNotesMutation();
    notes = notes.filter((candidate) => candidate.id !== currentNote.id);
    likedNoteIds = setLikedNoteId(likedNoteIds, currentNote.id, false);
    persistLikedNoteIds();
    renderNotes();

    try {
      await removeShareLifeCover(currentNote.coverPath);
    } catch (error) {
      status.textContent = buildShareLifeCoverCleanupFailureMessage(
        errorMessage(error, ''),
      );
    }
  } catch (error) {
    pendingNoteMutationIds.delete(currentNote.id);
    ownsMutationLock = false;
    renderNotes();
    announceError(error, 'Could not delete this life note.');
  } finally {
    if (ownsMutationLock) {
      pendingNoteMutationIds.delete(currentNote.id);
    }
    button.disabled = false;
  }
}

async function handleLike(noteId, button) {
  if (pendingLikeIds.has(noteId)) return;

  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) return;
  const intent = nextLikeIntent(note, likedNoteIds);
  pendingLikeIds.add(noteId);
  button.disabled = true;
  let didApply = false;

  try {
    const nextCount = await adjustShareLifeLike(noteId, intent.delta);
    const currentNote = notes.find((candidate) => candidate.id === noteId);
    if (!currentNote) return;
    markNotesMutation();
    notes = mergeShareLifeNoteById(notes, noteId, {
      likesCount: Math.max(0, Number.isFinite(nextCount) ? nextCount : 0),
    });
    likedNoteIds = setLikedNoteId(likedNoteIds, noteId, intent.nextLiked);
    persistLikedNoteIds();
    didApply = true;
  } catch (error) {
    announceError(error, 'Could not update this like.');
    return;
  } finally {
    pendingLikeIds.delete(noteId);
    button.disabled = false;
  }

  if (didApply) renderNotes();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearAlert(loginError);
  if (!authKnown) {
    showAlert(loginError, 'Login status is still loading.');
    return;
  }

  const operationToken = createDialogOperationToken(
    openDialog?.generation,
    null,
  );
  const focusReturn = openDialog?.focusReturn
    ? { ...openDialog.focusReturn }
    : null;
  setFormPending(loginForm, 'Logging In…');

  try {
    const session = await signIn(emailInput.value, passwordInput.value);
    isLoggedIn = Boolean(session);
    authKnown = true;
    renderAuthState();
    if (!isCurrentModalOperation(loginDialogBackdrop, operationToken)) {
      return;
    }
    loginForm.reset();
    closeModal(loginDialogBackdrop, true, focusReturn);
  } catch (error) {
    if (isCurrentModalOperation(loginDialogBackdrop, operationToken)) {
      showAlert(loginError, errorMessage(error, 'Could not log in.'));
    }
  } finally {
    if (isCurrentModalOperation(loginDialogBackdrop, operationToken)) {
      resetFormSubmitButton(loginForm);
    }
  }
}

async function handleLogout() {
  if (!authKnown || !isLoggedIn) return;
  const idleLabel = logoutButton.textContent;
  logoutButton.disabled = true;
  logoutButton.textContent = 'Logging Out…';

  try {
    await signOut();
    isLoggedIn = false;
    authKnown = true;
    renderAuthState();
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

function isSliderControlTarget(target) {
  return target instanceof Element
    && Boolean(target.closest(SLIDER_CONTROL_SELECTOR));
}

function configureSliderInteractions() {
  previousButton.addEventListener('click', () => scrollCards(-1));
  nextButton.addEventListener('click', () => scrollCards(1));
  viewport.addEventListener('scroll', updateSliderButtons, { passive: true });

  viewport.addEventListener('wheel', (event) => {
    if (
      Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      || isSliderControlTarget(event.target)
      || !canConsumeHorizontalWheel({
        scrollLeft: viewport.scrollLeft,
        scrollWidth: viewport.scrollWidth,
        clientWidth: viewport.clientWidth,
        delta: event.deltaY,
      })
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
  let pointerStartedOnCardLink = false;
  let suppressNextCardLinkClick = false;

  viewport.addEventListener('pointerdown', (event) => {
    if (
      event.pointerType !== 'mouse'
      || !isMouseDragPointer(event)
      || isSliderControlTarget(event.target)
    ) {
      return;
    }

    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    scrollStart = viewport.scrollLeft;
    isDragging = false;
    pointerStartedOnCardLink = event.target instanceof Element
      && Boolean(event.target.closest('.share-life-card__link'));
  });

  viewport.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    const distance = event.clientX - pointerStartX;
    if (Math.abs(distance) > 4 && !isDragging) {
      isDragging = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (!isDragging) return;

    event.preventDefault();
    viewport.scrollLeft = scrollStart - distance;
  });

  const endDrag = (event) => {
    if (event.pointerId !== activePointerId) return;
    const shouldSuppressLink = isDragging && pointerStartedOnCardLink;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    isDragging = false;
    pointerStartedOnCardLink = false;
    if (shouldSuppressLink) {
      suppressNextCardLinkClick = true;
      window.setTimeout(() => {
        suppressNextCardLinkClick = false;
      }, 0);
    }
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

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
}

function configureModalInteractions() {
  addButton.addEventListener('click', openCreateDialog);
  loginButton.addEventListener('click', () => {
    loginForm.reset();
    resetFormSubmitButton(loginForm);
    clearAlert(loginError);
    openModal(loginDialogBackdrop, emailInput, loginButton, { type: 'login' });
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
    if (event.key === 'Tab' && openDialog) {
      trapModalFocus(event);
      return;
    }
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

async function initializeAuth() {
  if (!authSubscribed) {
    onAuthStateChange((nextSession) => {
      isLoggedIn = Boolean(nextSession);
      authKnown = true;
      renderAuthState();
    });
    authSubscribed = true;
  }
  try {
    const session = await getSession();
    isLoggedIn = Boolean(session);
    authKnown = true;
    renderAuthState();
  } catch (error) {
    renderAuthState();
    announceError(error, 'Could not determine login status.');
  }
}

async function loadShareLifeNotes() {
  if (notesLoadPending) return;
  notesLoadPending = true;
  const loadEpoch = ++notesLoadEpoch;
  const mutationRevisionAtStart = notesMutationRevision;
  renderAuthState();

  try {
    const rows = await fetchShareLifeNotes();
    if (!isFreshShareLifeNotesLoad({
      loadEpoch: loadEpoch,
      currentLoadEpoch: notesLoadEpoch,
      mutationRevisionAtStart: mutationRevisionAtStart,
      currentMutationRevision: notesMutationRevision,
    })) {
      return;
    }
    notes = rows.map(supabaseRowToShareLifeNote);
    notesLoaded = true;
    renderNotes();
  } catch (error) {
    if (!isFreshShareLifeNotesLoad({
      loadEpoch: loadEpoch,
      currentLoadEpoch: notesLoadEpoch,
      mutationRevisionAtStart: mutationRevisionAtStart,
      currentMutationRevision: notesMutationRevision,
    })) {
      return;
    }
    notesLoaded = false;
    renderStats();
    renderTrackMessage(
      errorMessage(error, 'Could not load life notes.'),
      () => void loadShareLifeNotes(),
    );
  } finally {
    if (loadEpoch === notesLoadEpoch) {
      notesLoadPending = false;
      renderAuthState();
    }
  }
}

function initialize() {
  renderLoading();
  likedNoteIds = readLikedNoteIds();
  renderChrome();
  void initializeAuth();
  void loadShareLifeNotes();
}

configureSliderInteractions();
configureModalInteractions();
initialize();
