import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  isFileSizeAllowed,
  buildUploadPath,
  supabaseRowToEntry,
  entryToSupabaseRow,
  resolveMediaUrls,
  buildEditPatch,
} from './diary-validation.mjs';
import { normalizeCategory } from './diary-category.mjs';

test('an image under the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES - 1, 'image'), true);
});

test('an image over the size limit is rejected', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES + 1, 'image'), false);
});

test('an image exactly at the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_IMAGE_BYTES, 'image'), true);
});

test('a video under the size limit is allowed', () => {
  assert.equal(isFileSizeAllowed(MAX_VIDEO_BYTES - 1, 'video'), true);
});

test('a video over the size limit is rejected', () => {
  assert.equal(isFileSizeAllowed(MAX_VIDEO_BYTES + 1, 'video'), false);
});

test('buildUploadPath combines a timestamp and the file name', () => {
  assert.equal(buildUploadPath('beach.jpg', 1700000000000), '1700000000000-beach.jpg');
});

test('buildUploadPath replaces spaces in the file name with hyphens', () => {
  assert.equal(buildUploadPath('my beach photo.jpg', 1700000000000), '1700000000000-my-beach-photo.jpg');
});

test('supabaseRowToEntry maps a database row to the entry shape used by rendering', () => {
  const row = {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  };
  assert.deepEqual(supabaseRowToEntry(row), {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '', layout: 'text-left' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  });
});

test('supabaseRowToEntry defaults missing quote/mood/weather to empty strings', () => {
  const row = {
    id: 'abc-123',
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: null,
    body: 'It was a good day.',
    media: { type: 'image', urls: [], caption: '' },
    mood: null,
    weather: null,
  };
  const entry = supabaseRowToEntry(row);
  assert.equal(entry.quote, '');
  assert.equal(entry.mood, '');
  assert.equal(entry.weather, '');
});

test('supabaseRowToEntry preserves a valid media-left layout and other media fields', () => {
  const row = {
    id: 'abc-123',
    number: '01',
    category: 'Study',
    entry_date: '2026.07.20',
    title: 'Notes',
    quote: null,
    body: 'Body.',
    media: { type: 'video', urls: ['a.mp4'], caption: 'Lecture', layout: 'media-left', provider: 'vimeo' },
    mood: null,
    weather: null,
  };

  assert.deepEqual(supabaseRowToEntry(row).media, {
    type: 'video',
    urls: ['a.mp4'],
    caption: 'Lecture',
    layout: 'media-left',
    provider: 'vimeo',
  });
});

test('entryToSupabaseRow maps the entry shape back to a database row', () => {
  const entry = {
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  };
  assert.deepEqual(entryToSupabaseRow(entry), {
    number: '01',
    category: 'Chill Beach',
    entry_date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: 'Salt air and sunshine.',
    body: 'It was a good day.',
    media: { type: 'image', urls: ['https://example.com/a.jpg'], caption: '', layout: 'text-left' },
    mood: '😊 Happy',
    weather: '☀️ Sunny',
  });
});

test('entryToSupabaseRow preserves a normalized custom category with special characters', () => {
  const category = normalizeCategory('  Film & "TV" <Notes>  ');
  const row = entryToSupabaseRow({
    number: '01',
    category,
    date: '2026.07.20',
    title: 'A custom category',
    quote: '',
    body: 'Body.',
    media: { type: 'image', urls: [], caption: '' },
    mood: '',
    weather: '',
  });

  assert.equal(category, 'Film & "TV" <Notes>');
  assert.equal(row.category, category);
});

test('entryToSupabaseRow defaults missing quote/mood/weather to null', () => {
  const entry = {
    number: '01',
    category: 'Chill Beach',
    date: '2026.07.20',
    title: 'A Day at the Beach',
    quote: '',
    body: 'It was a good day.',
    media: { type: 'image', urls: [], caption: '' },
    mood: '',
    weather: '',
  };
  const row = entryToSupabaseRow(entry);
  assert.equal(row.quote, null);
  assert.equal(row.mood, null);
  assert.equal(row.weather, null);
});

