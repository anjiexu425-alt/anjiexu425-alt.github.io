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
