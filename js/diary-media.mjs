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
  const entryGenerations = new Map();
  const anonymousEntryKeys = new WeakMap();
  let renderGeneration = null;
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

    if (
      renderGeneration?.key === key
      && renderGeneration.signature !== signature
    ) {
      renderGeneration = null;
    }

    const entryGeneration = entryGenerations.get(key);
    if (entryGeneration && entryGeneration.signature !== signature) {
      entryGenerations.delete(key);
    }
  };

  const createGeneration = (entry, lane) => {
    const key = keyFor(entry);
    const signature = mediaSignature(entry);
    rejectChangedMedia(key, signature);
    nextGeneration += 1;
    return Object.freeze({
      key,
      signature,
      lane,
      generation: nextGeneration,
    });
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
      const token = createGeneration(entry, 'render');
      renderGeneration = token;
      return token;
    },

    beginEntry(entry) {
      const token = createGeneration(entry, 'entry');
      entryGenerations.set(token.key, token);
      return token;
    },

    set(token, layout) {
      if (!token) return false;
      const isCurrent = token.lane === 'entry'
        ? entryGenerations.get(token.key) === token
        : renderGeneration === token;
      if (!isCurrent) return false;
      layouts.set(token.key, { signature: token.signature, layout });
      return true;
    },

    cancel(token) {
      if (!token) return false;
      if (token.lane === 'entry') {
        if (entryGenerations.get(token.key) !== token) return false;
        entryGenerations.delete(token.key);
        return true;
      }
      if (renderGeneration !== token) return false;
      renderGeneration = null;
      return true;
    },

    invalidate(entry) {
      if (entry === undefined) {
        layouts.clear();
        entryGenerations.clear();
        renderGeneration = null;
        return;
      }
      const key = keyFor(entry);
      layouts.delete(key);
      entryGenerations.delete(key);
      if (renderGeneration?.key === key) renderGeneration = null;
    },

    prune(entries) {
      const referenced = new Map(
        entries.map((entry) => [keyFor(entry), mediaSignature(entry)]),
      );
      layouts.forEach((cached, key) => {
        if (referenced.get(key) !== cached.signature) layouts.delete(key);
      });
      entryGenerations.forEach((token, key) => {
        if (referenced.get(key) !== token.signature) entryGenerations.delete(key);
      });
      if (
        renderGeneration
        && referenced.get(renderGeneration.key) !== renderGeneration.signature
      ) renderGeneration = null;
    },
  };
}

function intrinsicMediaRequest(entry) {
  const urls = Array.isArray(entry?.media?.urls) ? entry.media.urls : [];
  if (urls.length !== 1) return null;
  const url = String(urls[0]);
  if (url.startsWith('[')) return null;
  if (entry?.media?.type !== 'image' && entry?.media?.type !== 'video') {
    return null;
  }
  return { type: entry.media.type, url };
}

function abortError() {
  const error = new Error('Media metadata loading was aborted.');
  error.name = 'AbortError';
  return error;
}

function timeoutError() {
  const error = new Error('Media metadata loading timed out.');
  error.name = 'TimeoutError';
  return error;
}

