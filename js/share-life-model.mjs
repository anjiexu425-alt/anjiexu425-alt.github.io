export const MAX_SHARE_LIFE_IMAGE_BYTES = 8 * 1024 * 1024;

export function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeDouyinUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function validateNoteFields({ title, douyinUrl } = {}) {
  const values = {
    title: normalizeTitle(title),
    douyinUrl: normalizeDouyinUrl(douyinUrl),
  };
  const errors = {
    values,
    title: '',
    douyinUrl: '',
    isValid: true,
  };

  if (!values.title) {
    errors.title = 'Please enter a title.';
  } else if (values.title.length > 160) {
    errors.title = 'Title must be 160 characters or fewer.';
  }

  if (!values.douyinUrl) {
    errors.douyinUrl = 'Please enter a valid http or https link.';
  }

  errors.isValid = !errors.title && !errors.douyinUrl;
  return errors;
}

export function isShareLifeImageAllowed(size, type) {
  return Number.isFinite(Number(size))
    && Number(size) >= 0
    && Number(size) <= MAX_SHARE_LIFE_IMAGE_BYTES
    && typeof type === 'string'
    && type.startsWith('image/');
}

export function buildShareLifeUploadPath(fileName, timestampMs = Date.now(), cryptoPart = crypto.randomUUID()) {
  const safeFileName = String(fileName ?? '').replace(/\s+/g, '-');
  return `share-life/${timestampMs}-${cryptoPart}-${safeFileName}`;
}

export function supabaseRowToShareLifeNote(row) {
  return {
    id: row.id,
    title: row.title,
    douyinUrl: row.douyin_url,
    coverUrl: row.cover_url,
    coverPath: row.cover_path,
    likesCount: row.likes_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shareLifeNoteToInsertRow(note) {
  return {
    title: note.title,
    douyin_url: note.douyinUrl,
    cover_url: note.coverUrl,
    cover_path: note.coverPath,
  };
}

export function buildShareLifeEditPatch(note) {
  return shareLifeNoteToInsertRow(note);
}

export function resolveEditedCover(newCover, existingCoverUrl, existingCoverPath) {
  if (!newCover) {
    return { coverUrl: existingCoverUrl, coverPath: existingCoverPath };
  }

  return {
    coverUrl: newCover.coverUrl,
    coverPath: newCover.coverPath,
  };
}

export function sumLikeCounts(notes) {
  return notes.reduce((sum, note) => (
    sum + Math.max(0, Number.isFinite(Number(note.likesCount)) ? Number(note.likesCount) : 0)
  ), 0);
}

export function parseLikedNoteIds(value) {
  if (typeof value !== 'string') return new Set();
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleLikedNoteId(likedNoteIds, noteId) {
  const ids = new Set(likedNoteIds);
  if (ids.has(noteId)) {
    ids.delete(noteId);
  } else {
    ids.add(noteId);
  }
  return ids;
}

export function buildShareLifeCardView(note, likedNoteIds, isLoggedIn) {
  const likesCount = Number(note.likesCount);

  return {
    id: note.id,
    titleText: note.title,
    douyinUrl: note.douyinUrl,
    coverUrl: typeof note.coverUrl === 'string' && note.coverUrl.trim()
      ? note.coverUrl
      : '/assets/images/share-life-placeholder.svg',
    likesCount: Number.isFinite(likesCount) ? Math.max(0, likesCount) : 0,
    isLiked: likedNoteIds.has(note.id),
    canManage: isLoggedIn,
  };
}

export function nextLikeIntent(note, likedNoteIds) {
  const nextLiked = !likedNoteIds.has(note.id);
  return {
    delta: nextLiked ? 1 : -1,
    nextLiked,
  };
}

export function resolveScrollBehavior(prefersReducedMotion) {
  return prefersReducedMotion ? 'auto' : 'smooth';
}
