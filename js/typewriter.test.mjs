import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charactersVisibleAt, visibleTextLength, revealHtml } from './typewriter.mjs';

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

test('visibleTextLength counts only text, not markup', () => {
  assert.equal(visibleTextLength('plain text'), 10);
  assert.equal(visibleTextLength('a <a href="x">link</a> b'), 8); // "a " + "link" + " b" = 2+4+2
});

test('revealHtml reveals plain text one character at a time', () => {
  assert.equal(revealHtml('hello', 0), '');
  assert.equal(revealHtml('hello', 3), 'hel');
  assert.equal(revealHtml('hello', 100), 'hello');
});

test('revealHtml copies a tag through whole the moment the cursor reaches it', () => {
  const html = 'See <a href="https://example.com">the site</a> now.';
  // "See " (4 visible chars) is fully revealed; the <a> tag should appear
  // immediately, atomically, even though none of its text is visible yet.
  const result = revealHtml(html, 4);
  assert.equal(result, 'See <a href="https://example.com">');
});

test('revealHtml leaves a tag unclosed at the cut point (browser auto-closes it)', () => {
  const html = 'See <a href="https://example.com">the site</a> now.';
  // "See " (4) + "the" (3) = 7 visible chars in
  const result = revealHtml(html, 7);
  assert.equal(result, 'See <a href="https://example.com">the');
});

test('revealHtml at full length reproduces the original HTML exactly', () => {
  const html = 'See <a href="https://example.com">the site</a> now.';
  assert.equal(revealHtml(html, visibleTextLength(html)), html);
});
