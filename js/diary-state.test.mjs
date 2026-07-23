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
  computeDragProgress,
  shouldCompleteFlip,
  computeCurlMotion,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
  contentOffsetForSlice,
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

test('shouldCompleteFlip is false below the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.49), false);
});

test('shouldCompleteFlip is true at or above the halfway point', () => {
  assert.equal(shouldCompleteFlip(0.5), true);
  assert.equal(shouldCompleteFlip(0.9), true);
});

test('computeCurlMotion is 0 at both ends and peaks at the midpoint', () => {
  assert.ok(Math.abs(computeCurlMotion(0)) < 1e-9);
  assert.equal(computeCurlMotion(0.5), 1);
  assert.ok(Math.abs(computeCurlMotion(1)) < 1e-9);
});

test('easeInOutCubic passes through the endpoints and midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});

test('computeSliceThetas is flat at progress 0 and fully rotated at 1', () => {
  assert.deepEqual(computeSliceThetas(0, 16, 'next'), Array(16).fill(0));
  computeSliceThetas(1, 16, 'next').forEach((deg) => assert.ok(Math.abs(deg + 180) < 1e-6));
  computeSliceThetas(1, 16, 'prev').forEach((deg) => assert.ok(Math.abs(deg - 180) < 1e-6));
});

test('computeSliceThetas mirrors next and previous directions', () => {
  const next = computeSliceThetas(0.5, 16, 'next');
  const prev = computeSliceThetas(0.5, 16, 'prev');
  next.forEach((deg, index) => assert.ok(Math.abs(deg + prev[index]) < 1e-9));
});

test('computeSliceLayout lays out and mirrors flat slices', () => {
  assert.deepEqual(computeSliceLayout([0, 0, 0, 0], 10, 'next'), {
    positions: [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }, { x: 30, z: 0 }],
    tip: { x: 40, z: 0, rotateDeg: 0 },
  });
  assert.deepEqual(computeSliceLayout([0, 0, 0, 0], 10, 'prev').positions, [
    { x: 30, z: 0 }, { x: 20, z: 0 }, { x: 10, z: 0 }, { x: 0, z: 0 },
  ]);
});

test('computeSliceLayout carries curl depth into the tip', () => {
  const { tip } = computeSliceLayout([-30], 10, 'next');
  const radians = (-30 * Math.PI) / 180;
  assert.ok(Math.abs(tip.x - 10 * Math.cos(radians)) < 1e-9);
  assert.ok(Math.abs(tip.z + 10 * Math.sin(radians)) < 1e-9);
});

test('contentOffsetForSlice maps front and mirrored back strips', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'next', 'front'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'next', 'front'), 15);
  assert.equal(contentOffsetForSlice(0, 16, 'prev', 'front'), 15);
  assert.equal(contentOffsetForSlice(0, 16, 'next', 'back'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'prev', 'back'), 15);
});
