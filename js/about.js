import { charactersVisibleAt, visibleTextLength, revealHtml } from './typewriter.mjs';

const TYPING_SPEED_MS_PER_CHAR = 20; // faster than the Home hero's 55ms/char — these are full paragraphs, not a short headline
const PAUSE_BETWEEN_PARAGRAPHS_MS = 450;
const CURSOR_CHARACTER = '_';

function renderBioTypewriter() {
  const paragraphs = Array.from(document.querySelectorAll('.about__content > p'));
  if (paragraphs.length === 0) return;

  const items = paragraphs.map((el) => {
    const html = el.innerHTML;
    return { el, html, length: visibleTextLength(html) };
  });

  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.textContent = CURSOR_CHARACTER;
  cursor.setAttribute('aria-hidden', 'true');

  items.forEach((item) => {
    item.el.innerHTML = '';
  });
  items[0].el.appendChild(cursor);

  let index = 0;
  let startMs = null;
  let pauseUntilMs = null;

  function tick(timestampMs) {
    if (startMs === null) startMs = timestampMs;

    if (pauseUntilMs !== null) {
      if (timestampMs >= pauseUntilMs) {
        pauseUntilMs = null;
        index += 1;
        startMs = timestampMs;
        if (index < items.length) items[index].el.appendChild(cursor);
      }
      if (index < items.length) requestAnimationFrame(tick);
      return;
    }

    const current = items[index];
    const elapsed = timestampMs - startMs;
    const visibleCount = charactersVisibleAt(elapsed, TYPING_SPEED_MS_PER_CHAR, current.length);
    current.el.innerHTML = revealHtml(current.html, visibleCount);
    current.el.appendChild(cursor);

    if (visibleCount >= current.length) {
      if (index === items.length - 1) {
        return; // last paragraph finished — cursor stays put, still blinking via CSS
      }
      pauseUntilMs = timestampMs + PAUSE_BETWEEN_PARAGRAPHS_MS;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', renderBioTypewriter);
