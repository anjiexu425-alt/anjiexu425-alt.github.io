import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceState, toggleFlip, computeFanOffsets, computeCompassTickAngles, computeCompassRotation } from './experience-state.mjs';

test('toggling flip on a card sets it as the flipped card', () => {
  const state = createExperienceState(4);
  const next = toggleFlip(state, 2);
  assert.equal(next.flippedIndex, 2);
});

test('toggling the already-flipped card unflips it', () => {
  const state = createExperienceState(4);
  const flipped = toggleFlip(state, 2);
  const unflipped = toggleFlip(flipped, 2);
  assert.equal(unflipped.flippedIndex, null);
});

test('toggling a different card while one is flipped switches to the new card, not both', () => {
  const state = createExperienceState(4);
  const flipped = toggleFlip(state, 2);
  const switched = toggleFlip(flipped, 0);
  assert.equal(switched.flippedIndex, 0);
});

test('fan offsets match the exact design-specified values for all 5 cards', () => {
  const offsets = computeFanOffsets();
  assert.deepEqual(offsets, [
    { index: 0, translateX: -230, translateY: 24, rotateDeg: -35 },
    { index: 1, translateX: -115, translateY: -30, rotateDeg: -17 },
    { index: 2, translateX: 0, translateY: -52, rotateDeg: 0 },
    { index: 3, translateX: 115, translateY: -30, rotateDeg: 17 },
    { index: 4, translateX: 230, translateY: 24, rotateDeg: 35 },
  ]);
});

test('the middle card sits highest (most negative translateY) and rotation is symmetric around it', () => {
  const offsets = computeFanOffsets();
  assert.ok(offsets[2].translateY < offsets[0].translateY);
  assert.ok(offsets[2].translateY < offsets[4].translateY);
  assert.equal(offsets[0].rotateDeg, -offsets[4].rotateDeg);
  assert.equal(offsets[1].rotateDeg, -offsets[3].rotateDeg);
});

test('compass tick angles start straight up and spread evenly clockwise', () => {
  const angles = computeCompassTickAngles(5).map((t) => t.angleDeg);
  assert.deepEqual(angles, [-90, -18, 54, 126, 198]);
});

test('compass rotation is zero when the tick already pointing up is active', () => {
  const angles = computeCompassTickAngles(5);
  assert.equal(computeCompassRotation(angles, 0), 0);
});

test('compass rotation brings any active tick to point straight up (-90deg) once applied', () => {
  const angles = computeCompassTickAngles(5);
  for (let activeIndex = 0; activeIndex < 5; activeIndex += 1) {
    const rotation = computeCompassRotation(angles, activeIndex);
    const rotatedAngle = angles[activeIndex].angleDeg + rotation;
    assert.equal(rotatedAngle, -90);
  }
});
