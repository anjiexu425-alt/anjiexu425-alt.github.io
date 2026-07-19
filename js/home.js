import { computeLabelAngles, arcLengthAtAngle, computeOrbitDashArray } from './circle-nav-math.mjs';

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
const PATH_ID = 'circle-nav-path';

function buildCirclePathD(radius) {
  const cx = radius;
  const cy = radius;
  return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
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
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('id', PATH_ID);
  path.setAttribute('d', buildCirclePathD(radius));
  defs.appendChild(path);
  svg.appendChild(defs);

  const orbitLine = document.createElementNS(SVG_NS, 'circle');
  orbitLine.setAttribute('class', 'circle-nav__orbit-line');
  orbitLine.setAttribute('cx', String(radius));
  orbitLine.setAttribute('cy', String(radius));
  orbitLine.setAttribute('r', String(radius));
  svg.appendChild(orbitLine);

  // Attach before measuring: getComputedTextLength() needs live layout.
  spin.appendChild(svg);

  const angles = computeLabelAngles(RING_ITEMS.length);
  const gapItems = [];

  RING_ITEMS.forEach((item, i) => {
    const angleDeg = angles[i];

    const link = document.createElementNS(SVG_NS, 'a');
    link.setAttributeNS(XLINK_NS, 'xlink:href', item.href);
    link.setAttribute('href', item.href);
    link.setAttribute('class', 'circle-nav__item');
    link.setAttribute('aria-label', `Go to ${item.label}`);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('text-anchor', 'middle');

    const textPath = document.createElementNS(SVG_NS, 'textPath');
    textPath.setAttributeNS(XLINK_NS, 'xlink:href', `#${PATH_ID}`);
    textPath.setAttribute('href', `#${PATH_ID}`);
    textPath.setAttribute('startOffset', String(arcLengthAtAngle(angleDeg, radius)));
    textPath.textContent = item.label;

    text.appendChild(textPath);
    link.appendChild(text);
    svg.appendChild(link);

    const gapWidth = textPath.getComputedTextLength() + GAP_PADDING_PX;
    gapItems.push({ angleDeg, gapWidth });
  });

  const dashArray = computeOrbitDashArray(gapItems, radius);
  orbitLine.setAttribute('stroke-dasharray', dashArray.join(' '));
}

document.addEventListener('DOMContentLoaded', renderCircleNav);
