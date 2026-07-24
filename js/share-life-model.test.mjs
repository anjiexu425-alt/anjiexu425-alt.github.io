import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from './share-life-model.mjs';

test('normalizes a valid title and http/https Douyin URL', () => {
  assert.equal(model.normalizeTitle('  Iceland light  '), 'Iceland light');
  assert.equal(
    model.normalizeDouyinUrl(' https://www.douyin.com/video/123 '),
    'https://www.douyin.com/video/123',
  );
  assert.equal(model.normalizeDouyinUrl('javascript:alert(1)'), '');
  assert.equal(model.normalizeDouyinUrl('file:///tmp/a'), '');
});

test('validates required title, length, URL, and 8 MB image size', () => {
  assert.equal(model.MAX_SHARE_LIFE_IMAGE_BYTES, 8 * 1024 * 1024);
  assert.equal(model.validateNoteFields({ title: ' ', douyinUrl: 'https://douyin.com' }).title, 'Please enter a title.');
  assert.equal(model.validateNoteFields({ title: 'x'.repeat(161), douyinUrl: 'https://douyin.com' }).title, 'Title must be 160 characters or fewer.');
  assert.equal(model.validateNoteFields({ title: 'Title', douyinUrl: 'javascript:alert(1)' }).douyinUrl, 'Please enter a valid http or https link.');
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024, 'image/jpeg'), true);
  assert.equal(model.isShareLifeImageAllowed(8 * 1024 * 1024 + 1, 'image/jpeg'), false);
  assert.equal(model.isShareLifeImageAllowed(100, 'video/mp4'), false);
});

test('maps rows and preserves existing cover during an edit without upload', () => {
  const row = {
    id: 'n1',
    title: 'Title',
    douyin_url: 'https://www.douyin.com/video/1',
    cover_url: '/cover.jpg',
    cover_path: 'covers/cover.jpg',
    likes_count: 4,
    created_at: '2026-07-24T00:00:00Z',
    updated_at: '2026-07-24T00:00:00Z',
  };
  assert.deepEqual(model.supabaseRowToShareLifeNote(row), {
    id: 'n1',
    title: 'Title',
    douyinUrl: 'https://www.douyin.com/video/1',
    coverUrl: '/cover.jpg',
    coverPath: 'covers/cover.jpg',
    likesCount: 4,
    createdAt: '2026-07-24T00:00:00Z',
    updatedAt: '2026-07-24T00:00:00Z',
  });
  assert.deepEqual(
    model.resolveEditedCover(null, row.cover_url, row.cover_path),
    { coverUrl: '/cover.jpg', coverPath: 'covers/cover.jpg' },
  );
});

test('normalizes persisted navigation URLs at both the row and card boundaries', () => {
  const unsafeRow = model.supabaseRowToShareLifeNote({
    id: 'unsafe',
    title: 'Unsafe',
    douyin_url: 'javascript:alert(1)',
    cover_url: '/cover.jpg',
    cover_path: null,
    likes_count: 0,
  });
  const safeRow = model.supabaseRowToShareLifeNote({
    id: 'safe',
    title: 'Safe',
    douyin_url: ' https://www.douyin.com/video/42 ',
    cover_url: '/cover.jpg',
    cover_path: null,
    likes_count: 0,
  });

  assert.equal(unsafeRow.douyinUrl, '');
  assert.equal(safeRow.douyinUrl, 'https://www.douyin.com/video/42');
  assert.equal(
    model.buildShareLifeCardView({
      ...safeRow,
      douyinUrl: 'data:text/html,<script>alert(1)</script>',
    }, new Set(), false).douyinUrl,
    '',
  );
});

test('uses the bundled placeholder and a null path when create has no upload', () => {
  assert.deepEqual(model.resolveCreatedCover(null), {
    coverUrl: '/assets/images/share-life-placeholder.svg',
    coverPath: null,
  });
  assert.deepEqual(model.resolveCreatedCover({
    coverUrl: 'https://cdn.example/cover.jpg',
    coverPath: 'share-life/cover.jpg',
  }), {
    coverUrl: 'https://cdn.example/cover.jpg',
    coverPath: 'share-life/cover.jpg',
  });
});

test('sums safe like counts and toggles deduplicated local liked ids', () => {
  assert.equal(model.sumLikeCounts([{ likesCount: 3 }, { likesCount: 7 }, { likesCount: -2 }]), 10);
  assert.deepEqual([...model.parseLikedNoteIds('["a","a","b",4]')], ['a', 'b']);
  assert.deepEqual([...model.parseLikedNoteIds('bad json')], []);
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'a'), new Set());
  assert.deepEqual(model.toggleLikedNoteId(new Set(['a']), 'b'), new Set(['a', 'b']));
});

