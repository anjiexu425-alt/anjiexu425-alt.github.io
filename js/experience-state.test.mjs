import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceState, toggleFlip, computeFanRotations, computeArcTimelinePositions } from './experience-state.mjs';

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

test('fan rotations increase evenly from negative to positive around a centered middle card', () => {
  const rotations = computeFanRotations(5, 10);
  assert.deepEqual(rotations.map((r) => r.rotateDeg), [-20, -10, 0, 10, 20]);
});

test('fan rotations stay symmetric and evenly spaced for an even card count', () => {
  const rotations = computeFanRotations(4, 10).map((r) => r.rotateDeg);
  assert.deepEqual(rotations, [-15, -5, 5, 15]);
});

test('a single card sits with no rotation', () => {
  const rotations = computeFanRotations(1, 10);
  assert.equal(rotations[0].rotateDeg, 0);
});

test('a single arc timeline position sits at the deepest point of the dip', () => {
  const [position] = computeArcTimelinePositions(1, 100);
  assert.equal(position.x, 100);
  assert.equal(position.y, 100);
});

test('arc timeline endpoints sit at the two edges, level with y=0', () => {
  const positions = computeArcTimelinePositions(4, 100);
  assert.equal(positions[0].x, 0);
  assert.ok(Math.abs(positions[0].y) < 1e-9);
  assert.equal(positions[3].x, 200);
  assert.ok(Math.abs(positions[3].y) < 1e-9);
});

test('arc timeline positions dip lowest in the middle, matching a downward arc', () => {
  const positions = computeArcTimelinePositions(4, 100);
  assert.ok(positions[1].y > positions[0].y);
  assert.ok(positions[2].y > positions[3].y);
});
