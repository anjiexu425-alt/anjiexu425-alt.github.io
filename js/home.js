import { computeRingPositions } from './circle-nav-math.mjs';

const RING_ITEMS = [
  { label: 'About', href: 'about.html' },
  { label: 'Experience', href: 'experience.html' },
  { label: 'Study Diary', href: 'study-diary.html' },
  { label: 'Share Life', href: 'share-life.html' },
  { label: 'Toolkit', href: 'toolkit.html' },
  { label: 'Contact', href: 'contact.html' },
];

function renderRing() {
  const ring = document.querySelector('.circle-nav__ring');
  if (!ring) return;

  const radius = Number(ring.dataset.radius || 160);
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
}

document.addEventListener('DOMContentLoaded', renderRing);
