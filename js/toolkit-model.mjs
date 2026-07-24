function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeTags(tags = []) {
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = normalizeText(raw);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function buildItemSubmission({ name, url, description, tags }) {
  const normalizedName = normalizeText(name);
  const normalizedUrl = normalizeText(url);
  const normalizedDescription = normalizeText(description);
  const normalizedTags = normalizeTags(tags);

  const errors = [];
  if (!normalizedName) errors.push('Name is required.');
  if (normalizedName.length > 160) errors.push('Name must be 160 characters or fewer.');
  if (!isValidHttpUrl(normalizedUrl)) errors.push('A valid http(s) URL is required.');

  if (errors.length > 0) {
    return { valid: false, errors, row: null };
  }

  return {
    valid: true,
    errors: [],
    row: {
      name: normalizedName,
      url: normalizedUrl,
      description: normalizedDescription || null,
      tags: normalizedTags,
    },
  };
}

export function supabaseRowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function tagChipsHTML(tags, className) {
  return tags.map((tag) => `<span class="${className}">${escapeHTML(tag)}</span>`).join('');
}

export function skillRowHTML(item, isLoggedIn) {
  const tagsHtml = tagChipsHTML(item.tags, 'skill-tag');
  const deleteButton = isLoggedIn
    ? `<button class="skill-delete" data-id="${escapeHTML(item.id)}" title="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`
    : '';
  return `
    <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" class="skill-row" data-id="${escapeHTML(item.id)}">
      <div class="skill-main">
        <span class="skill-name">${escapeHTML(item.name)}</span>
        <span class="skill-desc">${escapeHTML(item.description)}</span>
      </div>
      <div class="skill-row__end">
        <div class="skill-tags">${tagsHtml}</div>
        ${deleteButton}
      </div>
    </a>
  `;
}

export function projectCardHTML(item, isLoggedIn) {
  const badgesHtml = tagChipsHTML(item.tags, 'project-badge');
  const deleteButton = isLoggedIn
    ? `<button class="project-delete" data-id="${escapeHTML(item.id)}" title="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`
    : '';
  return `
    <div class="project-card" data-id="${escapeHTML(item.id)}">
      ${deleteButton}
      <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" class="project-card__link">
        <div class="project-content">
          <h3 class="project-name">${escapeHTML(item.name)}</h3>
          <p class="project-desc">${item.description ? escapeHTML(item.description) : '暂无描述'}</p>
          <div class="project-badges">${badgesHtml}</div>
        </div>
      </a>
    </div>
  `;
}

export function emptyStateHTML(message) {
  return `<div class="toolkit-empty"><p>${escapeHTML(message)}</p></div>`;
}
