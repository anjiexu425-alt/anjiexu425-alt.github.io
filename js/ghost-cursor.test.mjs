import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerp, computeFadeOpacity } from './ghost-cursor-math.mjs';

test('lerp interpolates linearly between two values', () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('lerp on equal endpoints returns that value regardless of t', () => {
  assert.equal(lerp(7, 7, 0.3), 7);
});

test('computeFadeOpacity stays at full opacity until the fade delay elapses', () => {
  assert.equal(computeFadeOpacity(0, 1000, 1500), 1);
  assert.equal(computeFadeOpacity(999, 1000, 1500), 1);
  assert.equal(computeFadeOpacity(1000, 1000, 1500), 1);
});

test('computeFadeOpacity fades linearly across the fade duration', () => {
  assert.equal(computeFadeOpacity(1000 + 750, 1000, 1500), 0.5);
});

test('computeFadeOpacity reaches 0 once the fade duration has fully elapsed', () => {
  assert.equal(computeFadeOpacity(1000 + 1500, 1000, 1500), 0);
  assert.equal(computeFadeOpacity(1000 + 5000, 1000, 1500), 0);
});
