import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLabelAngles,
  arcLengthAtAngle,
  resolveArcPlacement,
  computeOrbitDashArray,
  ARC_BUFFER_DEG,
} from './circle-nav-math.mjs';

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

test('resolveArcPlacement: top-of-circle angle resolves to the top path', () => {
  // -90deg = normalized 270deg, which is in the upper half [180, 360)
  const placement = resolveArcPlacement(-90, 100);
  assert.equal(placement.path, 'top');
});

test('resolveArcPlacement: bottom-of-circle angle resolves to the bottom path', () => {
  // 90deg = normalized 90deg, which is in the lower half [0, 180)
  const placement = resolveArcPlacement(90, 100);
  assert.equal(placement.path, 'bottom');
});

test('resolveArcPlacement: offset is continuous across the leftmost crossing (normalized 180deg)', () => {
  const radius = 100;
  const fromTopSide = resolveArcPlacement(180 + 0.0001, radius); // just inside the top half
  const fromBottomSide = resolveArcPlacement(180 - 0.0001, radius); // just inside the bottom half
  assert.equal(fromTopSide.path, 'top');
  assert.equal(fromBottomSide.path, 'bottom');
  assert.ok(Math.abs(fromTopSide.offset - fromBottomSide.offset) < 0.01);
});

test('resolveArcPlacement: offset is continuous across the rightmost crossing (normalized 0/360deg)', () => {
  const radius = 100;
  const fromTopSide = resolveArcPlacement(-0.0001, radius); // normalized ~359.9999, top half
  const fromBottomSide = resolveArcPlacement(0.0001, radius); // normalized ~0.0001, bottom half
  const bufferArc = radius * (ARC_BUFFER_DEG * Math.PI) / 180;
  const expectedOffset = Math.PI * radius + bufferArc;
  assert.ok(Math.abs(fromTopSide.offset - expectedOffset) < 0.01);
  assert.ok(Math.abs(fromBottomSide.offset - expectedOffset) < 0.01);
});

test('resolveArcPlacement: a buffered anchor near the boundary leaves room for half a long label', () => {
  const radius = 160;
  const longestLabelHalfWidth = 55; // approx. half the rendered width of "Study Diary" at this font size
  const placement = resolveArcPlacement(180.0001, radius); // just inside the top half, right at the seam
  assert.ok(placement.offset >= longestLabelHalfWidth);
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
