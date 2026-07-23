export function normalizePageLayout(value) {
  return value === 'media-left' ? 'media-left' : 'text-left';
}

export function pageRolesForEntry(entry) {
  const layout = normalizePageLayout(entry?.media?.layout);
  return layout === 'media-left'
    ? { left: 'media', right: 'text' }
    : { left: 'text', right: 'media' };
}
