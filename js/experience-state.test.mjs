import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceState, selectCard, computeFanOffsets } from './experience-state.mjs';

test('selecting a non-active card makes it active and unflipped', () => {
  const state = createExperienceState(4, 0);
  const next = selectCard(state, 2);
  assert.equal(next.activeIndex, 2);
  assert.equal(next.flipped, false);
});

test('selecting the already-active card toggles flip instead of changing selection', () => {
  const state = createExperienceState(4, 1);
  const flipped = selectCard(state, 1);
  assert.equal(flipped.activeIndex, 1);
  assert.equal(flipped.flipped, true);

  const flippedBack = selectCard(flipped, 1);
  assert.equal(flippedBack.activeIndex, 1);
  assert.equal(flippedBack.flipped, false);
});

test('active card sits centered with no rotation and the highest z-index', () => {
  const offsets = computeFanOffsets(5, 2);
  const active = offsets[2];
  assert.equal(active.isActive, true);
  assert.equal(active.rotateDeg, 0);
  assert.equal(active.translateX, 0);
  assert.equal(active.zIndex, 5);
});

test('cards further from the active index fan out further and sit lower in the stack', () => {
  const offsets = computeFanOffsets(5, 2);
  assert.equal(offsets[0].rotateDeg, -12);
  assert.equal(offsets[4].rotateDeg, 12);
  assert.ok(offsets[0].zIndex < offsets[2].zIndex);
});
