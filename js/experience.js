import { createExperienceState, toggleFlip, computeScatterOffsets, computeArcTimelinePositions } from './experience-state.mjs';

const CARDS = [
  {
    org: 'Lanzhou University',
    role: 'Bachelor · Public Administration',
    period: '2018',
    detail: '[Text placeholder: describe coursework, honors, and a standout project from this degree.]',
  },
  {
    org: 'Tongji University',
    role: "Master's · International Relations",
    period: '2022',
    detail: '[Text placeholder: describe your thesis focus and the coursework that shaped it.]',
  },
  {
    org: 'AI Product Team',
    role: 'Product Intern',
    period: '2024',
    detail: '[Text placeholder: describe your responsibilities and one concrete outcome.]',
  },
  {
    org: 'Content Strategy Team',
    role: 'Content Strategy Intern',
    period: '2023',
    detail: '[Text placeholder: describe the campaigns or content you shaped.]',
  },
];

let state = createExperienceState(CARDS.length);

function render() {
  const offsets = computeScatterOffsets(state.cardCount);

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    const isFlipped = i === state.flippedIndex;
    const scale = isFlipped ? 1.06 : 1;
    card.style.transform = `translate(-50%, -50%) translate(${offset.translateX}px, ${offset.translateY}px) rotate(${offset.rotateDeg}deg) scale(${scale})`;
    card.style.zIndex = String(isFlipped ? 999 : offset.zIndex);
    card.classList.toggle('is-flipped', isFlipped);
  });

  document.querySelectorAll('.experience-timeline__tick').forEach((tick, i) => {
    tick.classList.toggle('is-active', i === state.flippedIndex);
  });
}

function handleSelect(index) {
  state = toggleFlip(state, index);
  render();
}

function buildFan() {
  const fan = document.querySelector('.experience-fan');
  const timeline = document.querySelector('.experience-timeline');
  if (!fan || !timeline) return;

  CARDS.forEach((card, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'polaroid';
    el.setAttribute('aria-label', `${card.org}, ${card.role}, ${card.period}. Click to flip and read more.`);
    el.innerHTML = `
      <span class="polaroid__face polaroid__face--front">
        <span class="placeholder-img" style="min-height:220px;">[Photo placeholder: ${card.org}]</span>
        <span class="polaroid__caption"><strong>${card.org}</strong> · ${card.period}</span>
      </span>
      <span class="polaroid__face polaroid__face--back">
        <strong>${card.org}</strong><br />
        ${card.role}, ${card.period}<br /><br />
        ${card.detail}
      </span>
    `;
    el.addEventListener('click', () => handleSelect(i));
    fan.appendChild(el);
  });

  const radius = Number(timeline.dataset.radius || 130);
  const positions = computeArcTimelinePositions(CARDS.length, radius);

  CARDS.forEach((card, i) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'experience-timeline__tick';
    tick.textContent = card.period;
    tick.setAttribute('aria-label', `Select ${card.org}, ${card.period}`);
    tick.style.left = `${positions[i].x}px`;
    tick.style.top = `${positions[i].y}px`;
    tick.addEventListener('click', () => handleSelect(i));
    timeline.appendChild(tick);
  });

  render();
}

document.addEventListener('DOMContentLoaded', buildFan);
