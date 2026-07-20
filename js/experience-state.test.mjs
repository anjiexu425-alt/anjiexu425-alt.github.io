import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceState, selectCard, computeCoverflowOffsets, computeCompassTickAngles, computeCompassRotation } from './experience-state.mjs';

test('selecting a non-active card makes it active and unflipped', () => {
  const state = createExperienceState(5, 0);
  const next = selectCard(state, 3);
  assert.equal(next.activeIndex, 3);
  assert.equal(next.flipped, false);
});

test('selecting the already-active card toggles flip instead of changing selection', () => {
  const state = createExperienceState(5, 1);
  const flipped = selectCard(state, 1);
  assert.equal(flipped.activeIndex, 1);
  assert.equal(flipped.flipped, true);

  const flippedBack = selectCard(flipped, 1);
  assert.equal(flippedBack.activeIndex, 1);
  assert.equal(flippedBack.flipped, false);
});

test('coverflow: the active card sits centered, lifted up, and scaled up with the highest z-index', () => {
  const offsets = computeCoverflowOffsets(5, 0);
  const active = offsets[0];
  assert.equal(active.isActive, true);
  assert.equal(active.rotateDeg, 0);
  assert.equal(active.translateX, 0);
  assert.equal(active.translateY, -32);
  assert.equal(active.scale, 1.05);
  assert.equal(active.zIndex, 50);
});

test('coverflow: rotation and horizontal spread grow linearly with distance from the active card', () => {
  const offsets = computeCoverflowOffsets(5, 0);
  assert.equal(offsets[1].rotateDeg, 11);
  assert.equal(offsets[1].translateX, 140);
  assert.equal(offsets[4].rotateDeg, 44);
  assert.equal(offsets[4].translateX, 560);
});

test('coverflow: vertical position follows an arch, further cards sitting lower', () => {
  const offsets = computeCoverflowOffsets(5, 0);
  assert.equal(offsets[1].translateY, 10);
  assert.equal(offsets[2].translateY, 40);
  assert.equal(offsets[4].translateY, 160);
});

test('coverflow: reflows around whichever card becomes active, not fixed slots', () => {
  const offsets = computeCoverflowOffsets(5, 3);
  assert.equal(offsets[3].isActive, true);
  assert.equal(offsets[3].translateX, 0);
  assert.equal(offsets[0].translateX, -420);
  assert.equal(offsets[4].translateX, 140);
});

test('compass tick angles spread evenly across a 112deg arc centered on straight up', () => {
  const angles = computeCompassTickAngles(5).map((t) => t.angleDeg);
  assert.deepEqual(angles, [-146, -118, -90, -62, -34]);
});

test('compass rotation is zero when the tick already pointing up is active', () => {
  const angles = computeCompassTickAngles(5);
  assert.equal(computeCompassRotation(angles, 2), 0);
});

test('compass rotation brings any active tick to point straight up (-90deg) once applied', () => {
  const angles = computeCompassTickAngles(5);
  for (let activeIndex = 0; activeIndex < 5; activeIndex += 1) {
    const rotation = computeCompassRotation(angles, activeIndex);
    const rotatedAngle = angles[activeIndex].angleDeg + rotation;
    assert.equal(rotatedAngle, -90);
  }
});