test('sets a like intent explicitly without toggling stale state', () => {
  assert.deepEqual(model.setLikedNoteId(new Set(['a']), 'a', true), new Set(['a']));
  assert.deepEqual(model.setLikedNoteId(new Set(['a']), 'a', false), new Set());
  assert.deepEqual(model.setLikedNoteId(new Set(), 'b', true), new Set(['b']));
});

test('card view models preserve text as data and never return HTML', () => {
  const view = model.buildShareLifeCardView({
    id: 'n1',
    title: '<img src=x onerror=alert(1)>',
    douyinUrl: 'https://douyin.com/video/1',
    coverUrl: '/cover.jpg',
    likesCount: 2,
  }, new Set(['n1']), true);

  assert.equal(view.titleText, '<img src=x onerror=alert(1)>');
  assert.equal(view.isLiked, true);
  assert.equal(view.canManage, true);
  assert.equal('html' in view, false);
});

test('card view models clamp negative likes and select the bundled placeholder', () => {
  const view = model.buildShareLifeCardView({
    id: 'n1',
    title: 'A quiet morning',
    douyinUrl: 'https://douyin.com/video/1',
    coverUrl: '  ',
    likesCount: -8,
  }, new Set(), false);

  assert.equal(view.coverUrl, '/assets/images/share-life-placeholder.svg');
  assert.equal(view.likesCount, 0);
  assert.equal(view.isLiked, false);
  assert.equal(view.canManage, false);
});

test('next like intent reflects the current liked set without mutating it', () => {
  const likedIds = new Set(['liked']);

  assert.deepEqual(
    model.nextLikeIntent({ id: 'new' }, likedIds),
    { delta: 1, nextLiked: true },
  );
  assert.deepEqual(
    model.nextLikeIntent({ id: 'liked' }, likedIds),
    { delta: -1, nextLiked: false },
  );
  assert.deepEqual(likedIds, new Set(['liked']));
});

test('scroll behavior respects reduced-motion preference', () => {
  assert.equal(model.resolveScrollBehavior(true), 'auto');
  assert.equal(model.resolveScrollBehavior(false), 'smooth');
});

test('focus trapping wraps only at modal boundaries', () => {
  assert.equal(model.resolveFocusTrapTarget(0, 4, true), 3);
  assert.equal(model.resolveFocusTrapTarget(3, 4, false), 0);
  assert.equal(model.resolveFocusTrapTarget(1, 4, false), -1);
  assert.equal(model.resolveFocusTrapTarget(-1, 4, false), 0);
  assert.equal(model.resolveFocusTrapTarget(-1, 4, true), 3);
});

test('focus return prefers the live opener, then the replacement edit control, then stable chrome', () => {
  assert.equal(model.resolveFocusReturnTarget({
    openerConnected: true,
    matchingEditExists: true,
    addAvailable: true,
    loginAvailable: true,
  }), 'opener');
  assert.equal(model.resolveFocusReturnTarget({
    openerConnected: false,
    matchingEditExists: true,
    addAvailable: true,
    loginAvailable: true,
  }), 'edit');
  assert.equal(model.resolveFocusReturnTarget({
    openerConnected: false,
    matchingEditExists: false,
    addAvailable: true,
    loginAvailable: true,
  }), 'add');
  assert.equal(model.resolveFocusReturnTarget({
    openerConnected: false,
    matchingEditExists: false,
    addAvailable: false,
    loginAvailable: true,
  }), 'login');
});

test('dialog operation tokens reject stale generations and editing ids', () => {
  const token = model.createDialogOperationToken(7, 'note-a');

  assert.equal(model.isDialogOperationCurrent(token, 7, 'note-a'), true);
  assert.equal(model.isDialogOperationCurrent(token, 8, 'note-a'), false);
  assert.equal(model.isDialogOperationCurrent(token, 7, 'note-b'), false);
  assert.equal(model.isDialogOperationCurrent(null, 7, 'note-a'), false);
});

