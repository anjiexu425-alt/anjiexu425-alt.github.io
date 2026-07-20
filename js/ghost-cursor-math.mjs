/**
 * Linear interpolation, used both for the trail's "inertia" follow (each
 * point chases the one ahead of it by this fraction per frame) and for
 * anything else that needs simple easing toward a target.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Trail opacity multiplier based on how long it's been since the mouse
 * last moved: full opacity until fadeDelayMs, then a linear fade to 0
 * over fadeDurationMs, then 0.
 */
export function computeFadeOpacity(msSinceLastMove, fadeDelayMs, fadeDurationMs) {
  if (msSinceLastMove <= fadeDelayMs) return 1;
  const fadeElapsed = msSinceLastMove - fadeDelayMs;
  if (fadeElapsed >= fadeDurationMs) return 0;
  return 1 - fadeElapsed / fadeDurationMs;
}
