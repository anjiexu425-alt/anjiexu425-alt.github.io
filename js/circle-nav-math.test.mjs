import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRingPositions } from './circle-nav-math.mjs';

test('distributes items evenly around the circle starting at the top', () => {
  const positions = computeRingPositions(['A', 'B', 'C', 'D'], 100);
  assert.equal(positions.length, 4);
  assert.equal(positions[0].angleDeg, -90);
  assert.equal(positions[1].angleDeg, 0);
  assert.equal(positions[2].angleDeg, 90);
  assert.equal(positions[3].angleDeg, 180);
});

test('first item sits at the top of the circle (x near 0, y negative)', () => {
  const positions = computeRingPositions(['A', 'B'], 100);
  assert.ok(Math.abs(positions[0].x) < 1e-9);
  assert.ok(positions[0].y < 0);
});

test('rotateDeg keeps the label tangent to the circle', () => {
  const positions = computeRingPositions(['A'], 50);
  assert.equal(positions[0].rotateDeg, 0);
});
