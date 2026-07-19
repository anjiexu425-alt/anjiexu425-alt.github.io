import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLabelAngles, arcLengthAtAngle, computeOrbitDashArray } from './circle-nav-math.mjs';

test('distributes angles evenly around the circle starting at the top', () => {
  const angles = computeLabelAngles(4);
  assert.deepEqual(angles, [-90, 0, 90, 180]);
});

test('arcLengthAtAngle: 0deg is the path start (0), -90deg is 3/4 of the way around', () => {
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  assert.equal(arcLengthAtAngle(0, radius), 0);
  assert.ok(Math.abs(arcLengthAtAngle(-90, radius) - circumference * 0.75) < 1e-9);
  assert.ok(Math.abs(arcLengthAtAngle(90, radius) - circumference * 0.25) < 1e-9);
});

test('dash array segments sum to the full circumference', () => {
  const radius = 160;
  const angles = computeLabelAngles(6);
  const items = angles.map((angleDeg) => ({ angleDeg, gapWidth: 40 }));
  const segments = computeOrbitDashArray(items, radius);
  const total = segments.reduce((sum, n) => sum + n, 0);
  const circumference = 2 * Math.PI * radius;
  assert.ok(Math.abs(total - circumference) < 1e-6);
});

test('dash array alternates dash/gap and produces one gap per item', () => {
  const angles = computeLabelAngles(6);
  const items = angles.map((angleDeg) => ({ angleDeg, gapWidth: 40 }));
  const segments = computeOrbitDashArray(items, 160);
  // segments = [dash, gap, dash, gap, ..., dash] — one gap per item, one extra trailing dash
  assert.equal(segments.length, 6 * 2 + 1);
});

test('a wider requested gapWidth produces a wider total gap allocation', () => {
  const gapSum = (segments) => segments.filter((_, i) => i % 2 === 1).reduce((sum, n) => sum + n, 0);
  const angles = computeLabelAngles(2);
  const narrowItems = angles.map((angleDeg) => ({ angleDeg, gapWidth: 20 }));
  const wideItems = angles.map((angleDeg) => ({ angleDeg, gapWidth: 80 }));
  assert.ok(gapSum(computeOrbitDashArray(wideItems, 100)) > gapSum(computeOrbitDashArray(narrowItems, 100)));
});
