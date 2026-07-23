export const BUILT_IN_CATEGORIES = Object.freeze([
  'Study',
  'Abroad / Travel',
  'Chill Beach',
  'Cozy Coffee Shop',
  'Quiet Nature',
  'City Sunset',
  'Rainy Reflection',
  'Midnight Wanderer',
]);

export function normalizeCategory(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function mergeCategoryOptions(entries = []) {
  const categories = [];
  const seen = new Set();

  for (const value of [
    ...BUILT_IN_CATEGORIES,
    ...entries.map((entry) => entry?.category),
  ]) {
    const category = normalizeCategory(value);
    const key = category.toLocaleLowerCase();
    if (!category || seen.has(key)) continue;
    seen.add(key);
    categories.push(category);
  }

  return categories;
}

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function categoryOptionsHTML(categories) {
  return categories
    .map((category) => `<option value="${escapeAttribute(category)}"></option>`)
    .join('');
}
