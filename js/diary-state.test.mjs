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
  computeDirectionalDragProgress,
  shouldCompleteFlip,
  computeCurlMotion,
  computeUnderlayOpacities,
  easeInOutCubic,
  computeSliceThetas,
  computeSliceLayout,
  contentOffsetForSlice,
  createFlipTransition,
  shouldCompleteDirectionalFlip,
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

test('directional drag progress maps the latest pointer position onto canonical progress', () => {
  assert.equal(computeDirectionalDragProgress(500, 350, 300, 'next'), 0.5);
  assert.equal(computeDirectionalDragProgress(500, 650, 300, 'prev'), 0.5);
  assert.ok(Math.abs(computeDirectionalDragProgress(500, 740, 300, 'prev') - 0.2) < 1e-9);
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

test('underlay shadows follow canonical progress at both physical endpoints', () => {
  assert.deepEqual(computeUnderlayOpacities(0), { leftIn: 0, rightOut: 0.7 });
  assert.deepEqual(computeUnderlayOpacities(0.5), { leftIn: 0.3, rightOut: 0.35 });
  assert.deepEqual(computeUnderlayOpacities(1), { leftIn: 0.6, rightOut: 0 });
});

test('easeInOutCubic passes through the endpoints and midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});

test('canonical slice geometry is flat right at 0 and flat left at 1', () => {
  assert.deepEqual(computeSliceThetas(0, 16), Array(16).fill(0));
  computeSliceThetas(1, 16).forEach((deg) => {
    assert.ok(Math.abs(deg + 180) < 1e-6);
  });
});

test('canonical layout starts at the spine and needs no direction mirror', () => {
  const flatThetas = Array(4).fill(0);
  const result = computeSliceLayout(flatThetas, 10);
  assert.deepEqual(result.positions, [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 20, z: 0 },
    { x: 30, z: 0 },
  ]);
  assert.deepEqual(result.tip, { x: 40, z: 0, rotateDeg: 0 });
});

test('computeSliceLayout carries curl depth into the tip', () => {
  const { tip } = computeSliceLayout([-30], 10);
  const radians = (-30 * Math.PI) / 180;
  assert.ok(Math.abs(tip.x - 10 * Math.cos(radians)) < 1e-9);
  assert.ok(Math.abs(tip.z + 10 * Math.sin(radians)) < 1e-9);
});

test('content strips depend on paper face, not navigation direction', () => {
  assert.equal(contentOffsetForSlice(0, 16, 'front'), 0);
  assert.equal(contentOffsetForSlice(15, 16, 'front'), 15);
  assert.equal(contentOffsetForSlice(0, 16, 'back'), 15);
  assert.equal(contentOffsetForSlice(15, 16, 'back'), 0);
});

test('next transition plays canonical curl forward', () => {
  assert.deepEqual(createFlipTransition(2, 'next'), {
    fromIndex: 2,
    toIndex: 3,
    startProgress: 0,
    targetProgress: 1,
  });
});

test('previous transition plays the same canonical curl backward', () => {
  assert.deepEqual(createFlipTransition(2, 'prev'), {
    fromIndex: 1,
    toIndex: 2,
    startProgress: 1,
    targetProgress: 0,
  });
});

test('directional completion uses opposite sides of the midpoint', () => {
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'next'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'next'), false);
  assert.equal(shouldCompleteDirectionalFlip(0.4, 'prev'), true);
  assert.equal(shouldCompleteDirectionalFlip(0.6, 'prev'), false);
});
