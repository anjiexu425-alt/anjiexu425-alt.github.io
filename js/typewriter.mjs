/**
 * Given how long a line has been typing and how fast it types, returns how
 * many characters of the line should currently be visible. Pure so the
 * timing math can be verified without a DOM or a running animation loop.
 */
export function charactersVisibleAt(elapsedMs, typingSpeedMsPerChar, textLength) {
  if (typingSpeedMsPerChar <= 0) return textLength;
  const count = Math.floor(elapsedMs / typingSpeedMsPerChar);
  return Math.max(0, Math.min(textLength, count));
}

/**
 * Counts the visible (non-tag) characters in an HTML string, e.g. so a
 * paragraph containing an <a> link can be typed out at a speed based on
 * how much text a reader actually sees, not the markup byte length.
 */
export function visibleTextLength(html) {
  let count = 0;
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const closeIdx = html.indexOf('>', i);
      if (closeIdx === -1) break;
      i = closeIdx + 1;
    } else {
      count += 1;
      i += 1;
    }
  }
  return count;
}

/**
 * Returns the prefix of an HTML string with exactly `visibleCharCount`
 * visible characters revealed. Tags are copied through atomically (never
 * revealed one character at a time, which would render broken markup like
 * "<a hr") the moment the reveal cursor reaches them, so a link's <a> tag
 * appears whole right before its text starts typing. Any tag left open at
 * the cut point (e.g. reveal stops mid-link-text) is intentionally left
 * unclosed in the returned string — assigning that to `.innerHTML` lets
 * the browser's HTML parser auto-close it, which is the standard, safe way
 * to render a truncated HTML fragment.
 */
export function revealHtml(html, visibleCharCount) {
  let output = '';
  let visibleSoFar = 0;
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      // Tags are always copied through in full, regardless of the visible
      // budget — a tag sitting right at the reveal cursor (e.g. the <a>
      // opening a link whose text hasn't started typing yet) should appear
      // immediately, not wait for its first character.
      const closeIdx = html.indexOf('>', i);
      if (closeIdx === -1) break;
      output += html.slice(i, closeIdx + 1);
      i = closeIdx + 1;
    } else {
      if (visibleSoFar >= visibleCharCount) break;
      output += html[i];
      visibleSoFar += 1;
      i += 1;
    }
  }
  return output;
}
