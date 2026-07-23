import { resolveMediaLayout } from './diary-state.mjs';

const MEDIA_ORIENTATION_CLASSES = [
  'diary-page__media--unknown',
  'diary-page__media--landscape',
  'diary-page__media--square',
  'diary-page__media--portrait',
];

const POLAROID_ORIENTATION_CLASSES = [
  'diary-polaroid--unknown',
  'diary-polaroid--landscape',
  'diary-polaroid--square',
  'diary-polaroid--portrait',
  'diary-polaroid--gallery',
];

function mediaSignature(entry) {
  const urls = Array.isArray(entry?.media?.urls) ? entry.media.urls : [];
  return JSON.stringify([entry?.media?.type ?? '', urls.map(String)]);
}

export function createMediaLayoutCache() {
  const layouts = new Map();
  const currentGenerations = new Map();
  const anonymousEntryKeys = new WeakMap();
  let nextAnonymousKey = 0;
  let nextGeneration = 0;

  const keyFor = (entry) => {
    if (entry?.id !== undefined && entry.id !== null) {
      return `entry:${String(entry.id)}`;
    }
    if (!anonymousEntryKeys.has(entry)) {
      nextAnonymousKey += 1;
      anonymousEntryKeys.set(entry, `anonymous:${nextAnonymousKey}`);
    }
    return anonymousEntryKeys.get(entry);
  };

  const rejectChangedMedia = (key, signature) => {
    const cached = layouts.get(key);
    if (cached && cached.signature !== signature) layouts.delete(key);

    const generation = currentGenerations.get(key);
    if (generation && generation.signature !== signature) {
      currentGenerations.delete(key);
    }
  };

  return {
    get size() {
      return layouts.size;
    },

    get(entry) {
      const key = keyFor(entry);
      const signature = mediaSignature(entry);
      rejectChangedMedia(key, signature);
      return layouts.get(key)?.layout;
    },

    begin(entry) {
      const key = keyFor(entry);
      const signature = mediaSignature(entry);
      rejectChangedMedia(key, signature);
      nextGeneration += 1;
      const token = Object.freeze({ key, signature, generation: nextGeneration });
      currentGenerations.clear();
      currentGenerations.set(key, token);
      return token;
    },

    set(token, layout) {
      if (!token || currentGenerations.get(token.key) !== token) return false;
      layouts.set(token.key, { signature: token.signature, layout });
      return true;
    },

    invalidate(entry) {
      if (entry === undefined) {
        layouts.clear();
        currentGenerations.clear();
        return;
      }
      const key = keyFor(entry);
      layouts.delete(key);
      currentGenerations.delete(key);
    },

    prune(entries) {
      const referenced = new Map(
        entries.map((entry) => [keyFor(entry), mediaSignature(entry)]),
      );
      layouts.forEach((cached, key) => {
        if (referenced.get(key) !== cached.signature) layouts.delete(key);
      });
      currentGenerations.forEach((token, key) => {
        if (referenced.get(key) !== token.signature) currentGenerations.delete(key);
      });
    },
  };
}

export function mediaGridStyle(count) {
  if (count <= 1) return 'display:grid; grid-template-columns:1fr; grid-template-rows:1fr;';
  if (count === 2) return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:1fr; gap:2px;';
  return 'display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(2,1fr); gap:2px;';
}

export function polaroidClassForEntry(entry, layoutCache, orientation) {
  const urls = Array.isArray(entry?.media?.urls) ? entry.media.urls : [];
  if (urls.length > 1) return 'diary-polaroid--gallery';
  const resolvedOrientation = orientation ?? layoutCache.get(entry)?.orientation ?? 'unknown';
  return `diary-polaroid--${resolvedOrientation}`;
}

export function mediaContainerHTML(entry, options = {}) {
  const {
    active = true,
    layoutCache = createMediaLayoutCache(),
    renderItem,
  } = options;
  const urls = Array.isArray(entry?.media?.urls) ? entry.media.urls : [];
  const isSingle = urls.length <= 1;
  const resolvedLayout = urls.length === 1
    ? (Object.hasOwn(options, 'layout') ? options.layout : layoutCache.get(entry))
    : undefined;
  const orientation = resolvedLayout?.orientation ?? 'unknown';
  const mediaClass = isSingle
    ? `diary-page__media diary-page__media--single diary-page__media--${orientation}`
    : 'diary-page__media';
  const aspectStyle = resolvedLayout ? ` --diary-media-aspect:${resolvedLayout.aspectRatio};` : '';
  const itemsHTML = urls
    .map((url, index) => renderItem(entry, url, index, urls.length, active))
    .join('');

  return `<div class="${mediaClass}" style="${mediaGridStyle(urls.length)}${aspectStyle}">${itemsHTML}</div>`;
}

function applyPolaroidOrientation(frame, orientation) {
  if (!frame) return;
  frame.classList.remove(...POLAROID_ORIENTATION_CLASSES);
  frame.classList.add(`diary-polaroid--${orientation}`);
}

function applyResolvedSingleMediaLayout(container, layout) {
  container.classList.remove(...MEDIA_ORIENTATION_CLASSES);
  container.classList.add(`diary-page__media--${layout.orientation}`);
  container.style.setProperty('--diary-media-aspect', String(layout.aspectRatio));
  applyPolaroidOrientation(container.closest('.diary-polaroid'), layout.orientation);
}

export function applySingleMediaLayout(container, width, height) {
  const layout = resolveMediaLayout(width, height);
  applyResolvedSingleMediaLayout(container, layout);
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
      const layout = resolveMediaLayout(width, height);
      if (onLayout(layout) === false) return;
      applyResolvedSingleMediaLayout(container, layout);
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
