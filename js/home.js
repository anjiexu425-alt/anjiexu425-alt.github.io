import {
  computeLabelAngles,
  arcLengthAtAngle,
  resolveArcPlacement,
  computeOrbitDashArray,
} from './circle-nav-math.mjs';

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
const TOP_PATH_ID = 'circle-nav-path-top';
const BOTTOM_PATH_ID = 'circle-nav-path-bottom';
const DEGREES_PER_SECOND = 360 / 70; // one revolution per 70s, matching the site's slow/breathing motion pace
const MIN_UPDATE_INTERVAL_MS = 80; // ~12fps is plenty smooth for a 70s revolution; avoids needless work at 60fps

function topPathD(radius) {
  return `M 0 ${radius} A ${radius} ${radius} 0 0 1 ${radius * 2} ${radius}`;
}

function bottomPathD(radius) {
  return `M 0 ${radius} A ${radius} ${radius} 0 0 0 ${radius * 2} ${radius}`;
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
  topPath.setAttribute('d', topPathD(radius));
  const bottomPath = document.createElementNS(SVG_NS, 'path');
  bottomPath.setAttribute('id', BOTTOM_PATH_ID);
  bottomPath.setAttribute('d', bottomPathD(radius));
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

    // Measured once: the label's own text is a fixed length; only its
    // position on the ring changes as the ring rotates.
    const gapWidth = textPath.getComputedTextLength() + GAP_PADDING_PX;

    return { baseAngle: baseAngles[i], textPath, gapWidth };
  });

  let lastUpdate = 0;

  function update(timestampMs) {
    if (timestampMs - lastUpdate >= MIN_UPDATE_INTERVAL_MS) {
      lastUpdate = timestampMs;
      const rotation = (timestampMs / 1000) * DEGREES_PER_SECOND;

      const dashItems = items.map(({ baseAngle, textPath, gapWidth }) => {
        const angleDeg = baseAngle + rotation;
        const placement = resolveArcPlacement(angleDeg, radius);
        const pathId = placement.path === 'top' ? TOP_PATH_ID : BOTTOM_PATH_ID;

        if (textPath.getAttribute('href') !== `#${pathId}`) {
          textPath.setAttribute('href', `#${pathId}`);
          textPath.setAttributeNS(XLINK_NS, 'xlink:href', `#${pathId}`);
        }
        textPath.setAttribute('startOffset', String(placement.offset));

        return { angleDeg, gapWidth };
      });

      const dashArray = computeOrbitDashArray(dashItems, radius);
      orbitLine.setAttribute('stroke-dasharray', dashArray.join(' '));
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

document.addEventListener('DOMContentLoaded', renderCircleNav);
