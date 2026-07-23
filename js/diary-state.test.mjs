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
  isSheetEventTarget,
  computeDragProgress,
  computeFlipVisualState,
  shouldCompleteFlip,
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

test('isSheetEventTarget is true only for the sheet element itself', () => {
  const sheet = {};
  assert.equal(isSheetEventTarget({ target: sheet }, sheet), true);
});

test('isSheetEventTarget rejects an event bubbled up from a child element', () => {
  const sheet = {};
  const childElement = {};
  assert.equal(isSheetEventTarget({ target: childElement }, sheet), false);
});

test('computeDragProgress returns 0 when there is no movement', () => {
  assert.equal(computeDragProgress(0, 300), 0);
});

test('computeDragProgress returns a fraction of pageWidth dragged', () => {
  assert.equal(computeDragProgress(150, 300), 0.5);
});

test('computeDragProgress clamps below 0 to 0', () => {
  assert.equal(computeDragProgress(-50, 300), 0);
});

test('computeDragProgress clamps above 1 to 1', () => {
  assert.equal(computeDragProgress(400, 300), 1);
});

test('computeDragProgress returns 0 for a non-positive pageWidth', () => {
  assert.equal(computeDragProgress(150, 0), 0);
});

test('computeFlipVisualState at progress 0 is fully flat, no lift, opaque', () => {
  const result = computeFlipVisualState(0, 'next');
  assert.equal(result.rotateDeg, 0);
  assert.equal(result.liftPx, 0);
  assert.equal(result.opacity, 1);
});

test('computeFlipVisualState at progress 1 for next direction is fully rotated', () => {
  const result = computeFlipVisualState(1, 'next');
  assert.equal(Math.round(result.rotateDeg), -180);
  assert.ok(Math.abs(result.liftPx) < 1e-9);
  assert.equal(Math.round(result.opacity * 100) / 100, 1);
});

test('computeFlipVisualState at progress 1 for prev direction rotates the opposite way', () => {
  const result = computeFlipVisualState(1, 'prev');
  assert.equal(Math.round(result.rotateDeg), 180);
});

test('computeFlipVisualState peaks lift and dips opacity at progress 0.5', () => {
  const result = computeFlipVisualState(0.5, 'next');
  assert.equal(result.liftPx, -16);
  assert.equal(Math.round(result.opacity * 100) / 100, 0.65);
});

test('shouldCompleteFlip is false below the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.49), false);
});

test('shouldCompleteFlip is true at or above the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.5), true);
  assert.equal(shouldCompleteFlip(0.9), true);
});
