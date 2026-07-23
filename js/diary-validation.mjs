export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function maxBytesForMediaType(mediaType) {
  return mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function isFileSizeAllowed(sizeBytes, mediaType) {
  return sizeBytes <= maxBytesForMediaType(mediaType);
}

// Storage object keys can't safely contain arbitrary whitespace, and a
// timestamp prefix keeps two uploads of the same filename from colliding.
export function buildUploadPath(fileName, timestampMs) {
  return `${timestampMs}-${fileName.replace(/\s+/g, '-')}`;
}

// Maps a diary_entries database row to the entry object shape every
// rendering function in js/diary.js already expects (leftPageHTML,
// rightPageHTML, mediaItemHTML, etc. are unchanged by the Supabase
// migration as long as this mapping is correct).
export function supabaseRowToEntry(row) {
  return {
    id: row.id,
    number: row.number,
    category: row.category,
    date: row.entry_date,
    title: row.title,
    quote: row.quote || '',
    body: row.body,
    media: row.media,
    mood: row.mood || '',
    weather: row.weather || '',
  };
}

export function entryToSupabaseRow(entry) {
  return {
    number: entry.number,
    category: entry.category,
    entry_date: entry.date,
    title: entry.title,
    quote: entry.quote || null,
    body: entry.body,
    media: entry.media,
    mood: entry.mood || null,
    weather: entry.weather || null,
  };
}

// Returns the media URLs to save for an edit: newly uploaded files replace
// the entry's existing media entirely, but an edit with no new uploads (the
// file inputs left blank) keeps whatever media the entry already had.
export function resolveMediaUrls(uploadedUrls, existingUrls) {
  return uploadedUrls.length > 0 ? uploadedUrls : existingUrls;
}

// Builds the partial-update patch for editing an existing entry. Deliberately
// omits `number`, `mood`, and `weather` — editing text/media must never touch
// those fields, so they simply aren't part of the patch Supabase applies.
export function buildEditPatch(fields, media) {
  return {
    category: fields.category,
    entry_date: fields.date,
    title: fields.title,
    quote: fields.quote || null,
    body: fields.body,
    media,
  };
}
