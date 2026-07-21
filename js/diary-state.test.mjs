import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
  goToPage,
  isSheetTransformEnd,
} from './diary-state.mjs';

test('starts closed on the first page', () => {
  const state = createDiaryState(3);
  assert.equal(state.isOpen, false);
  assert.equal(state.current, 0);
});

test('opening the book does not change the current page', () => {
  const state = openBook(createDiaryState(3));
  assert.equal(state.isOpen, true);
  assert.equal(state.current, 0);
});

test('previous is clamped at the first page', () => {
  const state = createDiaryState(3);
  assert.equal(canGoPrevious(state), false);
  const stillFirst = goToPrevious(state);
  assert.equal(stillFirst.current, 0);
});

test('next moves forward and is clamped at the last page', () => {
  let state = createDiaryState(3);
  state = goToNext(state);
  state = goToNext(state);
  assert.equal(state.current, 2);
  assert.equal(canGoNext(state), false);

  const stillLast = goToNext(state);
  assert.equal(stillLast.current, 2);
});

test('goToPage jumps directly to a given page', () => {
  const state = createDiaryState(5);
  const jumped = goToPage(state, 3);
  assert.equal(jumped.current, 3);
});

test('goToPage clamps to the valid range', () => {
  const state = createDiaryState(5);
  assert.equal(goToPage(state, -2).current, 0);
  assert.equal(goToPage(state, 99).current, 4);
});

test('isSheetTransformEnd is true only for the sheet element itself finishing its transform', () => {
  const sheet = {};
  assert.equal(isSheetTransformEnd({ target: sheet, propertyName: 'transform' }, sheet), true);
});

test('isSheetTransformEnd rejects a transitionend bubbled up from a child element', () => {
  const sheet = {};
  const childElement = {};
  assert.equal(isSheetTransformEnd({ target: childElement, propertyName: 'transform' }, sheet), false);
});

test('isSheetTransformEnd rejects the sheet transitioning a property other than transform', () => {
  const sheet = {};
  assert.equal(isSheetTransformEnd({ target: sheet, propertyName: 'opacity' }, sheet), false);
});
