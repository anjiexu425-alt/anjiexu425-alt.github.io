import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILT_IN_CATEGORIES,
  normalizeCategory,
  mergeCategoryOptions,
} from './diary-category.mjs';

test('normalizeCategory trims a category value', () => {
  assert.equal(normalizeCategory('  Film Notes  '), 'Film Notes');
});

test('normalizeCategory converts non-string and whitespace-only values to empty', () => {
  assert.equal(normalizeCategory('   '), '');
  assert.equal(normalizeCategory(null), '');
  assert.equal(normalizeCategory(42), '');
});

test('mergeCategoryOptions keeps built-ins first and appends custom entry categories', () => {
  const result = mergeCategoryOptions([
    { category: 'Film Notes' },
    { category: 'Weekend Cooking' },
  ]);
  assert.deepEqual(result.slice(0, BUILT_IN_CATEGORIES.length), BUILT_IN_CATEGORIES);
  assert.deepEqual(result.slice(-2), ['Film Notes', 'Weekend Cooking']);
});

test('mergeCategoryOptions ignores empty categories and deduplicates without case sensitivity', () => {
  const result = mergeCategoryOptions([
    { category: ' study ' },
    { category: 'Film Notes' },
    { category: 'film notes' },
    { category: '   ' },
  ]);
  assert.equal(result.filter((category) => category.toLowerCase() === 'study').length, 1);
  assert.equal(result.find((category) => category.toLowerCase() === 'study'), 'Study');
  assert.equal(result.filter((category) => category.toLowerCase() === 'film notes').length, 1);
  assert.equal(result.find((category) => category.toLowerCase() === 'film notes'), 'Film Notes');
});
