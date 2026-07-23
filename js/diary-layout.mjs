import { rightPageMediaFrameHTML } from './diary-media.mjs';

const DEFAULT_TAGLINE = 'Abroad & Reflection Sanctuary';
const DEFAULT_BRAND = 'Abroad in Serenity';
const DEFAULT_EDITION = '2026 Edition';

export function normalizePageLayout(value) {
  return value === 'media-left' ? 'media-left' : 'text-left';
}

export function mediaWithPageLayout(media, value) {
  return { ...media, layout: normalizePageLayout(value) };
}

export function pageRolesForEntry(entry) {
  const layout = normalizePageLayout(entry?.media?.layout);
  return layout === 'media-left'
    ? { left: 'media', right: 'text' }
    : { left: 'text', right: 'media' };
}

export function isPlaceholder(value) {
  return value.startsWith('[');
}

function escapeHTMLText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bodyParagraphsHTML(body) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p class="diary-page__body">${paragraph}</p>`)
    .join('');
}

function contentWrapper(entry, role, html) {
  return `<div class="diary-page__content diary-page__content--${role}" data-entry-id="${entry.id}">
    ${html}
  </div>`;
}

export function textPageHTML(entry, {
  isLoggedIn = false,
  tagline = DEFAULT_TAGLINE,
} = {}) {
  const discardHTML = isLoggedIn
    ? `<button type="button" class="diary-page__discard" data-entry-id="${entry.id}">Discard</button>`
    : '';
  const html = `
    <div class="diary-page__header">
      <span class="diary-page__label">${entry.number} / ${escapeHTMLText(entry.category.toUpperCase())}</span>
      <span class="diary-page__date">${entry.date}</span>
    </div>
    <h2 class="diary-page__title">${entry.title}</h2>
    ${entry.quote ? `<blockquote class="diary-page__quote">${entry.quote}</blockquote>` : ''}
    <div class="diary-page__ruled">${bodyParagraphsHTML(entry.body)}</div>
    <div class="diary-page__footer">
      <span class="diary-page__tagline">${tagline}</span>
      ${discardHTML}
    </div>
  `;
  return contentWrapper(entry, 'text', html);
}

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

function mediaItemHTML(entry, url, index, total, active) {
  const spanAttr = total === 3 && index === 0 ? ' style="grid-row: span 2;"' : '';
  if (isPlaceholder(url)) {
    return `<div class="diary-placeholder"${spanAttr}>${placeholderHTML(url)}</div>`;
  }
  if (entry.media.type === 'video') {
    const preloadAttr = active ? '' : ' preload="none"';
    return `<video class="diary-page__video" src="${url}" muted loop playsinline controls${preloadAttr}${spanAttr}></video>`;
  }
  return `<img class="diary-page__photo" src="${url}" alt="${entry.title}"${spanAttr} />`;
}

export function mediaPageHTML(entry, {
  active = true,
  entries = [],
  isLoggedIn = false,
  layoutCache,
  brand = DEFAULT_BRAND,
  edition = DEFAULT_EDITION,
} = {}) {
  const index = entries.indexOf(entry);
  const spreadNumber = index >= 0 ? index + 1 : 1;
  const spreadCount = Math.max(entries.length, 1);
  const urls = entry.media.urls;
  const isGrid = urls.length > 1;
  const badgeHTML = isGrid ? '<span class="diary-polaroid__badge">Gallery</span>' : '';
  const captionHTML = entry.media.caption
    ? `<p class="diary-polaroid__caption">${entry.media.caption}</p>`
    : '';
  const countLabel = entry.media.type === 'video'
    ? '1 Video'
    : `${urls.length} Snapshot${urls.length === 1 ? '' : 's'}`;
  const moodRowHTML = isLoggedIn
    ? `<div class="diary-mood-row">
        <button type="button" class="diary-mood-btn" data-mood-kind="mood" data-entry-id="${entry.id}">${entry.mood || '+ Mood'}</button>
        <button type="button" class="diary-mood-btn" data-mood-kind="weather" data-entry-id="${entry.id}">${entry.weather || '+ Weather'}</button>
      </div>`
    : '';
  const mediaFrameHTML = rightPageMediaFrameHTML(entry, {
    active,
    layoutCache,
    renderItem: mediaItemHTML,
    beforeMediaHTML: badgeHTML,
    afterMediaHTML: `${captionHTML}${moodRowHTML}`,
  });
  const html = `
    <div class="diary-page__header">
      <span class="diary-page__label">Page Spread ${spreadNumber} of ${spreadCount}</span>
      <span class="diary-page__count">${countLabel}</span>
    </div>
    ${mediaFrameHTML}
    <div class="diary-page__footer diary-page__footer--right">
      <span>${brand}</span>
      <span>${edition}</span>
    </div>
  `;
  return contentWrapper(entry, 'media', html);
}

export function pageContentHTML(entry, role, options = {}) {
  return role === 'media'
    ? mediaPageHTML(entry, options)
    : textPageHTML(entry, options);
}

export function spreadHTMLForEntry(entry, options = {}) {
  const roles = pageRolesForEntry(entry);
  return {
    leftHTML: pageContentHTML(entry, roles.left, options),
    rightHTML: pageContentHTML(entry, roles.right, options),
  };
}

export function transitionHTMLForEntries(fromEntry, toEntry, options = {}) {
  const fromSpread = spreadHTMLForEntry(fromEntry, options);
  const toSpread = spreadHTMLForEntry(toEntry, options);
  return {
    underlayLeftHTML: fromSpread.leftHTML,
    underlayRightHTML: toSpread.rightHTML,
    frontHTML: fromSpread.rightHTML,
    backHTML: toSpread.leftHTML,
  };
}
