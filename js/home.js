import {
  computeLabelAngles,
  resolveArcPlacement,
  bufferDegForArcLength,
  computeOrbitDashArray,
} from './circle-nav-math.mjs';
import { charactersVisibleAt } from './typewriter.mjs';

const TYPEWRITER_LINES = [
  { text: 'Hello,', selector: '.hero__line--1' },
  { text: "I'm Anjie, endlessly curious about bringing ideas to life with AI.", selector: '.hero__line--2' },
  { text: 'Nothing starts perfectly. Everything starts somewhere.', selector: '.hero__line--3' },
];
const TYPING_SPEED_MS_PER_CHAR = 55;
const PAUSE_BETWEEN_LINES_MS = 450;
const CURSOR_CHARACTER = '_';

const RING_ITEMS = [
  { label: 'About', href: 'about.html' },
  { label: 'Experience', href: 'experience.html' },
  { label: 'Study Diary', href: 'study-diary.html' },
  { label: 'Share Life', href: 'share-life.html' },
  { label: 'Toolkit', href: 'toolkit.html' },
  { label: 'Contact', href: 'contact.html' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const GAP_PADDING_PX = 14;
const BUFFER_SAFETY_MARGIN_PX = 20; // extra room beyond the longest label's measured half-width
const TOP_PATH_ID = 'circle-nav-path-top';
const BOTTOM_PATH_ID = 'circle-nav-path-bottom';
const DEGREES_PER_SECOND = 360 / 70; // one revolution per 70s, matching the site's slow/breathing motion pace
const MIN_UPDATE_INTERVAL_MS = 80; // ~12fps is plenty smooth for a 70s revolution; avoids needless work at 60fps

function pointOnCircle(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius + radius * Math.cos(rad), y: radius + radius * Math.sin(rad) };
}

// Each path extends bufferDeg past its nominal 180/0deg boundary on both
// ends (see the comment on resolveArcPlacement in circle-nav-math.mjs) —
// large-arc-flag is 1 because the buffered span exceeds 180deg.
function topPathD(radius, bufferDeg) {
  const start = pointOnCircle(radius, 180 - bufferDeg);
  const end = pointOnCircle(radius, 360 + bufferDeg);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;
}

function bottomPathD(radius, bufferDeg) {
  const start = pointOnCircle(radius, 180 + bufferDeg);
  const end = pointOnCircle(radius, 0 - bufferDeg);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 0 ${end.x} ${end.y}`;
}

function renderCircleNav() {
  const spin = document.querySelector('.circle-nav__spin');
  if (!spin) return;

  const radius = Number(spin.dataset.radius || 160);
  const size = radius * 2;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'circle-nav__orbit');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const defs = document.createElementNS(SVG_NS, 'defs');
  const topPath = document.createElementNS(SVG_NS, 'path');
  topPath.setAttribute('id', TOP_PATH_ID);
  const bottomPath = document.createElementNS(SVG_NS, 'path');
  bottomPath.setAttribute('id', BOTTOM_PATH_ID);
  // Placeholder (unbuffered) geometry, just so a valid path exists for the
  // text measurement pass below — replaced with the real, buffered
  // geometry once the longest label's rendered width is known.
  topPath.setAttribute('d', topPathD(radius, 0));
  bottomPath.setAttribute('d', bottomPathD(radius, 0));
  defs.appendChild(topPath);
  defs.appendChild(bottomPath);
  svg.appendChild(defs);

  const orbitLine = document.createElementNS(SVG_NS, 'circle');
  orbitLine.setAttribute('class', 'circle-nav__orbit-line');
  orbitLine.setAttribute('cx', String(radius));
  orbitLine.setAttribute('cy', String(radius));
  orbitLine.setAttribute('r', String(radius));
  svg.appendChild(orbitLine);

  spin.appendChild(svg);

  const baseAngles = computeLabelAngles(RING_ITEMS.length);

  const items = RING_ITEMS.map((item, i) => {
    const link = document.createElementNS(SVG_NS, 'a');
    link.setAttributeNS(XLINK_NS, 'xlink:href', item.href);
    link.setAttribute('href', item.href);
    link.setAttribute('class', 'circle-nav__item');
    link.setAttribute('aria-label', `Go to ${item.label}`);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('text-anchor', 'middle');

    const textPath = document.createElementNS(SVG_NS, 'textPath');
    textPath.setAttributeNS(XLINK_NS, 'xlink:href', `#${TOP_PATH_ID}`);
    textPath.setAttribute('href', `#${TOP_PATH_ID}`);
    textPath.textContent = item.label;

    text.appendChild(textPath);
    link.appendChild(text);
    svg.appendChild(link);

    // Real, rendered-font width — depends on whatever font actually loaded
    // in this environment, so this can't be estimated ahead of time.
    const renderedLength = textPath.getComputedTextLength();

    return { baseAngle: baseAngles[i], textPath, renderedLength };
  });

  // Give every label's anchor enough path room for the longest label's
  // half-width, wherever it lands on the ring (see resolveArcPlacement's
  // doc comment for why this can't be a hardcoded guess).
  const maxRenderedLength = Math.max(...items.map((item) => item.renderedLength));
  const bufferDeg = bufferDegForArcLength(maxRenderedLength / 2 + BUFFER_SAFETY_MARGIN_PX, radius);
  topPath.setAttribute('d', topPathD(radius, bufferDeg));
  bottomPath.setAttribute('d', bottomPathD(radius, bufferDeg));

  let lastUpdate = 0;

  function update(timestampMs) {
    if (timestampMs - lastUpdate >= MIN_UPDATE_INTERVAL_MS) {
      lastUpdate = timestampMs;
      const rotation = (timestampMs / 1000) * DEGREES_PER_SECOND;

      const dashItems = items.map(({ baseAngle, textPath, renderedLength }) => {
        const angleDeg = baseAngle + rotation;
        const placement = resolveArcPlacement(angleDeg, radius, bufferDeg);
        const pathId = placement.path === 'top' ? TOP_PATH_ID : BOTTOM_PATH_ID;

        if (textPath.getAttribute('href') !== `#${pathId}`) {
          textPath.setAttribute('href', `#${pathId}`);
          textPath.setAttributeNS(XLINK_NS, 'xlink:href', `#${pathId}`);
        }
        textPath.setAttribute('startOffset', String(placement.offset));

        return { angleDeg, gapWidth: renderedLength + GAP_PADDING_PX };
      });

      const dashArray = computeOrbitDashArray(dashItems, radius);
      orbitLine.setAttribute('stroke-dasharray', dashArray.join(' '));
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function renderTypewriter() {
  const lines = TYPEWRITER_LINES.map((line) => {
    const el = document.querySelector(line.selector);
    return el ? { text: line.text, el } : null;
  }).filter(Boolean);
  if (lines.length === 0) return;

  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.textContent = CURSOR_CHARACTER;
  cursor.setAttribute('aria-hidden', 'true');

  lines.forEach((line) => {
    line.el.textContent = '';
  });
  lines[0].el.appendChild(cursor);

  let lineIndex = 0;
  let lineStartMs = null;
  let pauseUntilMs = null;

  function tick(timestampMs) {
    if (lineStartMs === null) lineStartMs = timestampMs;

    if (pauseUntilMs !== null) {
      if (timestampMs >= pauseUntilMs) {
        pauseUntilMs = null;
        lineIndex += 1;
        lineStartMs = timestampMs;
        if (lineIndex < lines.length) {
          lines[lineIndex].el.appendChild(cursor);
        }
      }
      if (lineIndex < lines.length) requestAnimationFrame(tick);
      return;
    }

    const current = lines[lineIndex];
    const elapsed = timestampMs - lineStartMs;
    const visibleCount = charactersVisibleAt(elapsed, TYPING_SPEED_MS_PER_CHAR, current.text.length);
    current.el.textContent = current.text.slice(0, visibleCount);
    current.el.appendChild(cursor);

    if (visibleCount >= current.text.length) {
      if (lineIndex === lines.length - 1) {
        return; // last line finished — cursor stays put, still blinking via CSS
      }
      pauseUntilMs = timestampMs + PAUSE_BETWEEN_LINES_MS;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', () => {
  renderCircleNav();
  renderTypewriter();
});
