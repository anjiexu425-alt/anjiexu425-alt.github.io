import { resolveMediaLayout } from './diary-state.mjs';

const MEDIA_ORIENTATION_CLASSES = [
  'diary-page__media--unknown',
  'diary-page__media--landscape',
  'diary-page__media--square',
  'diary-page__media--portrait',
];

export function mediaLayoutKey(url) {
  return encodeURIComponent(String(url));
}

export function mediaGridStyle(count) {
  if (count <= 1) return 'display:grid; grid-template-columns:1fr; grid-template-rows:1fr;';
  if (count === 2) return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:1fr; gap:2px;';
  return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); gap:2px;';
}

export function mediaContainerHTML(entry, {
  active = true,
  layoutCache = new Map(),
  renderItem,
} = {}) {
  const urls = entry.media.urls;
  const isSingle = urls.length === 1;
  const layoutKey = isSingle ? mediaLayoutKey(urls[0]) : null;
  const layout = layoutKey ? layoutCache.get(layoutKey) : null;
  const orientation = layout?.orientation ?? 'unknown';
  const mediaClass = isSingle
    ? `diary-page__media diary-page__media--single diary-page__media--${orientation}`
    : 'diary-page__media';
  const layoutKeyAttribute = layoutKey ? ` data-media-layout-key="${layoutKey}"` : '';
  const aspectStyle = layout ? ` --diary-media-aspect:${layout.aspectRatio};` : '';
  const itemsHTML = urls
    .map((url, index) => renderItem(entry, url, index, urls.length, active))
    .join('');

  return `<div class="${mediaClass}"${layoutKeyAttribute} style="${mediaGridStyle(urls.length)}${aspectStyle}">${itemsHTML}</div>`;
}

export function applySingleMediaLayout(container, width, height) {
  const layout = resolveMediaLayout(width, height);
  container.classList.remove(...MEDIA_ORIENTATION_CLASSES);
  container.classList.add(`diary-page__media--${layout.orientation}`);
  container.style.setProperty('--diary-media-aspect', String(layout.aspectRatio));
  return layout;
}

function isBrowserImage(media) {
  return typeof HTMLImageElement !== 'undefined' && media instanceof HTMLImageElement;
}

export function hydrateSingleMediaLayouts(root, {
  isImage = isBrowserImage,
  haveMetadata = globalThis.HTMLMediaElement?.HAVE_METADATA ?? 1,
  onLayout = () => {},
} = {}) {
  root.querySelectorAll('.diary-page__media--single').forEach((container) => {
    const media = container.querySelector('img, video');
    if (!media) return;

    const apply = (width, height) => {
      const layout = applySingleMediaLayout(container, width, height);
      onLayout(container.dataset.mediaLayoutKey, layout);
    };

    if (isImage(media)) {
      const applyImage = () => apply(media.naturalWidth, media.naturalHeight);
      if (media.complete) applyImage();
      else media.addEventListener('load', applyImage, { once: true });
      return;
    }

    const applyVideo = () => apply(media.videoWidth, media.videoHeight);
    if (media.readyState >= haveMetadata) applyVideo();
    else media.addEventListener('loadedmetadata', applyVideo, { once: true });
  });
}