test('entryToSupabaseRow normalizes an invalid layout without mutating other media fields', () => {
  const media = { type: 'image', urls: ['a.jpg'], caption: 'Notes', layout: 'sideways', focalPoint: 'center' };
  const entry = {
    number: '01', category: 'Study', date: '2026.07.20', title: 'Title', quote: '', body: 'Body.', media, mood: '', weather: '',
  };

  assert.deepEqual(entryToSupabaseRow(entry).media, {
    type: 'image',
    urls: ['a.jpg'],
    caption: 'Notes',
    layout: 'text-left',
    focalPoint: 'center',
  });
  assert.equal(media.layout, 'sideways');
});

test('resolveMediaUrls keeps newly uploaded files when present', () => {
  assert.deepEqual(
    resolveMediaUrls(['new.jpg'], { type: 'image', urls: ['old.jpg'] }, 'image'),
    ['new.jpg']
  );
});

test('resolveMediaUrls falls back to the existing urls when nothing was uploaded and the media type is unchanged', () => {
  assert.deepEqual(
    resolveMediaUrls([], { type: 'image', urls: ['old.jpg', 'old2.jpg'] }, 'image'),
    ['old.jpg', 'old2.jpg']
  );
});

test('resolveMediaUrls returns a placeholder instead of the existing urls when the media type was switched and nothing new was uploaded', () => {
  assert.deepEqual(
    resolveMediaUrls([], { type: 'image', urls: ['old.jpg'] }, 'video'),
    ['[Photo placeholder: edited entry video]']
  );
});

test('resolveMediaUrls returns a photo placeholder when switching from video to photo with no upload', () => {
  assert.deepEqual(
    resolveMediaUrls([], { type: 'video', urls: ['old.mp4'] }, 'image'),
    ['[Photo placeholder: edited entry photo]']
  );
});

test('resolveMediaUrls prefers newly uploaded files even when the media type was switched', () => {
  assert.deepEqual(
    resolveMediaUrls(['new.mp4'], { type: 'image', urls: ['old.jpg'] }, 'video'),
    ['new.mp4']
  );
});

test('buildEditPatch maps form fields and media into a Supabase patch, without number/mood/weather', () => {
  const patch = buildEditPatch(
    { category: 'Study', date: '2026.07.20', title: 'Edited Title', quote: 'A line that stuck.', body: 'Body text.' },
    { type: 'image', urls: ['a.jpg', 'b.jpg'], caption: 'A caption', layout: 'media-left' }
  );
  assert.deepEqual(patch, {
    category: 'Study',
    entry_date: '2026.07.20',
    title: 'Edited Title',
    quote: 'A line that stuck.',
    body: 'Body text.',
    media: { type: 'image', urls: ['a.jpg', 'b.jpg'], caption: 'A caption', layout: 'media-left' },
  });
});

test('buildEditPatch preserves a normalized custom category with special characters', () => {
  const category = normalizeCategory('  Film & "TV" <Notes>  ');
  const patch = buildEditPatch(
    { category, date: '2026.07.20', title: 'Edited Title', quote: '', body: 'Body.' },
    { type: 'image', urls: [], caption: '' },
  );

  assert.equal(category, 'Film & "TV" <Notes>');
  assert.equal(patch.category, category);
});

test('buildEditPatch defaults an empty quote to null, matching entryToSupabaseRow', () => {
  const patch = buildEditPatch(
    { category: 'Study', date: '2026.07.20', title: 'Title', quote: '', body: 'Body.' },
    { type: 'video', urls: ['a.mp4'], caption: '' }
  );
  assert.equal(patch.quote, null);
});

test('buildEditPatch normalizes invalid layouts without mutating media', () => {
  const media = { type: 'video', urls: ['a.mp4'], caption: '', layout: 'sideways', autoplay: true };
  const patch = buildEditPatch(
    { category: 'Study', date: '2026.07.20', title: 'Title', quote: '', body: 'Body.' },
    media
  );

  assert.deepEqual(patch.media, {
    type: 'video',
    urls: ['a.mp4'],
    caption: '',
    layout: 'text-left',
    autoplay: true,
  });
  assert.equal(media.layout, 'sideways');
});