test('note result merging resolves by id and preserves unrelated concurrent fields', () => {
  const original = [
    { id: 'a', title: 'Old', likesCount: 2, coverPath: 'old.jpg' },
    { id: 'b', title: 'Other', likesCount: 5 },
  ];
  const merged = model.mergeShareLifeNoteById(original, 'a', {
    title: 'Edited',
    coverPath: 'new.jpg',
  });

  assert.notEqual(merged, original);
  assert.deepEqual(merged[0], {
    id: 'a',
    title: 'Edited',
    likesCount: 2,
    coverPath: 'new.jpg',
  });
  assert.equal(merged[1], original[1]);
  assert.equal(model.mergeShareLifeNoteById(original, 'missing', { title: 'Nope' }), original);
});

test('wheel consumption is directional and pointer dragging is mouse-only', () => {
  const middle = { scrollLeft: 40, scrollWidth: 200, clientWidth: 100 };
  assert.equal(model.canConsumeHorizontalWheel({ ...middle, delta: 30 }), true);
  assert.equal(model.canConsumeHorizontalWheel({ ...middle, delta: -30 }), true);
  assert.equal(model.canConsumeHorizontalWheel({
    scrollLeft: 100,
    scrollWidth: 200,
    clientWidth: 100,
    delta: 30,
  }), false);
  assert.equal(model.canConsumeHorizontalWheel({
    scrollLeft: 0,
    scrollWidth: 200,
    clientWidth: 100,
    delta: -30,
  }), false);
  assert.equal(model.canConsumeHorizontalWheel({
    scrollLeft: 0.5,
    scrollWidth: 200,
    clientWidth: 100,
    delta: -30,
  }), true);
  assert.equal(model.canConsumeHorizontalWheel({
    scrollLeft: 99.5,
    scrollWidth: 200,
    clientWidth: 100,
    delta: 30,
  }), true);
  assert.equal(model.canConsumeHorizontalWheel({ ...middle, delta: 0 }), false);

  assert.equal(model.isMouseDragPointer({ pointerType: 'mouse', button: 0, isPrimary: true }), true);
  assert.equal(model.isMouseDragPointer({ pointerType: 'touch', button: 0, isPrimary: true }), false);
  assert.equal(model.isMouseDragPointer({ pointerType: 'pen', button: 0, isPrimary: true }), false);
  assert.equal(model.isMouseDragPointer({ pointerType: 'mouse', button: 1, isPrimary: true }), false);
});

test('owner mutations require known auth and loaded, idle notes', () => {
  const ready = {
    authKnown: true,
    isLoggedIn: true,
    notesKnown: true,
    notesLoadPending: false,
  };

  assert.equal(model.canManageShareLifeNotes(ready), true);
  assert.equal(model.canManageShareLifeNotes({ ...ready, authKnown: false }), false);
  assert.equal(model.canManageShareLifeNotes({ ...ready, isLoggedIn: false }), false);
  assert.equal(model.canManageShareLifeNotes({ ...ready, notesKnown: false }), false);
  assert.equal(model.canManageShareLifeNotes({ ...ready, notesLoadPending: true }), false);
});

test('notes load results are fresh only for the same epoch and mutation revision', () => {
  const fresh = {
    loadEpoch: 4,
    currentLoadEpoch: 4,
    mutationRevisionAtStart: 9,
    currentMutationRevision: 9,
  };

  assert.equal(model.isFreshShareLifeNotesLoad(fresh), true);
  assert.equal(model.isFreshShareLifeNotesLoad({
    ...fresh,
    currentLoadEpoch: 5,
  }), false);
  assert.equal(model.isFreshShareLifeNotesLoad({
    ...fresh,
    currentMutationRevision: 10,
  }), false);
});

test('per-note mutation availability survives independently of dialog state', () => {
  const pendingIds = new Set(['busy']);

  assert.equal(model.canStartShareLifeNoteMutation('free', pendingIds, true), true);
  assert.equal(model.canStartShareLifeNoteMutation('busy', pendingIds, true), false);
  assert.equal(model.canStartShareLifeNoteMutation('free', pendingIds, false), false);
  assert.equal(model.canStartShareLifeNoteMutation('', pendingIds, true), false);
});

test('cover cleanup failure keeps fixed deletion semantics and technical detail', () => {
  assert.equal(
    model.buildShareLifeCoverCleanupFailureMessage('storage timeout'),
    'Note deleted, but cover cleanup failed: storage timeout',
  );
  assert.equal(
    model.buildShareLifeCoverCleanupFailureMessage(''),
    'Note deleted, but cover cleanup failed.',
  );
});

test('create availability requires owner readiness and no global pending create', () => {
  assert.equal(model.canStartShareLifeCreate(true, false), true);
  assert.equal(model.canStartShareLifeCreate(true, true), false);
  assert.equal(model.canStartShareLifeCreate(false, false), false);
});
