import { createExperienceState, selectCard, computeFanOffsets } from './experience-state.mjs';

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

let state = createExperienceState(CARDS.length, 0);

function render() {
  const offsets = computeFanOffsets(state.cardCount, state.activeIndex);

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    const scale = offset.isActive ? 1.08 : 0.94;
    card.style.transform = `translateX(${offset.translateX}px) rotate(${offset.rotateDeg}deg) scale(${scale})`;
    card.style.zIndex = String(offset.zIndex);
    card.classList.toggle('is-active', offset.isActive);
    card.classList.toggle('is-flipped', offset.isActive && state.flipped);
  });

  document.querySelectorAll('.experience-timeline__tick').forEach((tick, i) => {
    tick.classList.toggle('is-active', i === state.activeIndex);
  });
}

function handleSelect(index) {
  state = selectCard(state, index);
  render();
}

function buildFan() {
  const fan = document.querySelector('.experience-fan');
  const track = document.querySelector('.experience-timeline__track');
  if (!fan || !track) return;

  CARDS.forEach((card, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'polaroid';
    el.setAttribute('aria-label', `${card.org}, ${card.role}, ${card.period}. Click to select, click again to flip.`);
    el.innerHTML = `
      <span class="polaroid__face polaroid__face--front">
        <span class="placeholder-img" style="min-height:160px;">[Photo placeholder: ${card.org}]</span>
        <span class="polaroid__caption">
          <strong>${card.org}</strong>
          <span>${card.role}</span>
          <span>${card.period}</span>
        </span>
      </span>
      <span class="polaroid__face polaroid__face--back">${card.detail}</span>
    `;
    el.addEventListener('click', () => handleSelect(i));
    fan.appendChild(el);

    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'experience-timeline__tick';
    tick.textContent = card.period;
    tick.setAttribute('aria-label', `Select ${card.org}, ${card.period}`);
    tick.addEventListener('click', () => handleSelect(i));
    track.appendChild(tick);
  });

  render();
}

document.addEventListener('DOMContentLoaded', buildFan);
