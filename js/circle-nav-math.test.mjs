import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRingPositions, computeOrbitDashArray } from './circle-nav-math.mjs';

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

test('dash array segments sum to the full circumference', () => {
  const radius = 160;
  const segments = computeOrbitDashArray(['About', 'Experience', 'Study Diary', 'Share Life', 'Toolkit', 'Contact'], radius);
  const total = segments.reduce((sum, n) => sum + n, 0);
  const circumference = 2 * Math.PI * radius;
  assert.ok(Math.abs(total - circumference) < 1e-6);
});

test('dash array alternates dash/gap and produces one gap per label', () => {
  const segments = computeOrbitDashArray(['About', 'Experience', 'Study Diary', 'Share Life', 'Toolkit', 'Contact'], 160);
  // segments = [dash, gap, dash, gap, ..., dash] — one gap per label, one extra trailing dash
  assert.equal(segments.length, 6 * 2 + 1);
});

test('a longer label produces a wider total gap allocation than a shorter one', () => {
  const gapSum = (segments) => segments.filter((_, i) => i % 2 === 1).reduce((sum, n) => sum + n, 0);
  const shortSegments = computeOrbitDashArray(['A', 'B'], 100);
  const longSegments = computeOrbitDashArray(['AAAAAAAAAA', 'B'], 100);
  // gaps sit at odd indices (dash, gap, dash, gap, ..., dash) regardless of angular sort order
  assert.ok(gapSum(longSegments) > gapSum(shortSegments));
});