function loadImageMetadataInBrowser(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image metadata loading requires a browser.'));
      return;
    }
    const image = new Image();
    const cleanup = () => {
      image.removeEventListener('load', handleLoad);
      image.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', handleAbort);
    };
    const handleLoad = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      cleanup();
      resolve(dimensions);
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Could not load image metadata for ${url}`));
    };
    const handleAbort = () => {
      cleanup();
      image.src = '';
      reject(abortError());
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    image.addEventListener('load', handleLoad, { once: true });
    image.addEventListener('error', handleError, { once: true });
    signal?.addEventListener('abort', handleAbort, { once: true });
    image.src = url;
  });
}

function loadVideoMetadataInBrowser(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Video metadata loading requires a browser.'));
      return;
    }
    const video = document.createElement('video');
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('error', handleError);
      signal?.removeEventListener('abort', handleAbort);
    };
    const stopLoading = () => {
      video.removeAttribute('src');
      video.load();
    };
    const handleMetadata = () => {
      const dimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      stopLoading();
      resolve(dimensions);
    };
    const handleError = () => {
      cleanup();
      stopLoading();
      reject(new Error(`Could not load video metadata for ${url}`));
    };
    const handleAbort = () => {
      cleanup();
      stopLoading();
      reject(abortError());
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('loadedmetadata', handleMetadata, { once: true });
    video.addEventListener('error', handleError, { once: true });
    signal?.addEventListener('abort', handleAbort, { once: true });
    video.src = url;
    video.load();
  });
}

function loadMetadataWithin(loader, url, entry, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const metadata = Promise.resolve().then(() => loader(url, {
    entry,
    signal: controller.signal,
  }));
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(timeoutError());
    }, timeoutMs);
  });
  return Promise.race([metadata, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export function createMediaIntrinsicPrewarmer(layoutCache, {
  loadImageMetadata = loadImageMetadataInBrowser,
  loadVideoMetadata = loadVideoMetadataInBrowser,
  maxConcurrency = 4,
  timeoutMs = 2500,
} = {}) {
  const inFlight = new WeakMap();
  const boundedConcurrency = Number.isFinite(maxConcurrency) && maxConcurrency > 0
    ? Math.max(1, Math.floor(maxConcurrency))
    : 4;
  const boundedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : 2500;

  const isReady = (entries) => entries.every((entry) => (
    intrinsicMediaRequest(entry) === null
    || layoutCache.get(entry) !== undefined
  ));

  const prewarm = (entry) => {
    const cachedLayout = layoutCache.get(entry);
    if (cachedLayout) {
      return Promise.resolve({ status: 'cached', layout: cachedLayout });
    }
    const request = intrinsicMediaRequest(entry);
    if (!request) return Promise.resolve({ status: 'not-needed' });
    const signature = mediaSignature(entry);
    const pending = inFlight.get(entry);
    if (pending?.signature === signature) return pending.work;

    const generation = layoutCache.beginEntry(entry);
    const loader = request.type === 'video'
      ? loadVideoMetadata
      : loadImageMetadata;
    const work = (async () => {
      try {
        const { width, height } = await loadMetadataWithin(
          loader,
          request.url,
          entry,
          boundedTimeoutMs,
        );
        const layout = resolveMediaLayout(width, height);
        if (layout.orientation === 'unknown') {
          layoutCache.cancel(generation);
          return { status: 'failed' };
        }
        if (!layoutCache.set(generation, layout)) return { status: 'stale' };
        return { status: 'ready', layout };
      } catch (error) {
        layoutCache.cancel(generation);
        return {
          status: error?.name === 'TimeoutError' ? 'timed-out' : 'failed',
        };
      }
    })();

    const pendingRecord = { signature, work };
    inFlight.set(entry, pendingRecord);
    void work.finally(() => {
      if (inFlight.get(entry) === pendingRecord) inFlight.delete(entry);
    });
    return work;
  };

  const prewarmAll = async (entries) => {
    const results = new Array(entries.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < entries.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await prewarm(entries[index]);
      }
    };
    const workerCount = Math.min(entries.length, boundedConcurrency);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
  };

  return Object.freeze({
    prewarm,
    prewarmAll,
    isReady,
    ensure(entries) {
      return prewarmAll(entries).then(() => isReady(entries));
    },
  });
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

export function rightPageMediaFrameHTML(entry, {
  active = true,
  layoutCache = createMediaLayoutCache(),
  renderItem,
  beforeMediaHTML = '',
  afterMediaHTML = '',
} = {}) {
  const urls = Array.isArray(entry?.media?.urls) ? entry.media.urls : [];
  const layout = urls.length === 1 ? layoutCache.get(entry) : undefined;
  const polaroidClass = polaroidClassForEntry(
    entry,
    layoutCache,
    layout?.orientation ?? 'unknown',
  );
  const mediaHTML = mediaContainerHTML(entry, {
    active,
    layoutCache,
    layout,
    renderItem,
  });

  return `<div class="diary-polaroid ${polaroidClass}">
      <span class="diary-polaroid__tape" aria-hidden="true"></span>
      ${beforeMediaHTML}
      ${mediaHTML}
      ${afterMediaHTML}
    </div>`;
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
