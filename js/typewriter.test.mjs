import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charactersVisibleAt } from './typewriter.mjs';

test('no characters are visible before any time has elapsed', () => {
  assert.equal(charactersVisibleAt(0, 50, 10), 0);
});

test('one character becomes visible per typingSpeedMsPerChar elapsed', () => {
  assert.equal(charactersVisibleAt(150, 50, 10), 3);
  assert.equal(charactersVisibleAt(174, 50, 10), 3); // not yet at the 4th character's threshold
  assert.equal(charactersVisibleAt(200, 50, 10), 4);
});

test('clamps at the full text length once fully typed', () => {
  assert.equal(charactersVisibleAt(10000, 50, 10), 10);
});

test('a typingSpeedMsPerChar of 0 reveals the whole line immediately', () => {
  assert.equal(charactersVisibleAt(0, 0, 10), 10);
});
