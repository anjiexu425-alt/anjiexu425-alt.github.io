import { computeRingPositions, computeOrbitDashArray } from './circle-nav-math.mjs';

const RING_ITEMS = [
  { label: 'About', href: 'about.html' },
  { label: 'Experience', href: 'experience.html' },
  { label: 'Study Diary', href: 'study-diary.html' },
  { label: 'Share Life', href: 'share-life.html' },
  { label: 'Toolkit', href: 'toolkit.html' },
  { label: 'Contact', href: 'contact.html' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function renderOrbit(spin, radius) {
  const size = radius * 2;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'circle-nav__orbit');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', String(radius));
  circle.setAttribute('cy', String(radius));
  circle.setAttribute('r', String(radius));

  const dashArray = computeOrbitDashArray(RING_ITEMS.map((item) => item.label), radius);
  circle.setAttribute('stroke-dasharray', dashArray.join(' '));

  svg.appendChild(circle);
  spin.appendChild(svg);
}

function renderRing(spin, radius) {
  const ring = document.createElement('div');
  ring.className = 'circle-nav__ring';

  const positions = computeRingPositions(RING_ITEMS.map((item) => item.label), radius);

  positions.forEach((pos, i) => {
    const item = RING_ITEMS[i];
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'circle-nav__item';
    link.textContent = item.label;
    link.setAttribute('aria-label', `Go to ${item.label}`);
    link.style.transform =
      `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotateDeg}deg)`;
    ring.appendChild(link);
  });

  spin.appendChild(ring);
}

function renderCircleNav() {
  const spin = document.querySelector('.circle-nav__spin');
  if (!spin) return;

  const radius = Number(spin.dataset.radius || 160);
  renderOrbit(spin, radius);
  renderRing(spin, radius);
}

document.addEventListener('DOMContentLoaded', renderCircleNav);
